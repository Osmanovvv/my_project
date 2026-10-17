import { TELEGRAM_BOT_USERNAME } from "../data/contacts";

/**
 * Источники переходов с сайта в Telegram.
 *
 * Значения намеренно статические и не принимают пользовательский ввод:
 * deep link нужен для аналитики канала, а не для передачи заявки, телефона
 * или другого персонального поля.
 */
export const TELEGRAM_LINK_SOURCES = {
  header: "site_header",
  hero: "site_hero",
  catalog: "site_catalog",
  footer: "site_footer",
} as const;

export type TelegramLinkSource = (typeof TELEGRAM_LINK_SOURCES)[keyof typeof TELEGRAM_LINK_SOURCES];

const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/;
const TELEGRAM_SOURCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertSafeTelegramConfig(): void {
  if (!TELEGRAM_USERNAME_PATTERN.test(TELEGRAM_BOT_USERNAME)) {
    throw new Error("telegram_bot_username_invalid");
  }
}

/**
 * Возвращает публичную ссылку на бота с непрозрачным источником перехода.
 * В URL попадает только фиксированное значение из TELEGRAM_LINK_SOURCES.
 */
export function buildTelegramDeepLink(source: TelegramLinkSource): string {
  assertSafeTelegramConfig();
  if (!TELEGRAM_SOURCE_PATTERN.test(source)) {
    throw new Error("telegram_link_source_invalid");
  }
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(source)}`;
}
