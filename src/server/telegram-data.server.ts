/**
 * Нормализованные данные Telegram.
 *
 * Здесь нет обработчиков Telegram updates и нет UI. Модуль даёт серверный
 * слой для этапов 3–5: одна запись клиента, отдельные conversations,
 * идемпотентная история, операторская сессия и неизменяемый outbox.
 * Любой вызов принимает environment явно, поэтому тестовая база не может
 * случайно прочитать production-строку только из-за совпавшего ID.
 */

import { randomBytes, randomUUID } from "node:crypto";

import { all, get, run, transaction } from "./db.server";
import { normalizeLead, validateLead, type Lead } from "../lib/lead";
import { telegramBotReplySchema, type TelegramBotReply } from "../lib/telegram-bot-message";
import { LEGAL_VERSION } from "../data/legal";

export const TELEGRAM_ENVIRONMENTS = ["development", "staging", "production", "test"] as const;
export type TelegramEnvironment = (typeof TELEGRAM_ENVIRONMENTS)[number];

export const TELEGRAM_CONVERSATION_STATUSES = [
  "open",
  "waiting_operator",
  "waiting_client",
  "closed",
] as const;
export type TelegramConversationStatus = (typeof TELEGRAM_CONVERSATION_STATUSES)[number];

export const TELEGRAM_MESSAGE_DIRECTIONS = ["client", "operator", "system"] as const;
export type TelegramMessageDirection = (typeof TELEGRAM_MESSAGE_DIRECTIONS)[number];

export const TELEGRAM_MESSAGE_TYPES = [
  "text",
  "file",
  "photo",
  "voice",
  "internal_note",
  "status_event",
] as const;
export type TelegramMessageType = (typeof TELEGRAM_MESSAGE_TYPES)[number];

export const TELEGRAM_RETENTION = {
  /** Telegram-профиль, карточка диалога и история хранятся не дольше 3 лет с последней активности. */
  messagesMs: 3 * 365 * 24 * 60 * 60 * 1000,
  /** Служебные события не нужны для долгой истории пользователя. */
  eventsMs: 90 * 24 * 60 * 60 * 1000,
  /** Сырой update нужен только для повторной доставки и расследования сбоя. */
  rawUpdatesMs: 7 * 24 * 60 * 60 * 1000,
  /** Успешный или отменённый outbox не нужен после месяца. */
  outboxMs: 30 * 24 * 60 * 60 * 1000,
  /** Сессия не должна жить вечно после потери устройства. */
  sessionMs: 30 * 24 * 60 * 60 * 1000,
  /** Callback/action и черновик живут недолго. */
  actionMs: 30 * 60 * 1000,
  draftMs: 30 * 60 * 1000,
  /** Deep-link от заявки сайта должен быть использован в течение недели. */
  leadLinkMs: 7 * 24 * 60 * 60 * 1000,
} as const;

type ContactRow = {
  id: number;
  environment: TelegramEnvironment;
  telegram_user_id: string;
  username: string;
  display_name: string;
  verified_name: string;
  verified_contact: string;
  first_seen_at: number;
  last_seen_at: number;
};

export type TelegramContact = ContactRow;

type ConversationRow = {
  id: number;
  title: string;
  environment: TelegramEnvironment;
  telegram_contact_id: number;
  lead_id: number | null;
  client_chat_id: string;
  status: TelegramConversationStatus;
  is_test: 0 | 1;
  unread_count: number;
  last_message_at: number;
  last_incoming_at: number | null;
  last_read_message_id: number | null;
  created_at: number;
  updated_at: number;
};

export type TelegramConversation = ConversationRow;

type MessageRow = {
  id: number;
  environment: TelegramEnvironment;
  conversation_id: number;
  direction: TelegramMessageDirection;
  message_type: TelegramMessageType;
  sender_telegram_user_id: string | null;
  chat_id: string;
  telegram_message_id: number | null;
  update_id: number | null;
  text: string;
  metadata: string;
  delivery_status: "not_applicable" | "pending" | "sent" | "delivered" | "failed" | "unknown";
  delivered_at: number | null;
  read_at: number | null;
  created_at: number;
  updated_at: number;
};

export type TelegramMessage = MessageRow;

export type TelegramFile = {
  id: number;
  environment: TelegramEnvironment;
  message_id: number;
  telegram_file_id: string;
  stored_path: string;
  mime: string;
  bytes: number | null;
  created_at: number;
  expires_at: number | null;
};

export type TelegramOperatorSession = {
  id: number;
  environment: TelegramEnvironment;
  operator_telegram_user_id: string;
  operator_chat_id: string;
  selected_conversation_id: number | null;
  mode: "menu" | "reply_draft" | "internal_note";
  draft_text: string;
  draft_recipient_chat_id: string | null;
  draft_recipient_user_id: string | null;
  draft_version: number;
  draft_expires_at: number | null;
  last_read_message_id: number | null;
  created_at: number;
  updated_at: number;
};

export type TelegramClientSession = {
  environment: TelegramEnvironment;
  telegram_user_id: string;
  chat_id: string;
  selected_conversation_id: number | null;
  mode: "menu" | "new_task" | "conversation";
  version: number;
  updated_at: number;
  draft_payload: string;
  draft_expires_at: number | null;
};

export type TelegramLeadDraft = Lead & {
  step: "name" | "contact" | "task" | "summary";
};

export type TelegramLeadOperationResult = {
  leadId: number;
  conversationId: number;
  duplicate: boolean;
};

export type TelegramConversationLead = {
  id: number;
  name: string;
  contact: string;
  task: string;
  source: Lead["source"];
  sourceDetail: string;
  status: string;
};

/** Короткая карточка заявки для раздела «Мои заявки» в Mini App. */
export type TelegramMiniAppLead = {
  id: number;
  name: string;
  contact: string;
  task: string;
  status: string;
  createdAt: number;
  conversationId: number;
  conversationStatus: TelegramConversationStatus;
};

export type TelegramOutboxEntry = {
  id: number;
  environment: TelegramEnvironment;
  conversation_id: number | null;
  message_id: number | null;
  recipient_chat_id: string;
  recipient_telegram_user_id: string | null;
  payload: string;
  idempotency_key: string;
  status: "pending" | "processing" | "sent" | "failed" | "unknown" | "cancelled";
  attempts: number;
  next_attempt_at: number;
  last_error: string;
  created_at: number;
  sent_at: number | null;
  expires_at: number | null;
  locked_at: number | null;
  last_attempt_at: number | null;
  lead_id: number | null;
};

export type TelegramLeadLinkResult = {
  leadId: number;
  conversationId: number;
  duplicate: boolean;
};

export type TelegramTransportState = {
  environment: TelegramEnvironment;
  webhook_last_received_at: number | null;
  outbox_last_attempt_at: number | null;
  outbox_last_success_at: number | null;
  outbox_last_failure_at: number | null;
  outbox_last_status: "sent" | "failed" | "unknown" | null;
  outbox_last_error_code: string | null;
  updated_at: number;
};

export type TelegramOperatorAction = {
  actionKey: string;
  environment: TelegramEnvironment;
  operatorTelegramUserId: string;
  operatorChatId: string;
  conversationId: number | null;
  actionType: string;
  recipientChatId: string;
  recipientTelegramUserId: string | null;
  draftVersion: number;
  payload: Record<string, unknown>;
  expiresAt: number;
};

function ensureEnvironment(environment: string): asserts environment is TelegramEnvironment {
  if (!(TELEGRAM_ENVIRONMENTS as readonly string[]).includes(environment)) {
    throw new Error(`Недопустимое Telegram-окружение: ${environment}`);
  }
}

function idText(value: string | number | bigint): string {
  const result = String(value).trim();
  if (!result || result.length > 80) throw new Error("Некорректный Telegram ID");
  return result;
}

function jsonObject(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {});
}

function safeErrorCode(value: string | undefined): string {
  return (value ?? "")
    .replace(/bot\d+:[^\s"']+/gi, "[redacted-token]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b-?\d{5,}\b/g, "[redacted-id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function isConversationStatus(value: string): value is TelegramConversationStatus {
  return (TELEGRAM_CONVERSATION_STATUSES as readonly string[]).includes(value);
}

function ensureContactInEnvironment(environment: TelegramEnvironment, contactId: number): void {
  const contact = get<{ environment: TelegramEnvironment }>(
    "SELECT environment FROM telegram_contact WHERE id = ?",
    [contactId],
  );
  if (!contact || contact.environment !== environment) {
    throw new Error("Telegram-контакт не найден в этом окружении");
  }
}

function ensureConversationInEnvironment(
  environment: TelegramEnvironment,
  conversationId: number,
): { client_chat_id: string; status: TelegramConversationStatus } {
  const conversation = get<{
    environment: TelegramEnvironment;
    client_chat_id: string;
    status: TelegramConversationStatus;
  }>("SELECT environment, client_chat_id, status FROM telegram_conversation WHERE id = ?", [
    conversationId,
  ]);
  if (!conversation || conversation.environment !== environment) {
    throw new Error("Диалог не найден в этом окружении");
  }
  return conversation;
}

function ensureMessageInEnvironment(environment: TelegramEnvironment, messageId: number): void {
  const message = get<{ environment: TelegramEnvironment }>(
    "SELECT environment FROM telegram_message WHERE id = ?",
    [messageId],
  );
  if (!message || message.environment !== environment) {
    throw new Error("Telegram-сообщение не найдено в этом окружении");
  }
}

export function currentTelegramEnvironment(): TelegramEnvironment {
  const raw = process.env.APP_ENV?.trim().toLowerCase() || "development";
  return raw === "production" || raw === "staging" || raw === "test" ? raw : "development";
}

/** Обновляет только безопасную метку последнего принятого webhook update. */
export function touchTelegramWebhookReceived(
  environment: TelegramEnvironment,
  now = Date.now(),
): void {
  ensureEnvironment(environment);
  run(
    `INSERT INTO telegram_transport_state (environment, webhook_last_received_at, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(environment) DO UPDATE SET
       webhook_last_received_at = excluded.webhook_last_received_at,
       updated_at = excluded.updated_at`,
    [environment, now, now],
  );
}

/** Обновляет last-attempt/terminal state без chat ID, текста и токена. */
export function touchTelegramOutboxState(input: {
  environment: TelegramEnvironment;
  status?: "sent" | "failed" | "unknown";
  errorCode?: string;
  now?: number;
}): void {
  ensureEnvironment(input.environment);
  const now = input.now ?? Date.now();
  const status = input.status ?? null;
  const successAt = status === "sent" ? now : null;
  const failureAt = status === "failed" || status === "unknown" ? now : null;
  run(
    `INSERT INTO telegram_transport_state
       (environment, outbox_last_attempt_at, outbox_last_success_at,
        outbox_last_failure_at, outbox_last_status, outbox_last_error_code, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(environment) DO UPDATE SET
       outbox_last_attempt_at = excluded.outbox_last_attempt_at,
       outbox_last_success_at = CASE
         WHEN excluded.outbox_last_status = 'sent' THEN excluded.outbox_last_success_at
         ELSE telegram_transport_state.outbox_last_success_at END,
       outbox_last_failure_at = CASE
         WHEN excluded.outbox_last_status IN ('failed','unknown') THEN excluded.outbox_last_failure_at
         ELSE telegram_transport_state.outbox_last_failure_at END,
       outbox_last_status = CASE
         WHEN excluded.outbox_last_status IS NOT NULL THEN excluded.outbox_last_status
         ELSE telegram_transport_state.outbox_last_status END,
       outbox_last_error_code = CASE
         WHEN excluded.outbox_last_status IS NOT NULL THEN excluded.outbox_last_error_code
         ELSE telegram_transport_state.outbox_last_error_code END,
       updated_at = excluded.updated_at`,
    [input.environment, now, successAt, failureAt, status, safeErrorCode(input.errorCode), now],
  );
}

export function getTelegramTransportState(
  environment: TelegramEnvironment,
): TelegramTransportState | undefined {
  ensureEnvironment(environment);
  return get<TelegramTransportState>(
    "SELECT * FROM telegram_transport_state WHERE environment = ?",
    [environment],
  );
}

/** Служебное событие без пользовательского payload. */
export function recordTelegramEvent(input: {
  environment: TelegramEnvironment;
  eventType: string;
  payload?: Record<string, unknown>;
  conversationId?: number | null;
  now?: number;
  expiresAt?: number | null;
}): void {
  ensureEnvironment(input.environment);
  const now = input.now ?? Date.now();
  run(
    `INSERT INTO telegram_event
       (environment, conversation_id, event_type, payload, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.environment,
      input.conversationId ?? null,
      input.eventType.slice(0, 100),
      jsonObject(input.payload),
      now,
      input.expiresAt ?? now + TELEGRAM_RETENTION.eventsMs,
    ],
  );
}

export type UpsertTelegramContactInput = {
  environment: TelegramEnvironment;
  telegramUserId: string | number | bigint;
  username?: string;
  displayName?: string;
  verifiedName?: string;
  verifiedContact?: string;
  now?: number;
};

export function upsertTelegramContact(input: UpsertTelegramContactInput): number {
  ensureEnvironment(input.environment);
  const userId = idText(input.telegramUserId);
  const now = input.now ?? Date.now();
  const username = (input.username ?? "").trim().slice(0, 255);
  const displayName = (input.displayName ?? "").trim().slice(0, 500);
  // Telegram-профиль не подтверждает имя/контакт и не стирает ранее
  // подтверждённые клиентом поля. Один UPSERT также работает внутри inbox-транзакции.
  return get<{ id: number }>(
    `INSERT INTO telegram_contact
     (environment, telegram_user_id, username, display_name, verified_name, verified_contact,
      first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(environment, telegram_user_id) DO UPDATE SET
       username = excluded.username, display_name = excluded.display_name,
       verified_name = COALESCE(?, telegram_contact.verified_name),
       verified_contact = COALESCE(?, telegram_contact.verified_contact),
       last_seen_at = excluded.last_seen_at
     RETURNING id`,
    [
      input.environment,
      userId,
      username,
      displayName,
      (input.verifiedName ?? "").trim().slice(0, 500),
      (input.verifiedContact ?? "").trim().slice(0, 500),
      now,
      now,
      input.verifiedName == null ? null : input.verifiedName.trim().slice(0, 500),
      input.verifiedContact == null ? null : input.verifiedContact.trim().slice(0, 500),
    ],
  )!.id;
}

export function getTelegramContact(
  environment: TelegramEnvironment,
  telegramUserId: string | number | bigint,
): TelegramContact | undefined {
  ensureEnvironment(environment);
  return get<TelegramContact>(
    "SELECT * FROM telegram_contact WHERE environment = ? AND telegram_user_id = ?",
    [environment, idText(telegramUserId)],
  );
}

export function getTelegramContactById(
  environment: TelegramEnvironment,
  contactId: number,
): TelegramContact | undefined {
  ensureEnvironment(environment);
  return get<TelegramContact>("SELECT * FROM telegram_contact WHERE environment = ? AND id = ?", [
    environment,
    contactId,
  ]);
}

export type CreateTelegramConversationInput = {
  environment: TelegramEnvironment;
  telegramContactId: number;
  clientChatId: string | number | bigint;
  leadId?: number | null;
  isTest?: boolean;
  title?: string;
  now?: number;
};

export function createTelegramConversation(input: CreateTelegramConversationInput): number {
  ensureEnvironment(input.environment);
  const chatId = idText(input.clientChatId);
  const now = input.now ?? Date.now();

  return transaction(() => {
    ensureContactInEnvironment(input.environment, input.telegramContactId);
    if (input.leadId != null) {
      const linked = get<{ conversation_id: number }>(
        "SELECT conversation_id FROM lead_telegram WHERE lead_id = ? AND environment = ?",
        [input.leadId, input.environment],
      );
      if (linked) return linked.conversation_id;
    }

    const { lastId } = run(
      `INSERT INTO telegram_conversation
       (environment, telegram_contact_id, lead_id, client_chat_id, status, is_test,
        unread_count, last_message_at, last_incoming_at, created_at, updated_at, title)
       VALUES (?, ?, ?, ?, 'open', ?, 0, ?, NULL, ?, ?, ?)`,
      [
        input.environment,
        input.telegramContactId,
        input.leadId ?? null,
        chatId,
        input.isTest ? 1 : 0,
        now,
        now,
        now,
        (input.title ?? "").trim().slice(0, 200),
      ],
    );

    if (input.leadId != null) {
      run(
        `INSERT INTO lead_telegram (lead_id, conversation_id, environment, created_at)
         VALUES (?, ?, ?, ?)`,
        [input.leadId, lastId, input.environment, now],
      );
    }
    return lastId;
  });
}

/**
 * Заявки, связанные с Telegram-контактом текущей сессии.
 *
 * Фильтр идёт по внутреннему contact id и окружению, поэтому клиент не может
 * подменить пользователя, передав чужой Telegram ID из браузера.
 */
export function listTelegramMiniAppLeads(input: {
  environment: TelegramEnvironment;
  telegramContactId: number;
  limit?: number;
}): TelegramMiniAppLead[] {
  ensureEnvironment(input.environment);
  ensureContactInEnvironment(input.environment, input.telegramContactId);
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
  return all<TelegramMiniAppLead>(
    `SELECT l.id, l.name, l.contact, l.task, l.status,
            l.created_at AS createdAt, c.id AS conversationId,
            c.status AS conversationStatus
       FROM lead l
       JOIN lead_telegram lt
         ON lt.lead_id = l.id AND lt.environment = ?
       JOIN telegram_conversation c
         ON c.id = lt.conversation_id
        AND c.environment = lt.environment
       WHERE c.telegram_contact_id = ? AND c.environment = ?
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ?`,
    [input.environment, input.telegramContactId, input.environment, limit],
  );
}

/**
 * Одной транзакцией создаёт lead, Telegram-диалог и их связь.
 * До этого вызова клиентский черновик не считается заявкой.
 */
export function createTelegramLeadFromDraft(input: {
  environment: TelegramEnvironment;
  telegramUserId: string | number | bigint;
  chatId: string | number | bigint;
  operationKey: string;
  draft: TelegramLeadDraft;
  now?: number;
}): TelegramLeadOperationResult {
  ensureEnvironment(input.environment);
  const userId = idText(input.telegramUserId);
  const chatId = idText(input.chatId);
  if (userId !== chatId) throw new Error("private_chat_required");
  const operationKey = input.operationKey.trim();
  if (!operationKey || operationKey.length > 255) throw new Error("Некорректный operation key");
  const now = input.now ?? Date.now();
  const draft = input.draft;
  if (draft.consent !== true) throw new Error("заявка без согласия на обработку данных");

  const lead = normalizeLead({
    name: draft.name,
    contact: draft.contact,
    task: draft.task,
    page: draft.page,
    source: draft.source || "telegram_bot",
    source_detail: draft.sourceDetail,
    consent: true,
  });
  const errors = validateLead(lead);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  return transaction(() => {
    const existing = get<{
      lead_id: number;
      conversation_id: number;
      telegram_user_id: string;
      chat_id: string;
    }>(
      `SELECT lead_id, conversation_id, telegram_user_id, chat_id
       FROM telegram_lead_operation WHERE operation_key = ? AND environment = ?`,
      [operationKey, input.environment],
    );
    if (existing) {
      if (existing.telegram_user_id !== userId || existing.chat_id !== chatId)
        throw new Error("operation_key принадлежит другому клиенту");
      return {
        leadId: existing.lead_id,
        conversationId: existing.conversation_id,
        duplicate: true,
      };
    }

    const contact = get<{ id: number }>(
      "SELECT id FROM telegram_contact WHERE environment = ? AND telegram_user_id = ?",
      [input.environment, userId],
    );
    if (!contact) throw new Error("профиль Telegram-клиента не найден");

    const leadRow = run(
      `INSERT INTO lead
       (created_at, name, contact, task, page, source, source_detail, consent_at, consent_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        now,
        lead.name,
        lead.contact,
        lead.task,
        lead.page,
        lead.source,
        lead.sourceDetail,
        now,
        LEGAL_VERSION,
      ],
    );
    const conversationRow = run(
      `INSERT INTO telegram_conversation
       (environment, telegram_contact_id, lead_id, client_chat_id, status, is_test,
        unread_count, last_message_at, last_incoming_at, created_at, updated_at, title)
       VALUES (?, ?, ?, ?, 'waiting_operator', ?, 0, ?, ?, ?, ?, ?)`,
      [
        input.environment,
        contact.id,
        leadRow.lastId,
        chatId,
        input.environment === "test" ? 1 : 0,
        now,
        now,
        now,
        now,
        lead.task.trim().slice(0, 200) || "Новая заявка",
      ],
    );
    run(
      `INSERT INTO lead_telegram (lead_id, conversation_id, environment, created_at)
       VALUES (?, ?, ?, ?)`,
      [leadRow.lastId, conversationRow.lastId, input.environment, now],
    );
    run(
      `INSERT INTO telegram_lead_operation
       (operation_key, environment, telegram_user_id, chat_id, lead_id, conversation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        operationKey,
        input.environment,
        userId,
        chatId,
        leadRow.lastId,
        conversationRow.lastId,
        now,
      ],
    );
    return {
      leadId: leadRow.lastId,
      conversationId: conversationRow.lastId,
      duplicate: false,
    };
  });
}

const TELEGRAM_LEAD_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

/** Создаёт или возвращает действующий одноразовый deep-link для заявки сайта. */
export function createTelegramLeadLink(input: {
  environment: TelegramEnvironment;
  leadId: number;
  now?: number;
}): string {
  ensureEnvironment(input.environment);
  const now = input.now ?? Date.now();
  return transaction(() => {
    const lead = get<{ id: number; consent_at: number | null }>(
      "SELECT id, consent_at FROM lead WHERE id = ?",
      [input.leadId],
    );
    if (!lead) throw new Error("Заявка не найдена");
    if (lead.consent_at == null) throw new Error("Для заявки не зафиксировано согласие");

    /* Просроченный активный ключ освобождает уникальное место для нового. */
    run(
      `UPDATE telegram_lead_link SET consumed_at = ?
       WHERE lead_id = ? AND consumed_at IS NULL AND expires_at <= ?`,
      [now, input.leadId, now],
    );
    const existing = get<{ token: string }>(
      `SELECT token FROM telegram_lead_link
       WHERE lead_id = ? AND environment = ? AND consumed_at IS NULL AND expires_at > ?`,
      [input.leadId, input.environment, now],
    );
    if (existing) return existing.token;

    const token = randomBytes(32).toString("base64url");
    run(
      `INSERT INTO telegram_lead_link
       (token, environment, lead_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [token, input.environment, input.leadId, now, now + TELEGRAM_RETENTION.leadLinkMs],
    );
    return token;
  });
}

/**
 * Одноразово связывает заявку сайта с private Telegram-профилем.
 * Повтор того же токена от того же чата возвращает исходный conversation,
 * чужой пользователь или другое окружение получают отказ.
 */
export function redeemTelegramLeadLink(input: {
  environment: TelegramEnvironment;
  token: string;
  telegramUserId: string | number | bigint;
  chatId: string | number | bigint;
  username?: string;
  displayName?: string;
  now?: number;
}): TelegramLeadLinkResult {
  ensureEnvironment(input.environment);
  const userId = idText(input.telegramUserId);
  const chatId = idText(input.chatId);
  if (userId !== chatId) throw new Error("private_chat_required");
  const token = input.token.trim();
  if (!TELEGRAM_LEAD_TOKEN_RE.test(token)) throw new Error("invalid_telegram_lead_link");
  const now = input.now ?? Date.now();

  return transaction(() => {
    const link = get<{
      token: string;
      environment: TelegramEnvironment;
      lead_id: number;
      expires_at: number;
      consumed_at: number | null;
      telegram_user_id: string | null;
      telegram_chat_id: string | null;
      conversation_id: number | null;
    }>("SELECT * FROM telegram_lead_link WHERE token = ?", [token]);
    if (!link || link.environment !== input.environment)
      throw new Error("telegram_lead_link_not_found");

    if (link.consumed_at != null) {
      if (
        link.telegram_user_id === userId &&
        link.telegram_chat_id === chatId &&
        link.conversation_id != null
      ) {
        return { leadId: link.lead_id, conversationId: link.conversation_id, duplicate: true };
      }
      throw new Error("telegram_lead_link_used");
    }
    if (link.expires_at <= now) throw new Error("telegram_lead_link_expired");

    const lead = get<{ id: number; consent_at: number | null }>(
      "SELECT id, consent_at FROM lead WHERE id = ?",
      [link.lead_id],
    );
    if (!lead) throw new Error("Заявка не найдена");
    if (lead.consent_at == null) throw new Error("Для заявки не зафиксировано согласие");

    const existing = get<{
      conversation_id: number;
      environment: TelegramEnvironment;
      telegram_user_id: string;
    }>(
      `SELECT lt.conversation_id, lt.environment, p.telegram_user_id
         FROM lead_telegram lt
         JOIN telegram_conversation c
           ON c.id = lt.conversation_id AND c.environment = lt.environment
         JOIN telegram_contact p
           ON p.id = c.telegram_contact_id AND p.environment = c.environment
        WHERE lt.lead_id = ?`,
      [link.lead_id],
    );
    if (existing) {
      if (existing.environment !== input.environment)
        throw new Error("Заявка связана с другим окружением");
      if (existing.telegram_user_id !== userId) throw new Error("telegram_lead_link_used");
      run(
        `UPDATE telegram_lead_link
         SET consumed_at = ?, telegram_user_id = ?, telegram_chat_id = ?, conversation_id = ?
         WHERE token = ? AND consumed_at IS NULL`,
        [now, userId, chatId, existing.conversation_id, token],
      );
      return {
        leadId: link.lead_id,
        conversationId: existing.conversation_id,
        duplicate: true,
      };
    }

    const contactId = upsertTelegramContact({
      environment: input.environment,
      telegramUserId: userId,
      username: input.username,
      displayName: input.displayName,
      now,
    });
    const conversation = run(
      `INSERT INTO telegram_conversation
       (environment, telegram_contact_id, lead_id, client_chat_id, status, is_test,
        unread_count, last_message_at, last_incoming_at, created_at, updated_at, title)
       SELECT ?, ?, ?, ?, 'waiting_operator', ?, 0, ?, NULL, ?, ?,
              CASE WHEN trim(task) <> '' THEN substr(task, 1, 200) ELSE 'Заявка с сайта' END
       FROM lead WHERE id = ?`,
      [
        input.environment,
        contactId,
        link.lead_id,
        chatId,
        input.environment === "test" ? 1 : 0,
        now,
        now,
        now,
        link.lead_id,
      ],
    );
    run(
      `INSERT INTO lead_telegram (lead_id, conversation_id, environment, created_at)
       VALUES (?, ?, ?, ?)`,
      [link.lead_id, conversation.lastId, input.environment, now],
    );
    run(
      `UPDATE telegram_lead_link
       SET consumed_at = ?, telegram_user_id = ?, telegram_chat_id = ?, conversation_id = ?
       WHERE token = ? AND consumed_at IS NULL`,
      [now, userId, chatId, conversation.lastId, token],
    );
    return { leadId: link.lead_id, conversationId: conversation.lastId, duplicate: false };
  });
}

export function getTelegramConversation(
  environment: TelegramEnvironment,
  conversationId: number,
): TelegramConversation | undefined {
  ensureEnvironment(environment);
  return get<TelegramConversation>(
    "SELECT * FROM telegram_conversation WHERE environment = ? AND id = ?",
    [environment, conversationId],
  );
}

/** Возвращает заявку только при согласованной связи conversation ↔ lead. */
export function getTelegramConversationLead(
  environment: TelegramEnvironment,
  conversationId: number,
): TelegramConversationLead | undefined {
  ensureEnvironment(environment);
  return get<TelegramConversationLead>(
    `SELECT l.id, l.name, l.contact, l.task, l.source,
            l.source_detail AS sourceDetail, l.status
     FROM telegram_conversation c
     JOIN lead l ON l.id = c.lead_id
     JOIN lead_telegram lt
       ON lt.lead_id = l.id AND lt.conversation_id = c.id AND lt.environment = ?
     WHERE c.environment = ? AND c.id = ?`,
    [environment, environment, conversationId],
  );
}

/** Возвращает обращение только владельцу Mini App-сессии. */
export function getTelegramMiniAppConversation(input: {
  environment: TelegramEnvironment;
  telegramContactId: number;
  conversationId: number;
}): { leadId: number; conversationId: number } | undefined {
  ensureEnvironment(input.environment);
  ensureContactInEnvironment(input.environment, input.telegramContactId);
  return get<{ leadId: number; conversationId: number }>(
    `SELECT c.id AS conversationId, lt.lead_id AS leadId
       FROM telegram_conversation c
       JOIN lead_telegram lt
         ON lt.conversation_id = c.id AND lt.environment = c.environment
        AND lt.lead_id = c.lead_id
      WHERE c.environment = ? AND c.id = ? AND c.telegram_contact_id = ?`,
    [input.environment, input.conversationId, input.telegramContactId],
  );
}

/** Явно связывает уже существующий lead с Telegram-обращением. */
export function linkTelegramConversationToLead(input: {
  environment: TelegramEnvironment;
  conversationId: number;
  leadId: number;
  now?: number;
}): void {
  ensureEnvironment(input.environment);
  const now = input.now ?? Date.now();
  transaction(() => {
    const conversation = get<{
      environment: TelegramEnvironment;
      lead_id: number | null;
    }>("SELECT environment, lead_id FROM telegram_conversation WHERE id = ?", [
      input.conversationId,
    ]);
    if (!conversation || conversation.environment !== input.environment)
      throw new Error("Диалог не найден в этом окружении");
    const lead = get<{ id: number }>("SELECT id FROM lead WHERE id = ?", [input.leadId]);
    if (!lead) throw new Error("Заявка не найдена");
    if (conversation.lead_id != null && conversation.lead_id !== input.leadId)
      throw new Error("Диалог уже связан с другой заявкой");
    const existing = get<{ conversation_id: number }>(
      "SELECT conversation_id FROM lead_telegram WHERE lead_id = ? AND environment = ?",
      [input.leadId, input.environment],
    );
    if (existing && existing.conversation_id !== input.conversationId)
      throw new Error("Заявка уже связана с другим Telegram-обращением");
    run(
      `UPDATE telegram_conversation SET lead_id = ?, updated_at = ?
       WHERE environment = ? AND id = ?`,
      [input.leadId, now, input.environment, input.conversationId],
    );
    if (!existing)
      run(
        `INSERT INTO lead_telegram (lead_id, conversation_id, environment, created_at)
         VALUES (?, ?, ?, ?)`,
        [input.leadId, input.conversationId, input.environment, now],
      );
  });
}

export function setTelegramConversationStatus(
  environment: TelegramEnvironment,
  conversationId: number,
  status: TelegramConversationStatus,
  now = Date.now(),
): TelegramConversation {
  ensureEnvironment(environment);
  ensureConversationInEnvironment(environment, conversationId);
  if (!isConversationStatus(status)) throw new Error("Некорректный статус диалога");
  run(
    `UPDATE telegram_conversation SET status = ?, updated_at = ?
     WHERE environment = ? AND id = ?`,
    [status, now, environment, conversationId],
  );
  recordTelegramEvent({
    environment,
    conversationId,
    eventType: "conversation_status_changed",
    payload: { status },
    now,
  });
  return getTelegramConversation(environment, conversationId)!;
}

export function reopenTelegramConversation(
  environment: TelegramEnvironment,
  conversationId: number,
  now = Date.now(),
): TelegramConversation {
  const conversation = getTelegramConversation(environment, conversationId);
  if (!conversation) throw new Error("диалог не найден");
  const nextStatus: TelegramConversationStatus =
    conversation.unread_count > 0 ? "waiting_operator" : "open";
  return setTelegramConversationStatus(environment, conversationId, nextStatus, now);
}

export type ListTelegramConversationsInput = {
  environment: TelegramEnvironment;
  status?: TelegramConversationStatus | "all";
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

export function listTelegramConversations({
  environment,
  status = "all",
  unreadOnly = false,
  limit = 50,
  offset = 0,
}: ListTelegramConversationsInput): TelegramConversation[] {
  ensureEnvironment(environment);
  if (status !== "all" && !isConversationStatus(status))
    throw new Error("Некорректный статус диалога");
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const safeOffset = Math.max(Math.trunc(offset), 0);
  const clauses = ["environment = ?"];
  const params: (string | number | null)[] = [environment];
  if (status !== "all") {
    clauses.push("status = ?");
    params.push(status);
  }
  if (unreadOnly) clauses.push("unread_count > 0");
  params.push(safeLimit, safeOffset);
  return all<TelegramConversation>(
    `SELECT * FROM telegram_conversation WHERE ${clauses.join(" AND ")}
     ORDER BY last_message_at DESC, id DESC LIMIT ? OFFSET ?`,
    params,
  );
}

export type ListTelegramOperatorConversationsInput = ListTelegramConversationsInput & {
  search?: string;
};

/** Лента оператора: поиск выполняется только по нормализованным полям. */
export function listTelegramOperatorConversations({
  environment,
  status = "all",
  unreadOnly = false,
  search = "",
  limit = 20,
  offset = 0,
}: ListTelegramOperatorConversationsInput): TelegramConversation[] {
  ensureEnvironment(environment);
  if (status !== "all" && !isConversationStatus(status))
    throw new Error("Некорректный статус диалога");
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const safeOffset = Math.max(Math.trunc(offset), 0);
  const clauses = ["c.environment = ?"];
  const params: (string | number)[] = [environment];
  if (status !== "all") {
    clauses.push("c.status = ?");
    params.push(status);
  }
  if (unreadOnly) clauses.push("c.unread_count > 0");
  const query = search.trim().slice(0, 120);
  if (query) {
    clauses.push(
      "(p.username LIKE ? OR p.display_name LIKE ? OR p.telegram_user_id LIKE ? OR c.title LIKE ? OR CAST(c.id AS TEXT) = ?)",
    );
    const pattern = `%${query}%`;
    params.push(pattern, pattern, pattern, pattern, query);
  }
  params.push(safeLimit, safeOffset);
  return all<TelegramConversation>(
    `SELECT c.* FROM telegram_conversation c
     JOIN telegram_contact p ON p.id = c.telegram_contact_id AND p.environment = c.environment
     WHERE ${clauses.join(" AND ")}
     ORDER BY c.last_message_at DESC, c.id DESC LIMIT ? OFFSET ?`,
    params,
  );
}

export function listTelegramClientConversations(
  environment: TelegramEnvironment,
  telegramUserId: string | number | bigint,
  limit = 20,
  offset = 0,
): TelegramConversation[] {
  ensureEnvironment(environment);
  return all<TelegramConversation>(
    `SELECT c.* FROM telegram_conversation c
     JOIN telegram_contact p ON p.id = c.telegram_contact_id
     WHERE c.environment = ? AND p.environment = ? AND p.telegram_user_id = ?
     ORDER BY c.last_message_at DESC, c.id DESC LIMIT ? OFFSET ?`,
    [
      environment,
      environment,
      idText(telegramUserId),
      Math.min(Math.max(Math.trunc(limit), 1), 50),
      Math.max(Math.trunc(offset), 0),
    ],
  );
}

export type RecordTelegramMessageInput = {
  environment: TelegramEnvironment;
  conversationId: number;
  direction: TelegramMessageDirection;
  messageType: TelegramMessageType;
  chatId: string | number | bigint;
  telegramMessageId?: number | null;
  updateId?: number | null;
  senderTelegramUserId?: string | number | bigint | null;
  text?: string;
  metadata?: Record<string, unknown>;
  deliveryStatus?: TelegramMessage["delivery_status"];
  readAt?: number | null;
  now?: number;
};

export function recordTelegramMessage(input: RecordTelegramMessageInput): {
  id: number;
  duplicate: boolean;
} {
  ensureEnvironment(input.environment);
  const chatId = idText(input.chatId);
  const sender = input.senderTelegramUserId == null ? null : idText(input.senderTelegramUserId);
  const now = input.now ?? Date.now();
  const text = (input.text ?? "").slice(0, 100_000);
  const metadata = jsonObject(input.metadata);
  const deliveryStatus = input.deliveryStatus ?? "not_applicable";

  return transaction(() => {
    ensureConversationInEnvironment(input.environment, input.conversationId);
    const duplicateClauses: string[] = [];
    const duplicateParams: (string | number)[] = [input.environment];
    if (input.telegramMessageId != null) {
      duplicateClauses.push("(chat_id = ? AND telegram_message_id = ?)");
      duplicateParams.push(chatId, input.telegramMessageId);
    }
    if (input.updateId != null) {
      duplicateClauses.push("update_id = ?");
      duplicateParams.push(input.updateId);
    }
    const duplicate =
      duplicateClauses.length === 0
        ? undefined
        : get<{ id: number }>(
            `SELECT id FROM telegram_message
             WHERE environment = ? AND (${duplicateClauses.join(" OR ")})
             LIMIT 1`,
            duplicateParams,
          );
    if (duplicate) return { id: duplicate.id, duplicate: true };

    const { lastId } = run(
      `INSERT INTO telegram_message
       (environment, conversation_id, direction, message_type, sender_telegram_user_id,
        chat_id, telegram_message_id, update_id, text, metadata, delivery_status,
        delivered_at, read_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        input.environment,
        input.conversationId,
        input.direction,
        input.messageType,
        sender,
        chatId,
        input.telegramMessageId ?? null,
        input.updateId ?? null,
        text,
        metadata,
        deliveryStatus,
        input.readAt ?? null,
        now,
        now,
      ],
    );

    if (input.direction === "client" && input.readAt == null) {
      run(
        `UPDATE telegram_conversation
         SET unread_count = unread_count + 1, last_incoming_at = ?, last_message_at = ?, updated_at = ?
         WHERE environment = ? AND id = ?`,
        [now, now, now, input.environment, input.conversationId],
      );
    } else {
      run(
        `UPDATE telegram_conversation
         SET last_message_at = ?, updated_at = ?
         WHERE environment = ? AND id = ?`,
        [now, now, input.environment, input.conversationId],
      );
    }
    return { id: lastId, duplicate: false };
  });
}

export function listTelegramMessages(
  environment: TelegramEnvironment,
  conversationId: number,
  limit = 100,
  offset = 0,
): TelegramMessage[] {
  ensureEnvironment(environment);
  return all<TelegramMessage>(
    `SELECT * FROM telegram_message
     WHERE environment = ? AND conversation_id = ?
     ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    [
      environment,
      conversationId,
      Math.min(Math.max(Math.trunc(limit), 1), 200),
      Math.max(Math.trunc(offset), 0),
    ],
  );
}

export type RecordTelegramFileInput = {
  environment: TelegramEnvironment;
  messageId: number;
  telegramFileId: string;
  storedPath?: string;
  mime?: string;
  bytes?: number | null;
  now?: number;
  expiresAt?: number | null;
};

export function recordTelegramFile(input: RecordTelegramFileInput): number {
  ensureEnvironment(input.environment);
  ensureMessageInEnvironment(input.environment, input.messageId);
  const fileId = input.telegramFileId.trim();
  if (!fileId || fileId.length > 255) throw new Error("Некорректный Telegram file ID");
  const now = input.now ?? Date.now();
  const existing = get<{ id: number }>(
    "SELECT id FROM telegram_file WHERE environment = ? AND telegram_file_id = ?",
    [input.environment, fileId],
  );
  if (existing) {
    run(
      `UPDATE telegram_file SET message_id = ?, stored_path = ?, mime = ?, bytes = ?, expires_at = ?
       WHERE environment = ? AND telegram_file_id = ?`,
      [
        input.messageId,
        (input.storedPath ?? "").slice(0, 500),
        (input.mime ?? "").slice(0, 255),
        input.bytes ?? null,
        input.expiresAt ?? null,
        input.environment,
        fileId,
      ],
    );
    return existing.id;
  }
  return run(
    `INSERT INTO telegram_file
     (environment, message_id, telegram_file_id, stored_path, mime, bytes, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.environment,
      input.messageId,
      fileId,
      (input.storedPath ?? "").slice(0, 500),
      (input.mime ?? "").slice(0, 255),
      input.bytes ?? null,
      now,
      input.expiresAt ?? null,
    ],
  ).lastId;
}

export function markTelegramConversationRead(
  environment: TelegramEnvironment,
  conversationId: number,
  upToMessageId?: number,
  now = Date.now(),
): number {
  ensureEnvironment(environment);
  return transaction(() => {
    const params: (string | number)[] = [now, environment, conversationId];
    const upper = upToMessageId == null ? "" : " AND id <= ?";
    if (upToMessageId != null) params.push(upToMessageId);
    const result = run(
      `UPDATE telegram_message SET read_at = ?
       WHERE environment = ? AND conversation_id = ? AND direction = 'client'
         AND read_at IS NULL${upper}`,
      params,
    );
    const unread = get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM telegram_message
       WHERE environment = ? AND conversation_id = ? AND direction = 'client' AND read_at IS NULL`,
      [environment, conversationId],
    );
    run(
      `UPDATE telegram_conversation
       SET unread_count = ?, last_read_message_id = COALESCE(?, last_read_message_id), updated_at = ?
       WHERE environment = ? AND id = ?`,
      [Number(unread?.n ?? 0), upToMessageId ?? null, now, environment, conversationId],
    );
    return result.changes;
  });
}

export function getOrCreateTelegramOperatorSession(
  environment: TelegramEnvironment,
  operatorTelegramUserId: string | number | bigint,
  operatorChatId: string | number | bigint,
  now = Date.now(),
): TelegramOperatorSession {
  ensureEnvironment(environment);
  const userId = idText(operatorTelegramUserId);
  const chatId = idText(operatorChatId);
  return transaction(() => {
    const existing = get<TelegramOperatorSession>(
      `SELECT * FROM telegram_operator_session
       WHERE environment = ? AND operator_telegram_user_id = ? AND operator_chat_id = ?`,
      [environment, userId, chatId],
    );
    if (existing) {
      run("UPDATE telegram_operator_session SET updated_at = ? WHERE id = ?", [now, existing.id]);
      return { ...existing, updated_at: now };
    }
    const { lastId } = run(
      `INSERT INTO telegram_operator_session
       (environment, operator_telegram_user_id, operator_chat_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [environment, userId, chatId, now, now],
    );
    return get<TelegramOperatorSession>("SELECT * FROM telegram_operator_session WHERE id = ?", [
      lastId,
    ])!;
  });
}

export function getOrCreateTelegramClientSession(
  environment: TelegramEnvironment,
  telegramUserId: string | number | bigint,
  chatId: string | number | bigint,
  now = Date.now(),
): TelegramClientSession {
  ensureEnvironment(environment);
  const userId = idText(telegramUserId);
  const normalizedChatId = idText(chatId);
  if (userId !== normalizedChatId) throw new Error("private_chat_required");
  return transaction(() => {
    const existing = get<TelegramClientSession>(
      `SELECT * FROM telegram_client_session
       WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?`,
      [environment, userId, normalizedChatId],
    );
    if (existing) {
      run(
        "UPDATE telegram_client_session SET updated_at = ? WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?",
        [now, environment, userId, normalizedChatId],
      );
      return { ...existing, updated_at: now };
    }
    run(
      `INSERT INTO telegram_client_session
       (environment, telegram_user_id, chat_id, selected_conversation_id, mode, version, updated_at)
       VALUES (?, ?, ?, NULL, 'menu', 0, ?)`,
      [environment, userId, normalizedChatId, now],
    );
    return get<TelegramClientSession>(
      `SELECT * FROM telegram_client_session WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?`,
      [environment, userId, normalizedChatId],
    )!;
  });
}

export function updateTelegramClientSession(input: {
  environment: TelegramEnvironment;
  telegramUserId: string | number | bigint;
  chatId: string | number | bigint;
  mode: TelegramClientSession["mode"];
  selectedConversationId?: number | null;
  expectedVersion?: number;
  now?: number;
}): TelegramClientSession {
  ensureEnvironment(input.environment);
  const userId = idText(input.telegramUserId);
  const chatId = idText(input.chatId);
  if (userId !== chatId) throw new Error("private_chat_required");
  const now = input.now ?? Date.now();
  const selected = input.selectedConversationId ?? null;
  return transaction(() => {
    const current = get<TelegramClientSession>(
      `SELECT * FROM telegram_client_session
       WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?`,
      [input.environment, userId, chatId],
    );
    if (!current) throw new Error("клиентская сессия не найдена");
    if (input.expectedVersion != null && current.version !== input.expectedVersion)
      throw new Error("устаревшая клиентская сессия");
    const result = run(
      `UPDATE telegram_client_session
       SET selected_conversation_id = ?, mode = ?,
           draft_payload = CASE WHEN ? = 'menu' THEN '{}' ELSE draft_payload END,
           draft_expires_at = CASE WHEN ? = 'menu' THEN NULL ELSE draft_expires_at END,
           version = version + 1, updated_at = ?
       WHERE environment = ? AND telegram_user_id = ? AND chat_id = ? AND version = ?`,
      [
        selected,
        input.mode,
        input.mode,
        input.mode,
        now,
        input.environment,
        userId,
        chatId,
        current.version,
      ],
    );
    if (result.changes !== 1) throw new Error("устаревшая клиентская сессия");
    return get<TelegramClientSession>(
      `SELECT * FROM telegram_client_session WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?`,
      [input.environment, userId, chatId],
    )!;
  });
}

export function saveTelegramClientLeadDraft(input: {
  environment: TelegramEnvironment;
  telegramUserId: string | number | bigint;
  chatId: string | number | bigint;
  draft: TelegramLeadDraft;
  expectedVersion: number;
  now?: number;
}): TelegramClientSession {
  ensureEnvironment(input.environment);
  const userId = idText(input.telegramUserId);
  const chatId = idText(input.chatId);
  if (userId !== chatId) throw new Error("private_chat_required");
  const now = input.now ?? Date.now();
  const payload = JSON.stringify(input.draft);
  const result = run(
    `UPDATE telegram_client_session
     SET selected_conversation_id = NULL, mode = 'new_task', draft_payload = ?,
         draft_expires_at = ?, version = version + 1, updated_at = ?
     WHERE environment = ? AND telegram_user_id = ? AND chat_id = ? AND version = ?`,
    [
      payload,
      now + TELEGRAM_RETENTION.draftMs,
      now,
      input.environment,
      userId,
      chatId,
      input.expectedVersion,
    ],
  );
  if (result.changes !== 1) throw new Error("устаревший черновик заявки");
  return get<TelegramClientSession>(
    `SELECT * FROM telegram_client_session
     WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?`,
    [input.environment, userId, chatId],
  )!;
}

export function consumeTelegramClientAction(input: {
  actionKey: string;
  environment: TelegramEnvironment;
  telegramUserId: string | number | bigint;
  chatId: string | number | bigint;
  now?: number;
}): void {
  ensureEnvironment(input.environment);
  const now = input.now ?? Date.now();
  const userId = idText(input.telegramUserId);
  const chatId = idText(input.chatId);
  if (userId !== chatId) throw new Error("private_chat_required");
  transaction(() => {
    const action = get<{
      action_key: string;
      environment: TelegramEnvironment;
      telegram_user_id: string;
      chat_id: string;
      expires_at: number;
      queued_update_id: number | null;
      consumed_at: number | null;
      session_version: number | null;
    }>("SELECT * FROM telegram_client_action WHERE action_key = ?", [input.actionKey]);
    const session = get<TelegramClientSession>(
      `SELECT * FROM telegram_client_session
       WHERE environment = ? AND telegram_user_id = ? AND chat_id = ?`,
      [input.environment, userId, chatId],
    );
    if (
      !action ||
      action.environment !== input.environment ||
      action.telegram_user_id !== userId ||
      action.chat_id !== chatId ||
      action.queued_update_id == null ||
      action.consumed_at != null ||
      action.expires_at <= now ||
      !session ||
      session.updated_at <= now - TELEGRAM_RETENTION.sessionMs ||
      (action.session_version != null && session.version !== action.session_version)
    ) {
      throw new Error("действие клиента уже использовано, устарело или сессия истекла");
    }
    const result = run(
      `UPDATE telegram_client_action SET consumed_at = ?
       WHERE action_key = ? AND environment = ? AND telegram_user_id = ? AND chat_id = ?
         AND queued_update_id IS NOT NULL AND consumed_at IS NULL AND expires_at > ?`,
      [now, input.actionKey, input.environment, userId, chatId, now],
    );
    if (result.changes !== 1) throw new Error("действие клиента уже использовано");
  });
}

export function enqueueTelegramBotReply(input: {
  environment: TelegramEnvironment;
  recipientChatId: string | number | bigint;
  recipientTelegramUserId?: string | number | bigint | null;
  conversationId?: number | null;
  leadId?: number | null;
  reply: TelegramBotReply;
  idempotencyKey: string;
  now?: number;
  expiresAt?: number | null;
}): { outboxId: number; duplicate: boolean } {
  ensureEnvironment(input.environment);
  const reply = telegramBotReplySchema.parse(input.reply);
  const chatId = idText(input.recipientChatId);
  const recipientUserId =
    input.recipientTelegramUserId == null ? null : idText(input.recipientTelegramUserId);
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 255) throw new Error("Некорректный idempotency key");
  const now = input.now ?? Date.now();
  return transaction(() => {
    const existing = get<{ id: number }>(
      "SELECT id FROM telegram_outbox WHERE environment = ? AND idempotency_key = ?",
      [input.environment, key],
    );
    if (existing) return { outboxId: existing.id, duplicate: true };
    if (input.conversationId != null)
      ensureConversationInEnvironment(input.environment, input.conversationId);
    if (input.leadId != null) {
      const lead = get<{ id: number }>("SELECT id FROM lead WHERE id = ?", [input.leadId]);
      if (!lead) throw new Error("Заявка не найдена");
    }
    const outbox = run(
      `INSERT INTO telegram_outbox
       (environment, conversation_id, lead_id, message_id, recipient_chat_id, recipient_telegram_user_id,
        payload, idempotency_key, status, attempts, next_attempt_at, created_at, expires_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      [
        input.environment,
        input.conversationId ?? null,
        input.leadId ?? null,
        chatId,
        recipientUserId,
        jsonObject(reply),
        key,
        now,
        now,
        input.expiresAt ?? null,
      ],
    );
    return { outboxId: outbox.lastId, duplicate: false };
  });
}

export type SaveOperatorDraftInput = {
  environment: TelegramEnvironment;
  sessionId: number;
  expectedVersion: number;
  conversationId: number;
  recipientChatId: string | number | bigint;
  recipientTelegramUserId?: string | number | bigint | null;
  mode: "reply_draft" | "internal_note";
  draftText: string;
  now?: number;
};

export function saveOperatorDraft(input: SaveOperatorDraftInput): number {
  ensureEnvironment(input.environment);
  const conversation = ensureConversationInEnvironment(input.environment, input.conversationId);
  const recipientChatId = idText(input.recipientChatId);
  const recipientUserId =
    input.recipientTelegramUserId == null ? null : idText(input.recipientTelegramUserId);
  if (conversation.client_chat_id !== recipientChatId) {
    throw new Error("Получатель черновика не совпадает с чатом диалога");
  }
  if (conversation.status === "closed")
    throw new Error("нельзя создать черновик для закрытого диалога");
  const now = input.now ?? Date.now();
  const expiresAt = now + TELEGRAM_RETENTION.draftMs;
  const result = run(
    `UPDATE telegram_operator_session
     SET selected_conversation_id = ?, mode = ?, draft_text = ?,
         draft_recipient_chat_id = ?, draft_recipient_user_id = ?,
         draft_version = draft_version + 1, draft_expires_at = ?, updated_at = ?
     WHERE id = ? AND environment = ? AND draft_version = ?
       AND (draft_expires_at IS NULL OR draft_expires_at > ?)`,
    [
      input.conversationId,
      input.mode,
      input.draftText.slice(0, 100_000),
      recipientChatId,
      recipientUserId,
      expiresAt,
      now,
      input.sessionId,
      input.environment,
      input.expectedVersion,
      now,
    ],
  );
  if (result.changes !== 1) throw new Error("устаревшая сессия оператора");
  return input.expectedVersion + 1;
}

export type CreateOperatorActionInput = {
  environment: TelegramEnvironment;
  operatorTelegramUserId: string | number | bigint;
  operatorChatId: string | number | bigint;
  conversationId: number | null;
  actionType: string;
  recipientChatId: string | number | bigint;
  recipientTelegramUserId?: string | number | bigint | null;
  draftVersion: number;
  payload?: Record<string, unknown>;
  expiresAt?: number;
  now?: number;
};

export function createTelegramOperatorAction(
  input: CreateOperatorActionInput,
): TelegramOperatorAction {
  ensureEnvironment(input.environment);
  if (input.conversationId != null) {
    const conversation = ensureConversationInEnvironment(input.environment, input.conversationId);
    if (conversation.client_chat_id !== idText(input.recipientChatId)) {
      throw new Error("Получатель action не совпадает с чатом диалога");
    }
  }
  const now = input.now ?? Date.now();
  const actionKey = randomUUID();
  const recipientUserId =
    input.recipientTelegramUserId == null ? null : idText(input.recipientTelegramUserId);
  const expiresAt = input.expiresAt ?? now + TELEGRAM_RETENTION.actionMs;
  run(
    `INSERT INTO telegram_operator_action
     (action_key, environment, operator_telegram_user_id, operator_chat_id, conversation_id,
      action_type, recipient_chat_id, recipient_telegram_user_id, draft_version, payload,
      created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actionKey,
      input.environment,
      idText(input.operatorTelegramUserId),
      idText(input.operatorChatId),
      input.conversationId,
      input.actionType.slice(0, 100),
      idText(input.recipientChatId),
      recipientUserId,
      input.draftVersion,
      jsonObject(input.payload),
      now,
      expiresAt,
    ],
  );
  return {
    actionKey,
    environment: input.environment,
    operatorTelegramUserId: idText(input.operatorTelegramUserId),
    operatorChatId: idText(input.operatorChatId),
    conversationId: input.conversationId,
    actionType: input.actionType,
    recipientChatId: idText(input.recipientChatId),
    recipientTelegramUserId: recipientUserId,
    draftVersion: input.draftVersion,
    payload: input.payload ?? {},
    expiresAt,
  };
}

export function consumeTelegramOperatorAction(input: {
  actionKey: string;
  environment: TelegramEnvironment;
  operatorTelegramUserId: string | number | bigint;
  operatorChatId: string | number | bigint;
  expectedDraftVersion: number;
  now?: number;
}): TelegramOperatorAction {
  ensureEnvironment(input.environment);
  const now = input.now ?? Date.now();
  return transaction(() => {
    const row = get<{
      action_key: string;
      environment: TelegramEnvironment;
      operator_telegram_user_id: string;
      operator_chat_id: string;
      conversation_id: number | null;
      action_type: string;
      recipient_chat_id: string;
      recipient_telegram_user_id: string | null;
      draft_version: number;
      payload: string;
      expires_at: number;
      consumed_at: number | null;
    }>("SELECT * FROM telegram_operator_action WHERE action_key = ?", [input.actionKey]);
    const session = get<TelegramOperatorSession>(
      `SELECT * FROM telegram_operator_session
       WHERE environment = ? AND operator_telegram_user_id = ? AND operator_chat_id = ?`,
      [input.environment, idText(input.operatorTelegramUserId), idText(input.operatorChatId)],
    );
    if (!row) throw new Error("действие оператора не найдено");
    if (
      row.environment !== input.environment ||
      row.operator_telegram_user_id !== idText(input.operatorTelegramUserId) ||
      row.operator_chat_id !== idText(input.operatorChatId) ||
      row.draft_version !== input.expectedDraftVersion ||
      row.consumed_at != null ||
      row.expires_at <= now ||
      !session ||
      session.draft_version !== input.expectedDraftVersion ||
      session.updated_at <= now - TELEGRAM_RETENTION.sessionMs ||
      (session.draft_expires_at != null && session.draft_expires_at <= now)
    ) {
      throw new Error("действие оператора устарело или не принадлежит этому чату");
    }
    const updated = run(
      `UPDATE telegram_operator_action SET consumed_at = ?
       WHERE action_key = ? AND consumed_at IS NULL AND expires_at > ?`,
      [now, input.actionKey, now],
    );
    if (updated.changes !== 1) throw new Error("действие оператора уже использовано");
    let payload: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(row.payload);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = {};
    }
    return {
      actionKey: row.action_key,
      environment: row.environment,
      operatorTelegramUserId: row.operator_telegram_user_id,
      operatorChatId: row.operator_chat_id,
      conversationId: row.conversation_id,
      actionType: row.action_type,
      recipientChatId: row.recipient_chat_id,
      recipientTelegramUserId: row.recipient_telegram_user_id,
      draftVersion: row.draft_version,
      payload,
      expiresAt: row.expires_at,
    };
  });
}

export type EnqueueOperatorReplyInput = {
  environment: TelegramEnvironment;
  conversationId: number;
  operatorTelegramUserId: string | number | bigint;
  recipientChatId: string | number | bigint;
  recipientTelegramUserId?: string | number | bigint | null;
  text: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  now?: number;
  expiresAt?: number | null;
};

export function enqueueOperatorReply(input: EnqueueOperatorReplyInput): {
  messageId: number;
  outboxId: number;
  duplicate: boolean;
} {
  ensureEnvironment(input.environment);
  const recipientChatId = idText(input.recipientChatId);
  const recipientUserId =
    input.recipientTelegramUserId == null ? null : idText(input.recipientTelegramUserId);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 255)
    throw new Error("Некорректный idempotency key");
  const now = input.now ?? Date.now();

  return transaction(() => {
    const existing = get<{ id: number; message_id: number | null }>(
      `SELECT id, message_id FROM telegram_outbox
       WHERE environment = ? AND idempotency_key = ?`,
      [input.environment, idempotencyKey],
    );
    if (existing && existing.message_id != null) {
      return { messageId: existing.message_id, outboxId: existing.id, duplicate: true };
    }

    const conversation = get<{ client_chat_id: string; status: TelegramConversationStatus }>(
      `SELECT client_chat_id, status FROM telegram_conversation
       WHERE environment = ? AND id = ?`,
      [input.environment, input.conversationId],
    );
    if (!conversation) throw new Error("диалог не найден в этом окружении");
    if (conversation.client_chat_id !== recipientChatId) {
      throw new Error("получатель не совпадает с подтверждённым личным чатом клиента");
    }
    if (conversation.status === "closed") throw new Error("нельзя ответить в закрытый диалог");

    const message = run(
      `INSERT INTO telegram_message
       (environment, conversation_id, direction, message_type, sender_telegram_user_id,
        chat_id, text, metadata, delivery_status, created_at, updated_at)
       VALUES (?, ?, 'operator', 'text', ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        input.environment,
        input.conversationId,
        idText(input.operatorTelegramUserId),
        recipientChatId,
        input.text.slice(0, 100_000),
        jsonObject(input.metadata),
        now,
        now,
      ],
    );
    const outbox = run(
      `INSERT INTO telegram_outbox
       (environment, conversation_id, message_id, recipient_chat_id, recipient_telegram_user_id,
        payload, idempotency_key, status, attempts, next_attempt_at, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      [
        input.environment,
        input.conversationId,
        message.lastId,
        recipientChatId,
        recipientUserId,
        jsonObject({ text: input.text.slice(0, 100_000), messageId: message.lastId }),
        idempotencyKey,
        now,
        now,
        input.expiresAt ?? null,
      ],
    );
    run(
      `UPDATE telegram_conversation
       SET status = 'waiting_client', last_message_at = ?, updated_at = ?
       WHERE environment = ? AND id = ?`,
      [now, now, input.environment, input.conversationId],
    );
    return { messageId: message.lastId, outboxId: outbox.lastId, duplicate: false };
  });
}

export function markTelegramOutboxResult(
  environment: TelegramEnvironment,
  outboxId: number,
  result: {
    status: "sent" | "failed" | "unknown";
    error?: string;
    sentAt?: number;
    telegramMessageId?: number;
  },
): void {
  ensureEnvironment(environment);
  const now = result.sentAt ?? Date.now();
  transaction(() => {
    const row = get<{
      message_id: number | null;
      lead_id: number | null;
      status: TelegramOutboxEntry["status"];
    }>("SELECT message_id, lead_id, status FROM telegram_outbox WHERE environment = ? AND id = ?", [
      environment,
      outboxId,
    ]);
    if (!row) throw new Error("outbox не найден");
    run(
      `UPDATE telegram_outbox SET status = ?, last_error = ?, locked_at = NULL,
       sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END
       WHERE environment = ? AND id = ?`,
      [result.status, safeErrorCode(result.error), result.status, now, environment, outboxId],
    );
    if (row.lead_id != null) {
      run(`UPDATE lead SET delivered = ?, delivery_error = ? WHERE id = ?`, [
        result.status === "sent" ? 1 : 0,
        result.status === "sent" ? "" : safeErrorCode(result.error),
        row.lead_id,
      ]);
    }
    if (row.message_id != null) {
      run(
        `UPDATE telegram_message
         SET delivery_status = ?,
             telegram_message_id = CASE WHEN ? IS NOT NULL THEN ? ELSE telegram_message_id END,
             delivered_at = CASE WHEN ? = 'sent' THEN ? ELSE delivered_at END,
             updated_at = ?
         WHERE environment = ? AND id = ?`,
        [
          result.status,
          result.telegramMessageId ?? null,
          result.telegramMessageId ?? null,
          result.status,
          now,
          now,
          environment,
          row.message_id,
        ],
      );
    }
    touchTelegramOutboxState({
      environment,
      status: result.status,
      errorCode: result.error,
      now,
    });
  });
}

/** Возвращает временный сбой в очередь, не меняя число уже сделанных попыток. */
export function rescheduleTelegramOutbox(
  environment: TelegramEnvironment,
  outboxId: number,
  nextAttemptAt: number,
  errorCode: string,
): void {
  ensureEnvironment(environment);
  const result = run(
    `UPDATE telegram_outbox
     SET status = 'pending', next_attempt_at = ?, last_error = ?, locked_at = NULL
     WHERE environment = ? AND id = ? AND status = 'processing'`,
    [nextAttemptAt, safeErrorCode(errorCode), environment, outboxId],
  );
  if (result.changes !== 1) throw new Error("outbox уже обработан или не найден");
}

/** Снимает протухшие черновики и удаляет технические записи по срокам. */
export function purgeExpiredTelegramData(now = Date.now()): Record<string, number> {
  return transaction(() => {
    const result: Record<string, number> = {};
    result.actions = run(
      "DELETE FROM telegram_operator_action WHERE expires_at <= ? OR (consumed_at IS NOT NULL AND created_at < ?)",
      [now, now - TELEGRAM_RETENTION.actionMs],
    ).changes;
    result.leadLinks = run(
      "DELETE FROM telegram_lead_link WHERE expires_at <= ? OR (consumed_at IS NOT NULL AND created_at < ?)",
      [now, now - TELEGRAM_RETENTION.leadLinkMs],
    ).changes;
    result.clientActions = run(
      "DELETE FROM telegram_client_action WHERE expires_at <= ? OR (consumed_at IS NOT NULL AND created_at < ?)",
      [now, now - TELEGRAM_RETENTION.actionMs],
    ).changes;
    result.expiredSessions = run("DELETE FROM telegram_operator_session WHERE updated_at < ?", [
      now - TELEGRAM_RETENTION.sessionMs,
    ]).changes;
    result.clientSessions = run("DELETE FROM telegram_client_session WHERE updated_at < ?", [
      now - TELEGRAM_RETENTION.sessionMs,
    ]).changes;
    result.clientDrafts = run(
      `UPDATE telegram_client_session
       SET mode = 'menu', selected_conversation_id = NULL, draft_payload = '{}',
           draft_expires_at = NULL, version = version + 1, updated_at = ?
       WHERE draft_expires_at IS NOT NULL AND draft_expires_at <= ?`,
      [now, now],
    ).changes;
    result.drafts = run(
      `UPDATE telegram_operator_session
       SET mode = 'menu', draft_text = '', draft_recipient_chat_id = NULL,
           draft_recipient_user_id = NULL, draft_expires_at = NULL,
           draft_version = draft_version + 1, updated_at = ?
       WHERE draft_expires_at IS NOT NULL AND draft_expires_at <= ?`,
      [now, now],
    ).changes;
    result.events = run(
      "DELETE FROM telegram_event WHERE (expires_at IS NOT NULL AND expires_at <= ?) OR created_at < ?",
      [now, now - TELEGRAM_RETENTION.eventsMs],
    ).changes;
    result.rawUpdates = run(
      `DELETE FROM telegram_update
       WHERE received_at < ? AND status IN ('processed','failed')`,
      [now - TELEGRAM_RETENTION.rawUpdatesMs],
    ).changes;
    result.inbox = run(
      `DELETE FROM telegram_inbox
       WHERE created_at < ? AND status IN ('processed','failed')`,
      [now - TELEGRAM_RETENTION.rawUpdatesMs],
    ).changes;
    result.outbox = run(
      `DELETE FROM telegram_outbox
       WHERE created_at < ? AND status IN ('sent','failed','unknown','cancelled')`,
      [now - TELEGRAM_RETENTION.outboxMs],
    ).changes;
    result.files = run(
      "DELETE FROM telegram_file WHERE (expires_at IS NOT NULL AND expires_at <= ?) OR created_at < ?",
      [now, now - TELEGRAM_RETENTION.messagesMs],
    ).changes;
    result.messages = run("DELETE FROM telegram_message WHERE created_at < ?", [
      now - TELEGRAM_RETENTION.messagesMs,
    ]).changes;
    result.conversations = run(
      `DELETE FROM telegram_conversation
       WHERE last_message_at < ?`,
      [now - TELEGRAM_RETENTION.messagesMs],
    ).changes;
    result.contacts = run(
      `DELETE FROM telegram_contact
       WHERE telegram_contact.last_seen_at < ?
         AND NOT EXISTS (
           SELECT 1 FROM telegram_conversation conversation
           WHERE conversation.telegram_contact_id = telegram_contact.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM telegram_miniapp_session session
           WHERE session.telegram_contact_id = telegram_contact.id
         )`,
      [now - TELEGRAM_RETENTION.messagesMs],
    ).changes;
    return result;
  });
}
