/**
 * Единственное место в проекте, которое знает про `node:sqlite`.
 *
 * Модуль помечен в Node как экспериментальный: он работает без флага начиная
 * с Node 22.5, но API может поменяться в следующей мажорной версии. Поэтому
 * весь доступ к базе идёт через эту обёртку — если `DatabaseSync` переименуют
 * или сменят сигнатуры, править придётся один файл, а не сорок вызовов
 * по всему коду.
 *
 * Почему не `better-sqlite3`: он нативный, и на машине разработчика (Windows)
 * его установка падает на node-gyp. Плюс Nitro пришлось бы учить не бандлить
 * бинарник. Встроенный модуль для сборщика — просто builtin, он его не трогает.
 *
 * Файл базы живёт в каталоге данных РЯДОМ с приложением, а не внутри него:
 * `.output` пересобирается целиком при каждом деплое, и база, лежащая внутри,
 * была бы стёрта. См. `DATA_DIR`.
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, isAbsolute, resolve } from "node:path";

import { MIGRATIONS } from "./migrations.server";

/**
 * Каталог для базы и загруженных картинок. Задаётся переменной `DATA_DIR`;
 * по умолчанию — `.data` в рабочем каталоге процесса. В разработке это корень
 * проекта, в проде — каталог, который указан в systemd-юните.
 *
 * Каталог намеренно НЕ внутри `public/` и не внутри `.output/`: первый
 * раздаётся статикой целиком (база утекла бы в интернет), второй стирается
 * при сборке.
 */
export const DATA_DIR = (() => {
  const raw = process.env.DATA_DIR?.trim() || ".data";
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
})();

export const MEDIA_DIR = join(DATA_DIR, "media");

/** Значение колонки, как его отдаёт node:sqlite. */
export type SqlValue = string | number | bigint | null | Uint8Array;
export type Row = Record<string, SqlValue>;
export type Params = SqlValue[];

let handle: DatabaseSync | null = null;

/**
 * Соединение открывается лениво и живёт до конца процесса.
 *
 * SQLite здесь синхронный, и это осознанно: у нас один процесс Node и
 * нагрузка в единицы запросов в секунду. Асинхронный драйвер добавил бы
 * пул, ожидание и обработку разрывов, не дав ничего взамен.
 */
function db(): DatabaseSync {
  if (handle) return handle;

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(MEDIA_DIR, { recursive: true });

  const next = new DatabaseSync(join(DATA_DIR, "content.db"));

  /* WAL: читатели не блокируют писателя. Без него любой чтение-запрос
     страницы мог бы встать в очередь за сохранением из админки.
     `busy_timeout` — страховка на случай, если это всё же произойдёт:
     лучше подождать 5 секунд, чем отдать посетителю ошибку. */
  next.exec("PRAGMA journal_mode = WAL");
  next.exec("PRAGMA synchronous = NORMAL");
  next.exec("PRAGMA foreign_keys = ON");
  next.exec("PRAGMA busy_timeout = 5000");

  migrate(next);

  handle = next;
  return next;
}

/**
 * Накат миграций по номеру. Схема хранится в `user_version` — встроенном
 * счётчике SQLite, для которого не нужна своя таблица и который переживает
 * копирование файла базы.
 */
function migrate(connection: DatabaseSync): void {
  const [{ user_version: current }] = connection
    .prepare("PRAGMA user_version")
    .all() as unknown as Array<{ user_version: number }>;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    connection.exec("BEGIN");
    try {
      connection.exec(migration.up);
      /* `user_version` не принимает параметры — только литерал. Номер берётся
         из нашего же массива, не из пользовательского ввода. */
      connection.exec(`PRAGMA user_version = ${migration.version}`);
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw new Error(
        `Миграция ${migration.version} (${migration.name}) не применилась: ${String(error)}`,
      );
    }
  }
}

/** Строки результата. Для SELECT. */
export function all<T = Row>(sql: string, params: Params = []): T[] {
  return db()
    .prepare(sql)
    .all(...params) as T[];
}

/** Первая строка или `undefined`. */
export function get<T = Row>(sql: string, params: Params = []): T | undefined {
  return db()
    .prepare(sql)
    .get(...params) as T | undefined;
}

/** INSERT/UPDATE/DELETE. Возвращает id вставленной строки и число затронутых. */
export function run(sql: string, params: Params = []): { lastId: number; changes: number } {
  const result = db()
    .prepare(sql)
    .run(...params);
  return {
    lastId: Number(result.lastInsertRowid ?? 0),
    changes: Number(result.changes ?? 0),
  };
}

/**
 * Несколько записей одной транзакцией. Либо применяется всё, либо ничего —
 * важно для сохранения кейса, где пишется и сама запись, и её списки.
 *
 * Вложенные вызовы намеренно не поддержаны: SQLite не умеет вложенные
 * транзакции без savepoint'ов, а нам они не нужны. Попытка вложить —
 * ошибка на этапе разработки, а не молчаливая порча данных.
 */
let inTransaction = false;

export function transaction<T>(fn: () => T): T {
  if (inTransaction) {
    throw new Error("Вложенная транзакция: перенесите вызов наружу");
  }

  const connection = db();
  inTransaction = true;
  connection.exec("BEGIN");
  try {
    const result = fn();
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  } finally {
    inTransaction = false;
  }
}

/**
 * Версия контента. Растёт при каждой записи из админки — на неё опирается
 * кеш снимка контента, чтобы страницы не ходили в базу на каждый запрос,
 * но и не отдавали устаревшее после правки.
 */
export function contentVersion(): number {
  const row = get<{ value: string }>("SELECT value FROM meta WHERE key = 'content_version'");
  return Number(row?.value ?? 0);
}

export function bumpContentVersion(): void {
  run(
    "UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'content_version'",
  );
}

/** Закрыть соединение. Нужно только тестам и скриптам обслуживания. */
export function closeDb(): void {
  handle?.close();
  handle = null;
}
