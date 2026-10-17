/**
 * Доставка исходящих ответов оператора.
 *
 * Worker сначала атомарно забирает строки в `processing`, затем делает один
 * запрос Bot API. Неопределённый результат сразу становится `unknown`:
 * повтор такого запроса мог бы создать второе сообщение у клиента.
 */

import { all, run, transaction } from "./db.server";
import { telegramBotReplySchema, type TelegramBotReply } from "../lib/telegram-bot-message";
import {
  markTelegramOutboxResult,
  recordTelegramEvent,
  rescheduleTelegramOutbox,
  touchTelegramOutboxState,
  currentTelegramEnvironment,
  type TelegramEnvironment,
  type TelegramOutboxEntry,
} from "./telegram-data.server";
import {
  readTelegramBotToken,
  sendTelegramBotMessage,
  type TelegramApiAttemptResult,
} from "../lib/telegram.server";

export const TELEGRAM_OUTBOX_MAX_ATTEMPTS = 5;
export const TELEGRAM_OUTBOX_LOCK_TIMEOUT_MS = 2 * 60 * 1_000;
const RETRY_BACKOFF_MS = [1_000, 5_000, 15_000, 60_000] as const;
const DEFAULT_BATCH_SIZE = 10;

type OutboxWorkItem = TelegramOutboxEntry & { reply: TelegramBotReply | null; attempt: number };

export type TelegramOutboxWorkerSummary = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  unknown: number;
  blocked: number;
  deferred: number;
};

const activeWorkers = new Set<TelegramEnvironment>();
let outboxScheduleStarted = false;

function workerLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, string | number | null>,
): void {
  const line = JSON.stringify({ scope: "telegram.outbox", event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function retryDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs != null) return Math.min(Math.max(Math.trunc(retryAfterMs), 0), 120_000);
  return RETRY_BACKOFF_MS[Math.min(Math.max(attempt - 1, 0), RETRY_BACKOFF_MS.length - 1)];
}

function parseOutboxReply(payload: string): TelegramBotReply | null {
  try {
    const parsed = telegramBotReplySchema.safeParse(JSON.parse(payload));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function classifyEvent(result: TelegramApiAttemptResult): string {
  return result.kind === "sent" ? "" : result.code;
}

function configuredTestUserIds(): Set<string> {
  return new Set(
    (process.env.TELEGRAM_TEST_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^[1-9]\d*$/.test(value)),
  );
}

/**
 * Локальный worker никогда не читает production outbox. В test-очереди он
 * отправляет только в явно разрешённый private chat: chat ID и user ID
 * должны совпадать либо chat ID сам должен быть в test allowlist.
 */
function isOutboxEnvironmentAllowed(environment: TelegramEnvironment): boolean {
  const appEnvironment = currentTelegramEnvironment();
  return appEnvironment === "production"
    ? environment === "production" || environment === "test"
    : environment === "test";
}

function isTestRecipientAllowed(item: TelegramOutboxEntry): boolean {
  const testUserIds = configuredTestUserIds();
  if (testUserIds.size === 0) return false;
  const userId = item.recipient_telegram_user_id ?? item.recipient_chat_id;
  if (!testUserIds.has(userId)) return false;
  return (
    item.recipient_telegram_user_id == null ||
    item.recipient_telegram_user_id === item.recipient_chat_id
  );
}

function claimTelegramOutbox(
  environment: TelegramEnvironment,
  now: number,
  limit: number,
): OutboxWorkItem[] {
  // Процесс мог умереть уже после отправки запроса. Возвращать такие строки
  // в pending нельзя: Bot API не поддерживает idempotency key.
  const interrupted = all<{ id: number }>(
    `SELECT id FROM telegram_outbox WHERE environment = ? AND status = 'processing'
     AND (locked_at IS NULL OR locked_at <= ?)`,
    [environment, now - TELEGRAM_OUTBOX_LOCK_TIMEOUT_MS],
  );
  for (const row of interrupted) {
    markTelegramOutboxResult(environment, row.id, {
      status: "unknown",
      error: "worker_interrupted",
      sentAt: now,
    });
    recordTelegramEvent({
      environment,
      eventType: "outbox_unknown",
      payload: { outboxId: row.id, code: "worker_interrupted" },
      now,
    });
  }

  return transaction(() => {
    const candidates = all<TelegramOutboxEntry>(
      `SELECT * FROM telegram_outbox
       WHERE environment = ? AND status = 'pending' AND next_attempt_at <= ?
       ORDER BY id LIMIT ?`,
      [environment, now, limit],
    );
    const claimed: OutboxWorkItem[] = [];
    for (const row of candidates) {
      const result = run(
        `UPDATE telegram_outbox
         SET status = 'processing', locked_at = ?, last_attempt_at = ?, attempts = attempts + 1
         WHERE environment = ? AND id = ? AND status = 'pending'`,
        [now, now, environment, row.id],
      );
      if (result.changes !== 1) continue;
      claimed.push({
        ...row,
        status: "processing",
        locked_at: now,
        last_attempt_at: now,
        attempts: row.attempts + 1,
        attempt: row.attempts + 1,
        reply: parseOutboxReply(row.payload),
      });
    }
    return claimed;
  });
}

function eventPayload(item: OutboxWorkItem, code?: string): Record<string, unknown> {
  return {
    outboxId: item.id,
    attempt: item.attempt,
    ...(code ? { code } : {}),
  };
}

async function deliverOne(
  token: string,
  environment: TelegramEnvironment,
  item: OutboxWorkItem,
  now: number,
): Promise<"sent" | "retry" | "failed" | "unknown" | "blocked"> {
  if (!isOutboxEnvironmentAllowed(environment)) {
    markTelegramOutboxResult(environment, item.id, {
      status: "failed",
      error: "environment_blocked",
      sentAt: now,
    });
    recordTelegramEvent({
      environment,
      eventType: "outbox_blocked",
      payload: eventPayload(item, "environment_blocked"),
      now,
    });
    workerLog("error", "blocked", {
      environment,
      outboxId: item.id,
      attempt: item.attempt,
      code: "environment_blocked",
    });
    return "blocked";
  }

  if (environment === "test" && !isTestRecipientAllowed(item)) {
    markTelegramOutboxResult(environment, item.id, {
      status: "failed",
      error: "test_recipient_not_allowed",
      sentAt: now,
    });
    recordTelegramEvent({
      environment,
      eventType: "outbox_blocked",
      payload: eventPayload(item, "test_recipient_not_allowed"),
      now,
    });
    workerLog("error", "blocked", {
      environment,
      outboxId: item.id,
      attempt: item.attempt,
      code: "test_recipient_not_allowed",
    });
    return "blocked";
  }

  if (item.expires_at != null && item.expires_at <= now) {
    markTelegramOutboxResult(environment, item.id, {
      status: "failed",
      error: "expired",
      sentAt: now,
    });
    recordTelegramEvent({
      environment,
      eventType: "outbox_expired",
      payload: eventPayload(item, "expired"),
      now,
    });
    workerLog("warn", "expired", {
      environment,
      outboxId: item.id,
      attempt: item.attempt,
      code: "expired",
    });
    return "failed";
  }

  if (!item.reply) {
    markTelegramOutboxResult(environment, item.id, {
      status: "failed",
      error: "invalid_payload",
      sentAt: now,
    });
    recordTelegramEvent({
      environment,
      eventType: "outbox_failed",
      payload: eventPayload(item, "invalid_payload"),
      now,
    });
    workerLog("error", "failed", {
      environment,
      outboxId: item.id,
      attempt: item.attempt,
      code: "invalid_payload",
    });
    return "failed";
  }

  const result = await sendTelegramBotMessage(
    { token },
    {
      chatId: item.recipient_chat_id,
      ...item.reply,
    },
  );
  const code = classifyEvent(result);
  touchTelegramOutboxState({ environment, now });

  if (result.kind === "sent") {
    markTelegramOutboxResult(environment, item.id, {
      status: "sent",
      sentAt: now,
      telegramMessageId: result.messageId,
    });
    recordTelegramEvent({
      environment,
      eventType: "outbox_sent",
      payload: eventPayload(item),
      now,
    });
    workerLog("info", "sent", {
      environment,
      outboxId: item.id,
      attempt: item.attempt,
      code: null,
    });
    return "sent";
  }

  if (result.kind === "failed") {
    markTelegramOutboxResult(environment, item.id, { status: "failed", error: code, sentAt: now });
    recordTelegramEvent({
      environment,
      eventType: "outbox_failed",
      payload: eventPayload(item, code),
      now,
    });
    workerLog("error", "failed", { environment, outboxId: item.id, attempt: item.attempt, code });
    return "failed";
  }

  if (result.kind === "retryable" && item.attempt < TELEGRAM_OUTBOX_MAX_ATTEMPTS) {
    const nextAttemptAt = now + retryDelay(item.attempt, result.retryAfterMs);
    rescheduleTelegramOutbox(environment, item.id, nextAttemptAt, code);
    recordTelegramEvent({
      environment,
      eventType: "outbox_retry",
      payload: { ...eventPayload(item, code), nextAttemptAt },
      now,
    });
    workerLog("warn", "retry", {
      environment,
      outboxId: item.id,
      attempt: item.attempt,
      code,
      nextAttemptAt,
    });
    return "retry";
  }

  const terminalStatus = result.kind === "unknown" ? "unknown" : "failed";
  markTelegramOutboxResult(environment, item.id, {
    status: terminalStatus,
    error: code,
    sentAt: now,
  });
  recordTelegramEvent({
    environment,
    eventType: `outbox_${terminalStatus}`,
    payload: eventPayload(item, code),
    now,
  });
  workerLog("error", terminalStatus, {
    environment,
    outboxId: item.id,
    attempt: item.attempt,
    code,
  });
  return terminalStatus;
}

/** Обрабатывает одну ограниченную пачку; повторный запуск безопасен. */
export async function runTelegramOutboxWorker(
  environment: TelegramEnvironment,
  options: { now?: number; limit?: number } = {},
): Promise<TelegramOutboxWorkerSummary> {
  if (activeWorkers.has(environment)) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0, unknown: 0, blocked: 0, deferred: 0 };
  }

  const token = readTelegramBotToken();
  const now = options.now ?? Date.now();
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_BATCH_SIZE), 1), 100);
  if (!token || !isOutboxEnvironmentAllowed(environment)) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0, unknown: 0, blocked: 0, deferred: 0 };
  }

  activeWorkers.add(environment);
  try {
    const claimed = claimTelegramOutbox(environment, now, limit);
    if (claimed.length > 0) touchTelegramOutboxState({ environment, now });
    const summary: TelegramOutboxWorkerSummary = {
      claimed: claimed.length,
      sent: 0,
      retried: 0,
      failed: 0,
      unknown: 0,
      blocked: 0,
      deferred: 0,
    };
    for (const item of claimed) {
      const outcome = await deliverOne(token, environment, item, now);
      const key = outcome === "retry" ? "retried" : outcome;
      summary[key]++;
    }
    return summary;
  } finally {
    activeWorkers.delete(environment);
  }
}

/** Планировщик вызывается один раз из server entry. */
export function scheduleTelegramOutboxWorker(): void {
  if (typeof process === "undefined" || !process.versions?.node) return;
  if (outboxScheduleStarted) return;
  outboxScheduleStarted = true;
  const tick = () => {
    if (!readTelegramBotToken()) return;
    const environments: TelegramEnvironment[] =
      process.env.APP_ENV?.trim().toLowerCase() === "production"
        ? ["production", "test"]
        : ["test"];
    for (const environment of environments) {
      void runTelegramOutboxWorker(environment).catch((error) => {
        workerLog("error", "worker_error", {
          environment,
          outboxId: null,
          attempt: 0,
          code: error instanceof Error ? "worker_exception" : "worker_error",
        });
      });
    }
  };
  tick();
  setInterval(tick, 5_000).unref();
}
