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

  {
    version: 3,
    name: "Услуги, пакеты, вопросы, цифры, контакты, тексты",
    up: `
      -- ── НАКЛАДКИ ─────────────────────────────────────────────────────────
      -- Устройство отличается от кейсов, и намеренно.
      --
      -- Кейсы создаёт владелец, заготовки в коде для них нет. А услуги — это
      -- страницы сайта: у каждой свой адрес, вёрстка и тексты. Их нельзя
      -- «добавить из админки», можно только поправить цену или срок.
      --
      -- Поэтому в коде остаётся СКЕЛЕТ (какие бывают услуги и пакеты,
      -- как считается «от 60 000 ₽»), а в базе — только то, что владелец
      -- реально изменил. Пустая строка в накладке означает «взять из кода».
      --
      -- Отсюда главное свойство: пустая или потерянная база НЕ роняет сайт.
      -- Он отрисуется значениями из кода, как до всей этой затеи.

      CREATE TABLE service_override (
        id           TEXT PRIMARY KEY,
        price_value  INTEGER,
        timeline     TEXT,
        short        TEXT,
        description  TEXT,
        updated_at   INTEGER NOT NULL
      );

      CREATE TABLE package_override (
        id          TEXT PRIMARY KEY,
        price_value INTEGER,
        who         TEXT,
        term        TEXT,
        result      TEXT,
        not_for     TEXT,
        points      TEXT CHECK (points IS NULL OR json_valid(points)),
        updated_at  INTEGER NOT NULL
      );

      -- ── ВОПРОСЫ ──────────────────────────────────────────────────────────
      -- Здесь полноценный CRUD: вопросы добавляют и убирают по ходу дела,
      -- скелета в коде им не нужно.
      CREATE TABLE faq_item (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        question   TEXT    NOT NULL,
        answer     TEXT    NOT NULL,
        -- Показывать в кратком блоке на главной.
        preview    INTEGER NOT NULL DEFAULT 0 CHECK (preview IN (0,1)),
        position   INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX faq_order ON faq_item (position);

      -- ── ПЛИТКИ С ЦИФРАМИ ─────────────────────────────────────────────────
      -- Количество менять нельзя, только значения: вёрстка рассчитана ровно
      -- на четыре плитки в блоке главной (у последней оставлено место под
      -- маскота) и три на странице работ. Пятая сломала бы раскладку.
      CREATE TABLE metric_tile (
        id         TEXT PRIMARY KEY,
        -- 'home' — блок на главной, 'works' — плитки над списком работ.
        area       TEXT    NOT NULL CHECK (area IN ('home','works')),
        value      TEXT    NOT NULL DEFAULT '',
        label      TEXT    NOT NULL DEFAULT '',
        position   INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX metric_order ON metric_tile (area, position);

      -- ── КОНТАКТЫ ─────────────────────────────────────────────────────────
      -- Пустое значение = канала нет нигде: ни на странице контактов,
      -- ни в подвале, ни в микроразметке. Правило то же, что было в коде.
      CREATE TABLE contact_channel (
        id         TEXT PRIMARY KEY CHECK (id IN ('telegram','phone','email')),
        value      TEXT    NOT NULL DEFAULT '',
        position   INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      -- ── ТЕКСТЫ ───────────────────────────────────────────────────────────
      -- Переопределения строк по ключу. В коде у каждой строки остаётся
      -- значение по умолчанию; сюда попадает только то, что владелец изменил.
      -- Так новый ключ не требует миграции, а забытый в базе — не ломает
      -- страницу: её текст просто берётся из кода.
      CREATE TABLE text_override (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },

  {
    version: 4,
    name: "Страницы услуг, мета-теги, тарифы поддержки",
    up: `
      -- ── СОДЕРЖИМОЕ СТРАНИЦ УСЛУГ ─────────────────────────────────────────
      -- Первый экран, «кому подходит», «что получите» и шаги работы. Раньше
      -- этот текст лежал литералами в семи файлах роутов: самый продающий
      -- текст сайта правился только через разработчика.
      --
      -- Колонки добавляются к существующей накладке услуги, а не отдельной
      -- таблицей: ключ тот же (идентификатор услуги), читается и пишется
      -- всегда целиком, и лишний join ради этого не нужен.
      --
      -- Списки — строками JSON. Отдельные таблицы под пункты дали бы три
      -- джойна и колонку порядка ради данных, которые всегда читаются
      -- и переписываются целиком. Проверка json_valid здесь не ставится:
      -- ALTER TABLE ADD COLUMN не даёт добавить её задним числом одинаково
      -- на всех версиях SQLite, а разбор всё равно защищён try/catch —
      -- битое значение означает «взять из кода», а не упавшую страницу.
      ALTER TABLE service_override ADD COLUMN eyebrow    TEXT;
      ALTER TABLE service_override ADD COLUMN hero_title TEXT;
      ALTER TABLE service_override ADD COLUMN hero_lead  TEXT;
      ALTER TABLE service_override ADD COLUMN best_for   TEXT;
      ALTER TABLE service_override ADD COLUMN features   TEXT;
      ALTER TABLE service_override ADD COLUMN steps      TEXT;

      -- ── МЕТА-ТЕГИ ────────────────────────────────────────────────────────
      -- Заголовок и описание страницы для поисковой выдачи. Ключ — путь
      -- страницы: он же стоит в canonical и в карте сайта, другого
      -- устойчивого идентификатора у страницы нет.
      --
      -- Строка на несуществующий путь безвредна: снимок собирается по списку
      -- страниц из кода, лишняя запись просто не читается.
      CREATE TABLE seo_override (
        path               TEXT PRIMARY KEY,
        title              TEXT,
        description        TEXT,
        social_title       TEXT,
        social_description TEXT,
        updated_at         INTEGER NOT NULL
      );

      -- ── ТАРИФЫ СОПРОВОЖДЕНИЯ ─────────────────────────────────────────────
      -- Три тарифа на странице поддержки. Накладка, как у услуг: состав
      -- задан кодом, здесь только изменённые значения.
      --
      -- Цена — числом, потому что строка собирается форматтером с
      -- неразрывными пробелами: «35 000 ₽/мес» иначе рвётся по строкам
      -- в узкой колонке. price_text — для нечисловых случаев вроде
      -- «по запросу».
      CREATE TABLE support_plan_override (
        id          TEXT PRIMARY KEY,
        name        TEXT,
        price_value INTEGER,
        price_text  TEXT,
        features    TEXT,
        updated_at  INTEGER NOT NULL
      );
    `,
  },
];
