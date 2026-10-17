import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_A, CLIENT_B, OPERATOR, OUTSIDER, callbackUpdate, installTestDatabase, messageUpdate, webhookRequest } from "./helpers/telegram";

const db = await installTestDatabase();
const data = await import("../src/server/telegram-data.server");
type TelegramEnvironment = import("../src/server/telegram-data.server").TelegramEnvironment;
const { acceptTelegramWebhookUpdate: accept, listPendingTelegramInbound } = await import("../src/server/telegram-webhook.server");
const { createTelegramClientAction, validateTelegramCallback: validate } = await import("../src/server/telegram-callback.server");
const { handleTelegramWebhook: handle } = await import("../src/server/telegram-webhook-http.server");

function receive(update: unknown) { return accept(webhookRequest(update), JSON.stringify(update)); }
function validation(callback: string, patch: Record<string, unknown> = {}) {
  return validate({ data: callback, userId: CLIENT_A, chatId: CLIENT_A, isOperator: false, environment: "test", appEnvironment: "development", now: Date.now(), ...patch });
}
function seed(userId = CLIENT_A, environment: TelegramEnvironment = "test") {
  const contactId = data.upsertTelegramContact({ environment, telegramUserId: userId });
  const conversationId = data.createTelegramConversation({ environment, telegramContactId: contactId, clientChatId: userId });
  return conversationId;
}

test("9.4: development drops working traffic, accepts test users and rejects client /admin", () => {
  assert.deepEqual(receive(messageUpdate(OUTSIDER, "/start")), { ok: true, duplicate: false, ignored: "working_traffic_disabled" });
  assert.deepEqual(receive(messageUpdate(CLIENT_A, "/admin@ITagent_bot")), { ok: true, duplicate: false, ignored: "operator_required" });
  assert.ok(receive(messageUpdate(CLIENT_A, "/start")).ok);
  assert.equal(listPendingTelegramInbound("test").length, 1);
  assert.throws(() => listPendingTelegramInbound("production"), /environment_forbidden/);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_update")?.n, 1);
});

test("9.4: production separates live/test/operator inbox rows and sessions", async () => {
  process.env.APP_ENV = "production";
  for (const [user, text] of [[OUTSIDER, "/start"], [CLIENT_A, "/start"], [OPERATOR, "/admin"]]) {
    assert.equal((await handle(webhookRequest(messageUpdate(user, text)))).status, 200);
  }
  const rows = db.all<{ environment: string; actor_role: string; sender_telegram_user_id: string; status: string }>("SELECT * FROM telegram_inbox ORDER BY id");
  assert.deepEqual(rows.map(r => [r.environment, r.actor_role, r.sender_telegram_user_id, r.status]), [
    ["production", "client", OUTSIDER, "processed"], ["test", "client", CLIENT_A, "processed"], ["test", "operator", OPERATOR, "processed"],
  ]);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_client_session")?.n, 2);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_operator_session")?.n, 1);
});

test("9.4: same Telegram identity is isolated by environment", () => {
  const testConversation = seed();
  const productionConversation = seed(CLIENT_A, "production");
  assert.notEqual(testConversation, productionConversation);
  assert.deepEqual(data.listTelegramClientConversations("test", CLIENT_A).map(c => c.id), [testConversation]);
  assert.deepEqual(data.listTelegramClientConversations("production", CLIENT_A).map(c => c.id), [productionConversation]);
  assert.equal(data.getTelegramConversation("production", testConversation), undefined);
  assert.throws(() => data.recordTelegramMessage({ environment: "test", conversationId: productionConversation, direction: "client", messageType: "text", chatId: CLIENT_A }), /окружении/);
});

test("9.4a: operator role requires BOTH allowlisted user and matching private chat", () => {
  process.env.APP_ENV = "production";
  receive(messageUpdate(OPERATOR, "/admin"));
  assert.equal(db.get<{ actor_role: string }>("SELECT actor_role FROM telegram_inbox")?.actor_role, "operator");
  process.env.TELEGRAM_OPERATOR_CHAT_ID = CLIENT_A;
  assert.deepEqual(receive(messageUpdate(OPERATOR, "/admin")), { ok: true, duplicate: false, ignored: "operator_required" });
  process.env.TELEGRAM_OPERATOR_CHAT_ID = OPERATOR;
  process.env.TELEGRAM_OPERATOR_IDS = "invalid,0,-1";
  assert.deepEqual(receive(messageUpdate(OPERATOR, "/admin")), { ok: true, duplicate: false, ignored: "operator_required" });
  assert.deepEqual(receive(messageUpdate(OPERATOR, "/admin", { chat: { id: Number(CLIENT_A), type: "private" } })), { ok: true, duplicate: false, ignored: "private_chat_mismatch" });
  assert.deepEqual(receive(messageUpdate(OPERATOR, "/admin", { chat: { id: -100, type: "supergroup" } })), { ok: true, duplicate: false, ignored: "private_chat_required" });
});

test("9.4a: client callback binds owner, private chat, environment, session version and expiry", () => {
  const conversationId = seed();
  const session = data.getOrCreateTelegramClientSession("test", CLIENT_A, CLIENT_A);
  const callback = createTelegramClientAction({ environment: "test", userId: CLIENT_A, chatId: CLIENT_A, actionType: "select_conversation", conversationId, sessionVersion: session.version });
  assert.equal(validation(callback)?.conversationId, conversationId);
  for (const patch of [{ userId: CLIENT_B, chatId: CLIENT_B }, { chatId: CLIENT_B }, { environment: "production" }, { now: Date.now() + data.TELEGRAM_RETENTION.actionMs + 1 }]) assert.equal(validation(callback, patch), null);
  assert.throws(() => createTelegramClientAction({ environment: "test", userId: CLIENT_B, chatId: CLIENT_B, actionType: "select_conversation", conversationId }), /not_owned/);
  data.updateTelegramClientSession({ environment: "test", telegramUserId: CLIENT_A, chatId: CLIENT_A, mode: "menu", expectedVersion: session.version });
  assert.equal(validation(callback), null);
});

test("9.4a: callback reservation, consumption and update replay are one-use", async () => {
  data.getOrCreateTelegramClientSession("test", CLIENT_A, CLIENT_A);
  const callback = createTelegramClientAction({ environment: "test", userId: CLIENT_A, chatId: CLIENT_A, actionType: "help" });
  const update = callbackUpdate(CLIENT_A, callback);
  assert.equal((await handle(webhookRequest(update))).status, 200);
  assert.ok(receive(update).ok);
  const replay = receive(callbackUpdate(CLIENT_A, callback));
  assert.ok(replay.ok && replay.callbackRejected);
  const row = db.get<{ consumed_at: number; queued_update_id: number }>("SELECT * FROM telegram_client_action")!;
  assert.ok(row.consumed_at);
  assert.equal(row.queued_update_id, update.update_id);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_inbox")?.n, 1);
});

test("9.4a: operator callbacks reject wrong role, owner, environment, stale version and expired session", () => {
  const session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  const action = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: null, actionType: "menu", recipientChatId: OPERATOR, draftVersion: session.draft_version });
  const callback = `op:${action.actionKey}`;
  const allowed = { userId: OPERATOR, chatId: OPERATOR, isOperator: true };
  assert.ok(validation(callback, allowed));
  for (const patch of [{ isOperator: false }, { userId: CLIENT_A }, { chatId: CLIENT_A }, { environment: "production" }, { now: action.expiresAt }]) assert.equal(validation(callback, { ...allowed, ...patch }), null);
  assert.equal(validation(callback, { ...allowed, environment: "production", appEnvironment: "production" })?.environment, "test");
  db.run("UPDATE telegram_operator_session SET updated_at = ?", [Date.now() - data.TELEGRAM_RETENTION.sessionMs - 1]);
  assert.equal(validation(callback, allowed), null);
  db.run("UPDATE telegram_operator_session SET updated_at = ?, draft_version = draft_version + 1", [Date.now()]);
  assert.equal(validation(callback, allowed), null);
});

test("9.4a: local operator cannot switch into working mode with a stored action", async () => {
  const session = data.getOrCreateTelegramOperatorSession("test", OPERATOR, OPERATOR);
  const action = data.createTelegramOperatorAction({ environment: "test", operatorTelegramUserId: OPERATOR, operatorChatId: OPERATOR, conversationId: null, actionType: "switch_environment", recipientChatId: OPERATOR, draftVersion: session.draft_version, payload: { environment: "production" } });
  await handle(webhookRequest(callbackUpdate(OPERATOR, `op:${action.actionKey}`)));
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_operator_session WHERE environment = 'production'")?.n, 0);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_outbox WHERE environment = 'production'")?.n, 0);
});
