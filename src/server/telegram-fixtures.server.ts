/**
 * Детерминированные фикстуры для локальных и CI-проверок этапа 3.
 *
 * Здесь нет реальных Telegram ID, имён, телефонов или текстов клиентов.
 * Функция импорта намеренно принимает environment только `test`, чтобы
 * фикстуру нельзя было случайно записать в production-базу.
 */

import {
  createTelegramConversation,
  recordTelegramMessage,
  upsertTelegramContact,
  type TelegramEnvironment,
} from "./telegram-data.server";

export const TELEGRAM_FIXTURE_ENVIRONMENT = "test" as const;

export const TELEGRAM_FIXTURE_CONTACT = {
  telegramUserId: "fixture-user-001",
  username: "fixture_client",
  displayName: "Тестовый клиент",
  verifiedName: "Тестовый клиент",
  verifiedContact: "fixture@example.invalid",
} as const;

export function seedSyntheticTelegramFixtures(now = Date.now()): {
  contactId: number;
  conversationId: number;
  messageId: number;
} {
  const environment: TelegramEnvironment = TELEGRAM_FIXTURE_ENVIRONMENT;
  const contactId = upsertTelegramContact({
    environment,
    ...TELEGRAM_FIXTURE_CONTACT,
    now,
  });
  const conversationId = createTelegramConversation({
    environment,
    telegramContactId: contactId,
    clientChatId: "fixture-chat-001",
    isTest: true,
    now,
  });
  const message = recordTelegramMessage({
    environment,
    conversationId,
    direction: "client",
    messageType: "text",
    chatId: "fixture-chat-001",
    telegramMessageId: 1,
    updateId: 1,
    text: "Синтетическая заявка для проверки схемы",
    metadata: { fixture: true },
    now,
  });
  return { contactId, conversationId, messageId: message.id };
}
