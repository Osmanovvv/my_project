/**
 * Доставка заявок в Telegram.
 *
 * Только сервер: суффикс `.server` — конвенция TanStack Start, модуль
 * не попадает в клиентский бандл, поэтому токен не утекает в браузер.
 * Значения приходят из окружения (`.env` в разработке, переменные
 * проекта в проде) и никогда не хранятся в коде.
 */

import type { Lead } from "./lead";
import type { TelegramBotReply } from "./telegram-bot-message";

const TELEGRAM_API = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 8_000;
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

export type TelegramConfig = { token: string; chatId: string };

export type DeliveryResult = { ok: true } | { ok: false; detail: string };

/** Один запрос Bot API. Ретраи намеренно находятся выше, в outbox worker. */
export type TelegramApiAttemptResult =
  | { kind: "sent"; messageId?: number }
  | { kind: "failed"; code: string; httpStatus?: number }
  | { kind: "retryable"; code: string; httpStatus?: number; retryAfterMs?: number }
  | { kind: "unknown"; code: string };

export type TelegramBotMessageInput = TelegramBotReply & {
  chatId: string;
  parseMode?: "HTML";
};

/**
 * Отправка в Telegram включается автоматически только для production.
 *
 * Для development/staging нужен явный TELEGRAM_DELIVERY_ENABLED=true. Это
 * защищает рабочий чат, если локальный .env случайно содержит настоящий токен.
 */
export function isTelegramDeliveryEnabled(
  env: Record<string, string | undefined> | undefined = typeof process !== "undefined"
    ? process.env
    : undefined,
): boolean {
  const configuredAppEnv = env?.APP_ENV?.trim().toLowerCase();
  const appEnv =
    configuredAppEnv ||
    (env?.NODE_ENV?.trim().toLowerCase() === "production" ||
    env?.DATA_DIR?.trim() === "/var/lib/itagent"
      ? "production"
      : "development");
  const override = env?.TELEGRAM_DELIVERY_ENABLED?.trim().toLowerCase();

  if (["0", "false", "no", "off"].includes(override ?? "")) return false;
  if (appEnv === "production") return true;
  return ["1", "true", "yes", "on"].includes(override ?? "");
}

/** Возвращает конфиг или null, если переменные не заданы. */
export function readTelegramConfig(): TelegramConfig | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!isTelegramDeliveryEnabled(env)) return null;

  const token = readTelegramBotToken();
  const chatId = env?.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** Токен нужен исходящему outbox и не требует глобального TELEGRAM_CHAT_ID. */
export function readTelegramBotToken(): string | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!isTelegramDeliveryEnabled(env)) return null;
  const token = env?.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

/** Экранирование под `parse_mode: HTML` — иначе `<` в тексте ломает сообщение. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function moscowTime(now: Date): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Moscow",
    }).format(now);
  } catch {
    // На случай рантайма без полной ICU — лучше UTC, чем ничего.
    return `${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }
}

export function formatLeadMessage(lead: Lead, now: Date = new Date()): string {
  const lines = [
    "🔔 <b>Новая заявка с сайта</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Контакт:</b> ${escapeHtml(lead.contact)}`,
  ];

  if (lead.task) {
    lines.push("", "<b>Задача:</b>", escapeHtml(lead.task));
  }

  lines.push("", `<b>Страница:</b> ${escapeHtml(lead.page || "—")}`);
  lines.push(`<b>Источник:</b> ${escapeHtml(lead.source)}`);
  if (lead.sourceDetail) {
    lines.push(`<b>Детали источника:</b> ${escapeHtml(lead.sourceDetail)}`);
  }
  lines.push(`<b>Время:</b> ${moscowTime(now)} (МСК)`);

  return lines.join("\n");
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryAfterMs(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const parameters = (payload as { parameters?: unknown }).parameters;
  if (!parameters || typeof parameters !== "object") return undefined;
  const retryAfter = (parameters as { retry_after?: unknown }).retry_after;
  if (typeof retryAfter !== "number" || !Number.isFinite(retryAfter)) return undefined;
  return Math.min(Math.max(Math.trunc(retryAfter * 1_000), 0), 120_000);
}

/**
 * Делает ровно одну попытку отправки. Ответ намеренно не содержит описание
 * Telegram: оно может включать адресата или другие персональные данные.
 */
export async function sendTelegramBotMessage(
  config: { token: string },
  input: TelegramBotMessageInput,
): Promise<TelegramApiAttemptResult> {
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        ...(input.parseMode ? { parse_mode: input.parseMode } : {}),
        ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error_code?: unknown;
      result?: { message_id?: unknown };
    } | null;
    const status = response.status;

    if (response.ok && payload?.ok === true) {
      const messageId = payload.result?.message_id;
      if (typeof messageId === "number" && Number.isSafeInteger(messageId) && messageId > 0)
        return { kind: "sent", messageId };
      return { kind: "unknown", code: "invalid_response" };
    }

    if (status === 429 || status >= 500) {
      // HTML/неполный ответ прокси не доказывает, что Telegram отверг запрос.
      if (payload?.ok !== false || payload.error_code !== status)
        return { kind: "unknown", code: `http_${status}_unconfirmed` };
      return {
        kind: "retryable",
        code: status === 429 ? "http_429" : `http_${status}`,
        httpStatus: status,
        retryAfterMs: retryAfterMs(payload),
      };
    }
    if (status >= 400 && status < 500) {
      return { kind: "failed", code: `http_${status}`, httpStatus: status };
    }
    return { kind: "unknown", code: `http_${status || "invalid_response"}` };
  } catch (error) {
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
      return { kind: "unknown", code: "timeout" };
    }
    return { kind: "unknown", code: "network_error" };
  }
}

/**
 * Повторяет только подтверждённый временный отказ Telegram.
 * Сетевой сбой/таймаут не повторяется: сообщение уже могло быть принято.
 */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
): Promise<DeliveryResult> {
  let lastDetail = "unknown";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await sendTelegramBotMessage(config, {
      chatId: config.chatId,
      text,
      parseMode: "HTML",
    });
    if (result.kind === "sent") return { ok: true };
    lastDetail = result.code;
    if (result.kind !== "retryable") return { ok: false, detail: lastDetail };

    if (attempt < ATTEMPTS) {
      await wait(result.retryAfterMs ?? RETRY_DELAY_MS);
    }
  }

  return { ok: false, detail: lastDetail };
}
