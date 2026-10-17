import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_A,
  CLIENT_B,
  OPERATOR,
  callbackUpdate,
  installTestDatabase,
  messageUpdate,
  webhookRequest,
} from "./helpers/telegram";

const db = await installTestDatabase();
const data = await import("../src/server/telegram-data.server");
const { handleTelegramWebhook: handle } =
  await import("../src/server/telegram-webhook-http.server");
const { runTelegramOutboxWorker, TELEGRAM_OUTBOX_LOCK_TIMEOUT_MS } =
  await import("../src/server/telegram-outbox.server");

type ReplyPayload = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data?: string }>>;
  };
};

const CLIENT_C = "910000004";

async function post(update: unknown): Promise<Response> {
  return handle(webhookRequest(update));
}

async function postText(userId: string, text: string): Promise<Response> {
  return post(messageUpdate(userId, text));
}

function latestReply(): ReplyPayload {
  const row = db.get<{ payload: string }>(
    "SELECT payload FROM telegram_outbox ORDER BY id DESC LIMIT 1",
  );
  assert.ok(row, "ожидался ответ в outbox");
  return JSON.parse(row.payload) as ReplyPayload;
}

function latestCallback(text: RegExp): string {
  const reply = latestReply();
  const button = reply.replyMarkup?.inline_keyboard.flat().find((item) => text.test(item.text));
  assert.ok(button?.callback_data, `не найдена кнопка ${text}`);
  return button.callback_data;
}

function createConversation(userId: string, title: string, now = Date.now()): number {
  const contactId = data.upsertTelegramContact({
    environment: "test",
    telegramUserId: userId,
    username: `user_${userId}`,
    displayName: title,
    now,
  });
  return data.createTelegramConversation({
    environment: "test",
    telegramContactId: contactId,
    clientChatId: userId,
    title,
    isTest: true,
    now,
  });
}

async function completeLead(
  userId: string,
  name: string,
  contact: string,
  task: string,
): Promise<void> {
  await postText(userId, "/request");
  await postText(userId, name);
  await postText(userId, contact);
  await postText(userId, task);
  const confirm = latestCallback(/подтвердить и отправить/i);
  const response = await post(callbackUpdate(userId, confirm));
  assert.equal(response.status, 200);
}

test("9.5: новый клиент проходит старт, заявку, согласие и получает отдельный диалог", async () => {
  assert.equal((await postText(CLIENT_A, "/start")).status, 200);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_contact")?.n, 1);
  assert.equal(data.getOrCreateTelegramClientSession("test", CLIENT_A, CLIENT_A).mode, "menu");

  await completeLead(CLIENT_A, "Новый клиент", "+79990000001", "Нужен сайт для студии");

  const leads = db.all<{ id: number; name: string; contact: string; task: string }>(
    "SELECT id, name, contact, task FROM lead ORDER BY id",
  );
  const conversations = data.listTelegramClientConversations("test", CLIENT_A);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].name, "Новый клиент");
  assert.equal(leads[0].contact, "+79990000001");
  assert.equal(leads[0].task, "Нужен сайт для студии");
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].lead_id, leads[0].id);
  assert.equal(conversations[0].status, "waiting_operator");
  assert.equal(
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_inbox WHERE status = 'processed'")?.n,
    6,
  );
  assert.match(latestReply().text, /заявка принята/i);
});

test("9.6: повторный клиент сохраняет один профиль и может создать второе обращение", async () => {
  await postText(CLIENT_A, "/start");
  await completeLead(CLIENT_A, "Повторный клиент", "repeat@example.com", "Первая задача");
  await completeLead(CLIENT_A, "Повторный клиент", "repeat@example.com", "Вторая задача");
  await postText(CLIENT_A, "/start");

  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_contact")?.n, 1);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM lead")?.n, 2);
  const conversations = data.listTelegramClientConversations("test", CLIENT_A);
  assert.equal(conversations.length, 2);
  assert.deepEqual(
    db.all<{ task: string }>("SELECT task FROM lead ORDER BY id").map((row) => row.task),
    ["Первая задача", "Вторая задача"],
  );
  assert.equal(new Set(conversations.map((item) => item.lead_id)).size, 2);
});

test("9.7: два клиента и третье обращение остаются раздельными при переключении оператора", async () => {
  const first = createConversation(CLIENT_A, "Клиент A");
  const second = createConversation(CLIENT_B, "Клиент B");
  const third = createConversation(CLIENT_C, "Клиент C");
  for (const [conversationId, userId, text] of [
    [first, CLIENT_A, "сообщение A"],
    [second, CLIENT_B, "сообщение B"],
    [third, CLIENT_C, "сообщение C"],
  ] as const) {
    data.recordTelegramMessage({
      environment: "test",
      conversationId,
      direction: "client",
      messageType: "text",
      chatId: userId,
      senderTelegramUserId: userId,
      telegramMessageId: conversationId,
      updateId: 50_000 + conversationId,
      text,
    });
  }
  assert.deepEqual(
    data.listTelegramMessages("test", first).map((item) => item.text),
    ["сообщение A"],
  );
  assert.deepEqual(
    data.listTelegramMessages("test", second).map((item) => item.text),
    ["сообщение B"],
  );
  assert.deepEqual(
    data.listTelegramMessages("test", third).map((item) => item.text),
    ["сообщение C"],
  );

  let session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  const openFirst = data.createTelegramOperatorAction({
    environment: "test",
    operatorTelegramUserId: OPERATOR,
    operatorChatId: OPERATOR,
    conversationId: first,
    actionType: "open",
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    draftVersion: session.draft_version,
  });
  await post(callbackUpdate(OPERATOR, `op:${openFirst.actionKey}`));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.selected_conversation_id, first);

  const reply = data.createTelegramOperatorAction({
    environment: "test",
    operatorTelegramUserId: OPERATOR,
    operatorChatId: OPERATOR,
    conversationId: first,
    actionType: "reply",
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    draftVersion: session.draft_version,
  });
  await post(callbackUpdate(OPERATOR, `op:${reply.actionKey}`));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.mode, "reply_draft");
  assert.equal(session.draft_recipient_chat_id, CLIENT_A);

  const openThird = data.createTelegramOperatorAction({
    environment: "test",
    operatorTelegramUserId: OPERATOR,
    operatorChatId: OPERATOR,
    conversationId: third,
    actionType: "open",
    recipientChatId: CLIENT_C,
    recipientTelegramUserId: CLIENT_C,
    draftVersion: session.draft_version,
  });
  await post(callbackUpdate(OPERATOR, `op:${openThird.actionKey}`));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.selected_conversation_id, first);
  assert.equal(session.draft_recipient_chat_id, CLIENT_A);
  assert.equal(
    db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM telegram_outbox WHERE conversation_id IS NOT NULL",
    )?.n,
    0,
  );
});

test("9.8: текст, фото, файл и голосовое сообщение попадают в правильную историю", async () => {
  const conversation = createConversation(CLIENT_A, "Медиа-клиент");
  const mediaMessage = (text: string, patch: Record<string, unknown>) =>
    messageUpdate(CLIENT_A, text, { text: undefined, ...patch });

  assert.equal((await post(messageUpdate(CLIENT_A, "обычный текст"))).status, 200);
  assert.equal(
    (
      await post(
        mediaMessage("фото", {
          caption: "подпись фото",
          photo: [
            {
              file_id: "photo-small",
              file_unique_id: "photo-u1",
              width: 40,
              height: 40,
              file_size: 500,
            },
            {
              file_id: "photo-large",
              file_unique_id: "photo-u2",
              width: 800,
              height: 600,
              file_size: 50_000,
            },
          ],
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        mediaMessage("документ", {
          document: {
            file_id: "file-1",
            file_unique_id: "file-u1",
            file_size: 12_000,
            mime_type: "application/pdf",
            file_name: "brief.pdf",
          },
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        mediaMessage("голосовое", {
          voice: {
            file_id: "voice-1",
            file_unique_id: "voice-u1",
            file_size: 8_000,
            mime_type: "audio/ogg",
            duration: 12,
          },
        }),
      )
    ).status,
    200,
  );

  const messages = data.listTelegramMessages("test", conversation);
  assert.deepEqual(
    messages.map((item) => item.message_type),
    ["text", "photo", "file", "voice"],
  );
  assert.equal(messages[1].text, "подпись фото");
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_file")?.n, 3);
  assert.deepEqual(
    db
      .all<{
        telegram_file_id: string;
        message_id: number;
      }>("SELECT telegram_file_id, message_id FROM telegram_file ORDER BY id")
      .map((row) => row.telegram_file_id),
    ["photo-large", "file-1", "voice-1"],
  );
});

test("9.9: временный сбой Telegram повторяется и после успеха становится sent", async () => {
  process.env.TELEGRAM_DELIVERY_ENABLED = "true";
  let calls = 0;
  const temporaryFailure: typeof fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ ok: false, error_code: 500 }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  };
  globalThis.fetch = temporaryFailure;
  const queued = data.enqueueTelegramBotReply({
    environment: "test",
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    reply: { text: "Повторная доставка" },
    idempotencyKey: "quality-9-9-retry",
    now: 1_000_000,
  });
  assert.equal((await runTelegramOutboxWorker("test", { now: 1_000_000 })).retried, 1);
  let item = db.get<{ status: string; attempts: number; next_attempt_at: number }>(
    "SELECT status, attempts, next_attempt_at FROM telegram_outbox WHERE id = ?",
    [queued.outboxId],
  )!;
  assert.deepEqual([item.status, item.attempts], ["pending", 1]);

  const success: typeof fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ ok: true, result: { message_id: 7001 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  globalThis.fetch = success;
  assert.equal((await runTelegramOutboxWorker("test", { now: item.next_attempt_at })).sent, 1);
  const sentItem = db.get<{ status: string; attempts: number; last_error: string }>(
    "SELECT status, attempts, last_error FROM telegram_outbox WHERE id = ?",
    [queued.outboxId],
  )!;
  assert.deepEqual([sentItem.status, sentItem.attempts, sentItem.last_error], ["sent", 2, ""]);
  assert.equal(calls, 2);
  assert.equal(data.getTelegramTransportState("test")?.outbox_last_status, "sent");
  assert.deepEqual(
    db
      .all<{ event_type: string }>("SELECT event_type FROM telegram_event ORDER BY id")
      .map((row) => row.event_type),
    ["outbox_retry", "outbox_sent"],
  );
});

test("9.9a: неизвестный результат сразу становится unknown без слепого повтора", async () => {
  process.env.TELEGRAM_DELIVERY_ENABLED = "true";
  let calls = 0;
  const unknownFetch: typeof fetch = async () => {
    calls++;
    throw new Error("synthetic network reset");
  };
  globalThis.fetch = unknownFetch;
  const conversation = createConversation(CLIENT_A, "Неизвестная доставка");
  const queued = data.enqueueOperatorReply({
    environment: "test",
    conversationId: conversation,
    operatorTelegramUserId: OPERATOR,
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    text: "Ответ с неопределённым результатом",
    idempotencyKey: "quality-9-9a-unknown",
  });

  const next = db.get<{ next_attempt_at: number }>(
    "SELECT next_attempt_at FROM telegram_outbox WHERE id = ?",
    [queued.outboxId],
  )!;
  assert.equal((await runTelegramOutboxWorker("test", { now: next.next_attempt_at })).unknown, 1);
  const terminal = db.get<{ status: string; attempts: number }>(
    "SELECT status, attempts FROM telegram_outbox WHERE id = ?",
    [queued.outboxId],
  )!;
  assert.deepEqual([terminal.status, terminal.attempts], ["unknown", 1]);
  assert.equal(
    (await runTelegramOutboxWorker("test", { now: Date.now() + data.TELEGRAM_RETENTION.outboxMs }))
      .claimed,
    0,
  );
  assert.equal(calls, 1);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_outbox")?.n, 1);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_message")?.n, 1);
  assert.equal(
    db.get<{ delivery_status: string }>(
      "SELECT delivery_status FROM telegram_message WHERE id = ?",
      [queued.messageId],
    )?.delivery_status,
    "unknown",
  );
  assert.equal(data.getTelegramTransportState("test")?.outbox_last_status, "unknown");
});

test("9.9a: прерванная отправка после перезапуска не возвращается в pending", async () => {
  process.env.TELEGRAM_DELIVERY_ENABLED = "true";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("не должно быть нового запроса после неизвестного результата");
  };
  const queued = data.enqueueTelegramBotReply({
    environment: "test",
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    reply: { text: "Прерванная отправка" },
    idempotencyKey: "quality-9-9a-interrupted",
  });
  db.run(
    "UPDATE telegram_outbox SET status = 'processing', locked_at = ?, attempts = 1 WHERE id = ?",
    [Date.now() - TELEGRAM_OUTBOX_LOCK_TIMEOUT_MS - 1, queued.outboxId],
  );

  const summary = await runTelegramOutboxWorker("test", { now: Date.now() });
  assert.deepEqual(summary, {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    unknown: 0,
    blocked: 0,
    deferred: 0,
  });
  assert.equal(
    db.get<{ status: string; last_error: string }>(
      "SELECT status, last_error FROM telegram_outbox WHERE id = ?",
      [queued.outboxId],
    )?.status,
    "unknown",
  );
  assert.equal(calls, 0);
});

test("9.9b: после перезапуска старый callback двух устройств не может отправить прежний черновик", () => {
  const conversation = createConversation(CLIENT_A, "Два устройства");
  let session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  const firstVersion = data.saveOperatorDraft({
    environment: "test",
    sessionId: session.id,
    expectedVersion: session.draft_version,
    conversationId: conversation,
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    mode: "reply_draft",
    draftText: "Старый черновик",
  });
  const staleConfirm = data.createTelegramOperatorAction({
    environment: "test",
    operatorTelegramUserId: OPERATOR,
    operatorChatId: OPERATOR,
    conversationId: conversation,
    actionType: "confirm_reply",
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    draftVersion: firstVersion,
  });

  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  data.saveOperatorDraft({
    environment: "test",
    sessionId: session.id,
    expectedVersion: session.draft_version,
    conversationId: conversation,
    recipientChatId: CLIENT_A,
    recipientTelegramUserId: CLIENT_A,
    mode: "reply_draft",
    draftText: "Новый черновик с другого устройства",
  });
  const beforeRestart = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  db.closeDb();
  const afterRestart = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(afterRestart.draft_version, beforeRestart.draft_version);
  assert.equal(afterRestart.draft_text, "Новый черновик с другого устройства");
  assert.throws(
    () =>
      data.consumeTelegramOperatorAction({
        actionKey: staleConfirm.actionKey,
        environment: "test",
        operatorTelegramUserId: OPERATOR,
        operatorChatId: OPERATOR,
        expectedDraftVersion: afterRestart.draft_version,
      }),
    /устарело|не принадлежит/,
  );
  assert.equal(
    db.get<{ consumed_at: number | null }>(
      "SELECT consumed_at FROM telegram_operator_action WHERE action_key = ?",
      [staleConfirm.actionKey],
    )?.consumed_at,
    null,
  );
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_outbox")?.n, 0);
  assert.equal(
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_message WHERE direction = 'operator'")
      ?.n,
    0,
  );
});
