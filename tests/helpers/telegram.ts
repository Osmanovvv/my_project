import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, afterEach, beforeEach } from "node:test";

export const CLIENT_A = "910000001";
export const CLIENT_B = "910000002";
export const OUTSIDER = "910000003";
export const OPERATOR = "910000099";
export const FAKE_BOT_TOKEN = "123456789:synthetic-test-token-never-use-in-telegram";
export const WEBHOOK_SECRET = "synthetic_webhook_secret";

function configureEnvironment(directory: string): void {
  // Never read the workspace .env. Replace every relevant value, even if the
  // caller exported a real token or a production DATA_DIR in their terminal.
  Object.assign(process.env, {
    NODE_ENV: "test",
    APP_ENV: "development",
    DATA_DIR: directory,
    ADMIN_PASSWORD: "",
    TELEGRAM_BOT_TOKEN: FAKE_BOT_TOKEN,
    TELEGRAM_DELIVERY_ENABLED: "false",
    TELEGRAM_CHAT_ID: "",
    TELEGRAM_OPERATOR_IDS: OPERATOR,
    TELEGRAM_OPERATOR_CHAT_ID: OPERATOR,
    TELEGRAM_OPERATOR_NOTIFICATIONS: "false",
    TELEGRAM_TEST_USER_IDS: `${CLIENT_A},${CLIENT_B},${OPERATOR}`,
    TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
    TELEGRAM_MINIAPP_URL: "https://example.invalid/miniapp",
  });
}

/** Must run before dynamically importing server modules (DATA_DIR is cached). */
export async function installTestDatabase() {
  const temporaryRoot = resolve(tmpdir());
  const directory = mkdtempSync(join(temporaryRoot, "itagent-test-"));
  configureEnvironment(directory);
  const db = await import("../../src/server/db.server");
  assert.equal(db.DATA_DIR, directory, "tests must use their own temporary database");
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  const denyNetwork: typeof fetch = async () => {
    networkAttempts++;
    throw new Error("External network is forbidden in automated tests");
  };
  beforeEach(() => {
    db.closeDb();
    for (const file of ["content.db", "content.db-wal", "content.db-shm"]) {
      rmSync(join(directory, file), { force: true });
    }
    configureEnvironment(directory);
    networkAttempts = 0;
    globalThis.fetch = denyNetwork;
  });
  afterEach(() => {
    globalThis.fetch = denyNetwork;
    assert.equal(networkAttempts, 0, "a test attempted an unmocked network call");
    assert.equal(db.get<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check, "ok");
    assert.deepEqual(db.all("PRAGMA foreign_key_check"), []);
  });
  after(() => {
    db.closeDb();
    globalThis.fetch = originalFetch;
    // Only our own newly created directory can be recursively removed.
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.ok(directory.startsWith(join(temporaryRoot, "itagent-test-")));
    rmSync(directory, { recursive: true, force: true });
  });
  return db;
}

let updateSequence = 100;

export function messageUpdate(userId: string, text: string, patch: Record<string, unknown> = {}) {
  const updateId = ++updateSequence;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      from: { id: Number(userId), is_bot: false, first_name: "Synthetic", username: "fixture_user" },
      chat: { id: Number(userId), type: "private" },
      text,
      ...patch,
    },
  };
}

export function callbackUpdate(userId: string, data: string) {
  const updateId = ++updateSequence;
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { id: Number(userId), is_bot: false, first_name: "Synthetic" },
      message: { message_id: updateId, chat: { id: Number(userId), type: "private" } },
      data,
    },
  };
}

export function webhookRequest(body: unknown, secret: string | null = WEBHOOK_SECRET): Request {
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === null ? {} : { "x-telegram-bot-api-secret-token": secret }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Independent fixture signer, including optional fields supplied by Telegram. */
export function signInitData(fields: Record<string, string>, token = FAKE_BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", key).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

export function initDataFields(now: number, user: unknown = { id: Number(CLIENT_A), first_name: "Тест" }) {
  return {
    query_id: "synthetic-query",
    user: JSON.stringify(user),
    auth_date: String(Math.floor(now / 1000)),
  };
}
