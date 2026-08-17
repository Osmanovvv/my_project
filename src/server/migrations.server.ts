/**
 * Миграции схемы.
 *
 * Почему TypeScript-модуль со строками SQL, а не файлы `.sql`: Nitro собирает
 * серверный бандл по графу импортов. Произвольные файлы, лежащие рядом
 * с исходниками, в `.output/server` не попадут, и на проде миграции просто
 * не найдутся. Строка внутри модуля попадёт туда гарантированно.
 *
 * Правило: применённую миграцию НЕ редактируют. База, на которой она уже
 * отработала, о правке не узнает — `user_version` у неё уже поднят. Любое
 * изменение схемы — новая запись в конце массива.
 */

export type Migration = {
  version: number;
  name: string;
  up: string;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "Заявки и доступ в админку",
    up: `
      -- Служебные значения. Пока здесь только версия контента, на которой
      -- держится кеш чтения: она в базе, а не в памяти процесса, чтобы
      -- пережить перезапуск и не разъехаться между процессами.
      CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO meta (key, value) VALUES ('content_version', '1');

      -- Заявки с формы. Пишутся ДО отправки в Telegram: доставка может
      -- не удаться, а контакт клиента терять нельзя — ровно эта дыра
      -- и была причиной всей затеи.
      --
      -- Времена — целые миллисекунды epoch. Один формат на всю базу,
      -- чтобы не гадать при сравнении и сортировке.
      CREATE TABLE lead (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at     INTEGER NOT NULL,
        name           TEXT    NOT NULL,
        contact        TEXT    NOT NULL,
        task           TEXT    NOT NULL DEFAULT '',
        page           TEXT    NOT NULL DEFAULT '',
        source         TEXT    NOT NULL DEFAULT '',
        status         TEXT    NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','in_progress','won','lost','spam')),
        note           TEXT    NOT NULL DEFAULT '',
        -- NULL = ещё не открывали. На этом держится счётчик в меню админки.
        read_at        INTEGER,
        -- Дошло ли в Telegram. 0 при сбое доставки — такие заявки
        -- показываются в админке отдельной отметкой.
        delivered      INTEGER NOT NULL DEFAULT 0 CHECK (delivered IN (0,1)),
        delivery_error TEXT    NOT NULL DEFAULT ''
      );
      CREATE INDEX lead_feed   ON lead (created_at DESC);
      CREATE INDEX lead_status ON lead (status, created_at DESC);
      CREATE INDEX lead_unread ON lead (created_at DESC) WHERE read_at IS NULL;

      -- Учётная запись ровно одна: владелец работает один, ролей нет.
      -- CHECK (id = 1) делает это ограничением схемы, а не договорённостью.
      CREATE TABLE admin_account (
        id              INTEGER PRIMARY KEY CHECK (id = 1),
        -- Формат: scrypt$N$r$p$соль$ключ. Пусто, пока пароль не задан.
        password_hash   TEXT    NOT NULL DEFAULT '',
        password_set_at INTEGER,
        -- Защита от перебора: после серии неудач вход закрывается на время.
        failed_count    INTEGER NOT NULL DEFAULT 0,
        locked_until    INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO admin_account (id) VALUES (1);

      -- Сессии. Хранится sha256 от токена, а не сам токен: копия базы
      -- на ноутбуке не должна быть живым ключом от админки.
      CREATE TABLE admin_session (
        token_hash   TEXT PRIMARY KEY,
        created_at   INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at   INTEGER NOT NULL
      );
      CREATE INDEX admin_session_expiry ON admin_session (expires_at);
    `,
  },
];
