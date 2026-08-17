/**
 * Заголовки и описания страниц для поисковиков — в одном месте и правятся
 * из админки.
 *
 * ЗАЧЕМ. Владелец строит сайт ради позиций в поиске, а `<title>` и
 * `description` — ровно тот текст, который видно в выдаче и по которому
 * решают, кликать или нет. До этого их можно было поменять только через
 * разработчика: шестнадцать страниц, шестнадцать литералов в роутах.
 *
 * УСТРОЙСТВО — та же накладка. Здесь значения по умолчанию, в базе только
 * изменённые. Пустая база не роняет мета-теги: страница возьмёт их отсюда.
 *
 * ПОДСТАНОВКА. В описании работают те же плейсхолдеры, что и в ответах
 * на вопросы: `{{start.price}}`, `{{business.term}}`. Это не украшение —
 * в описании `/packages` перечислены цены пакетов, и без подстановки они
 * разъезжались бы с тарифами при первой же правке цен в админке.
 */

export type SeoEntry = {
  title: string;
  description: string;
  /** Заголовок для соцсетей, если он должен отличаться от `<title>`. */
  socialTitle: string;
  socialDescription: string;
};

/**
 * Рекомендуемые длины. Не жёсткие ограничения, а подсказка в админке:
 * Яндекс и Google обрезают сниппет примерно здесь.
 */
export const SEO_LIMITS = {
  title: { good: 60, max: 70 },
  description: { good: 160, max: 200 },
} as const;

/** Страница сайта в списке админки. */
export type SeoPage = {
  path: string;
  /** Идентификатор в адресе админки: у пути есть косые черты, у слага нет. */
  slug: string;
  /** Как называется страница в админке. */
  label: string;
  /** Группа в списке: не сваливать шестнадцать страниц в один столбец. */
  group: string;
};

export const SEO_PAGES: SeoPage[] = [
  { path: "/", slug: "home", label: "Главная", group: "Основные" },
  { path: "/packages", slug: "packages", label: "Пакеты и цены", group: "Основные" },
  { path: "/works", slug: "works", label: "Работы", group: "Основные" },
  { path: "/faq", slug: "faq", label: "Вопросы и ответы", group: "Основные" },
  { path: "/contacts", slug: "contacts", label: "Контакты", group: "Основные" },
  { path: "/industries", slug: "industries", label: "Кому подходит", group: "Основные" },

  { path: "/services", slug: "services", label: "Все услуги", group: "Разделы услуг" },
  {
    path: "/services/websites",
    slug: "services-websites",
    label: "Сайты — раздел",
    group: "Разделы услуг",
  },
  {
    path: "/services/bots",
    slug: "services-bots",
    label: "Боты и MiniApp — раздел",
    group: "Разделы услуг",
  },

  {
    path: "/services/websites/landing",
    slug: "landing",
    label: "Лендинг",
    group: "Страницы услуг",
  },
  {
    path: "/services/websites/corporate",
    slug: "corporate",
    label: "Корпоративный сайт",
    group: "Страницы услуг",
  },
  {
    path: "/services/websites/ecommerce",
    slug: "ecommerce",
    label: "Интернет-магазин",
    group: "Страницы услуг",
  },
  {
    path: "/services/bots/telegram",
    slug: "telegram",
    label: "Telegram-бот",
    group: "Страницы услуг",
  },
  { path: "/services/bots/max", slug: "max", label: "MAX-бот", group: "Страницы услуг" },
  { path: "/services/bots/miniapp", slug: "miniapp", label: "MiniApp", group: "Страницы услуг" },
  { path: "/services/support", slug: "support", label: "Поддержка и SEO", group: "Страницы услуг" },
];

export function seoPageBySlug(slug: string): SeoPage | null {
  return SEO_PAGES.find((page) => page.slug === slug) ?? null;
}

/** Группы в порядке появления — для списка в админке. */
export const SEO_GROUPS: string[] = [...new Set(SEO_PAGES.map((page) => page.group))];

export const SEO_DEFAULTS: Record<string, SeoEntry> = {
  "/": {
    title: "IT-Agent — Сайт, бот и админка для заявок",
    description:
      "Единая система: сайт, Telegram-бот и админка работают вместе — заявка приходит менеджеру моментально и сохраняется в одном месте.",
    socialTitle: "IT-Agent — Сайт, который не теряет заявки",
    socialDescription:
      "Сайт + Telegram-бот + админка. Единая система приёма и обработки заявок для бизнеса.",
  },

  "/packages": {
    title: "Сколько стоит сайт с ботом — цены и пакеты | IT-Agent",
    /* Цены плейсхолдерами, а не числами: иначе после первой же правки
       тарифов в админке в выдаче осталась бы старая цена. */
    description:
      "Пакет «Старт» {{start.price}}, «Бизнес» {{business.price}}, «Система» {{system.price}}. Что входит, срок запуска и результат по каждому — без скрытых доплат и длинного техзадания.",
    socialTitle: "",
    socialDescription: "Старт, Бизнес, Система. Кому подходит, что на выходе, срок запуска.",
  },

  "/works": {
    title: "Портфолио: сайты, Telegram-боты и админки | IT-Agent",
    description:
      "Проекты IT-Agent: сайты с ботом и админкой для магазинов, клиник, школ, автосервисов и B2B. Что просил клиент, что мы собрали и как это работает сейчас.",
    socialTitle: "",
    socialDescription: "Кейсы IT-Agent: сайты, Telegram-боты, MiniApp и админки.",
  },

  "/faq": {
    title: "Вопросы о разработке сайтов и Telegram-ботов | IT-Agent",
    description:
      "Сколько стоит сайт с ботом, какие сроки, нужно ли техзадание, что будет после запуска и можно ли заказать что-то одно. Отвечаем коротко и по делу.",
    socialTitle: "Вопросы — IT-Agent",
    socialDescription: "Что нужно на старте, сколько занимает запуск, что делаем после.",
  },

  "/contacts": {
    title: "Заказать сайт, Telegram-бота или админку | Контакты IT-Agent",
    description:
      "Оставьте заявку — вернёмся с коротким разбором вашей ситуации. Без длинного техзадания и обязательств на старте.",
    socialTitle: "Контакты — IT-Agent",
    socialDescription: "Форма заявки. Отвечаем в течение рабочего дня.",
  },

  "/industries": {
    title: "Кому нужен сайт с Telegram-ботом и админкой | IT-Agent",
    description:
      "Сервисный бизнес, локальные компании, B2B, онлайн-сервисы и выездные услуги. Шесть типичных ситуаций: где теряются заявки и что мы с этим делаем.",
    socialTitle: "",
    socialDescription: "Шесть типичных сценариев: задача бизнеса и что мы делаем.",
  },

  "/services": {
    title: "Разработка сайтов и Telegram-ботов под ключ — IT-Agent",
    description:
      "Разрабатываем сайты, Telegram и MAX ботов, MiniApp и админку заявок. Собираем их в одну систему: заявка с сайта приходит менеджеру в Telegram за секунды.",
    socialTitle: "",
    socialDescription: "Три направления IT-Agent: сайты, боты и MiniApp, поддержка и SEO.",
  },

  "/services/websites": {
    title: "Сайты — Услуги IT-Agent",
    description: "Лендинги, корпоративные сайты и e-commerce. Быстро, красиво, с ботом и админкой.",
    socialTitle: "Сайты — IT-Agent",
    socialDescription: "Лендинги, корпоративные сайты, e-commerce и MiniApp.",
  },

  "/services/bots": {
    title: "Боты и MiniApp — Услуги IT-Agent",
    description:
      "Telegram и MAX боты, Telegram MiniApp: заказы, оплаты, поддержка, программы лояльности.",
    socialTitle: "Боты и MiniApp — IT-Agent",
    socialDescription: "Чат-боты Telegram и MAX, а также MiniApp внутри мессенджеров.",
  },

  "/services/websites/landing": {
    title: "Лендинг — Сайты — IT-Agent",
    description:
      "Одностраничный сайт под запуск, услугу или продукт. Дизайн, тексты, формы, аналитика.",
    socialTitle: "Лендинг под ключ — IT-Agent",
    socialDescription: "Быстрый одностраничник, который приводит заявки с первого дня.",
  },

  "/services/websites/corporate": {
    title: "Корпоративный сайт — Сайты — IT-Agent",
    description:
      "Многостраничный сайт компании: услуги, кейсы, блог, вакансии. Собственная админка и SEO.",
    socialTitle: "Корпоративный сайт — IT-Agent",
    socialDescription:
      "Сайт с услугами, кейсами, командой и блогом — под управлением без разработчика.",
  },

  "/services/websites/ecommerce": {
    title: "Интернет-магазин — Сайты — IT-Agent",
    description: "E-commerce под ключ: каталог, корзина, оплата, доставка, интеграции с CRM и 1С.",
    socialTitle: "Интернет-магазин — IT-Agent",
    socialDescription:
      "Магазин, который продаёт: удобный каталог, оплата и доставка, аналитика заказов.",
  },

  "/services/bots/telegram": {
    title: "Telegram-бот — Боты — IT-Agent",
    description: "Telegram-боты для заявок, продаж и поддержки: воронки, оплаты, CRM и аналитика.",
    socialTitle: "Telegram-бот под ключ — IT-Agent",
    socialDescription: "Автоворонки, оплата, уведомления, поддержка 24/7 — в одном боте.",
  },

  "/services/bots/max": {
    title: "MAX-бот — Боты — IT-Agent",
    description:
      "Боты для российского мессенджера MAX: новая аудитория, тот же функционал, что и у Telegram-ботов.",
    socialTitle: "MAX-бот под ключ — IT-Agent",
    socialDescription: "Автоворонки, оплаты и поддержка внутри мессенджера MAX.",
  },

  "/services/bots/miniapp": {
    title: "Telegram MiniApp — Боты — IT-Agent",
    description:
      "MiniApp — полноценное веб-приложение внутри Telegram: каталог, оплата, личный кабинет.",
    socialTitle: "Telegram MiniApp — IT-Agent",
    socialDescription: "Native-опыт внутри мессенджера, без установки из стора.",
  },

  "/services/support": {
    title: "Поддержка и SEO — Услуги IT-Agent",
    description: "Мониторинг 24/7, SEO, аналитика, доработки. Сайт не ломается и растёт в поиске.",
    socialTitle: "Поддержка и SEO — IT-Agent",
    socialDescription: "Сопровождение сайтов и ботов: мониторинг, SEO, аналитика, правки.",
  },
};

export function isSeoPath(value: string): boolean {
  return value in SEO_DEFAULTS;
}
