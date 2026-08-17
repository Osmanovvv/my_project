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

  {
    version: 2,
    name: "Кейсы и картинки",
    up: `
      -- Загруженные файлы. Сами файлы лежат в DATA_DIR/media, здесь — описание.
      -- Таблица заводится сейчас, хотя загрузка появится позже: добавить
      -- внешний ключ в уже существующую таблицу SQLite умеет только через
      -- пересоздание, и делать это на живых данных не хочется.
      CREATE TABLE media (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        hash        TEXT    NOT NULL,
        ext         TEXT    NOT NULL,
        mime        TEXT    NOT NULL,
        width       INTEGER NOT NULL CHECK (width  > 0),
        height      INTEGER NOT NULL CHECK (height > 0),
        bytes       INTEGER NOT NULL,
        alt         TEXT    NOT NULL DEFAULT '',
        source_name TEXT    NOT NULL DEFAULT '',
        created_at  INTEGER NOT NULL,
        -- Повторная загрузка того же файла не плодит копии на диске.
        UNIQUE (hash, ext)
      );

      -- Кейсы. Единственный раздел контента, где записи создаёт владелец:
      -- заготовки в коде для них быть не может, поэтому здесь полноценный CRUD.
      --
      -- Списки (теги, что болело, что предложили) хранятся строками JSON.
      -- Отдельные таблицы под них дали бы пять джойнов и порядок сортировки
      -- ради данных, которые всегда читаются и пишутся целиком.
      CREATE TABLE case_study (
        slug        TEXT PRIMARY KEY,
        title       TEXT    NOT NULL,
        client      TEXT    NOT NULL DEFAULT '',
        industry    TEXT    NOT NULL DEFAULT '',
        result      TEXT    NOT NULL DEFAULT '',
        summary     TEXT    NOT NULL DEFAULT '',
        timeline    TEXT    NOT NULL DEFAULT '',
        -- КЛЮЧ пресета, не классы Tailwind: классы из базы сборщик не увидит
        -- и правил под них не создаст — обложки станут прозрачными.
        -- См. src/data/case-presets.ts.
        gradient    TEXT    NOT NULL DEFAULT 'indigo',
        pattern     TEXT    NOT NULL DEFAULT 'grid',
        cover_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
        tags        TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
        challenge   TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(challenge)),
        solution    TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(solution)),
        delivered   TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(delivered)),
        stack       TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(stack)),
        services    TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(services)),
        -- Черновик виден только в админке. Так кейс можно дописывать
        -- несколько вечеров, не показывая посетителям половину текста.
        published   INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
        -- Порядок в сетке. Дробный шаг не нужен: записей единицы,
        -- перестановка переписывает позиции целиком.
        position    INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX case_order ON case_study (published, position, created_at);
    `,
  },
];
