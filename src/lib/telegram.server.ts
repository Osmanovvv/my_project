/**
 * Доставка заявок в Telegram.
 *
 * Только сервер: суффикс `.server` — конвенция TanStack Start, модуль
 * не попадает в клиентский бандл, поэтому токен не утекает в браузер.
 * Значения приходят из окружения (`.env` в разработке, переменные
 * проекта в проде) и никогда не хранятся в коде.
 */

import type { Lead } from "./lead";

const TELEGRAM_API = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 8_000;
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

export type TelegramConfig = { token: string; chatId: string };

export type DeliveryResult = { ok: true } | { ok: false; detail: string };

/** Возвращает конфиг или null, если переменные не заданы. */
export function readTelegramConfig(): TelegramConfig | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const token = env?.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env?.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
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
  if (lead.source) {
    lines.push(`<b>Источник:</b> ${escapeHtml(lead.source)}`);
  }
  lines.push(`<b>Время:</b> ${moscowTime(now)} (МСК)`);

  return lines.join("\n");
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Отправляет сообщение с одной повторной попыткой: сетевые сбои и 5xx
 * у Telegram случаются, терять из-за них заявку нельзя.
 */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
): Promise<DeliveryResult> {
  let lastDetail = "неизвестная ошибка";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${TELEGRAM_API}/bot${config.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        description?: string;
      } | null;

      if (response.ok && payload?.ok) return { ok: true };

      lastDetail = `HTTP ${response.status}: ${payload?.description ?? "нет описания"}`;

      // 4xx (кроме 429) — ошибка конфигурации, повтор не поможет.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { ok: false, detail: lastDetail };
      }
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    if (attempt < ATTEMPTS) await wait(RETRY_DELAY_MS);
  }

  return { ok: false, detail: lastDetail };
}
