/**
 * Тексты сайта, которые правятся из админки.
 *
 * Устройство — накладка: здесь лежит значение ПО УМОЛЧАНИЮ, в базе только
 * то, что владелец действительно изменил. Отсюда три следствия:
 *
 *   1. Пустая база не ломает сайт — он отрисуется этими значениями.
 *   2. Новый ключ не требует миграции: добавили строку сюда, и всё.
 *   3. Кнопка «вернуть как было» — это просто удаление строки из базы.
 *
 * ЭТО КАТАЛОГ СТРОК, А НЕ ПОРЯДОК ИХ ПОКАЗА. Как строки собираются в куски
 * страницы — первый экран, блок заявки, карточки ниш — описано отдельно,
 * в `data/sections.ts`. Разделение появилось по замечанию владельца: править
 * он хочет «первый экран целиком», вместе со снимками в рамках, а не список
 * текстов, отсортированный по тому, где они живут в коде.
 *
 * Чего здесь НЕТ — и намеренно:
 *   - навигация: меняется раз в жизни, зато ломает вёрстку длинной строкой
 *     быстрее всего;
 *   - подписи полей формы («Имя», «Telegram или телефон») — они завязаны
 *     на проверку ввода и сообщения об ошибках;
 *   - тексты страниц услуг: у них своя структура со списками и иконками,
 *     они живут в `data/service-pages.ts` и правятся отдельным разделом;
 *   - мета-теги: они в `data/seo-pages.ts`, у них свой раздел с подсказками
 *     по длине сниппета.
 *
 * ВЫДЕЛЕНИЕ ЦВЕТОМ. В заголовках часть слов покрашена акцентом. Хранить
 * там HTML нельзя — это дыра. Поэтому выделенный кусок берётся в звёздочки:
 * «Сайт, который *не теряет заявки*». Разбирает их `AccentText`.
 */

export type TextKey = keyof typeof TEXT_DEFAULTS;

export const TEXT_DEFAULTS = {
  // ── Главная: первый экран ──────────────────────────────────────────────
  "home.hero.eyebrow": "Сайт · Telegram-бот · Админка",
  "home.hero.title": "Сайт, который *не теряет заявки*",
  "home.hero.subtitle": "Единая система: сайт, бот в Telegram и админка работают вместе.",
  "home.hero.primaryCta": "Получить разбор",
  "home.hero.secondaryCta": "Как это работает",

  // ── Главная: макеты справа от заголовка ────────────────────────────────
  // Три рамки — окно браузера, телефон и чат бота — показывают конкретный
  // проект. Это самая ценная часть первого экрана и первое, что владелец
  // захочет поменять, когда сдаст следующего клиента: показывать «Кирпичные
  // дома» вечно нельзя.
  //
  // Время в репликах (12:04) остаётся в коде: это декорация, а не смысл.
  "home.hero.browser.url": "stroitelstvo-domov2.netlify.app",
  "home.hero.browser.title": "Кирпичные дома",
  "home.hero.browser.note": "Краснодар · сайт опубликован",
  "home.hero.browser.alt": "Сайт «Кирпичные дома», Краснодар — работа IT-Agent",

  "home.hero.phone.title": "Кирпичные дома",
  "home.hero.phone.note": "адаптив под телефон",
  "home.hero.phone.alt": "Мобильная версия сайта «Кирпичные дома»",

  "home.hero.chat.name": "IT-Agent",
  "home.hero.chat.badge": "Новая заявка",
  "home.hero.chat.msg1": "Здравствуйте! Какой метраж рассматриваете?",
  "home.hero.chat.msg2": "120 м², одноэтажный",
  "home.hero.chat.msg3": "Подобрал 4 проекта. Куда отправить смету?",
  "home.hero.chat.button1": "В Telegram",
  "home.hero.chat.button2": "На почту",

  // ── Главная: работы ────────────────────────────────────────────────────
  "home.works.eyebrow": "Работы",
  "home.works.title": "Что мы уже сделали",
  "home.works.note": "Каждый проект — сайт, бот и админка, собранные под конкретный поток заявок.",
  "home.works.cta": "Посмотреть все работы",

  // ── Главная: как работаем ──────────────────────────────────────────────
  "home.process.eyebrow": "Как работаем",
  "home.process.title": "Четыре шага без сюрпризов",
  "home.process.step1.title": "Разбор",
  "home.process.step1.text": "Созваниваемся, разбираем текущий поток заявок и что теряется.",
  "home.process.step2.title": "Прототип",
  "home.process.step2.text": "Показываем структуру сайта и как всё будет выглядеть в админке.",
  "home.process.step3.title": "Запуск",
  "home.process.step3.text": "Собираем сайт, бота и админку. Подключаем уведомления менеджеру.",
  "home.process.step4.title": "Развитие",
  "home.process.step4.text": "После запуска добавляем правила, интеграции, аналитику.",

  // ── Главная: пакеты ────────────────────────────────────────────────────
  "home.packages.eyebrow": "Пакеты и услуги",
  "home.packages.title": "С чего начать",
  "home.packages.note":
    "Пакет — это связка: сайт, бот и админка работают как одно целое. Отдельная услуга — одна её часть.",

  // ── Главная: цифры ─────────────────────────────────────────────────────
  "home.metrics.eyebrow": "Цифры",
  "home.metrics.title": "Что меняется после запуска",

  // ── Главная: блок вопросов ─────────────────────────────────────────────
  "home.faq.eyebrow": "Вопросы",
  "home.faq.title": "Отвечаем заранее",
  "home.faq.note": "Самое частое. Если вашего вопроса нет — напишите, добавим.",

  // ── Кнопки, повторяющиеся по всему сайту ───────────────────────────────
  // Одна строка на СМЫСЛ, а не на место в коде: «Получить разбор» стояла
  // в четырёх файлах, и правка по отдельности рано или поздно дала бы сайт,
  // где в шапке одно, а на странице услуги другое.
  "cta.primary": "Получить разбор",
  "cta.works": "Смотреть работы",
  "cta.package": "Обсудить пакет",
  "cta.discuss": "Обсудить",

  // ── Блок-призыв внизу страниц услуг ────────────────────────────────────
  "service.cta.title": "Обсудим ваш проект?",
  "service.cta.lead":
    "Расскажите задачу — вернёмся с идеями, примерами и точной оценкой в течение дня.",

  // ── Подвал ─────────────────────────────────────────────────────────────
  "footer.tagline": "IT-Agent всегда на связи — сайт, бот и админка в одной системе.",

  // ── Блок заявки (на каждой странице) ───────────────────────────────────
  "contact.eyebrow": "Первый шаг",
  "contact.title": "Получить разбор системы заявок",
  "contact.lead":
    "Оставьте контакт — вернёмся с коротким разбором вашей ситуации. Никакого длинного ТЗ на старте не нужно.",
  "contact.point1": "Ответим в Telegram или по телефону",
  "contact.point2": "Разберём задачу — без ТЗ и обязательств",
  "contact.point3": "Предложим, с чего начать",
  "contact.taskPlaceholder": "Например: интернет-магазин, много заявок теряется",
  "contact.submit": "Отправить заявку",
  "contact.success": "Заявка отправлена — свяжемся в течение рабочего дня.",
  "contact.consent": "Нажимая, вы соглашаетесь на обработку контактных данных.",

  // ── Шапки внутренних страниц ───────────────────────────────────────────
  "page.services.eyebrow": "Услуги",
  "page.services.title": "Три направления, *одна команда*",
  "page.services.lead":
    "Сайты, боты и MiniApp, поддержка и SEO — выбирайте одно направление или собирайте связку под задачу.",

  "page.packages.eyebrow": "Пакеты",
  "page.packages.title": "Выберите *с чего начать*",
  "page.packages.lead":
    "В каждом пакете сайт, бот и админка собраны в одну систему: заявка не теряется между ними. Отличаются объёмом, а не составом.",
  "page.packages.singleEyebrow": "Или по отдельности",
  "page.packages.singleTitle": "Можно заказать только то, что нужно",
  "page.packages.singleLead":
    "В пакете сайт, бот и админка связаны между собой, и админка отдельно не продаётся. Если нужна только одна часть — оценим и соберём её.",

  "page.works.eyebrow": "Работы",
  "page.works.title": "Проекты, которые *уже работают*",
  "page.works.lead": "Кейсы IT-Agent — от локальных мастерских до сетевых клиник и B2B-каталогов.",

  "page.faq.eyebrow": "Вопросы",
  "page.faq.title": "Короткие *ответы*",
  "page.faq.lead": "Если чего-то не хватает — напишите, ответим лично.",

  "page.contacts.eyebrow": "Контакты",
  "page.contacts.title": "Первый шаг — *короткий разговор*",
  "page.contacts.lead": "Оставьте заявку — ответим в течение рабочего дня.",

  "page.industries.eyebrow": "Для кого",
  "page.industries.title": "Шесть типичных *ситуаций*",
  "page.industries.lead": "Найдите свою — так проще понять, что именно мы будем делать.",

  // ── Карточки ниш на «Кому подходит» ────────────────────────────────────
  // Шесть ниш придуманы до первого клиента. Когда пойдёт реальный поток,
  // сюда переедут те слова, которыми клиенты сами описывают свою боль —
  // это самый сильный продающий текст, какой бывает, и появляется он
  // только после разговоров.
  //
  // Количество карточек не правится: шесть ровно ложится и в две колонки,
  // и в три, а пять или семь оставят дырку на десктопе.
  "industries.card1.name": "Сервисный бизнес",
  "industries.card1.tag": "ремонт · клининг · сервис",
  "industries.card1.problem": "Заявки теряются между звонками и мессенджерами.",
  "industries.card1.solution": "Сайт + Telegram-уведомления, менеджер видит всё в одном месте.",

  "industries.card2.name": "Локальная компания",
  "industries.card2.tag": "офлайн-точки · услуги района",
  "industries.card2.problem": "Клиенты пишут в 3 канала, забываем перезвонить.",
  "industries.card2.solution": "Единая админка со статусами и напоминаниями.",

  "industries.card3.name": "B2B-услуги",
  "industries.card3.tag": "агентства · подрядчики",
  "industries.card3.problem": "Долгий цикл сделки, теряется история клиента.",
  "industries.card3.solution": "История, комментарии и следующий шаг по каждой заявке.",

  "industries.card4.name": "Онлайн-сервис",
  "industries.card4.tag": "SaaS · онлайн-запись",
  "industries.card4.problem": "Нужно быстро обрабатывать входящие заявки.",
  "industries.card4.solution": "Форма → бот → админка со статусами. Всё автоматически.",

  "industries.card5.name": "Выездные услуги",
  "industries.card5.tag": "доставка · монтаж · выезд",
  "industries.card5.problem": "Менеджер в разъездах, отвечать неудобно.",
  "industries.card5.solution": "Заявки в Telegram — можно ответить с телефона за 30 секунд.",

  "industries.card6.name": "Стартап",
  "industries.card6.tag": "MVP · первые клиенты",
  "industries.card6.problem": "Нет времени и бюджета на большую CRM.",
  "industries.card6.solution": "Начинаем со «Старта» и растём по мере потока заявок.",

  "industries.band.title": "Не нашли свою нишу? Это не проблема.",
  "industries.band.text":
    "Мы работаем с любым бизнесом, где есть входящие заявки. Расскажите про свой поток — предложим схему.",
} as const;

/** Человеческие подписи полей в админке. */
export const TEXT_LABELS: Record<TextKey, string> = {
  "home.hero.eyebrow": "Плашка над заголовком",
  "home.hero.title": "Заголовок первого экрана",
  "home.hero.subtitle": "Подзаголовок",
  "home.hero.primaryCta": "Главная кнопка",
  "home.hero.secondaryCta": "Вторая кнопка",

  "home.hero.browser.url": "Адрес в строке браузера",
  "home.hero.browser.title": "Подпись на снимке",
  "home.hero.browser.note": "Вторая строка подписи",
  "home.hero.browser.alt": "Описание снимка для поиска",

  "home.hero.phone.title": "Подпись на снимке",
  "home.hero.phone.note": "Вторая строка подписи",
  "home.hero.phone.alt": "Описание снимка для поиска",

  "home.hero.chat.name": "Имя бота в чате",
  "home.hero.chat.badge": "Всплывающая плашка",
  "home.hero.chat.msg1": "Сообщение бота",
  "home.hero.chat.msg2": "Ответ клиента",
  "home.hero.chat.msg3": "Второе сообщение бота",
  "home.hero.chat.button1": "Кнопка в чате — левая",
  "home.hero.chat.button2": "Кнопка в чате — правая",

  "home.works.eyebrow": "Надзаголовок",
  "home.works.title": "Заголовок",
  "home.works.note": "Подпись справа",
  "home.works.cta": "Кнопка под работами",

  "home.process.eyebrow": "Надзаголовок",
  "home.process.title": "Заголовок",
  "home.process.step1.title": "Шаг 1 — название",
  "home.process.step1.text": "Шаг 1 — описание",
  "home.process.step2.title": "Шаг 2 — название",
  "home.process.step2.text": "Шаг 2 — описание",
  "home.process.step3.title": "Шаг 3 — название",
  "home.process.step3.text": "Шаг 3 — описание",
  "home.process.step4.title": "Шаг 4 — название",
  "home.process.step4.text": "Шаг 4 — описание",

  "home.packages.eyebrow": "Надзаголовок",
  "home.packages.title": "Заголовок",
  "home.packages.note": "Подпись под заголовком",

  "home.metrics.eyebrow": "Надзаголовок",
  "home.metrics.title": "Заголовок",

  "home.faq.eyebrow": "Надзаголовок",
  "home.faq.title": "Заголовок",
  "home.faq.note": "Подпись под заголовком",

  "cta.primary": "Главная кнопка сайта",
  "cta.works": "Кнопка «смотреть работы»",
  "cta.package": "Кнопка на карточке пакета",
  "cta.discuss": "Короткая кнопка «обсудить»",

  "service.cta.title": "Блок внизу услуги — заголовок",
  "service.cta.lead": "Блок внизу услуги — текст",

  "footer.tagline": "Строка о студии в подвале",

  "contact.eyebrow": "Надзаголовок",
  "contact.title": "Заголовок",
  "contact.lead": "Текст под заголовком",
  "contact.point1": "Пункт 1",
  "contact.point2": "Пункт 2",
  "contact.point3": "Пункт 3",
  "contact.taskPlaceholder": "Подсказка в поле «о задаче»",
  "contact.submit": "Надпись на кнопке",
  "contact.success": "Сообщение после отправки",
  "contact.consent": "Строка про обработку данных",

  "page.services.eyebrow": "Надзаголовок",
  "page.services.title": "Заголовок",
  "page.services.lead": "Текст под заголовком",

  "page.packages.eyebrow": "Надзаголовок",
  "page.packages.title": "Заголовок",
  "page.packages.lead": "Текст под заголовком",
  "page.packages.singleEyebrow": "Блок «по отдельности» — надзаголовок",
  "page.packages.singleTitle": "Блок «по отдельности» — заголовок",
  "page.packages.singleLead": "Блок «по отдельности» — текст",

  "page.works.eyebrow": "Надзаголовок",
  "page.works.title": "Заголовок",
  "page.works.lead": "Текст под заголовком",

  "page.faq.eyebrow": "Надзаголовок",
  "page.faq.title": "Заголовок",
  "page.faq.lead": "Текст под заголовком",

  "page.contacts.eyebrow": "Надзаголовок",
  "page.contacts.title": "Заголовок",
  "page.contacts.lead": "Текст под заголовком",

  "page.industries.eyebrow": "Надзаголовок",
  "page.industries.title": "Заголовок",
  "page.industries.lead": "Текст под заголовком",

  "industries.card1.name": "Ниша 1 — название",
  "industries.card1.tag": "Ниша 1 — подпись",
  "industries.card1.problem": "Ниша 1 — задача",
  "industries.card1.solution": "Ниша 1 — что делаем",
  "industries.card2.name": "Ниша 2 — название",
  "industries.card2.tag": "Ниша 2 — подпись",
  "industries.card2.problem": "Ниша 2 — задача",
  "industries.card2.solution": "Ниша 2 — что делаем",
  "industries.card3.name": "Ниша 3 — название",
  "industries.card3.tag": "Ниша 3 — подпись",
  "industries.card3.problem": "Ниша 3 — задача",
  "industries.card3.solution": "Ниша 3 — что делаем",
  "industries.card4.name": "Ниша 4 — название",
  "industries.card4.tag": "Ниша 4 — подпись",
  "industries.card4.problem": "Ниша 4 — задача",
  "industries.card4.solution": "Ниша 4 — что делаем",
  "industries.card5.name": "Ниша 5 — название",
  "industries.card5.tag": "Ниша 5 — подпись",
  "industries.card5.problem": "Ниша 5 — задача",
  "industries.card5.solution": "Ниша 5 — что делаем",
  "industries.card6.name": "Ниша 6 — название",
  "industries.card6.tag": "Ниша 6 — подпись",
  "industries.card6.problem": "Ниша 6 — задача",
  "industries.card6.solution": "Ниша 6 — что делаем",

  "industries.band.title": "Блок внизу — заголовок",
  "industries.band.text": "Блок внизу — текст",
};

/**
 * Мягкие ограничения длины: сколько символов помещается, не ломая вёрстку.
 *
 * Именно мягкие — поле не запрещает ввести больше, а показывает счётчик
 * и предупреждает. Жёсткий запрет здесь вреден: иногда длиннее действительно
 * нужно, и владелец должен решать сам, посмотрев на результат.
 *
 * Числа не выдуманы: это места, где перенос строки заметно двигает соседние
 * элементы. Кнопка в шапке стоит в одну строку с меню; название шага
 * процесса сдвигает иконку относительно трёх соседних карточек; пункт
 * «кому подходит» делает узкую колонку выше двух других.
 */
export const TEXT_LIMITS: Partial<Record<TextKey, number>> = {
  "home.hero.title": 48,
  "home.hero.eyebrow": 40,
  "home.hero.primaryCta": 24,
  "home.hero.secondaryCta": 24,
  "cta.primary": 24,
  "cta.works": 24,
  "cta.package": 24,
  "contact.submit": 24,
  "home.works.cta": 28,
  "home.process.step1.title": 14,
  "home.process.step2.title": 14,
  "home.process.step3.title": 14,
  "home.process.step4.title": 14,
  "home.process.step1.text": 90,
  "home.process.step2.text": 90,
  "home.process.step3.text": 90,
  "home.process.step4.text": 90,
  "contact.point1": 45,
  "contact.point2": 45,
  "contact.point3": 45,
  "industries.card1.name": 24,
  "industries.card2.name": 24,
  "industries.card3.name": 24,
  "industries.card4.name": 24,
  "industries.card5.name": 24,
  "industries.card6.name": 24,
  "industries.card1.problem": 70,
  "industries.card2.problem": 70,
  "industries.card3.problem": 70,
  "industries.card4.problem": 70,
  "industries.card5.problem": 70,
  "industries.card6.problem": 70,
  "industries.card1.solution": 70,
  "industries.card2.solution": 70,
  "industries.card3.solution": 70,
  "industries.card4.solution": 70,
  "industries.card5.solution": 70,
  "industries.card6.solution": 70,
  "industries.band.title": 55,
  "page.services.title": 45,
  "page.packages.title": 45,
  "page.works.title": 45,
  "page.faq.title": 45,
  "page.contacts.title": 45,
  "page.industries.title": 45,
};

export const TEXT_KEYS = Object.keys(TEXT_DEFAULTS) as TextKey[];

/**
 * Места на сайте, куда владелец ставит свою фотографию.
 *
 * Хранится тем же ключ-значением, что и тексты: в базе лежит НОМЕР
 * загруженной картинки строкой. Отдельная таблица тут ничего не добавила бы,
 * а миграцию потребовала бы.
 *
 * Значение по умолчанию — файл из `public/` вместе с настоящими размерами.
 * Размеры обязательны: без них браузер не знает, сколько места занять,
 * и страница дёргается, пока грузятся снимки первого экрана.
 *
 * `ratio` — во что кадрируется снимок в рамке. Показывается подсказкой:
 * иначе владелец загрузит вертикальное фото в горизонтальное окно браузера
 * и увидит обрезанные поля вместо сайта.
 */
export type ImageSlotKey = keyof typeof IMAGE_SLOTS;

export const IMAGE_SLOTS = {
  "home.hero.browser.image": {
    label: "Снимок сайта в окне браузера",
    hint: "Горизонтальный, кадрируется под 16/10",
    ratio: "16/10",
    fallback: { url: "/works/bricks-desktop.webp", width: 880, height: 550 },
  },
  "home.hero.phone.image": {
    label: "Снимок в рамке телефона",
    hint: "Вертикальный, кадрируется под 9/16",
    ratio: "9/16",
    fallback: { url: "/works/bricks-mobile.webp", width: 420, height: 747 },
  },
} as const;

export const IMAGE_SLOT_KEYS = Object.keys(IMAGE_SLOTS) as ImageSlotKey[];

export function isImageSlot(value: string): value is ImageSlotKey {
  return value in IMAGE_SLOTS;
}

/** Готовая картинка для страницы: адрес и размеры. */
export type SlotImage = { url: string; width: number; height: number };

export function isTextKey(value: string): value is TextKey {
  return value in TEXT_DEFAULTS;
}

/**
 * Ключи, где звёздочками задаётся выделение цветом. В админке к ним
 * показывается подсказка — иначе владелец увидит звёздочки на сайте
 * и решит, что что-то сломалось.
 */
export const ACCENT_TEXT_KEYS: ReadonlySet<string> = new Set<TextKey>([
  "home.hero.title",
  "home.works.title",
  "home.process.title",
  "home.packages.title",
  "home.metrics.title",
  "contact.title",
  "page.services.title",
  "page.packages.title",
  "page.works.title",
  "page.faq.title",
  "page.contacts.title",
  "page.industries.title",
]);
