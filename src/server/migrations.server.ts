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

  {
    version: 5,
    name: "Факт согласия на обработку данных",
    up: `
      -- Согласие посетителя — рядом с заявкой, а не отдельной таблицей:
      -- у него нет своей жизни, оно читается и удаляется вместе с ней.
      --
      -- consent_at NULL — заявка принята до появления чекбокса. Таких
      -- быть не должно (сайт ещё не публиковался), но колонка честно
      -- допускает это состояние, а не подделывает дату задним числом.
      --
      -- consent_version — дата редакции текста согласия, на которую
      -- человек соглашался. Текст со временем меняется, и «согласился
      -- на что-то» без указания на что — это не подтверждение согласия.
      ALTER TABLE lead ADD COLUMN consent_at      INTEGER;
      ALTER TABLE lead ADD COLUMN consent_version TEXT NOT NULL DEFAULT '';
    `,
  },

  {
    version: 6,
    name: "Очередь входящих Telegram обновлений",
    up: `
      -- Транспортный слой принимает обновление и сохраняет его до обработки.
      -- Это не история диалога: нормализованные контакты и сообщения появятся
      -- в следующих миграциях после утверждения сценариев бота.
      --
      -- update_id уникален у Telegram и защищает от повторной доставки.
      -- JSON хранится временно в очереди, чтобы входящее сообщение не
      -- потерялось между webhook и будущим обработчиком.
      CREATE TABLE telegram_update (
        update_id    INTEGER PRIMARY KEY,
        payload      TEXT NOT NULL CHECK (json_valid(payload)),
        received_at  INTEGER NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','processed','failed')),
        attempts     INTEGER NOT NULL DEFAULT 0,
        last_error   TEXT NOT NULL DEFAULT '',
        processed_at INTEGER
      );
      CREATE INDEX telegram_update_queue
        ON telegram_update (status, received_at);
    `,
  },

  {
    version: 7,
    name: "Telegram-клиенты, диалоги, сообщения и outbox",
    up: `
      -- В старой транспортной очереди не было окружения. Такие записи
      -- помечаются legacy и не могут попасть в новый обработчик адресатов.
      ALTER TABLE telegram_update ADD COLUMN environment TEXT NOT NULL DEFAULT 'legacy'
        CHECK (environment IN ('development','staging','production','test','legacy'));
      DROP INDEX telegram_update_queue;
      CREATE INDEX telegram_update_queue
        ON telegram_update (environment, status, received_at);

      -- Telegram-пользователь. Одинаковый numeric ID в разных окружениях
      -- намеренно может быть отдельной записью: базы и очереди изолированы.
      CREATE TABLE telegram_contact (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        telegram_user_id         TEXT NOT NULL,
        username                 TEXT NOT NULL DEFAULT '',
        display_name             TEXT NOT NULL DEFAULT '',
        verified_name            TEXT NOT NULL DEFAULT '',
        verified_contact         TEXT NOT NULL DEFAULT '',
        first_seen_at            INTEGER NOT NULL,
        last_seen_at             INTEGER NOT NULL,
        UNIQUE (environment, telegram_user_id)
      );
      CREATE INDEX telegram_contact_activity
        ON telegram_contact (environment, last_seen_at DESC);

      -- Отдельное обращение клиента. Один контакт может иметь несколько
      -- независимых conversations и заявок.
      CREATE TABLE telegram_conversation (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        telegram_contact_id      INTEGER NOT NULL
                                  REFERENCES telegram_contact(id) ON DELETE CASCADE,
        lead_id                  INTEGER REFERENCES lead(id) ON DELETE SET NULL,
        client_chat_id           TEXT NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','waiting_operator','waiting_client','closed')),
        is_test                  INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0,1)),
        unread_count              INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
        last_message_at          INTEGER NOT NULL,
        last_incoming_at         INTEGER,
        last_read_message_id     INTEGER,
        created_at                INTEGER NOT NULL,
        updated_at                INTEGER NOT NULL
      );
      CREATE INDEX telegram_conversation_contact
        ON telegram_conversation (environment, telegram_contact_id, updated_at DESC);
      CREATE INDEX telegram_conversation_feed
        ON telegram_conversation (environment, status, last_message_at DESC);
      CREATE INDEX telegram_conversation_unread
        ON telegram_conversation (environment, unread_count DESC, last_message_at DESC)
        WHERE unread_count > 0;

      -- Каноническая связь одной заявки сайта с одним Telegram-обращением.
      CREATE TABLE lead_telegram (
        lead_id                  INTEGER PRIMARY KEY REFERENCES lead(id) ON DELETE CASCADE,
        conversation_id          INTEGER NOT NULL
                                  REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        created_at                INTEGER NOT NULL,
        UNIQUE (conversation_id)
      );
      CREATE INDEX lead_telegram_conversation
        ON lead_telegram (environment, conversation_id);

      -- Нормализованная история. Telegram IDs хранятся текстом, чтобы не
      -- зависеть от точности Number в JavaScript; уникальные ключи защищают
      -- повторную доставку одного сообщения и update.
      CREATE TABLE telegram_message (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        conversation_id          INTEGER NOT NULL
                                  REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        direction                TEXT NOT NULL
                                  CHECK (direction IN ('client','operator','system')),
        message_type             TEXT NOT NULL
                                  CHECK (message_type IN ('text','file','photo','voice','internal_note','status_event')),
        sender_telegram_user_id  TEXT,
        chat_id                  TEXT NOT NULL,
        telegram_message_id      INTEGER,
        update_id                INTEGER,
        text                     TEXT NOT NULL DEFAULT '',
        metadata                 TEXT NOT NULL DEFAULT '{}'
                                  CHECK (json_valid(metadata)),
        delivery_status          TEXT NOT NULL DEFAULT 'not_applicable'
                                  CHECK (delivery_status IN ('not_applicable','pending','sent','delivered','failed','unknown')),
        delivered_at             INTEGER,
        read_at                  INTEGER,
        created_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL,
        UNIQUE (environment, chat_id, telegram_message_id),
        UNIQUE (environment, update_id)
      );
      CREATE INDEX telegram_message_conversation
        ON telegram_message (environment, conversation_id, created_at DESC, id DESC);
      CREATE INDEX telegram_message_unread
        ON telegram_message (environment, conversation_id, created_at ASC)
        WHERE direction = 'client' AND read_at IS NULL;
      CREATE INDEX telegram_message_update
        ON telegram_message (environment, update_id);

      -- Файл хранит только безопасные Telegram metadata и путь внутри
      -- DATA_DIR. Сам бинарник не попадает в клиентский бандл; срок действия
      -- записи нужен, чтобы последующая очистка удаляла и metadata, и файл.
      CREATE TABLE telegram_file (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        message_id               INTEGER NOT NULL
                                  REFERENCES telegram_message(id) ON DELETE CASCADE,
        telegram_file_id         TEXT NOT NULL,
        stored_path              TEXT NOT NULL DEFAULT '',
        mime                     TEXT NOT NULL DEFAULT '',
        bytes                    INTEGER CHECK (bytes IS NULL OR bytes >= 0),
        created_at               INTEGER NOT NULL,
        expires_at               INTEGER,
        UNIQUE (environment, telegram_file_id)
      );
      CREATE INDEX telegram_file_retention
        ON telegram_file (environment, expires_at, created_at);

      -- Служебный журнал без токенов и полного сырого payload.
      CREATE TABLE telegram_event (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        conversation_id          INTEGER
                                  REFERENCES telegram_conversation(id) ON DELETE SET NULL,
        event_type               TEXT NOT NULL,
        actor_telegram_user_id   TEXT,
        payload                  TEXT NOT NULL DEFAULT '{}'
                                  CHECK (json_valid(payload)),
        created_at               INTEGER NOT NULL,
        expires_at               INTEGER
      );
      CREATE INDEX telegram_event_retention
        ON telegram_event (environment, expires_at, created_at);
      CREATE INDEX telegram_event_conversation
        ON telegram_event (environment, conversation_id, created_at DESC);

      -- Outbox хранит адресата в момент подтверждения. Он не вычисляется
      -- заново из выбранного диалога, поэтому переключение меню не меняет
      -- уже подтверждённого получателя.
      CREATE TABLE telegram_outbox (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        conversation_id          INTEGER NOT NULL
                                  REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        message_id               INTEGER
                                  REFERENCES telegram_message(id) ON DELETE SET NULL,
        recipient_chat_id        TEXT NOT NULL,
        recipient_telegram_user_id TEXT,
        payload                  TEXT NOT NULL CHECK (json_valid(payload)),
        idempotency_key          TEXT NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','processing','sent','failed','unknown','cancelled')),
        attempts                 INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at          INTEGER NOT NULL,
        last_error               TEXT NOT NULL DEFAULT '',
        created_at               INTEGER NOT NULL,
        sent_at                  INTEGER,
        expires_at               INTEGER,
        UNIQUE (environment, idempotency_key)
      );
      CREATE INDEX telegram_outbox_queue
        ON telegram_outbox (environment, status, next_attempt_at, id);
      CREATE INDEX telegram_outbox_conversation
        ON telegram_outbox (environment, conversation_id, created_at DESC);

      -- Состояние оператора сохраняется отдельно для каждого чата и окружения.
      CREATE TABLE telegram_operator_session (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        operator_telegram_user_id TEXT NOT NULL,
        operator_chat_id         TEXT NOT NULL,
        selected_conversation_id INTEGER
                                  REFERENCES telegram_conversation(id) ON DELETE SET NULL,
        mode                     TEXT NOT NULL DEFAULT 'menu'
                                  CHECK (mode IN ('menu','reply_draft','internal_note')),
        draft_text               TEXT NOT NULL DEFAULT '',
        draft_recipient_chat_id  TEXT,
        draft_recipient_user_id  TEXT,
        draft_version             INTEGER NOT NULL DEFAULT 0 CHECK (draft_version >= 0),
        draft_expires_at         INTEGER,
        last_read_message_id     INTEGER,
        created_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL,
        UNIQUE (environment, operator_telegram_user_id, operator_chat_id)
      );
      CREATE INDEX telegram_operator_session_expiry
        ON telegram_operator_session (environment, draft_expires_at);

      -- Одноразовые callback/action keys. В ключе и строке есть всё, что
      -- нужно для проверки автора, чата, окружения, диалога и версии черновика.
      CREATE TABLE telegram_operator_action (
        action_key               TEXT PRIMARY KEY,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        operator_telegram_user_id TEXT NOT NULL,
        operator_chat_id         TEXT NOT NULL,
        conversation_id          INTEGER NOT NULL
                                  REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        action_type              TEXT NOT NULL,
        recipient_chat_id        TEXT NOT NULL,
        recipient_telegram_user_id TEXT,
        draft_version             INTEGER NOT NULL CHECK (draft_version >= 0),
        payload                  TEXT NOT NULL DEFAULT '{}'
                                  CHECK (json_valid(payload)),
        created_at               INTEGER NOT NULL,
        expires_at               INTEGER NOT NULL,
        consumed_at              INTEGER
      );
      CREATE INDEX telegram_operator_action_expiry
        ON telegram_operator_action (environment, expires_at, consumed_at);
      CREATE INDEX telegram_operator_action_owner
        ON telegram_operator_action (environment, operator_telegram_user_id, operator_chat_id, created_at DESC);
    `,
  },
  {
    version: 8,
    name: "Нормализованный Telegram inbox и привязка callback к update",
    up: `
      -- Сырой payload живёт недолго. Inbox остаётся независимым от его
      -- очистки, пока бизнес-обработчик этапа 5 не разберёт сообщение.
      CREATE TABLE telegram_inbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment TEXT NOT NULL CHECK (environment IN ('development','staging','production','test')),
        update_id INTEGER NOT NULL UNIQUE,
        sender_telegram_user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        actor_role TEXT NOT NULL CHECK (actor_role IN ('client','operator')),
        kind TEXT NOT NULL CHECK (kind IN ('text','photo','file','voice','callback')),
        payload TEXT NOT NULL CHECK (json_valid(payload)),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed')),
        created_at INTEGER NOT NULL,
        processed_at INTEGER
      );
      CREATE INDEX telegram_inbox_queue ON telegram_inbox (environment, status, id);
      CREATE INDEX telegram_inbox_sender ON telegram_inbox (environment, sender_telegram_user_id, id);

      -- Приём кнопки резервирует её за одним update, а выполнение и
      -- consumed_at относятся к бизнес-транзакции этапа 5.
      ALTER TABLE telegram_operator_action ADD COLUMN queued_update_id INTEGER;
      CREATE TABLE telegram_client_action (
        action_key TEXT PRIMARY KEY,
        environment TEXT NOT NULL CHECK (environment IN ('development','staging','production','test')),
        telegram_user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        conversation_id INTEGER REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL CHECK (action_type IN ('menu','request','status','select_conversation','cancel','help')),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        queued_update_id INTEGER,
        consumed_at INTEGER
      );
      CREATE INDEX telegram_client_action_expiry ON telegram_client_action (expires_at);
    `,
  },
  {
    version: 9,
    name: "Надёжная доставка Telegram и состояние транспорта",
    up: `
      -- Обработка outbox может быть прервана между claim и ответом API.
      -- locked_at позволяет безопасно вернуть такую запись в очередь.
      ALTER TABLE telegram_outbox ADD COLUMN locked_at INTEGER;
      ALTER TABLE telegram_outbox ADD COLUMN last_attempt_at INTEGER;
      CREATE INDEX telegram_outbox_lock
        ON telegram_outbox (environment, status, locked_at);

      -- Только служебные метки. Здесь нет токена, chat_id, текста сообщения
      -- или пользовательских данных, поэтому health endpoint не раскрывает их.
      CREATE TABLE telegram_transport_state (
        environment              TEXT PRIMARY KEY
                                  CHECK (environment IN ('development','staging','production','test')),
        webhook_last_received_at INTEGER,
        outbox_last_attempt_at   INTEGER,
        outbox_last_success_at   INTEGER,
        outbox_last_failure_at   INTEGER,
        outbox_last_status       TEXT
                                  CHECK (outbox_last_status IS NULL OR outbox_last_status IN ('sent','failed','unknown')),
        outbox_last_error_code   TEXT,
        updated_at               INTEGER NOT NULL
      );
    `,
  },
  {
    version: 10,
    name: "Клиентское меню Telegram, сессии и ответы до создания задачи",
    up: `
      CREATE TABLE telegram_client_session (
        environment TEXT NOT NULL CHECK (environment IN ('development','staging','production','test')),
        telegram_user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        selected_conversation_id INTEGER REFERENCES telegram_conversation(id) ON DELETE SET NULL,
        mode TEXT NOT NULL DEFAULT 'menu' CHECK (mode IN ('menu','new_task','conversation')),
        version INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (environment, telegram_user_id, chat_id)
      );
      CREATE INDEX telegram_client_session_expiry ON telegram_client_session (updated_at);
      ALTER TABLE telegram_client_action ADD COLUMN session_version INTEGER;
      ALTER TABLE telegram_client_action ADD COLUMN payload TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload));
      ALTER TABLE telegram_conversation ADD COLUMN title TEXT NOT NULL DEFAULT '';

      -- /start должен отвечать без фиктивной задачи или заявки. Сохраняем
      -- прежнюю очередь и её IDs, разрешая NULL conversation только для меню.
      CREATE TABLE telegram_outbox_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment TEXT NOT NULL CHECK (environment IN ('development','staging','production','test')),
        conversation_id INTEGER REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        message_id INTEGER REFERENCES telegram_message(id) ON DELETE SET NULL,
        recipient_chat_id TEXT NOT NULL,
        recipient_telegram_user_id TEXT,
        payload TEXT NOT NULL CHECK (json_valid(payload)),
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','unknown','cancelled')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at INTEGER NOT NULL,
        last_error TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        sent_at INTEGER,
        expires_at INTEGER,
        locked_at INTEGER,
        last_attempt_at INTEGER,
        UNIQUE (environment, idempotency_key)
      );
      INSERT INTO telegram_outbox_next SELECT * FROM telegram_outbox;
      DROP TABLE telegram_outbox;
      ALTER TABLE telegram_outbox_next RENAME TO telegram_outbox;
      CREATE INDEX telegram_outbox_queue ON telegram_outbox (environment, status, next_attempt_at, id);
      CREATE INDEX telegram_outbox_conversation ON telegram_outbox (environment, conversation_id, created_at DESC);
      CREATE INDEX telegram_outbox_lock ON telegram_outbox (environment, status, locked_at);
    `,
  },
  {
    version: 11,
    name: "Глобальные действия закрытого меню оператора",
    up: `
      -- Кнопки верхнего меню не обязаны быть привязаны к выбранному диалогу.
      -- Адрес оператора сохраняется в recipient_chat_id только для аудита;
      -- действия всё равно проходят серверную проверку владельца и сессии.
      CREATE TABLE telegram_operator_action_next (
        action_key               TEXT PRIMARY KEY,
        environment              TEXT NOT NULL
                                  CHECK (environment IN ('development','staging','production','test')),
        operator_telegram_user_id TEXT NOT NULL,
        operator_chat_id         TEXT NOT NULL,
        conversation_id          INTEGER
                                  REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        action_type              TEXT NOT NULL,
        recipient_chat_id        TEXT NOT NULL,
        recipient_telegram_user_id TEXT,
        draft_version             INTEGER NOT NULL CHECK (draft_version >= 0),
        payload                  TEXT NOT NULL DEFAULT '{}'
                                  CHECK (json_valid(payload)),
        created_at               INTEGER NOT NULL,
        expires_at               INTEGER NOT NULL,
        consumed_at              INTEGER,
        queued_update_id         INTEGER
      );
      INSERT INTO telegram_operator_action_next
        (action_key, environment, operator_telegram_user_id, operator_chat_id,
         conversation_id, action_type, recipient_chat_id, recipient_telegram_user_id,
         draft_version, payload, created_at, expires_at, consumed_at, queued_update_id)
      SELECT action_key, environment, operator_telegram_user_id, operator_chat_id,
         conversation_id, action_type, recipient_chat_id, recipient_telegram_user_id,
         draft_version, payload, created_at, expires_at, consumed_at, queued_update_id
      FROM telegram_operator_action;
      DROP TABLE telegram_operator_action;
      ALTER TABLE telegram_operator_action_next RENAME TO telegram_operator_action;
      CREATE INDEX telegram_operator_action_expiry
        ON telegram_operator_action (environment, expires_at, consumed_at);
      CREATE INDEX telegram_operator_action_owner
        ON telegram_operator_action (environment, operator_telegram_user_id, operator_chat_id, created_at DESC);
      CREATE INDEX telegram_operator_action_conversation
        ON telegram_operator_action (environment, conversation_id, created_at DESC);
    `,
  },
  {
    version: 12,
    name: "Черновик клиентской заявки и идемпотентное подтверждение Telegram",
    up: `
      -- До явного согласия в базе нет lead. Черновик живёт в сессии клиента
      -- и очищается по сроку хранения или командой /cancel.
      ALTER TABLE telegram_client_session ADD COLUMN draft_payload TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(draft_payload));
      ALTER TABLE telegram_client_session ADD COLUMN draft_expires_at INTEGER;
      CREATE INDEX telegram_client_session_draft_expiry
        ON telegram_client_session (environment, draft_expires_at);

      -- Повтор того же подтверждения возвращает прежний lead, даже если
      -- обработчик был перезапущен между записью lead и ответом Telegram.
      CREATE TABLE telegram_lead_operation (
        operation_key  TEXT PRIMARY KEY,
        environment    TEXT NOT NULL
                       CHECK (environment IN ('development','staging','production','test')),
        telegram_user_id TEXT NOT NULL,
        chat_id        TEXT NOT NULL,
        lead_id        INTEGER NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
        conversation_id INTEGER NOT NULL REFERENCES telegram_conversation(id) ON DELETE CASCADE,
        created_at     INTEGER NOT NULL,
        UNIQUE (environment, conversation_id)
      );
      CREATE INDEX telegram_lead_operation_owner
        ON telegram_lead_operation (environment, telegram_user_id, chat_id, created_at DESC);
    `,
  },
  {
    version: 13,
    name: "Единые источники заявок и детали атрибуции",
    up: `
      -- Канал хранится отдельно от UTM/referrer: заявки сайта и Telegram
      -- проходят через одну модель, а детали перехода не ломают фильтрацию.
      ALTER TABLE lead ADD COLUMN source_detail TEXT NOT NULL DEFAULT '';

      -- Старые пустые и произвольные строки считаются заявками с сайта;
      -- исходная строка сохраняется в source_detail для аудита.
      UPDATE lead
      SET source_detail = CASE
            WHEN source IN ('website','telegram_bot','telegram_miniapp','telegram_deeplink')
              THEN source_detail
            ELSE substr(source, 1, 500)
          END,
          source = CASE
            WHEN source IN ('website','telegram_bot','telegram_miniapp','telegram_deeplink')
              THEN source
            ELSE 'website'
          END;

      CREATE INDEX lead_source ON lead (source, created_at DESC);

      -- SQLite не позволяет добавить CHECK к существующей таблице без
      -- пересборки всех внешних связей, поэтому каноничность защищается
      -- триггерами на границе записи.
      CREATE TRIGGER lead_source_canonical_insert
      BEFORE INSERT ON lead
      WHEN NEW.source NOT IN ('website','telegram_bot','telegram_miniapp','telegram_deeplink')
      BEGIN
        SELECT RAISE(ABORT, 'invalid_lead_source');
      END;

      CREATE TRIGGER lead_source_canonical_update
      BEFORE UPDATE OF source ON lead
      WHEN NEW.source NOT IN ('website','telegram_bot','telegram_miniapp','telegram_deeplink')
      BEGIN
        SELECT RAISE(ABORT, 'invalid_lead_source');
      END;
    `,
  },
  {
    version: 14,
    name: "Идемпотентность заявок сайта",
    up: `
      -- Один повтор запроса с тем же ключом не должен создавать вторую
      -- заявку после двойного клика, таймаута сети или повторной отправки.
      -- Пустое значение оставляем допустимым для старых и внутренних
      -- записей; публичный endpoint принимает только непустой валидный ключ.
      ALTER TABLE lead ADD COLUMN idempotency_key TEXT NOT NULL DEFAULT '';
      CREATE UNIQUE INDEX lead_idempotency_key_unique
        ON lead (idempotency_key)
        WHERE idempotency_key <> '';
    `,
  },
  {
    version: 15,
    name: "Связь уведомления outbox с заявкой",
    up: `
      -- Outbox теперь может завершить доставку именно той заявки, для
      -- которой создано уведомление. Старые строки остаются независимыми.
      ALTER TABLE telegram_outbox ADD COLUMN lead_id INTEGER REFERENCES lead(id) ON DELETE SET NULL;
      CREATE INDEX telegram_outbox_lead ON telegram_outbox (lead_id, created_at DESC);
    `,
  },
  {
    version: 16,
    name: "Одноразовые ссылки сайта на Telegram",
    up: `
      -- Непредсказуемый токен связывает уже принятую заявку сайта с тем
      -- private Telegram-профилем, который открыл ссылку. Ссылка живёт
      -- ограниченное время и после использования не принимается повторно.
      CREATE TABLE telegram_lead_link (
        token               TEXT PRIMARY KEY,
        environment         TEXT NOT NULL
                            CHECK (environment IN ('development','staging','production','test')),
        lead_id             INTEGER NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
        created_at          INTEGER NOT NULL,
        expires_at          INTEGER NOT NULL,
        consumed_at         INTEGER,
        telegram_user_id    TEXT,
        telegram_chat_id    TEXT,
        conversation_id     INTEGER REFERENCES telegram_conversation(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX telegram_lead_link_active_lead
        ON telegram_lead_link (lead_id)
        WHERE consumed_at IS NULL;
      CREATE INDEX telegram_lead_link_expiry
        ON telegram_lead_link (expires_at, consumed_at);
    `,
  },
  {
    version: 17,
    name: "Клиентские сессии Telegram Mini App",
    up: `
      CREATE TABLE telegram_miniapp_session (
        token_hash          TEXT PRIMARY KEY,
        environment         TEXT NOT NULL
                            CHECK (environment IN ('production','test')),
        telegram_contact_id INTEGER NOT NULL REFERENCES telegram_contact(id) ON DELETE CASCADE,
        launch_hash         TEXT NOT NULL,
        auth_date           INTEGER NOT NULL,
        created_at          INTEGER NOT NULL,
        expires_at          INTEGER NOT NULL,
        revoked_at          INTEGER,
        UNIQUE (environment, launch_hash)
      );
      CREATE INDEX telegram_miniapp_session_expiry ON telegram_miniapp_session (expires_at);
      CREATE INDEX telegram_miniapp_session_contact
        ON telegram_miniapp_session (environment, telegram_contact_id);
    `,
  },
];
