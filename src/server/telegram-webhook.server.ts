/**
 * Единственный приёмник общего бота: authenticate -> parse -> route -> persist.
 * Inbox — подготовленная входящая очередь для бизнес-обработчика этапа 5.
 * На этом этапе нет автоматического создания lead/диалога или пересылки текста оператора.
 */
import { timingSafeEqual } from "node:crypto";

import { all, run, transaction } from "./db.server";
import {
  currentTelegramEnvironment,
  touchTelegramWebhookReceived,
  type TelegramEnvironment,
} from "./telegram-data.server";
import { parseTelegramInbound, type TelegramInbound } from "./telegram-inbound.server";
import { reserveTelegramCallback, validateTelegramCallback } from "./telegram-callback.server";

export const TELEGRAM_WEBHOOK_MAX_UPDATE_BYTES = 256_000;
const SECRET_HEADER = "x-telegram-bot-api-secret-token";

export type TelegramWebhookResult =
  | {
      ok: true;
      duplicate: boolean;
      ignored?: string;
      callbackQueryId?: string;
      callbackRejected?: boolean;
    }
  | { ok: false; status: 400 | 403 | 413 | 503; error: string };

export function authenticateTelegramWebhook(
  request: Request,
): { status: 403 | 503; error: string } | null {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return { status: 503, error: "webhook_not_configured" };
  }
  const header = request.headers.get(SECRET_HEADER) ?? "";
  const actual = Buffer.from(header);
  const expected = Buffer.from(secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { status: 403, error: "forbidden" };
  }
  return null;
}

function configuredIds(key: "TELEGRAM_OPERATOR_IDS" | "TELEGRAM_TEST_USER_IDS"): Set<string> {
  return new Set(
    (process.env[key] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^[1-9]\d*$/.test(value)),
  );
}

function routeInbound(inbound: TelegramInbound): {
  environment: TelegramEnvironment;
  appEnvironment: TelegramEnvironment;
  isOperator: boolean;
} | null {
  const appEnvironment = currentTelegramEnvironment();
  const isOperator =
    configuredIds("TELEGRAM_OPERATOR_IDS").has(inbound.userId) &&
    process.env.TELEGRAM_OPERATOR_CHAT_ID?.trim() === inbound.chatId;
  const isTestUser = configuredIds("TELEGRAM_TEST_USER_IDS").has(inbound.userId);
  // Локальный приёмник не сохраняет чужой рабочий трафик общего бота.
  if (appEnvironment !== "production" && !isTestUser && !isOperator) return null;
  const environment = appEnvironment === "production" && !isTestUser ? "production" : "test";
  return { environment, appEnvironment, isOperator };
}

export function acceptTelegramWebhookUpdate(
  request: Request,
  rawBody: string,
  now = Date.now(),
): TelegramWebhookResult {
  const authError = authenticateTelegramWebhook(request);
  if (authError) return { ok: false, ...authError };
  if (Buffer.byteLength(rawBody) > TELEGRAM_WEBHOOK_MAX_UPDATE_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("not_object");
    payload = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "bad_json" };
  }
  const parsed = parseTelegramInbound(payload);
  if (!parsed.ok)
    return "ignored" in parsed ? { ok: true, duplicate: false, ignored: parsed.ignored } : parsed;
  const inbound = parsed.inbound;
  const route = routeInbound(inbound);
  if (!route) return { ok: true, duplicate: false, ignored: "working_traffic_disabled" };
  const operatorCommand = /^\/admin(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(inbound.text);
  if (operatorCommand && !route.isOperator)
    return { ok: true, duplicate: false, ignored: "operator_required" };

  try {
    return transaction(() => {
      const inserted = run(
        `INSERT INTO telegram_update (update_id, environment, payload, received_at)
         VALUES (?, ?, ?, ?) ON CONFLICT(update_id) DO NOTHING`,
        [inbound.updateId, route.environment, rawBody, now],
      );
      if (inserted.changes === 0)
        return { ok: true, duplicate: true, callbackQueryId: inbound.callbackQueryId };

      let environment = route.environment;
      let action: ReturnType<typeof validateTelegramCallback> = null;
      if (inbound.kind === "callback") {
        action = validateTelegramCallback({
          data: inbound.callbackData!,
          userId: inbound.userId,
          chatId: inbound.chatId,
          isOperator: route.isOperator,
          environment,
          appEnvironment: route.appEnvironment,
          now,
        });
        if (!action) {
          run(
            "UPDATE telegram_update SET status = 'processed', attempts = 1, processed_at = ?, last_error = 'callback_rejected' WHERE update_id = ?",
            [now, inbound.updateId],
          );
          touchTelegramWebhookReceived(environment, now);
          return {
            ok: true,
            duplicate: false,
            ignored: "callback_rejected",
            callbackQueryId: inbound.callbackQueryId,
            callbackRejected: true,
          };
        }
        environment = action.environment;
        reserveTelegramCallback(action, inbound.updateId);
      }
      const normalized = { ...inbound, callbackData: undefined, action: action ?? undefined };
      run(
        `INSERT INTO telegram_inbox
         (environment, update_id, sender_telegram_user_id, chat_id, actor_role, kind, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          environment,
          inbound.updateId,
          inbound.userId,
          inbound.chatId,
          action?.role ?? (route.isOperator ? "operator" : "client"),
          inbound.kind,
          JSON.stringify(normalized),
          now,
        ],
      );
      run(
        "UPDATE telegram_update SET environment = ?, status = 'processed', attempts = 1, processed_at = ? WHERE update_id = ?",
        [environment, now, inbound.updateId],
      );
      touchTelegramWebhookReceived(environment, now);
      return { ok: true, duplicate: false, callbackQueryId: inbound.callbackQueryId };
    });
  } catch {
    // Telegram повторит 503; транзакция не оставляет частично принятую запись.
    return { ok: false, status: 503, error: "inbox_unavailable" };
  }
}

export type TelegramInboxEntry = {
  id: number;
  environment: TelegramEnvironment;
  update_id: number;
  sender_telegram_user_id: string;
  chat_id: string;
  actor_role: "client" | "operator";
  kind: TelegramInbound["kind"];
  payload: string;
  status: "pending" | "processing" | "processed" | "failed";
  created_at: number;
  processed_at: number | null;
};

/** Только production-приёмник читает рабочую очередь; локально доступна test. */
export function listPendingTelegramInbound(
  environment: TelegramEnvironment,
  limit = 50,
): TelegramInboxEntry[] {
  if (
    environment !== "test" &&
    !(environment === "production" && currentTelegramEnvironment() === "production")
  ) {
    throw new Error("inbox_environment_forbidden");
  }
  return all<TelegramInboxEntry>(
    "SELECT * FROM telegram_inbox WHERE environment = ? AND status = 'pending' ORDER BY id LIMIT ?",
    [environment, Math.min(200, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 50))],
  );
}
