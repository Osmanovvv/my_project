import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_A, OUTSIDER, FAKE_BOT_TOKEN, initDataFields, installTestDatabase, signInitData } from "./helpers/telegram";

const db = await installTestDatabase();
const { verifyTelegramMiniAppInitData: verify, createTelegramMiniAppSession: create, readTelegramMiniAppSession: read, revokeTelegramMiniAppSession: revoke, miniAppSessionCookie, TELEGRAM_MINIAPP_INIT_MAX_AGE_MS, TELEGRAM_MINIAPP_SESSION_TTL_MS } = await import("../src/server/telegram-miniapp.server");
const now = 1_800_000_000_000;

test("9.2: independent HMAC fixture, percent encoding, optional signature and parameter order", () => {
  const fields = { ...initDataFields(now, { id: Number(CLIENT_A), first_name: "Тест + & =", username: "fixture_user" }), signature: "fixture-signature", start_param: "site_catalog" };
  const raw = signInitData(fields);
  const result = verify(raw, now);
  assert.equal(result.user.firstName, "Тест + & =");
  assert.equal(result.environment, "test");
  assert.equal(result.user.id, CLIENT_A);
  const reversed = new URLSearchParams([...new URLSearchParams(raw)].reverse());
  assert.deepEqual(verify(reversed.toString(), now).user, result.user);
});

test("9.2: user/hash tampering and a signature for another bot are rejected", () => {
  const raw = signInitData(initDataFields(now));
  const params = new URLSearchParams(raw);
  params.set("user", JSON.stringify({ id: Number(OUTSIDER), first_name: "Forged" }));
  assert.throws(() => verify(params.toString(), now), /hash_invalid/);
  params.set("hash", "00".repeat(32));
  assert.throws(() => verify(params.toString(), now), /hash_invalid/);
  assert.throws(() => verify(signInitData(initDataFields(now), `${FAKE_BOT_TOKEN}-different`), now), /hash_invalid/);
});

test("9.2: missing/malformed/oversized initData fails closed", () => {
  for (const raw of ["", " ", "hash=abc", "x".repeat(20_001), "user=%7B%7D"]) assert.throws(() => verify(raw, now));
  process.env.TELEGRAM_BOT_TOKEN = "";
  assert.throws(() => verify(signInitData(initDataFields(now)), now), /not_configured/);
});

test("9.2: auth_date age and future skew boundaries", () => {
  const raw = signInitData(initDataFields(now));
  assert.doesNotThrow(() => verify(raw, now + TELEGRAM_MINIAPP_INIT_MAX_AGE_MS));
  assert.throws(() => verify(raw, now + TELEGRAM_MINIAPP_INIT_MAX_AGE_MS + 1), /expired/);
  const future = signInitData(initDataFields(now + 60_000));
  assert.doesNotThrow(() => verify(future, now));
  assert.throws(() => verify(future, now - 60_001), /expired/);
  for (const auth_date of ["", "0", "-1", "abc", "1.5"]) assert.throws(() => verify(signInitData({ ...initDataFields(now), auth_date }), now), /auth_date_invalid/);
});

test("9.2: signed but invalid user data is rejected", () => {
  for (const user of [null, [], {}, { id: 0 }, { id: -1 }, { id: 1.5 }]) {
    assert.throws(() => verify(signInitData(initDataFields(now, user)), now), /user_missing/);
  }
  assert.throws(() => verify(signInitData(initDataFields(now, { id: 1, first_name: "Unknown" })), now), /test_user_not_allowed/);
  assert.throws(() => verify(signInitData({ ...initDataFields(now), user: "{" }), now), /user_invalid/);
});

test("9.2: test allowlist and production scope are enforced after signature validation", () => {
  const raw = signInitData(initDataFields(now, { id: Number(OUTSIDER), first_name: "Outsider" }));
  assert.throws(() => verify(raw, now), /test_user_not_allowed/);
  process.env.APP_ENV = "production";
  assert.equal(verify(raw, now).environment, "production");
});

test("9.2: duplicate parameter names cannot create ambiguous signed credentials", () => {
  const raw = signInitData(initDataFields(now));
  for (const field of ["hash", "user", "auth_date"]) {
    const params = new URLSearchParams(raw);
    params.append(field, params.get(field)!);
    assert.throws(() => verify(params.toString(), now));
  }
});

test("9.2: session stores only a token hash, is scoped, expires and can be revoked", () => {
  const session = create(signInitData(initDataFields(now)), now);
  const token = session.sessionToken!;
  assert.ok(token.length >= 32);
  const row = db.get<{ token_hash: string }>("SELECT token_hash FROM telegram_miniapp_session")!;
  assert.notEqual(row.token_hash, token);
  assert.equal(row.token_hash.length, 64);
  const cookie = `other=1; itagent_miniapp=${token}`;
  assert.equal(read(cookie, now)?.user.id, CLIENT_A);
  assert.equal(read(cookie, now + TELEGRAM_MINIAPP_SESSION_TTL_MS), undefined);
  assert.equal(read("itagent_miniapp=forged", now), undefined);
  process.env.APP_ENV = "production";
  assert.equal(read(cookie, now), undefined);
  process.env.APP_ENV = "development";
  revoke(token);
  assert.equal(read(cookie, now), undefined);
});

test("9.2: relaunch rotates cookie token without duplicating profile/session", () => {
  const raw = signInitData(initDataFields(now));
  const first = create(raw, now);
  const second = create(raw, now + 1);
  assert.equal(first.contactId, second.contactId);
  assert.notEqual(first.sessionToken, second.sessionToken);
  assert.equal(read(`itagent_miniapp=${first.sessionToken}`, now + 1), undefined);
  assert.equal(read(`itagent_miniapp=${second.sessionToken}`, now + 1)?.contactId, second.contactId);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM telegram_miniapp_session")?.n, 1);
  const cookie = miniAppSessionCookie(second.sessionToken!, Date.now() + 60_000, true);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(cookie.includes(flag));
  assert.throws(() => miniAppSessionCookie("forged", Date.now(), true), /session_invalid/);
});
