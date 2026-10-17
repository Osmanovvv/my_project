/**
 * Проверка Telegram Mini App initData и короткая серверная сессия клиента.
 *
 * `initDataUnsafe` никогда не используется: браузер присылает на сервер
 * только сырой `Telegram.WebApp.initData`, а сервер сверяет HMAC с токеном
 * бота и проверяет свежесть auth_date. После этого в cookie остаётся только
 * случайный непрозрачный идентификатор сессии.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { all, get, run, transaction } from "./db.server";
import {
  currentTelegramEnvironment,
  upsertTelegramContact,
  type TelegramEnvironment,
} from "./telegram-data.server";

export const TELEGRAM_MINIAPP_SESSION_COOKIE = "itagent_miniapp";
export const TELEGRAM_MINIAPP_INIT_MAX_AGE_MS = 10 * 60 * 1000;
export const TELEGRAM_MINIAPP_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_FUTURE_SKEW_MS = 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const HASH_RE = /^[a-f0-9]{64}$/i;

export type TelegramMiniAppEnvironment = "production" | "test";

export type TelegramMiniAppUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
};

export type TelegramMiniAppSession = {
  environment: TelegramMiniAppEnvironment;
  /** Есть только в результате создания; из БД обратно не извлекается. */
  sessionToken?: string;
  contactId: number;
  user: TelegramMiniAppUser;
  authDate: number;
  createdAt: number;
  expiresAt: number;
};

type VerifiedInitData = {
  environment: TelegramMiniAppEnvironment;
  launchHash: string;
  authDate: number;
  user: TelegramMiniAppUser;
};

type SessionRow = {
  token_hash: string;
  environment: TelegramMiniAppEnvironment;
  telegram_contact_id: number;
  auth_date: number;
  created_at: number;
  expires_at: number;
  username: string;
  display_name: string;
  telegram_user_id: string;
};

function appEnvironment(): TelegramMiniAppEnvironment {
  return currentTelegramEnvironment() === "production" ? "production" : "test";
}

function allowedTestUsers(): Set<string> {
  return new Set(
    [process.env.TELEGRAM_TEST_USER_IDS, process.env.TELEGRAM_OPERATOR_IDS]
      .filter(Boolean)
      .flatMap((value) => (value ?? "").split(","))
      .map((value) => value.trim())
      .filter((value) => /^[1-9]\d*$/.test(value)),
  );
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!token) throw new Error("telegram_miniapp_not_configured");
  return token;
}

function safeEqualHex(actual: string, expected: string): boolean {
  if (!HASH_RE.test(actual) || !HASH_RE.test(expected)) return false;
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeUser(value: unknown): TelegramMiniAppUser {
  if (!value || typeof value !== "object") throw new Error("telegram_miniapp_user_missing");
  const input = value as Record<string, unknown>;
  const id = String(input.id ?? "").trim();
  if (!/^[1-9]\d*$/.test(id)) throw new Error("telegram_miniapp_user_missing");
  return {
    id,
    username: typeof input.username === "string" ? input.username.trim().slice(0, 255) : "",
    firstName: typeof input.first_name === "string" ? input.first_name.trim().slice(0, 255) : "",
    lastName: typeof input.last_name === "string" ? input.last_name.trim().slice(0, 255) : "",
  };
}

function sessionRowToValue(row: SessionRow): TelegramMiniAppSession {
  return {
    environment: row.environment,
    contactId: row.telegram_contact_id,
    user: {
      id: row.telegram_user_id,
      username: row.username,
      firstName: row.display_name.split(" ")[0] ?? "",
      lastName: row.display_name.split(" ").slice(1).join(" "),
    },
    authDate: row.auth_date,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/** Проверяет сырой Telegram.WebApp.initData на сервере. */
export function verifyTelegramMiniAppInitData(
  rawInitData: string,
  now = Date.now(),
): VerifiedInitData {
  const raw = rawInitData.trim();
  if (!raw || raw.length > 20_000) throw new Error("telegram_miniapp_init_data_invalid");
  const params = new URLSearchParams(raw);
  // Telegram sends every field once. Reject duplicate security-sensitive
  // fields instead of letting `get()` silently choose the first value while
  // the data-check-string contains a different set of values.
  for (const key of ["hash", "auth_date", "user"]) {
    if (params.getAll(key).length !== 1) {
      throw new Error(
        key === "hash" ? "telegram_miniapp_hash_invalid" : "telegram_miniapp_init_data_invalid",
      );
    }
  }
  const receivedHash = params.get("hash") ?? "";
  if (!HASH_RE.test(receivedHash)) throw new Error("telegram_miniapp_hash_invalid");

  const fields: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") fields.push(`${key}=${value}`);
  });
  fields.sort();
  const dataCheckString = fields.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken()).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(receivedHash, expectedHash)) throw new Error("telegram_miniapp_hash_invalid");

  const authDate = Number(params.get("auth_date") ?? "");
  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    throw new Error("telegram_miniapp_auth_date_invalid");
  }
  const authMs = authDate * 1000;
  if (authMs > now + MAX_FUTURE_SKEW_MS || now - authMs > TELEGRAM_MINIAPP_INIT_MAX_AGE_MS) {
    throw new Error("telegram_miniapp_init_data_expired");
  }

  let user: TelegramMiniAppUser;
  try {
    user = normalizeUser(JSON.parse(params.get("user") ?? ""));
  } catch (error) {
    if (error instanceof Error && error.message === "telegram_miniapp_user_missing") throw error;
    throw new Error("telegram_miniapp_user_invalid");
  }

  const environment = appEnvironment();
  if (environment === "test" && !allowedTestUsers().has(user.id)) {
    throw new Error("telegram_miniapp_test_user_not_allowed");
  }

  return {
    environment,
    launchHash: createHash("sha256").update(raw).digest("hex"),
    authDate,
    user,
  };
}

/** Создаёт сессию по уже проверенному initData и обновляет Telegram-профиль. */
export function createTelegramMiniAppSession(
  rawInitData: string,
  now = Date.now(),
): TelegramMiniAppSession {
  const verified = verifyTelegramMiniAppInitData(rawInitData, now);
  return transaction(() => {
    const contactId = upsertTelegramContact({
      environment: verified.environment,
      telegramUserId: verified.user.id,
      username: verified.user.username,
      displayName: [verified.user.firstName, verified.user.lastName].filter(Boolean).join(" "),
      now,
    });
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = now + TELEGRAM_MINIAPP_SESSION_TTL_MS;
    run(
      `INSERT INTO telegram_miniapp_session
       (token_hash, environment, telegram_contact_id, launch_hash, auth_date, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(environment, launch_hash) DO UPDATE SET
         token_hash = excluded.token_hash,
         telegram_contact_id = excluded.telegram_contact_id,
         auth_date = excluded.auth_date,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at,
         revoked_at = NULL`,
      [
        tokenHash,
        verified.environment,
        contactId,
        verified.launchHash,
        verified.authDate,
        now,
        expiresAt,
      ],
    );
    return {
      environment: verified.environment,
      sessionToken: token,
      contactId,
      user: verified.user,
      authDate: verified.authDate,
      createdAt: now,
      expiresAt,
    };
  });
}

/** Читает только непросроченную сессию из HttpOnly cookie. */
export function readTelegramMiniAppSession(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): TelegramMiniAppSession | undefined {
  const token = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TELEGRAM_MINIAPP_SESSION_COOKIE}=`))
    ?.slice(TELEGRAM_MINIAPP_SESSION_COOKIE.length + 1);
  if (!token || !TOKEN_RE.test(token)) return undefined;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = get<SessionRow>(
    `SELECT s.token_hash, s.environment, s.telegram_contact_id, s.auth_date,
            s.created_at, s.expires_at, c.username, c.display_name,
            c.telegram_user_id
     FROM telegram_miniapp_session s
     JOIN telegram_contact c ON c.id = s.telegram_contact_id
       AND c.environment = s.environment
     WHERE s.token_hash = ? AND s.environment = ?
       AND s.revoked_at IS NULL AND s.expires_at > ?`,
    [tokenHash, appEnvironment(), now],
  );
  return row ? sessionRowToValue(row) : undefined;
}

export function revokeTelegramMiniAppSession(token: string): void {
  if (!TOKEN_RE.test(token)) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  run("UPDATE telegram_miniapp_session SET revoked_at = ? WHERE token_hash = ?", [
    Date.now(),
    tokenHash,
  ]);
}

/** Для retention-планировщика: удалить только истёкшие/отозванные сессии. */
export function purgeExpiredTelegramMiniAppSessions(now = Date.now()): number {
  return run(
    "DELETE FROM telegram_miniapp_session WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND created_at < ?)",
    [now, now - TELEGRAM_MINIAPP_SESSION_TTL_MS],
  ).changes;
}

export function miniAppSessionCookie(token: string, expiresAt: number, secure: boolean): string {
  if (!TOKEN_RE.test(token)) throw new Error("telegram_miniapp_session_invalid");
  return [
    `${TELEGRAM_MINIAPP_SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function currentMiniAppEnvironment(): TelegramEnvironment {
  return appEnvironment();
}
