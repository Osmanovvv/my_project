/**
 * Вход в админку. Одна учётная запись — владелец работает один, ролей нет.
 *
 * Всё на `node:crypto`, без зависимостей: тянуть bcrypt ради одного пароля
 * бессмысленно, а scrypt встроен в Node и рекомендован для хранения паролей.
 *
 * Два правила, ради которых модуль выглядит именно так:
 *
 * 1. В базе лежит ХЕШ пароля и ХЕШ токена сессии, а не сами значения.
 *    Копия базы, которую владелец скачает на ноутбук для бэкапа, не должна
 *    быть работающим ключом от админки.
 *
 * 2. Сравнения — только `timingSafeEqual`. Обычное `===` на строках выходит
 *    раньше на первом несовпавшем байте, и по времени ответа можно
 *    подбирать значение посимвольно.
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

import { get, run } from "./db.server";

/* Параметры scrypt. N=16384 — примерно 50–100 мс на проверку: незаметно
   при входе раз в день и очень дорого при переборе. Хранятся внутри самого
   хеша, поэтому их можно поднять позже, не ломая уже заведённый пароль. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней
const MAX_FAILED = 7;
const LOCK_MS = 15 * 60 * 1000;

export const SESSION_COOKIE = "itagent_admin";

/** Пароль → строка вида `scrypt$N$r$p$соль$ключ`, всё в hex. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plain.normalize("NFKC"), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Проверка пароля. Параметры берутся из самого хеша, поэтому пароли,
 * заведённые со старыми параметрами, продолжают работать после их повышения.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(plain.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type AccountRow = {
  password_hash: string;
  failed_count: number;
  locked_until: number;
};

function account(): AccountRow {
  const row = get<AccountRow>(
    "SELECT password_hash, failed_count, locked_until FROM admin_account WHERE id = 1",
  );
  return row ?? { password_hash: "", failed_count: 0, locked_until: 0 };
}

/** Задан ли пароль. Пока нет — админка показывает инструкцию, а не форму входа. */
export function isConfigured(): boolean {
  return account().password_hash !== "";
}

/**
 * Завести пароль из переменной окружения при первом запуске.
 *
 * Так владельцу не нужно лезть в базу руками: задал `ADMIN_PASSWORD` в
 * окружении сервера, поднял приложение — пароль сохранён в виде хеша.
 * Дальше источником правды становится база, и переменную можно убрать;
 * менять пароль — уже из самой админки.
 *
 * Повторный запуск с той же переменной ничего не перезаписывает: иначе
 * смена пароля в админке откатывалась бы при каждом перезапуске сервера.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function ensurePasswordFromEnv(): void {
  if (isConfigured()) return;

  const initial = process.env.ADMIN_PASSWORD?.trim();
  if (!initial) return;

  /**
   * Короткий пароль отвергается — но ГРОМКО.
   *
   * Раньше он отбрасывался молча: сервер поднимался, вход не работал,
   * и понять почему было невозможно ни из интерфейса, ни из логов.
   * Владелец задал бы `ADMIN_PASSWORD=1234`, перезапустил сервер
   * и упёрся бы в «Пароль ещё не задан», не понимая, при чём тут он.
   */
  if (initial.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[admin] Пароль из ADMIN_PASSWORD не принят: ${initial.length} символов, ` +
        `нужно минимум ${MIN_PASSWORD_LENGTH}. Задайте пароль подлиннее и перезапустите сервер.`,
    );
    return;
  }

  run("UPDATE admin_account SET password_hash = ?, password_set_at = ? WHERE id = 1", [
    hashPassword(initial),
    Date.now(),
  ]);
  console.log("[admin] Пароль администратора принят из ADMIN_PASSWORD и сохранён в базе.");
}

export function setPassword(plain: string): void {
  run(
    "UPDATE admin_account SET password_hash = ?, password_set_at = ?, failed_count = 0, locked_until = 0 WHERE id = 1",
    [hashPassword(plain), Date.now()],
  );
  /* Смена пароля разлогинивает везде: иначе украденная сессия переживёт
     смену пароля, которая обычно и делается из-за подозрения на утечку. */
  run("DELETE FROM admin_session");
}

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: "not_configured" | "locked" | "bad_password"; retryInMs?: number };

/**
 * Попытка входа. При серии неудач вход закрывается на 15 минут — этого
 * достаточно против перебора и не мешает владельцу, который просто опечатался.
 */
export function login(plain: string): LoginResult {
  const row = account();
  if (!row.password_hash) return { ok: false, reason: "not_configured" };

  const now = Date.now();
  if (row.locked_until > now) {
    return { ok: false, reason: "locked", retryInMs: row.locked_until - now };
  }

  if (!verifyPassword(plain, row.password_hash)) {
    const failed = row.failed_count + 1;
    const lockUntil = failed >= MAX_FAILED ? now + LOCK_MS : 0;
    run("UPDATE admin_account SET failed_count = ?, locked_until = ? WHERE id = 1", [
      lockUntil ? 0 : failed,
      lockUntil,
    ]);
    return lockUntil
      ? { ok: false, reason: "locked", retryInMs: LOCK_MS }
      : { ok: false, reason: "bad_password" };
  }

  run("UPDATE admin_account SET failed_count = 0, locked_until = 0 WHERE id = 1");
  return { ok: true, token: createSession() };
}

/** sha256 от токена — то, что попадёт в базу. */
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createSession(): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  run(
    "INSERT INTO admin_session (token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)",
    [tokenHash(token), now, now, now + SESSION_TTL_MS],
  );
  purgeExpired();
  return token;
}

/**
 * Действителен ли токен. Заодно продлевает сессию, но не чаще раза в сутки —
 * иначе каждый переход по админке был бы записью в базу.
 */
export function verifySession(token: string | undefined): boolean {
  if (!token) return false;

  const hash = tokenHash(token);
  const row = get<{ expires_at: number; last_seen_at: number }>(
    "SELECT expires_at, last_seen_at FROM admin_session WHERE token_hash = ?",
    [hash],
  );
  if (!row) return false;

  const now = Date.now();
  if (row.expires_at <= now) {
    run("DELETE FROM admin_session WHERE token_hash = ?", [hash]);
    return false;
  }

  if (now - row.last_seen_at > 24 * 60 * 60 * 1000) {
    run("UPDATE admin_session SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?", [
      now,
      now + SESSION_TTL_MS,
      hash,
    ]);
  }

  return true;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  run("DELETE FROM admin_session WHERE token_hash = ?", [tokenHash(token)]);
}

/** Выйти на всех устройствах. */
export function destroyAllSessions(): void {
  run("DELETE FROM admin_session");
}

function purgeExpired(): void {
  run("DELETE FROM admin_session WHERE expires_at <= ?", [Date.now()]);
}

/**
 * Настройки cookie сессии. Вынесены сюда, чтобы вход и выход задавали их
 * одинаково: если при удалении не совпадут `path` или `sameSite`, браузер
 * посчитает это другой cookie и старая останется жить.
 *
 * `sameSite: lax`, а не `strict`: при `strict` переход по внешней ссылке
 * на админку (например из закладки в мессенджере) не отдал бы cookie,
 * и владелец увидел бы форму входа при живой сессии. От межсайтовых
 * запросов защищает проверка заголовка Origin в операциях записи.
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
} as const;
