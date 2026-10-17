import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_A, WEBHOOK_SECRET, installTestDatabase, messageUpdate, webhookRequest } from "./helpers/telegram";

const db = await installTestDatabase();
const { acceptTelegramWebhookUpdate: accept, authenticateTelegramWebhook: authenticate, TELEGRAM_WEBHOOK_MAX_UPDATE_BYTES: maxBytes } = await import("../src/server/telegram-webhook.server");
const { handleTelegramWebhook: handle } = await import("../src/server/telegram-webhook-http.server");
const count = (table: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n;

test("9.3: secret authentication rejects missing/wrong and accepts only an exact match", () => {
  const update = messageUpdate(CLIENT_A, "/start");
  assert.equal(authenticate(webhookRequest(update)), null);
  for (const secret of [null, "", "wrong", `${WEBHOOK_SECRET}x`, WEBHOOK_SECRET.toUpperCase()]) {
    assert.deepEqual(authenticate(webhookRequest(update, secret)), { status: 403, error: "forbidden" });
  }
  for (const secret of ["", "with spaces", "x".repeat(257)]) {
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    assert.deepEqual(authenticate(webhookRequest(update)), { status: 503, error: "webhook_not_configured" });
  }
  assert.equal(count("telegram_update"), 0);
});

test("9.3: HTTP method, media type, body parsing and byte limits", async () => {
  assert.equal((await handle(new Request("http://localhost/api/telegram/webhook"))).status, 405);
  const wrongType = new Request("http://localhost/api/telegram/webhook", { method: "POST", headers: { "x-telegram-bot-api-secret-token": WEBHOOK_SECRET }, body: "{}" });
  assert.equal((await handle(wrongType)).status, 415);
  for (const body of ["{", "null", "[]", "1"]) assert.equal((await handle(webhookRequest(body))).status, 400);
  assert.equal((await handle(webhookRequest({ update_id: "1", message: {} }))).status, 400);
  const body = JSON.stringify(messageUpdate(CLIENT_A, "я".repeat(maxBytes)));
  assert.ok(body.length < Buffer.byteLength(body));
  assert.equal((await handle(webhookRequest(body))).status, 413);
  const declared = webhookRequest("{}");
  declared.headers.set("content-length", String(maxBytes + 1));
  assert.equal((await handle(declared)).status, 413);
  assert.equal(count("telegram_update"), 0);
  assert.equal(count("telegram_inbox"), 0);
});

test("9.3: unauthorized request body is never read", async () => {
  let reads = 0;
  const request = {
    method: "POST",
    headers: new Headers({ "x-telegram-bot-api-secret-token": "forged" }),
    get body() { reads++; throw new Error("body was read"); },
  } as unknown as Request;
  assert.equal((await handle(request)).status, 403);
  assert.equal(reads, 0);
});

test("9.3: identical update_id produces one raw update and one inbox entry", () => {
  const update = messageUpdate(CLIENT_A, "/start");
  const request = webhookRequest(update);
  assert.deepEqual(accept(request, JSON.stringify(update)), { ok: true, duplicate: false, callbackQueryId: undefined });
  assert.equal(accept(request, JSON.stringify(update)).ok, true);
  const duplicate = accept(request, JSON.stringify({ ...update, message: { ...update.message, text: "altered replay" } }));
  assert.ok(duplicate.ok && duplicate.duplicate);
  assert.equal(count("telegram_update"), 1);
  assert.equal(count("telegram_inbox"), 1);
  assert.ok(db.get<{ payload: string }>("SELECT payload FROM telegram_inbox")?.payload.includes("/start"));
});

test("9.3: concurrent HTTP replay does not duplicate business effects or bot replies", async () => {
  const update = messageUpdate(CLIENT_A, "/start");
  const responses = await Promise.all(Array.from({ length: 6 }, () => handle(webhookRequest(update))));
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(count("telegram_update"), 1);
  assert.equal(count("telegram_inbox"), 1);
  assert.equal(count("telegram_contact"), 1);
  assert.equal(count("telegram_outbox"), 1);
  assert.equal(db.get<{ status: string }>("SELECT status FROM telegram_inbox")?.status, "processed");
});

test("9.3: an inbox failure rolls the entire accepted update back and can be retried", () => {
  db.run("CREATE TRIGGER fail_test_inbox BEFORE INSERT ON telegram_inbox BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
  const update = messageUpdate(CLIENT_A, "/start");
  assert.deepEqual(accept(webhookRequest(update), JSON.stringify(update)), { ok: false, status: 503, error: "inbox_unavailable" });
  assert.equal(count("telegram_update"), 0);
  assert.equal(count("telegram_inbox"), 0);
  db.run("DROP TRIGGER fail_test_inbox");
  const retry = accept(webhookRequest(update), JSON.stringify(update));
  assert.ok(retry.ok && !retry.duplicate);
  assert.equal(count("telegram_update"), 1);
});
