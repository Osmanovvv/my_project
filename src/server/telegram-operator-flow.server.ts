/** Закрытый операторский поток Telegram.
 *
 * Любое действие здесь приходит из уже проверенного webhook inbox. Повторная
 * проверка владельца, окружения и версии сессии выполняется callback-слоем,
 * а свободный текст никогда не считается ответом без явного режима и
 * подтверждения.
 */
import { all, get, run } from "./db.server";
import {
  consumeTelegramOperatorAction,
  currentTelegramEnvironment,
  createTelegramOperatorAction,
  enqueueOperatorReply,
  enqueueTelegramBotReply,
  getOrCreateTelegramOperatorSession,
  getTelegramContactById,
  getTelegramConversation,
  getTelegramConversationLead,
  listTelegramMessages,
  listTelegramOperatorConversations,
  markTelegramConversationRead,
  reopenTelegramConversation,
  recordTelegramMessage,
  saveOperatorDraft,
  setTelegramConversationStatus,
  type TelegramConversation,
  type TelegramEnvironment,
  type TelegramOperatorSession,
} from "./telegram-data.server";
import { validateTelegramMedia } from "./telegram-media.server";
import { isTelegramDeliveryEnabled } from "../lib/telegram.server";

type InboxRow = {
  id: number;
  environment: TelegramEnvironment;
  update_id: number;
  payload: string;
};

type OperatorAction = {
  key?: string;
  actionType?: string;
  conversationId?: number | null;
  environment?: TelegramEnvironment;
  role?: string;
};

type StoredInbound = {
  updateId: number;
  userId: string;
  chatId: string;
  messageId: number;
  displayName: string;
  username: string;
  kind: "text" | "photo" | "file" | "voice" | "callback";
  text: string;
  media?: Record<string, unknown>;
  action?: OperatorAction;
};

const LIST_LIMIT = 8;

function parsePayload(payload: string): StoredInbound {
  const parsed = JSON.parse(payload) as Partial<StoredInbound>;
  if (
    typeof parsed.updateId !== "number" ||
    typeof parsed.userId !== "string" ||
    typeof parsed.chatId !== "string" ||
    parsed.userId !== parsed.chatId ||
    typeof parsed.messageId !== "number" ||
    typeof parsed.kind !== "string"
  )
    throw new Error("telegram_operator_payload_invalid");
  return {
    updateId: parsed.updateId,
    userId: parsed.userId,
    chatId: parsed.chatId,
    messageId: parsed.messageId,
    displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
    username: typeof parsed.username === "string" ? parsed.username : "",
    kind: parsed.kind as StoredInbound["kind"],
    text: typeof parsed.text === "string" ? parsed.text : "",
    media: parsed.media,
    action: parsed.action,
  };
}

function commandOf(text: string): string {
  return text.trim().split(/\s+/, 1)[0].split("@", 1)[0].toLowerCase();
}

function operatorReply(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  text: string,
  keyboard: Array<Array<{ text: string; callback_data: string }>> = [],
  suffix = "0",
): void {
  enqueueTelegramBotReply({
    environment,
    recipientChatId: inbound.chatId,
    recipientTelegramUserId: inbound.userId,
    conversationId: null,
    reply: {
      text: text.slice(0, 3900),
      ...(keyboard.length ? { replyMarkup: { inline_keyboard: keyboard } } : {}),
    },
    idempotencyKey: `operator:${environment}:${inbound.updateId}:${suffix}`,
  });
}

function operatorIds(): string[] {
  return (process.env.TELEGRAM_OPERATOR_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[1-9]\d*$/.test(value));
}

function statusLabel(status: string): string {
  return (
    (
      {
        open: "новая",
        waiting_operator: "ждёт ответа",
        waiting_client: "ждём клиента",
        closed: "закрыта",
      } as Record<string, string>
    )[status] ?? status
  );
}

function modeLabel(environment: TelegramEnvironment): string {
  return environment === "test" ? "ТЕСТОВЫЙ" : "РАБОЧИЙ";
}

export function isTelegramOperatorAvailable(): boolean {
  return Boolean(
    isTelegramDeliveryEnabled() &&
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
    process.env.TELEGRAM_OPERATOR_CHAT_ID?.trim() &&
    operatorIds().length,
  );
}

function titleOf(conversation: TelegramConversation): string {
  return conversation.title.trim() || `Обращение №${conversation.id}`;
}

function recipientOf(
  environment: TelegramEnvironment,
  conversationId: number,
): {
  conversation: TelegramConversation;
  userId: string;
  chatId: string;
  displayName: string;
  username: string;
} {
  const conversation = getTelegramConversation(environment, conversationId);
  if (!conversation) throw new Error("диалог не найден");
  const contact = getTelegramContactById(environment, conversation.telegram_contact_id);
  if (!contact) throw new Error("профиль клиента не найден");
  return {
    conversation,
    userId: contact.telegram_user_id,
    chatId: conversation.client_chat_id,
    displayName: contact.display_name,
    username: contact.username,
  };
}

function bumpSession(
  environment: TelegramEnvironment,
  session: TelegramOperatorSession,
  mode: TelegramOperatorSession["mode"],
  selectedConversationId: number | null,
): TelegramOperatorSession {
  const result = run(
    `UPDATE telegram_operator_session
     SET selected_conversation_id = ?, mode = ?, draft_text = '',
         draft_recipient_chat_id = NULL, draft_recipient_user_id = NULL,
         draft_expires_at = NULL, draft_version = draft_version + 1, updated_at = ?
     WHERE id = ? AND environment = ? AND draft_version = ?`,
    [selectedConversationId, mode, Date.now(), session.id, environment, session.draft_version],
  );
  if (result.changes !== 1) throw new Error("устаревшая сессия оператора");
  return getOrCreateTelegramOperatorSession(
    environment,
    session.operator_telegram_user_id,
    session.operator_chat_id,
  );
}

function actionButton(
  environment: TelegramEnvironment,
  session: TelegramOperatorSession,
  actionType: string,
  conversationId: number | null,
  recipientChatId: string,
  recipientTelegramUserId: string | null,
  payload?: Record<string, unknown>,
): string {
  return `op:${
    createTelegramOperatorAction({
      environment,
      operatorTelegramUserId: session.operator_telegram_user_id,
      operatorChatId: session.operator_chat_id,
      conversationId,
      actionType,
      recipientChatId,
      recipientTelegramUserId,
      draftVersion: session.draft_version,
      payload,
    }).actionKey
  }`;
}

function menu(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
): void {
  const next = bumpSession(environment, session, "menu", null);
  const global = (type: string, payload?: Record<string, unknown>) =>
    actionButton(environment, next, type, null, inbound.chatId, inbound.userId, payload);
  const targetEnvironment = environment === "test" ? "production" : "test";
  const canSwitchToProduction = currentTelegramEnvironment() === "production";
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: "Новые заявки", callback_data: global("list", { category: "new" }) }],
    [{ text: "Диалоги", callback_data: global("list", { category: "all" }) }],
    [{ text: "Ожидают ответа", callback_data: global("list", { category: "waiting" }) }],
    [{ text: "Непрочитанные", callback_data: global("list", { category: "unread" }) }],
    [{ text: "Поиск: /search текст", callback_data: global("help") }],
  ];
  if (canSwitchToProduction || targetEnvironment === "test")
    buttons.push([
      {
        text: `Переключить в ${modeLabel(targetEnvironment)}`,
        callback_data: global("switch_environment", { environment: targetEnvironment }),
      },
    ]);
  operatorReply(
    environment,
    inbound,
    `Панель оператора IT-Agent\nРежим: ${modeLabel(environment)}\nВыберите раздел:`,
    buttons,
  );
}

function categoryOptions(payload: Record<string, unknown>): {
  status: "all" | "open" | "waiting_operator";
  unreadOnly: boolean;
  offset: number;
  label: string;
} {
  const category = typeof payload.category === "string" ? payload.category : "all";
  const offset =
    typeof payload.offset === "number" && payload.offset >= 0 ? Math.trunc(payload.offset) : 0;
  if (category === "new")
    return { status: "open", unreadOnly: false, offset, label: "Новые заявки" };
  if (category === "waiting")
    return { status: "waiting_operator", unreadOnly: false, offset, label: "Ожидают ответа" };
  if (category === "unread")
    return { status: "all", unreadOnly: true, offset, label: "Непрочитанные" };
  return { status: "all", unreadOnly: false, offset, label: "Диалоги" };
}

function showList(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  payload: Record<string, unknown>,
): void {
  const options = categoryOptions(payload);
  const conversations = listTelegramOperatorConversations({
    environment,
    status: options.status,
    unreadOnly: options.unreadOnly,
    limit: LIST_LIMIT,
    offset: options.offset,
  });
  const buttons = conversations.map((conversation) => {
    const recipient = recipientOf(environment, conversation.id);
    return [
      {
        text: `${conversation.unread_count ? "● " : ""}№${conversation.id} ${titleOf(conversation)} · ${statusLabel(conversation.status)}`.slice(
          0,
          100,
        ),
        callback_data: actionButton(
          environment,
          session,
          "open",
          conversation.id,
          recipient.chatId,
          recipient.userId,
        ),
      },
    ];
  });
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (options.offset > 0)
    navigation.push({
      text: "← Назад",
      callback_data: actionButton(
        environment,
        session,
        "list",
        null,
        inbound.chatId,
        inbound.userId,
        {
          category: payload.category,
          offset: Math.max(0, options.offset - LIST_LIMIT),
        },
      ),
    });
  if (conversations.length === LIST_LIMIT)
    navigation.push({
      text: "Дальше →",
      callback_data: actionButton(
        environment,
        session,
        "list",
        null,
        inbound.chatId,
        inbound.userId,
        {
          category: payload.category,
          offset: options.offset + LIST_LIMIT,
        },
      ),
    });
  if (navigation.length) buttons.push(navigation);
  buttons.push([
    {
      text: "← В меню",
      callback_data: actionButton(
        environment,
        session,
        "menu",
        null,
        inbound.chatId,
        inbound.userId,
      ),
    },
  ]);
  operatorReply(
    environment,
    inbound,
    conversations.length
      ? `${options.label} (страница ${Math.floor(options.offset / LIST_LIMIT) + 1}):`
      : `${options.label}: пока пусто.`,
    buttons,
    `list-${options.offset}-${options.status}-${options.unreadOnly}`,
  );
}

function search(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  query: string,
): void {
  const conversations = listTelegramOperatorConversations({
    environment,
    search: query,
    limit: LIST_LIMIT,
  });
  const buttons = conversations.map((conversation) => {
    const recipient = recipientOf(environment, conversation.id);
    return [
      {
        text: `№${conversation.id} ${titleOf(conversation)} · ${statusLabel(conversation.status)}`.slice(
          0,
          100,
        ),
        callback_data: actionButton(
          environment,
          session,
          "open",
          conversation.id,
          recipient.chatId,
          recipient.userId,
        ),
      },
    ];
  });
  buttons.push([
    {
      text: "← В меню",
      callback_data: actionButton(
        environment,
        session,
        "menu",
        null,
        inbound.chatId,
        inbound.userId,
      ),
    },
  ]);
  operatorReply(
    environment,
    inbound,
    conversations.length ? `Результаты поиска «${query.slice(0, 80)}»:` : "Ничего не найдено.",
    buttons,
    "search",
  );
}

function card(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  conversationId: number,
  offset = 0,
): void {
  const recipient = recipientOf(environment, conversationId);
  const pageOffset = Math.max(0, Math.trunc(offset));
  const messages = listTelegramMessages(environment, conversationId, 12, pageOffset);
  const history = messages
    .map((message) => {
      let metadata = "";
      try {
        const parsed = JSON.parse(message.metadata) as { media?: unknown };
        if (parsed.media) metadata = " [вложение]";
      } catch {
        metadata = "";
      }
      const who =
        message.direction === "client"
          ? "Клиент"
          : message.direction === "operator"
            ? "Вы"
            : "Заметка";
      return `${who}${metadata}: ${(message.text || "(без текста)").slice(0, 300)}`;
    })
    .join("\n");
  const lead = getTelegramConversationLead(environment, conversationId);
  const profile = [
    `Обращение №${conversationId}: ${titleOf(recipient.conversation)}`,
    `Клиент: ${recipient.displayName || "без имени"}${recipient.username ? ` (@${recipient.username})` : ""}`,
    `Telegram ID: ${recipient.userId}`,
    `Статус: ${statusLabel(recipient.conversation.status)}`,
    `Режим: ${modeLabel(environment)}${recipient.conversation.is_test ? " · карточка TEST" : ""}`,
    lead
      ? `Заявка #${lead.id}: ${lead.name}; ${lead.contact}; ${lead.status}\nИсточник: ${lead.source}${lead.sourceDetail ? ` · ${lead.sourceDetail}` : ""}\n${lead.task}`
      : "Заявка сайта ещё не привязана.",
    history
      ? `\nИстория (страница ${Math.floor(pageOffset / 12) + 1}):\n${history}`
      : "\nИстория пока пустая.",
  ].join("\n");
  const reply = actionButton(
    environment,
    session,
    "reply",
    conversationId,
    recipient.chatId,
    recipient.userId,
  );
  const note = actionButton(
    environment,
    session,
    "note",
    conversationId,
    recipient.chatId,
    recipient.userId,
  );
  const status = actionButton(
    environment,
    session,
    "status_menu",
    conversationId,
    recipient.chatId,
    recipient.userId,
  );
  const back = actionButton(environment, session, "menu", null, inbound.chatId, inbound.userId);
  const historyButtons: Array<{ text: string; callback_data: string }> = [];
  if (pageOffset > 0)
    historyButtons.push({
      text: "← Предыдущие",
      callback_data: actionButton(
        environment,
        session,
        "history",
        conversationId,
        recipient.chatId,
        recipient.userId,
        { offset: pageOffset - 12 },
      ),
    });
  if (messages.length === 12)
    historyButtons.push({
      text: "Следующие →",
      callback_data: actionButton(
        environment,
        session,
        "history",
        conversationId,
        recipient.chatId,
        recipient.userId,
        { offset: pageOffset + 12 },
      ),
    });
  const markRead = recipient.conversation.unread_count
    ? actionButton(
        environment,
        session,
        "mark_read",
        conversationId,
        recipient.chatId,
        recipient.userId,
      )
    : null;
  if (recipient.conversation.status === "closed") {
    const reopen = actionButton(
      environment,
      session,
      "reopen",
      conversationId,
      recipient.chatId,
      recipient.userId,
    );
    const closedButtons: Array<Array<{ text: string; callback_data: string }>> = [];
    if (historyButtons.length) closedButtons.push(historyButtons);
    if (markRead)
      closedButtons.push([
        {
          text: `Отметить прочитанным (${recipient.conversation.unread_count})`,
          callback_data: markRead,
        },
      ]);
    closedButtons.push(
      [{ text: "Открыть снова", callback_data: reopen }],
      [{ text: "← В меню", callback_data: back }],
    );
    operatorReply(environment, inbound, profile, closedButtons, `card-${conversationId}`);
    return;
  }
  const cardButtons: Array<Array<{ text: string; callback_data: string }>> = [];
  if (historyButtons.length) cardButtons.push(historyButtons);
  if (markRead)
    cardButtons.push([
      {
        text: `Отметить прочитанным (${recipient.conversation.unread_count})`,
        callback_data: markRead,
      },
    ]);
  cardButtons.push(
    [{ text: "Ответить клиенту", callback_data: reply }],
    [{ text: "Добавить заметку", callback_data: note }],
    [{ text: "Изменить статус", callback_data: status }],
    [{ text: "← В меню", callback_data: back }],
  );
  operatorReply(environment, inbound, profile, cardButtons, `card-${conversationId}`);
}

function showStatusMenu(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  conversationId: number,
): void {
  const recipient = recipientOf(environment, conversationId);
  const statusButton = (status: string, text: string) => ({
    text,
    callback_data: actionButton(
      environment,
      session,
      "set_status",
      conversationId,
      recipient.chatId,
      recipient.userId,
      { status },
    ),
  });
  operatorReply(
    environment,
    inbound,
    `Текущий статус: ${statusLabel(recipient.conversation.status)}\nВыберите новый статус:`,
    [
      [statusButton("open", "Открыто")],
      [statusButton("waiting_operator", "Ждёт ответа оператора")],
      [statusButton("waiting_client", "Ждём клиента")],
      [statusButton("closed", "Закрыть диалог")],
      [
        {
          text: "← К карточке",
          callback_data: actionButton(
            environment,
            session,
            "open",
            conversationId,
            recipient.chatId,
            recipient.userId,
          ),
        },
      ],
    ],
    `status-${conversationId}`,
  );
}

function preview(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  mode: "reply_draft" | "internal_note",
): void {
  if (!session.selected_conversation_id || !session.draft_text.trim())
    throw new Error("пустой черновик");
  const recipient = recipientOf(environment, session.selected_conversation_id);
  const isNote = mode === "internal_note";
  const confirmType = isNote ? "confirm_note" : "confirm_reply";
  const cancelType = "cancel_draft";
  const confirm = actionButton(
    environment,
    session,
    confirmType,
    recipient.conversation.id,
    recipient.chatId,
    recipient.userId,
  );
  const cancel = actionButton(
    environment,
    session,
    cancelType,
    recipient.conversation.id,
    recipient.chatId,
    recipient.userId,
  );
  operatorReply(
    environment,
    inbound,
    `${isNote ? "Предпросмотр внутренней заметки" : `Предпросмотр ответа для ${recipient.displayName || "клиента"} (${recipient.chatId})`}:\n\n${session.draft_text.slice(0, 2500)}`,
    [
      [
        { text: isNote ? "Сохранить заметку" : "Отправить клиенту", callback_data: confirm },
        { text: "Отмена", callback_data: cancel },
      ],
    ],
    "preview",
  );
}

function startDraft(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  conversationId: number,
  mode: "reply_draft" | "internal_note",
): void {
  const recipient = recipientOf(environment, conversationId);
  const draftVersion = saveOperatorDraft({
    environment,
    sessionId: session.id,
    expectedVersion: session.draft_version,
    conversationId,
    recipientChatId: recipient.chatId,
    recipientTelegramUserId: recipient.userId,
    mode,
    draftText: "",
  });
  operatorReply(
    environment,
    inbound,
    mode === "reply_draft"
      ? `Режим: ${modeLabel(environment)}. Напишите ответ клиенту. Получатель зафиксирован: ${recipient.chatId}. Для отмены — /cancel.`
      : `Режим: ${modeLabel(environment)}. Напишите внутреннюю заметку. Она останется только в истории оператора. Для отмены — /cancel.`,
    [],
    `draft-${draftVersion}`,
  );
}

function saveDraftText(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
): void {
  if (!session.selected_conversation_id) throw new Error("диалог для черновика не выбран");
  if (session.mode !== "reply_draft" && session.mode !== "internal_note")
    throw new Error("режим черновика не активен");
  const recipient = recipientOf(environment, session.selected_conversation_id);
  const version = saveOperatorDraft({
    environment,
    sessionId: session.id,
    expectedVersion: session.draft_version,
    conversationId: session.selected_conversation_id,
    recipientChatId: recipient.chatId,
    recipientTelegramUserId: recipient.userId,
    mode: session.mode,
    draftText: inbound.text,
  });
  const fresh = getOrCreateTelegramOperatorSession(environment, inbound.userId, inbound.chatId);
  if (fresh.draft_version !== version) throw new Error("версия черновика не совпала");
  preview(environment, inbound, fresh, session.mode);
}

function finishDraft(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
  action: OperatorAction,
): void {
  if (!session.selected_conversation_id || !session.draft_text.trim())
    throw new Error("черновик пуст");
  const recipient = recipientOf(environment, session.selected_conversation_id);
  if (action.actionType === "confirm_reply") {
    enqueueOperatorReply({
      environment,
      conversationId: recipient.conversation.id,
      operatorTelegramUserId: inbound.userId,
      recipientChatId: recipient.chatId,
      recipientTelegramUserId: recipient.userId,
      text: session.draft_text,
      idempotencyKey: `operator-reply:${environment}:${inbound.updateId}:${session.draft_version}`,
      metadata: { operator_mode: modeLabel(environment) },
    });
    const next = bumpSession(environment, session, "menu", recipient.conversation.id);
    operatorReply(
      environment,
      inbound,
      `Ответ поставлен в outbox (${modeLabel(environment)}) и будет доставлен worker-ом.`,
      [],
      "reply-ok",
    );
    card(environment, inbound, next, recipient.conversation.id);
    return;
  }
  if (action.actionType === "confirm_note") {
    recordTelegramMessage({
      environment,
      conversationId: recipient.conversation.id,
      direction: "system",
      messageType: "internal_note",
      chatId: inbound.chatId,
      senderTelegramUserId: inbound.userId,
      text: session.draft_text,
      metadata: { visibility: "operator" },
    });
    const next = bumpSession(environment, session, "menu", recipient.conversation.id);
    operatorReply(
      environment,
      inbound,
      "Внутренняя заметка сохранена. Клиент её не увидит.",
      [],
      "note-ok",
    );
    card(environment, inbound, next, recipient.conversation.id);
  }
}

function handleOperatorMedia(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
): void {
  if (inbound.kind !== "photo" && inbound.kind !== "file" && inbound.kind !== "voice") return;
  const validation = validateTelegramMedia(inbound.kind, inbound.media);
  if (!validation.ok) {
    operatorReply(environment, inbound, validation.message, [], "media-rejected");
    return;
  }
  operatorReply(
    environment,
    inbound,
    session.mode === "menu"
      ? "Вложение получено, но свободные файлы не отправляются клиенту. Откройте диалог и выберите действие."
      : "Медиа для ответа пока не поддерживается. Отправьте текст или отмените черновик командой /cancel.",
    [],
    "media-unsupported",
  );
}

function handleCallback(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramOperatorSession,
): void {
  const action = inbound.action;
  if (!action?.key || action.role !== "operator") return;
  try {
    const consumed = consumeTelegramOperatorAction({
      actionKey: action.key,
      environment,
      operatorTelegramUserId: inbound.userId,
      operatorChatId: inbound.chatId,
      expectedDraftVersion: session.draft_version,
    });
    const payload = consumed.payload;
    if (consumed.actionType === "menu") menu(environment, inbound, session);
    else if (consumed.actionType === "switch_environment") {
      const target = payload.environment;
      if (target !== "test" && target !== "production") throw new Error("Некорректный режим");
      if (target === "production" && currentTelegramEnvironment() !== "production")
        throw new Error("рабочий режим доступен только production-приёмнику");
      const targetSession = getOrCreateTelegramOperatorSession(
        target,
        inbound.userId,
        inbound.chatId,
      );
      menu(target, inbound, targetSession);
    } else if (consumed.actionType === "help")
      operatorReply(
        environment,
        inbound,
        "Команды: /admin, /search текст, /cancel. Свободный текст отправляется клиенту только после кнопки «Ответить клиенту» и подтверждения.",
      );
    else if (consumed.actionType === "list") showList(environment, inbound, session, payload);
    else if (consumed.actionType === "open" && consumed.conversationId != null) {
      if (session.mode !== "menu") throw new Error("active_draft");
      const next = bumpSession(environment, session, "menu", consumed.conversationId);
      card(environment, inbound, next, consumed.conversationId);
    } else if (consumed.actionType === "history" && consumed.conversationId != null) {
      card(
        environment,
        inbound,
        session,
        consumed.conversationId,
        typeof payload.offset === "number" ? payload.offset : 0,
      );
    } else if (consumed.actionType === "mark_read" && consumed.conversationId != null) {
      markTelegramConversationRead(environment, consumed.conversationId);
      card(environment, inbound, session, consumed.conversationId);
    } else if (consumed.actionType === "status_menu" && consumed.conversationId != null) {
      showStatusMenu(environment, inbound, session, consumed.conversationId);
    } else if (consumed.actionType === "set_status" && consumed.conversationId != null) {
      const requested = consumed.payload.status;
      if (
        requested !== "open" &&
        requested !== "waiting_operator" &&
        requested !== "waiting_client" &&
        requested !== "closed"
      )
        throw new Error("Некорректный статус");
      const updated = setTelegramConversationStatus(
        environment,
        consumed.conversationId,
        requested,
      );
      const next = bumpSession(environment, session, "menu", updated.id);
      operatorReply(
        environment,
        inbound,
        `Статус обращения №${updated.id}: ${statusLabel(updated.status)}.`,
        [],
        "status-ok",
      );
      card(environment, inbound, next, updated.id);
    } else if (consumed.actionType === "reopen" && consumed.conversationId != null) {
      const updated = reopenTelegramConversation(environment, consumed.conversationId);
      const next = bumpSession(environment, session, "menu", updated.id);
      operatorReply(
        environment,
        inbound,
        `Обращение №${updated.id} снова открыто: ${statusLabel(updated.status)}.`,
        [],
        "reopen-ok",
      );
      card(environment, inbound, next, updated.id);
    } else if (
      (consumed.actionType === "reply" || consumed.actionType === "note") &&
      consumed.conversationId != null
    ) {
      startDraft(
        environment,
        inbound,
        session,
        consumed.conversationId,
        consumed.actionType === "reply" ? "reply_draft" : "internal_note",
      );
    } else if (consumed.actionType === "cancel_draft") {
      const next = bumpSession(environment, session, "menu", session.selected_conversation_id);
      operatorReply(
        environment,
        inbound,
        "Черновик отменён. Клиент ничего не получил.",
        [],
        "draft-cancel",
      );
      if (next.selected_conversation_id)
        card(environment, inbound, next, next.selected_conversation_id);
      else menu(environment, inbound, next);
    } else if (consumed.actionType === "confirm_reply" || consumed.actionType === "confirm_note")
      finishDraft(environment, inbound, session, consumed);
    else throw new Error("неизвестное действие оператора");
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const blockedByDraft = action.actionType === "open" && session.mode !== "menu";
    operatorReply(
      environment,
      inbound,
      blockedByDraft || code === "active_draft"
        ? "Сначала подтвердите или отмените текущий черновик командой /cancel. Диалог не переключён."
        : "Кнопка устарела или действие уже выполнено. Откройте /admin заново.",
      [],
      "callback-error",
    );
    console.error(
      JSON.stringify({
        scope: "telegram.operator",
        event: "callback_failed",
        code: error instanceof Error ? error.message : "callback_failed",
      }),
    );
  }
}

function processOne(row: InboxRow): void {
  const claimed = run(
    "UPDATE telegram_inbox SET status = 'processing' WHERE id = ? AND status = 'pending'",
    [row.id],
  );
  if (claimed.changes !== 1) return;
  let inbound: StoredInbound | undefined;
  try {
    inbound = parsePayload(row.payload);
    const session = getOrCreateTelegramOperatorSession(
      row.environment,
      inbound.userId,
      inbound.chatId,
    );
    if (inbound.kind === "callback") handleCallback(row.environment, inbound, session);
    else if (inbound.kind === "photo" || inbound.kind === "file" || inbound.kind === "voice")
      handleOperatorMedia(row.environment, inbound, session);
    else {
      const command = commandOf(inbound.text);
      if (command === "/admin") {
        const argument = inbound.text.trim().split(/\s+/).slice(1).join(" ").toLowerCase();
        if (argument === "new") showList(row.environment, inbound, session, { category: "new" });
        else if (argument === "waiting")
          showList(row.environment, inbound, session, { category: "waiting" });
        else if (argument === "unread")
          showList(row.environment, inbound, session, { category: "unread" });
        else menu(row.environment, inbound, session);
      } else if (command === "/search")
        search(
          row.environment,
          inbound,
          session,
          inbound.text.trim().split(/\s+/).slice(1).join(" "),
        );
      else if (command === "/cancel") {
        const next = bumpSession(
          row.environment,
          session,
          "menu",
          session.selected_conversation_id,
        );
        operatorReply(row.environment, inbound, "Текущее действие отменено.", [], "cancel");
        menu(row.environment, inbound, next);
      } else if (session.mode === "reply_draft" || session.mode === "internal_note")
        saveDraftText(row.environment, inbound, session);
      else
        operatorReply(
          row.environment,
          inbound,
          "Выберите раздел в /admin. Свободный текст не отправляется клиенту автоматически.",
        );
    }
    run(
      "UPDATE telegram_inbox SET status = 'processed', processed_at = ? WHERE id = ? AND status = 'processing'",
      [Date.now(), row.id],
    );
  } catch (error) {
    run(
      "UPDATE telegram_inbox SET status = 'failed', processed_at = ? WHERE id = ? AND status = 'processing'",
      [Date.now(), row.id],
    );
    console.error(
      JSON.stringify({
        scope: "telegram.operator",
        event: "inbox_failed",
        inboxId: row.id,
        code: error instanceof Error ? error.message.slice(0, 120) : "operator_flow_failed",
      }),
    );
    if (inbound) {
      try {
        operatorReply(
          row.environment,
          inbound,
          "Операторское действие не удалось выполнить. Откройте /admin заново или повторите попытку.",
          [],
          "processing-error",
        );
      } catch {
        // Ошибка очереди уже отражена в логах, повторная ошибка не должна
        // скрыть исходный код обработки.
      }
    }
  }
}

/** Уведомление создаётся после записи клиентского сообщения и содержит только opaque callback. */
export function notifyTelegramOperatorOfConversation(input: {
  environment: TelegramEnvironment;
  conversationId: number;
  updateId: number;
  text: string;
}): void {
  const chatId = process.env.TELEGRAM_OPERATOR_CHAT_ID?.trim();
  if (!chatId || !operatorIds().length || !isTelegramOperatorAvailable()) return;
  const recipient = recipientOf(input.environment, input.conversationId);
  for (const operatorId of operatorIds()) {
    const session = getOrCreateTelegramOperatorSession(input.environment, operatorId, chatId);
    const action = createTelegramOperatorAction({
      environment: input.environment,
      operatorTelegramUserId: operatorId,
      operatorChatId: chatId,
      conversationId: input.conversationId,
      actionType: "open",
      recipientChatId: recipient.chatId,
      recipientTelegramUserId: recipient.userId,
      draftVersion: session.draft_version,
    });
    enqueueTelegramBotReply({
      environment: input.environment,
      recipientChatId: chatId,
      recipientTelegramUserId: operatorId,
      conversationId: null,
      reply: {
        text: `[${modeLabel(input.environment)}] Новое сообщение в обращении №${input.conversationId}\n${input.text.slice(0, 900)}`,
        replyMarkup: {
          inline_keyboard: [[{ text: "Открыть диалог", callback_data: `op:${action.actionKey}` }]],
        },
      },
      idempotencyKey: `operator-notify:${input.environment}:${input.updateId}:${operatorId}`,
    });
  }
}

/** Уведомление о заявке сайта в личном чате оператора. */
export function notifyTelegramOperatorOfLead(input: {
  environment: TelegramEnvironment;
  leadId: number;
  text: string;
}): boolean {
  if (!isTelegramOperatorAvailable()) return false;
  const chatId = process.env.TELEGRAM_OPERATOR_CHAT_ID!.trim();
  let queued = false;
  for (const operatorId of operatorIds()) {
    const session = getOrCreateTelegramOperatorSession(input.environment, operatorId, chatId);
    const action = createTelegramOperatorAction({
      environment: input.environment,
      operatorTelegramUserId: operatorId,
      operatorChatId: chatId,
      conversationId: null,
      actionType: "list",
      recipientChatId: chatId,
      recipientTelegramUserId: operatorId,
      draftVersion: session.draft_version,
      payload: { category: "new", leadId: input.leadId },
    });
    const result = enqueueTelegramBotReply({
      environment: input.environment,
      recipientChatId: chatId,
      recipientTelegramUserId: operatorId,
      conversationId: null,
      leadId: input.leadId,
      reply: {
        text: `[${modeLabel(input.environment)}] Новая заявка с сайта №${input.leadId}\n${input.text.slice(0, 900)}`,
        replyMarkup: {
          inline_keyboard: [[{ text: "Открыть заявки", callback_data: `op:${action.actionKey}` }]],
        },
      },
      idempotencyKey: `website-lead:${input.environment}:${input.leadId}:${operatorId}`,
    });
    queued ||= !result.duplicate;
  }
  return queued;
}

export function processPendingTelegramOperatorInbox(): number {
  const current =
    (process.env.APP_ENV?.trim().toLowerCase() || "development") === "production"
      ? ["production", "test"]
      : ["test"];
  const rows = all<InboxRow>(
    `SELECT id, environment, update_id, payload FROM telegram_inbox
     WHERE status = 'pending' AND actor_role = 'operator'
       AND environment IN (${current.map(() => "?").join(",")}) ORDER BY id LIMIT 50`,
    current,
  );
  rows.forEach(processOne);
  return rows.length;
}
