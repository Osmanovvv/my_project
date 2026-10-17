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
const { handleTelegramWebhook: handle } = await import("../src/server/telegram-webhook-http.server");
const { createTelegramClientAction, validateTelegramCallback } = await import("../src/server/telegram-callback.server");

function createConversation(userId: string, title: string, now: number): number {
  const contactId = data.upsertTelegramContact({ environment: "test", telegramUserId: userId, username: `user_${userId}`, displayName: title, now });
  return data.createTelegramConversation({ environment: "test", telegramContactId: contactId, clientChatId: userId, title, isTest: true, now });
}

test("9.4b: two conversations have independent selection, pages and unread state", () => {
  const now = 1_800_000_000_000;
  const first = createConversation(CLIENT_A, "Первое обращение", now);
  const second = createConversation(CLIENT_A, "Второе обращение", now + 1);
  const foreign = createConversation(CLIENT_B, "Чужое обращение", now + 2);
  for (let i = 0; i < 25; i++) {
    data.recordTelegramMessage({ environment: "test", conversationId: first, direction: "client", messageType: "text", chatId: CLIENT_A, senderTelegramUserId: CLIENT_A, telegramMessageId: 10_000 + i, updateId: 20_000 + i, text: `first-${i}`, now: now + i });
  }
  data.recordTelegramMessage({ environment: "test", conversationId: second, direction: "client", messageType: "text", chatId: CLIENT_A, senderTelegramUserId: CLIENT_A, telegramMessageId: 30_001, updateId: 40_001, text: "second-unread", now: now + 100 });
  data.recordTelegramMessage({ environment: "test", conversationId: foreign, direction: "client", messageType: "text", chatId: CLIENT_B, senderTelegramUserId: CLIENT_B, telegramMessageId: 50_001, updateId: 60_001, text: "foreign", now: now + 101 });

  const page1 = data.listTelegramMessages("test", first, 12, 0);
  const page2 = data.listTelegramMessages("test", first, 12, 12);
  const page3 = data.listTelegramMessages("test", first, 12, 24);
  assert.equal(page1.length, 12);
  assert.equal(page2.length, 12);
  assert.equal(page3.length, 1);
  assert.equal(page1[0].text, "first-0");
  assert.equal(page3[0].text, "first-24");

  const clientConversations = data.listTelegramClientConversations("test", CLIENT_A, 20, 0);
  assert.deepEqual(new Set(clientConversations.map(conversation => conversation.id)), new Set([first, second]));
  assert.equal(data.listTelegramClientConversations("test", CLIENT_B).length, 1);
  assert.equal(data.listTelegramClientConversations("test", CLIENT_A).some(conversation => conversation.id === foreign), false);

  const unread = data.listTelegramConversations({ environment: "test", unreadOnly: true });
  assert.deepEqual(unread.map(conversation => conversation.id).sort((a, b) => a - b), [first, second, foreign].sort((a, b) => a - b));
  data.markTelegramConversationRead("test", second);
  assert.equal(data.getTelegramConversation("test", second)?.unread_count, 0);
  assert.deepEqual(data.listTelegramConversations({ environment: "test", unreadOnly: true }).map(conversation => conversation.id).sort((a, b) => a - b), [first, foreign].sort((a, b) => a - b));

  const clientSession = data.getOrCreateTelegramClientSession("test", CLIENT_A, CLIENT_A, now);
  const selectFirst = createTelegramClientAction({ environment: "test", userId: CLIENT_A, chatId: CLIENT_A, actionType: "select_conversation", conversationId: first, sessionVersion: clientSession.version, now });
  const selectSecond = createTelegramClientAction({ environment: "test", userId: CLIENT_A, chatId: CLIENT_A, actionType: "select_conversation", conversationId: second, sessionVersion: clientSession.version, now });
  assert.equal(validateTelegramCallback({ data: selectFirst, userId: CLIENT_A, chatId: CLIENT_A, isOperator: false, environment: "test", appEnvironment: "development", now })?.conversationId, first);
  assert.equal(validateTelegramCallback({ data: selectSecond, userId: CLIENT_A, chatId: CLIENT_A, isOperator: false, environment: "test", appEnvironment: "development", now })?.conversationId, second);
});

test("9.4b: opening another conversation is blocked during an active operator draft", async () => {
  const now = Date.now();
  const first = createConversation(CLIENT_A, "Клиент A", now);
  const second = createConversation(CLIENT_B, "Клиент B", now + 1);
  const operatorSession = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR, now);
  const openFirst = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: first, actionType: "open", recipientChatId: CLIENT_A, recipientTelegramUserId: CLIENT_A, draftVersion: operatorSession.draft_version, now });
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${openFirst.actionKey}`)));
  let session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.selected_conversation_id, first);
  const replyAction = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: first, actionType: "reply", recipientChatId: CLIENT_A, recipientTelegramUserId: CLIENT_A, draftVersion: session.draft_version, now: now + 2 });
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${replyAction.actionKey}`)));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.mode, "reply_draft");
  assert.equal(session.selected_conversation_id, first);
  const openSecond = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: second, actionType: "open", recipientChatId: CLIENT_B, recipientTelegramUserId: CLIENT_B, draftVersion: session.draft_version, now: now + 3 });
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${openSecond.actionKey}`)));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.mode, "reply_draft");
  assert.equal(session.selected_conversation_id, first);
  const lastReply = db.get<{ payload: string }>("SELECT payload FROM telegram_outbox ORDER BY id DESC LIMIT 1")!;
  assert.match(JSON.parse(lastReply.payload).text, /черновик|отмените/i);
});

test("9.4b: draft preview and confirmation enqueue exactly one reply to the fixed conversation recipient", async () => {
  const now = Date.now();
  const first = createConversation(CLIENT_A, "Клиент A", now);
  const second = createConversation(CLIENT_B, "Клиент B", now + 1);
  let session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR, now);
  const openFirst = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: first, actionType: "open", recipientChatId: CLIENT_A, recipientTelegramUserId: CLIENT_A, draftVersion: session.draft_version, now });
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${openFirst.actionKey}`)));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  const replyAction = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: first, actionType: "reply", recipientChatId: CLIENT_A, recipientTelegramUserId: CLIENT_A, draftVersion: session.draft_version, now: now + 1 });
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${replyAction.actionKey}`)));
  await handle(webhookRequest(messageUpdate(OPERATOR, "Ответ только для клиента A")));
  session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  assert.equal(session.mode, "reply_draft");
  assert.equal(session.selected_conversation_id, first);
  assert.equal(session.draft_recipient_chat_id, CLIENT_A);
  assert.equal(session.draft_recipient_user_id, CLIENT_A);
  assert.equal(session.draft_text, "Ответ только для клиента A");
  const previewAction = db.get<{ action_key: string; action_type: string }>("SELECT action_key, action_type FROM telegram_operator_action WHERE action_type = 'confirm_reply' ORDER BY created_at DESC LIMIT 1")!;
  assert.equal(previewAction.action_type, "confirm_reply");
  const before = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_outbox WHERE conversation_id = ?", [first])!.n;
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${previewAction.action_key}`)));
  const rows = db.all<{ recipient_chat_id: string; recipient_telegram_user_id: string; conversation_id: number; payload: string; idempotency_key: string }>("SELECT recipient_chat_id, recipient_telegram_user_id, conversation_id, payload, idempotency_key FROM telegram_outbox WHERE conversation_id = ?", [first]);
  assert.equal(rows.length, before + 1);
  const reply = rows.at(-1)!;
  assert.equal(reply.recipient_chat_id, CLIENT_A);
  assert.equal(reply.recipient_telegram_user_id, CLIENT_A);
  assert.equal(reply.conversation_id, first);
  assert.equal(JSON.parse(reply.payload).text, "Ответ только для клиента A");
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_outbox WHERE conversation_id = ?", [second])!.n, 0);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_message WHERE conversation_id = ? AND direction = 'operator'", [first])!.n, 1);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_message WHERE conversation_id = ? AND direction = 'operator'", [second])!.n, 0);
});

test("9.4b: internal note is stored for operator history and excluded from client-visible message query", () => {
  const now = Date.now();
  const conversation = createConversation(CLIENT_A, "Клиент A", now);
  const message = data.recordTelegramMessage({ environment: "test", conversationId: conversation, direction: "system", messageType: "internal_note", chatId: OPERATOR, senderTelegramUserId: OPERATOR, text: "Служебная заметка", metadata: { visibility: "operator" }, now });
  assert.equal(data.listTelegramMessages("test", conversation).find(item => item.id === message.id)?.message_type, "internal_note");
  const visible = data.listTelegramMessages("test", conversation).filter(item => item.message_type !== "internal_note" && item.direction !== "system");
  assert.equal(visible.some(item => item.id === message.id), false);
});
