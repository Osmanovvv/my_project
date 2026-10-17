/** Callback содержит только непрозрачный ключ. Адресат и права берутся из базы/env. */
import { randomUUID } from "node:crypto";

import { get, run } from "./db.server";
import { TELEGRAM_RETENTION, type TelegramEnvironment } from "./telegram-data.server";

export const TELEGRAM_CLIENT_ACTION_TYPES = [
  "menu",
  "request",
  "status",
  "select_conversation",
  "cancel",
  "help",
] as const;
export type TelegramClientActionType = (typeof TELEGRAM_CLIENT_ACTION_TYPES)[number];

export function createTelegramClientAction(input: {
  environment: TelegramEnvironment;
  userId: string;
  chatId: string;
  actionType: TelegramClientActionType;
  conversationId?: number;
  sessionVersion?: number;
  payload?: Record<string, unknown>;
  now?: number;
}): string {
  if (!/^[1-9]\d*$/.test(input.userId) || input.chatId !== input.userId)
    throw new Error("private_chat_required");
  if (input.actionType === "select_conversation" && input.conversationId == null)
    throw new Error("conversation_required");
  if (
    input.conversationId != null &&
    !get(
      `SELECT c.id FROM telegram_conversation c JOIN telegram_contact p ON p.id = c.telegram_contact_id
     WHERE c.id = ? AND c.environment = ? AND p.environment = ? AND p.telegram_user_id = ? AND c.client_chat_id = ?`,
      [input.conversationId, input.environment, input.environment, input.userId, input.chatId],
    )
  )
    throw new Error("conversation_not_owned");
  const key = randomUUID();
  const now = input.now ?? Date.now();
  run(
    `INSERT INTO telegram_client_action
     (action_key, environment, telegram_user_id, chat_id, conversation_id, action_type, created_at, expires_at, session_version, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      key,
      input.environment,
      input.userId,
      input.chatId,
      input.conversationId ?? null,
      input.actionType,
      now,
      now + TELEGRAM_RETENTION.actionMs,
      input.sessionVersion ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  return `client:${key}`;
}

export type ValidatedTelegramCallback = {
  key: string;
  role: "client" | "operator";
  environment: TelegramEnvironment;
  actionType: string;
  conversationId: number | null;
  payload: Record<string, unknown>;
};

type CallbackRow = {
  environment: TelegramEnvironment;
  conversation_id: number | null;
  action_type: string;
  payload: string;
  expires_at: number;
  consumed_at: number | null;
  queued_update_id: number | null;
};

export function validateTelegramCallback(input: {
  data: string;
  userId: string;
  chatId: string;
  isOperator: boolean;
  environment: TelegramEnvironment;
  appEnvironment: TelegramEnvironment;
  now: number;
}): ValidatedTelegramCallback | null {
  const match =
    /^(op|client):([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(
      input.data,
    );
  if (!match) return null;
  const [, prefix, key] = match;
  if (prefix === "op" && !input.isOperator) return null;
  let row: CallbackRow | undefined;
  if (prefix === "op") {
    // Проверяется текущая сохранённая версия, а не версия из callback payload.
    row = get<CallbackRow>(
      `SELECT a.* FROM telegram_operator_action a
       JOIN telegram_operator_session s ON s.environment = a.environment
         AND s.operator_telegram_user_id = a.operator_telegram_user_id AND s.operator_chat_id = a.operator_chat_id
       LEFT JOIN telegram_conversation c ON c.id = a.conversation_id AND c.environment = a.environment
       LEFT JOIN telegram_contact p ON p.id = c.telegram_contact_id AND p.environment = c.environment
       WHERE a.action_key = ? AND a.operator_telegram_user_id = ? AND a.operator_chat_id = ?
         AND (a.conversation_id IS NULL OR (a.action_type = 'open') OR (a.recipient_chat_id = c.client_chat_id
           AND (a.recipient_telegram_user_id IS NULL OR a.recipient_telegram_user_id = p.telegram_user_id)
           AND s.selected_conversation_id = a.conversation_id))
         AND a.draft_version = s.draft_version
         AND s.updated_at >= ? AND (s.draft_expires_at IS NULL OR s.draft_expires_at > ?)`,
      [key, input.userId, input.chatId, input.now - TELEGRAM_RETENTION.sessionMs, input.now],
    );
  } else {
    row = get<CallbackRow>(
      `SELECT a.* FROM telegram_client_action a
       LEFT JOIN telegram_conversation c ON c.id = a.conversation_id AND c.environment = a.environment
       LEFT JOIN telegram_contact p ON p.id = c.telegram_contact_id AND p.environment = a.environment
       LEFT JOIN telegram_client_session s ON s.environment = a.environment
         AND s.telegram_user_id = a.telegram_user_id AND s.chat_id = a.chat_id
       WHERE a.action_key = ? AND a.telegram_user_id = ? AND a.chat_id = ?
         AND (a.session_version IS NULL OR (s.version = a.session_version AND s.updated_at > ?))
         AND (a.conversation_id IS NULL OR (c.client_chat_id = a.chat_id AND p.telegram_user_id = a.telegram_user_id))`,
      [key, input.userId, input.chatId, input.now - TELEGRAM_RETENTION.sessionMs],
    );
  }
  if (
    !row ||
    row.expires_at <= input.now ||
    row.consumed_at != null ||
    row.queued_update_id != null
  )
    return null;
  // Только оператор production-приёмника может открыть test-кнопку:
  // её окружение подтверждено записью сервера, а не переданным флагом.
  const operatorTestAction =
    prefix === "op" &&
    input.isOperator &&
    input.appEnvironment === "production" &&
    row.environment === "test";
  if (row.environment !== input.environment && !operatorTestAction) return null;
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      payload = parsed as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    key,
    role: prefix === "op" ? "operator" : "client",
    environment: row.environment,
    actionType: row.action_type,
    conversationId: row.conversation_id,
    payload,
  };
}

/** Вызывается внутри транзакции приёма update: кнопка попадает в inbox один раз. */
export function reserveTelegramCallback(action: ValidatedTelegramCallback, updateId: number): void {
  const table = action.role === "operator" ? "telegram_operator_action" : "telegram_client_action";
  const result = run(
    `UPDATE ${table} SET queued_update_id = ? WHERE action_key = ? AND environment = ?
     AND queued_update_id IS NULL AND consumed_at IS NULL`,
    [updateId, action.key, action.environment],
  );
  if (result.changes !== 1) throw new Error("callback_already_queued");
}
