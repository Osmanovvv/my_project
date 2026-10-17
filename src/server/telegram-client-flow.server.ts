/** Клиентский workflow Telegram: меню, история и сбор заявки.
 *
 * Inbox уже проверен webhook-слоем. Здесь мы только создаём/обновляем
 * профиль, сохраняем выбор клиента и ставим безопасные ответы в outbox.
 * Незавершённая заявка хранится только в сессии и не попадает оператору.
 */
import { all, run } from "./db.server";
import { normalizeLead, resolveLeadSource, validateLead, type LeadSource } from "../lib/lead";
import {
  consumeTelegramClientAction,
  createTelegramLeadFromDraft,
  enqueueTelegramBotReply,
  getOrCreateTelegramClientSession,
  redeemTelegramLeadLink,
  listTelegramClientConversations,
  listTelegramMessages,
  markTelegramConversationRead,
  recordTelegramMessage,
  recordTelegramFile,
  saveTelegramClientLeadDraft,
  updateTelegramClientSession,
  upsertTelegramContact,
  type TelegramClientSession,
  type TelegramConversation,
  type TelegramEnvironment,
  type TelegramLeadDraft,
} from "./telegram-data.server";
import { createTelegramClientAction } from "./telegram-callback.server";
import {
  isTelegramOperatorAvailable,
  notifyTelegramOperatorOfConversation,
  processPendingTelegramOperatorInbox,
} from "./telegram-operator-flow.server";
import { mediaDescription, validateTelegramMedia } from "./telegram-media.server";

type InboxRow = {
  id: number;
  environment: TelegramEnvironment;
  update_id: number;
  sender_telegram_user_id: string;
  chat_id: string;
  payload: string;
};

type ClientAction = {
  key?: string;
  actionType?: string;
  conversationId?: number | null;
  payload?: Record<string, unknown>;
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
  action?: ClientAction;
};

const SITE_URL = "https://itagent.ru";
const CONVERSATION_PAGE_SIZE = 6;
const HISTORY_PAGE_SIZE = 5;

function miniAppUrl(entry?: "catalog"): string {
  const configured = process.env.TELEGRAM_MINIAPP_URL?.trim();
  const base = configured?.startsWith("https://") ? configured : `${SITE_URL}/miniapp`;
  if (!entry) return base;
  return `${base}${base.includes("?") ? "&" : "?"}entry=${encodeURIComponent(entry)}`;
}

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
    throw new Error("telegram_inbox_payload_invalid");
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

function startParameter(text: string): string {
  return text.trim().split(/\s+/).slice(1, 2)[0] ?? "";
}

function statusLabel(conversation: TelegramConversation): string {
  const labels: Record<string, string> = {
    open: "Открыто",
    waiting_operator: "Ждём ответа оператора",
    waiting_client: "Ждём вашего ответа",
    closed: "Закрыто",
  };
  return labels[conversation.status] ?? conversation.status;
}

function conversationTitle(conversation: TelegramConversation): string {
  return conversation.title.trim() || `Обращение №${conversation.id}`;
}

function leadSource(value: unknown): "telegram_bot" | "telegram_deeplink" {
  return value === "telegram_deeplink" ? "telegram_deeplink" : "telegram_bot";
}

function markProcessed(row: InboxRow): void {
  run(
    `UPDATE telegram_inbox SET status = 'processed', processed_at = ?
     WHERE id = ? AND status = 'processing'`,
    [Date.now(), row.id],
  );
}

function markFailed(row: InboxRow, error: unknown): void {
  const code = error instanceof Error ? error.message.slice(0, 120) : "client_flow_failed";
  run(
    `UPDATE telegram_inbox SET status = 'failed', processed_at = ?
     WHERE id = ? AND status = 'processing'`,
    [Date.now(), row.id],
  );
  console.error(
    JSON.stringify({ scope: "telegram.client", event: "inbox_failed", inboxId: row.id, code }),
  );
}

function ownConversation(
  environment: TelegramEnvironment,
  userId: string,
  conversationId: number | null | undefined,
): TelegramConversation | undefined {
  if (conversationId == null) return undefined;
  return listTelegramClientConversations(environment, userId, 50).find(
    (conversation) => conversation.id === conversationId,
  );
}

function queueReply(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  text: string,
  inlineKeyboard: Array<
    Array<
      | { text: string; callback_data: string }
      | { text: string; url: string }
      | { text: string; web_app: { url: string } }
    >
  > = [],
  suffix = "0",
): void {
  enqueueTelegramBotReply({
    environment,
    recipientChatId: inbound.chatId,
    recipientTelegramUserId: inbound.userId,
    conversationId: null,
    reply: {
      text,
      ...(inlineKeyboard.length ? { replyMarkup: { inline_keyboard: inlineKeyboard } } : {}),
    },
    idempotencyKey: `client:${environment}:${inbound.updateId}:${suffix}`,
  });
}

function setMode(
  environment: TelegramEnvironment,
  session: TelegramClientSession,
  mode: TelegramClientSession["mode"],
  selectedConversationId: number | null,
): TelegramClientSession {
  return updateTelegramClientSession({
    environment,
    telegramUserId: session.telegram_user_id,
    chatId: session.chat_id,
    mode,
    selectedConversationId,
    expectedVersion: session.version,
  });
}

function mainMenuReply(name: string): string {
  return `Привет${name ? `, ${name}` : ""}! Я бот IT-Agent.\n\nПомогу оставить заявку и продолжить переписку с оператором в этом чате.`;
}

function showMainMenu(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
): void {
  const next = setMode(environment, session, "menu", null);
  const start = startParameter(inbound.text);
  const source = start ? "telegram_deeplink" : "telegram_bot";
  const catalogEntry = start === "site_catalog";
  const newTaskAction = createTelegramClientAction({
    environment,
    userId: inbound.userId,
    chatId: inbound.chatId,
    actionType: "request",
    sessionVersion: next.version,
    payload: { source },
  });
  const statusAction = createTelegramClientAction({
    environment,
    userId: inbound.userId,
    chatId: inbound.chatId,
    actionType: "status",
    sessionVersion: next.version,
  });
  const helpAction = createTelegramClientAction({
    environment,
    userId: inbound.userId,
    chatId: inbound.chatId,
    actionType: "help",
    sessionVersion: next.version,
  });
  queueReply(environment, inbound, mainMenuReply(inbound.displayName.split(" ", 1)[0]), [
    [
      {
        text: catalogEntry ? "Открыть каталог" : "Открыть Mini App",
        web_app: { url: miniAppUrl(catalogEntry ? "catalog" : undefined) },
      },
    ],
    [{ text: "Новая задача", callback_data: newTaskAction }],
    [{ text: "Продолжить диалог", callback_data: statusAction }],
    [{ text: "Мои обращения", callback_data: statusAction }],
    [
      { text: "Помощь", callback_data: helpAction },
      { text: "Открыть сайт", url: SITE_URL },
    ],
  ]);
}

function showHelp(environment: TelegramEnvironment, inbound: StoredInbound): void {
  queueReply(
    environment,
    inbound,
    `Напишите /request или нажмите «Новая задача». Ваши обращения доступны в разделе «Мои обращения». Общение продолжается в этом чате с ботом — личный аккаунт оператора вам не нужен.\n\nДокументы:\nСогласие: ${SITE_URL}/consent\nПолитика: ${SITE_URL}/privacy\n\nКоманды: /start, /request, /status, /cancel, /help.`,
  );
}

function handleStart(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
): void {
  const parameter = startParameter(inbound.text);
  let linkedConversationId: number | null = null;
  if (parameter.startsWith("lead_")) {
    try {
      const result = redeemTelegramLeadLink({
        environment,
        token: parameter.slice("lead_".length),
        telegramUserId: inbound.userId,
        chatId: inbound.chatId,
        username: inbound.username,
        displayName: inbound.displayName,
      });
      linkedConversationId = result.conversationId;
      if (!result.duplicate) {
        notifyTelegramOperatorOfConversation({
          environment,
          conversationId: result.conversationId,
          updateId: inbound.updateId,
          text: `Заявка сайта привязана к Telegram. Обращение №${result.conversationId}.`,
        });
      }
      queueReply(
        environment,
        inbound,
        result.duplicate
          ? `Эта заявка уже привязана к вашему Telegram. Номер обращения: №${result.conversationId}.`
          : `Готово: заявка привязана к этому Telegram. Номер обращения: №${result.conversationId}.`,
        [],
        `lead-link-${result.conversationId}`,
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      queueReply(
        environment,
        inbound,
        code === "telegram_lead_link_expired" || code === "telegram_lead_link_used"
          ? "Ссылка на заявку уже недействительна. Отправьте новую заявку на сайте или используйте /request."
          : "Не удалось привязать заявку. Ссылка могла быть скопирована с ошибкой или предназначена для другого окружения.",
        [],
        "lead-link-error",
      );
    }
  }
  if (linkedConversationId != null) {
    try {
      showConversationHistory(environment, inbound, session, linkedConversationId);
      return;
    } catch {
      // Если история недоступна, всё равно показываем обычное меню клиента.
    }
  }
  showMainMenu(environment, inbound, session);
}

function showConversations(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
  offset = 0,
): void {
  const pageOffset = Math.max(0, Math.trunc(offset));
  const conversations = listTelegramClientConversations(
    environment,
    inbound.userId,
    CONVERSATION_PAGE_SIZE,
    pageOffset,
  );
  if (conversations.length === 0) {
    queueReply(
      environment,
      inbound,
      pageOffset
        ? "Больше обращений нет."
        : "У вас пока нет обращений. Нажмите «Новая задача», чтобы начать.",
      pageOffset
        ? [
            [
              {
                text: "← Назад",
                callback_data: createTelegramClientAction({
                  environment,
                  userId: inbound.userId,
                  chatId: inbound.chatId,
                  actionType: "status",
                  sessionVersion: session.version,
                  payload: {
                    flow: "conversations",
                    offset: Math.max(0, pageOffset - CONVERSATION_PAGE_SIZE),
                  },
                }),
              },
            ],
          ]
        : [],
    );
    return;
  }
  const buttons = conversations.map((conversation) => [
    {
      text: `${conversation.unread_count ? "● " : ""}№${conversation.id} ${conversationTitle(conversation)} · ${statusLabel(conversation)}`.slice(
        0,
        100,
      ),
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "status",
        conversationId: conversation.id,
        sessionVersion: session.version,
        payload: { flow: "history", offset: 0 },
      }),
    },
  ]);
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (pageOffset > 0)
    navigation.push({
      text: "← Назад",
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "status",
        sessionVersion: session.version,
        payload: { flow: "conversations", offset: pageOffset - CONVERSATION_PAGE_SIZE },
      }),
    });
  if (conversations.length === CONVERSATION_PAGE_SIZE)
    navigation.push({
      text: "Дальше →",
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "status",
        sessionVersion: session.version,
        payload: { flow: "conversations", offset: pageOffset + CONVERSATION_PAGE_SIZE },
      }),
    });
  if (navigation.length) buttons.push(navigation);
  queueReply(
    environment,
    inbound,
    `Мои обращения · страница ${Math.floor(pageOffset / CONVERSATION_PAGE_SIZE) + 1}:`,
    buttons,
  );
}

function showConversationHistory(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
  conversationId: number | null | undefined,
  offset = 0,
): void {
  const conversation = ownConversation(environment, inbound.userId, conversationId);
  if (!conversation) throw new Error("conversation_not_owned");
  const pageOffset = Math.max(0, Math.trunc(offset));
  const messages = listTelegramMessages(
    environment,
    conversation.id,
    HISTORY_PAGE_SIZE,
    pageOffset,
  ).filter((message) => message.message_type !== "internal_note" && message.direction !== "system");
  const history = messages.length
    ? messages
        .map((message) => {
          const who = message.direction === "operator" ? "Оператор" : "Вы";
          const kind = message.message_type === "text" ? "" : ` [${message.message_type}]`;
          return `${who}${kind}: ${(message.text || "(без текста)").slice(0, 500)}`;
        })
        .join("\n")
    : "На этой странице пока нет сообщений.";
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  if (conversation.unread_count > 0) {
    buttons.push([
      {
        text: `Отметить прочитанным (${conversation.unread_count})`,
        callback_data: createTelegramClientAction({
          environment,
          userId: inbound.userId,
          chatId: inbound.chatId,
          actionType: "status",
          conversationId: conversation.id,
          sessionVersion: session.version,
          payload: { flow: "mark_read", offset: pageOffset },
        }),
      },
    ]);
  }
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (pageOffset > 0)
    navigation.push({
      text: "← Предыдущие",
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "status",
        conversationId: conversation.id,
        sessionVersion: session.version,
        payload: { flow: "history", offset: pageOffset - HISTORY_PAGE_SIZE },
      }),
    });
  if (messages.length === HISTORY_PAGE_SIZE)
    navigation.push({
      text: "Следующие →",
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "status",
        conversationId: conversation.id,
        sessionVersion: session.version,
        payload: { flow: "history", offset: pageOffset + HISTORY_PAGE_SIZE },
      }),
    });
  if (navigation.length) buttons.push(navigation);
  buttons.push([
    {
      text: "Написать сообщение",
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "select_conversation",
        conversationId: conversation.id,
        sessionVersion: session.version,
      }),
    },
  ]);
  buttons.push([
    {
      text: "← К обращениям",
      callback_data: createTelegramClientAction({
        environment,
        userId: inbound.userId,
        chatId: inbound.chatId,
        actionType: "status",
        sessionVersion: session.version,
        payload: { flow: "conversations", offset: 0 },
      }),
    },
  ]);
  queueReply(
    environment,
    inbound,
    `Обращение №${conversation.id} · ${statusLabel(conversation)}\n\nИстория (страница ${Math.floor(pageOffset / HISTORY_PAGE_SIZE) + 1}):\n${history}`,
    buttons,
    `history-${conversation.id}-${pageOffset}-${conversation.unread_count}`,
  );
}

function emptyLeadDraft(source: LeadSource = "telegram_bot"): TelegramLeadDraft {
  return {
    name: "",
    contact: "",
    task: "",
    page: "telegram",
    source,
    sourceDetail: "",
    consent: false,
    step: "name",
  };
}

function draftOf(session: TelegramClientSession): TelegramLeadDraft {
  try {
    const parsed = JSON.parse(session.draft_payload) as Partial<TelegramLeadDraft>;
    if (
      typeof parsed.name === "string" &&
      typeof parsed.contact === "string" &&
      typeof parsed.task === "string" &&
      typeof parsed.page === "string" &&
      typeof parsed.source === "string" &&
      (parsed.step === "name" ||
        parsed.step === "contact" ||
        parsed.step === "task" ||
        parsed.step === "summary")
    )
      return {
        name: parsed.name,
        contact: parsed.contact,
        task: parsed.task,
        page: parsed.page,
        source: resolveLeadSource(parsed.source, "telegram_bot"),
        sourceDetail: typeof parsed.sourceDetail === "string" ? parsed.sourceDetail : "",
        consent: parsed.consent === true,
        step: parsed.step,
      };
  } catch {
    // Повреждённый черновик безопаснее начать заново.
  }
  return emptyLeadDraft();
}

function leadAction(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
  command: string,
  field?: string,
): string {
  return createTelegramClientAction({
    environment,
    userId: inbound.userId,
    chatId: inbound.chatId,
    actionType: "request",
    sessionVersion: session.version,
    payload: { flow: "lead", command, ...(field ? { field } : {}) },
  });
}

function leadPrompt(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
  draft: TelegramLeadDraft,
): void {
  if (draft.step === "name") {
    queueReply(environment, inbound, "Шаг 1 из 3. Как к вам обращаться? Для отмены — /cancel.");
  } else if (draft.step === "contact") {
    queueReply(
      environment,
      inbound,
      "Шаг 2 из 3. Оставьте телефон, @username в Telegram или email.",
    );
  } else if (draft.step === "task") {
    queueReply(
      environment,
      inbound,
      "Шаг 3 из 3. Коротко опишите задачу или нажмите «Пропустить».",
      [
        [
          {
            text: "Пропустить описание",
            callback_data: leadAction(environment, inbound, session, "skip_task"),
          },
        ],
      ],
    );
  } else {
    const summary = [
      "Проверьте заявку:",
      `Имя: ${draft.name}`,
      `Контакт: ${draft.contact}`,
      `Задача: ${draft.task || "не указана"}`,
      "",
      `Перед отправкой подтвердите согласие на обработку данных. Документы:\nСогласие: ${SITE_URL}/consent\nПолитика: ${SITE_URL}/privacy`,
    ].join("\n");
    queueReply(environment, inbound, summary, [
      [
        {
          text: "✅ Подтвердить и отправить",
          callback_data: leadAction(environment, inbound, session, "confirm"),
        },
      ],
      [
        {
          text: "Изменить имя",
          callback_data: leadAction(environment, inbound, session, "edit", "name"),
        },
        {
          text: "Изменить контакт",
          callback_data: leadAction(environment, inbound, session, "edit", "contact"),
        },
      ],
      [
        {
          text: "Изменить задачу",
          callback_data: leadAction(environment, inbound, session, "edit", "task"),
        },
      ],
      [
        {
          text: "Отменить",
          callback_data: `client:${createTelegramClientAction({
            environment,
            userId: inbound.userId,
            chatId: inbound.chatId,
            actionType: "cancel",
            sessionVersion: session.version,
          }).slice("client:".length)}`,
        },
      ],
    ]);
  }
}

function startLeadDraft(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
  source: "telegram_bot" | "telegram_deeplink" = "telegram_bot",
): void {
  const next = saveTelegramClientLeadDraft({
    environment,
    telegramUserId: inbound.userId,
    chatId: inbound.chatId,
    draft: emptyLeadDraft(source),
    expectedVersion: session.version,
  });
  leadPrompt(environment, inbound, next, draftOf(next));
}

function saveLeadDraftText(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
): void {
  const draft = draftOf(session);
  const value = inbound.text.trim();
  if (draft.step === "summary") {
    leadPrompt(environment, inbound, session, draft);
    return;
  }
  const enteredStep = draft.step;
  if (enteredStep === "name") draft.name = value;
  else if (enteredStep === "contact") draft.contact = value;
  else draft.task = value;
  const normalized = normalizeLead({ ...draft, consent: true });
  const errors = validateLead(normalized);
  const error =
    enteredStep === "name" ? errors.name : enteredStep === "contact" ? errors.contact : errors.task;
  if (error) {
    draft.step = enteredStep;
    queueReply(environment, inbound, error);
    return;
  }
  draft.step = enteredStep === "name" ? "contact" : enteredStep === "contact" ? "task" : "summary";
  const next = saveTelegramClientLeadDraft({
    environment,
    telegramUserId: inbound.userId,
    chatId: inbound.chatId,
    draft,
    expectedVersion: session.version,
  });
  leadPrompt(environment, inbound, next, draftOf(next));
}

function confirmLeadDraft(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
  operationKey: string,
): void {
  const draft = draftOf(session);
  if (draft.step !== "summary") throw new Error("заявка ещё не заполнена");
  const result = createTelegramLeadFromDraft({
    environment,
    telegramUserId: inbound.userId,
    chatId: inbound.chatId,
    operationKey,
    draft: { ...draft, consent: true },
  });
  const next = setMode(environment, session, "menu", null);
  if (!result.duplicate) {
    const recorded = recordTelegramMessage({
      environment,
      conversationId: result.conversationId,
      direction: "client",
      messageType: "text",
      chatId: inbound.chatId,
      telegramMessageId: inbound.messageId,
      updateId: inbound.updateId,
      senderTelegramUserId: inbound.userId,
      text: draft.task || "Заявка создана через Telegram",
      metadata: { leadId: result.leadId, source: draft.source },
    });
    if (!recorded.duplicate)
      notifyTelegramOperatorOfConversation({
        environment,
        conversationId: result.conversationId,
        updateId: inbound.updateId,
        text: draft.task || "Новая заявка через Telegram",
      });
  }
  queueReply(
    environment,
    inbound,
    `${result.duplicate ? "Заявка уже была принята" : "Заявка принята"}. Номер обращения: №${result.conversationId}.`,
    [
      [
        {
          text: "Открыть обращение",
          callback_data: createTelegramClientAction({
            environment,
            userId: inbound.userId,
            chatId: inbound.chatId,
            actionType: "status",
            conversationId: result.conversationId,
            sessionVersion: next.version,
            payload: { flow: "history", offset: 0 },
          }),
        },
      ],
      [
        {
          text: "Создать ещё одну заявку",
          callback_data: createTelegramClientAction({
            environment,
            userId: inbound.userId,
            chatId: inbound.chatId,
            actionType: "request",
            sessionVersion: next.version,
          }),
        },
      ],
    ],
    "lead-accepted",
  );
}

function saveClientMessage(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
): void {
  let conversation = ownConversation(environment, inbound.userId, session.selected_conversation_id);
  if (!conversation) {
    const conversations = listTelegramClientConversations(environment, inbound.userId);
    if (conversations.length === 1) {
      conversation = conversations[0];
      session = setMode(environment, session, "conversation", conversation.id);
    } else if (conversations.length > 1) {
      showConversations(environment, inbound, session);
      return;
    } else {
      queueReply(environment, inbound, "Сначала выберите «Новая задача», чтобы создать обращение.");
      return;
    }
  }
  const messageType =
    inbound.kind === "photo" || inbound.kind === "file" || inbound.kind === "voice"
      ? inbound.kind
      : "text";
  const mediaKind =
    inbound.kind === "photo" || inbound.kind === "file" || inbound.kind === "voice"
      ? inbound.kind
      : null;
  if (mediaKind) {
    const validation = validateTelegramMedia(mediaKind, inbound.media);
    if (!validation.ok) {
      queueReply(environment, inbound, validation.message, [], "media-rejected");
      return;
    }
  }
  const recorded = recordTelegramMessage({
    environment,
    conversationId: conversation.id,
    direction: "client",
    messageType,
    chatId: inbound.chatId,
    telegramMessageId: inbound.messageId,
    updateId: inbound.updateId,
    senderTelegramUserId: inbound.userId,
    text: inbound.text,
    metadata: inbound.media ? { media: inbound.media } : undefined,
  });
  if (mediaKind && typeof inbound.media?.fileId === "string") {
    recordTelegramFile({
      environment,
      messageId: recorded.id,
      telegramFileId: inbound.media.fileId,
      mime: typeof inbound.media.mime === "string" ? inbound.media.mime : "",
      bytes: typeof inbound.media.bytes === "number" ? inbound.media.bytes : null,
    });
  }
  run(
    "UPDATE telegram_conversation SET status = 'waiting_operator', updated_at = ? WHERE environment = ? AND id = ?",
    [Date.now(), environment, conversation.id],
  );
  setMode(environment, session, "conversation", conversation.id);
  if (!recorded.duplicate) {
    notifyTelegramOperatorOfConversation({
      environment,
      conversationId: conversation.id,
      updateId: inbound.updateId,
      text: inbound.text || `Получено сообщение типа ${messageType}`,
    });
  }
  queueReply(
    environment,
    inbound,
    isTelegramOperatorAvailable()
      ? `Сообщение${mediaKind ? ` (${mediaDescription(mediaKind, inbound.media)})` : ""} добавлено в обращение №${conversation.id}. Оператор ответит в этом диалоге.`
      : `Сообщение${mediaKind ? ` (${mediaDescription(mediaKind, inbound.media)})` : ""} сохранено в обращении №${conversation.id}. Операторские уведомления временно недоступны, но обращение не потеряно.`,
  );
}

function handleCallback(
  environment: TelegramEnvironment,
  inbound: StoredInbound,
  session: TelegramClientSession,
): void {
  const action = inbound.action;
  if (!action?.key || action.role !== "client") return;
  try {
    // Сначала атомарно подтверждаем актуальность кнопки и версии сессии.
    // Любая бизнес-операция ниже выполняется только один раз и только для
    // callback, который ещё не был обработан на другом устройстве.
    consumeTelegramClientAction({
      actionKey: action.key,
      environment,
      telegramUserId: inbound.userId,
      chatId: inbound.chatId,
    });
    const payload = action.payload ?? {};
    if (action.actionType === "request") {
      if (payload.flow !== "lead")
        startLeadDraft(environment, inbound, session, leadSource(payload.source));
      else if (payload.command === "confirm")
        confirmLeadDraft(environment, inbound, session, action.key);
      else if (payload.command === "skip_task") {
        const draft = draftOf(session);
        if (draft.step !== "task") throw new Error("этап задачи уже завершён");
        draft.task = "";
        draft.step = "summary";
        const next = saveTelegramClientLeadDraft({
          environment,
          telegramUserId: inbound.userId,
          chatId: inbound.chatId,
          draft,
          expectedVersion: session.version,
        });
        leadPrompt(environment, inbound, next, draftOf(next));
      } else if (payload.command === "edit") {
        const field = payload.field;
        if (field !== "name" && field !== "contact" && field !== "task")
          throw new Error("некорректное поле заявки");
        const draft = draftOf(session);
        draft.step = field;
        const next = saveTelegramClientLeadDraft({
          environment,
          telegramUserId: inbound.userId,
          chatId: inbound.chatId,
          draft,
          expectedVersion: session.version,
        });
        leadPrompt(environment, inbound, next, draftOf(next));
      } else startLeadDraft(environment, inbound, session);
    } else if (action.actionType === "status") {
      if (payload.flow === "history")
        showConversationHistory(
          environment,
          inbound,
          session,
          action.conversationId,
          Number(payload.offset) || 0,
        );
      else if (payload.flow === "mark_read") {
        const conversation = ownConversation(environment, inbound.userId, action.conversationId);
        if (!conversation) throw new Error("conversation_not_owned");
        markTelegramConversationRead(environment, conversation.id);
        showConversationHistory(
          environment,
          inbound,
          session,
          conversation.id,
          Number(payload.offset) || 0,
        );
      } else showConversations(environment, inbound, session, Number(payload.offset) || 0);
    } else if (action.actionType === "help") showHelp(environment, inbound);
    else if (action.actionType === "menu") showMainMenu(environment, inbound, session);
    else if (action.actionType === "cancel") {
      const next = setMode(environment, session, "menu", null);
      queueReply(environment, inbound, "Текущее действие отменено.", [], "cancelled");
      showMainMenu(environment, inbound, next);
    } else if (action.actionType === "select_conversation") {
      const conversation = ownConversation(environment, inbound.userId, action.conversationId);
      if (!conversation) throw new Error("conversation_not_owned");
      setMode(environment, session, "conversation", conversation.id);
      queueReply(
        environment,
        inbound,
        `Открыто обращение №${conversation.id}. Можете написать следующее сообщение.`,
      );
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    queueReply(
      environment,
      inbound,
      code === "conversation_not_owned"
        ? "Это обращение больше недоступно. Откройте меню заново командой /start."
        : "Кнопка устарела или уже обработана. Откройте меню заново командой /start.",
    );
    console.error(
      JSON.stringify({
        scope: "telegram.client",
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
    upsertTelegramContact({
      environment: row.environment,
      telegramUserId: inbound.userId,
      username: inbound.username,
      displayName: inbound.displayName,
    });
    const session = getOrCreateTelegramClientSession(
      row.environment,
      inbound.userId,
      inbound.chatId,
    );
    if (inbound.kind === "callback") handleCallback(row.environment, inbound, session);
    else {
      const command = commandOf(inbound.text);
      if (command === "/start") handleStart(row.environment, inbound, session);
      else if (command === "/help") showHelp(row.environment, inbound);
      else if (command === "/request") startLeadDraft(row.environment, inbound, session);
      else if (command === "/status") showConversations(row.environment, inbound, session, 0);
      else if (command === "/cancel") {
        const next = setMode(row.environment, session, "menu", null);
        queueReply(row.environment, inbound, "Текущее действие отменено.", [], "cancelled");
        showMainMenu(row.environment, inbound, next);
      } else if (session.mode === "new_task") {
        if (inbound.kind === "text") saveLeadDraftText(row.environment, inbound, session);
        else
          queueReply(
            row.environment,
            inbound,
            "Сначала заполните заявку текстом или отмените её командой /cancel.",
          );
      } else saveClientMessage(row.environment, inbound, session);
    }
    markProcessed(row);
  } catch (error) {
    markFailed(row, error);
    if (inbound) {
      try {
        queueReply(
          row.environment,
          inbound,
          "Не удалось обработать сообщение сейчас. Обращение сохранено, попробуйте повторить через несколько секунд.",
          [],
          "processing-error",
        );
      } catch {
        // Если сама очередь недоступна, запись inbox уже помечена failed;
        // внутренний лог сохранит код для повторной диагностики.
      }
    }
  }
}

export function processPendingTelegramInbox(): number {
  const current =
    (process.env.APP_ENV?.trim().toLowerCase() || "development") === "production"
      ? ["production", "test"]
      : ["test"];
  const rows = all<InboxRow>(
    `SELECT id, environment, update_id, sender_telegram_user_id, chat_id, payload
     FROM telegram_inbox WHERE status = 'pending' AND actor_role = 'client'
       AND environment IN (${current.map(() => "?").join(",")}) ORDER BY id LIMIT 50`,
    current,
  );
  rows.forEach(processOne);
  return rows.length + processPendingTelegramOperatorInbox();
}
