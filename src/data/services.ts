/**
 * Единый источник правды по каталогу услуг и пакетам.
 *
 * Цены, сроки и описания правим ТОЛЬКО здесь. Отсюда читают:
 *   - карточки каталога на `/` и `/packages`
 *   - хабы `/services`, `/services/websites`, `/services/bots`
 *   - страницы услуг (`timeline` / `priceFrom`)
 *   - тарифы на `/services/support`
 *   - ответы чат-маскота и `/faq`
 *   - MCP-инструменты `list_services` / `get_service`
 *
 * Модуль намеренно без зависимостей (в т.ч. без lucide) — его импортирует
 * серверный MCP-бандл, тянуть туда React-иконки не нужно. Иконки страницы
 * сопоставляют по `ServiceId` у себя.
 */

/** Неразрывный пробел: «60 000 ₽» не должно переноситься по строкам. */
const NBSP = " ";

export const SERVICE_IDS = [
  "websites/landing",
  "websites/corporate",
  "websites/ecommerce",
  "bots/telegram",
  "bots/max",
  "bots/miniapp",
  "support",
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];
export type ServiceCategoryId = "websites" | "bots" | "support";
export type PriceUnit = "project" | "month";

/**
 * Пути указаны литеральными объединениями, а не `string`: так `<Link to={...}>`
 * проверяется типами роутера и опечатка ловится компилятором, без `as never`.
 */
export type ServicePath =
  | "/services/websites/landing"
  | "/services/websites/corporate"
  | "/services/websites/ecommerce"
  | "/services/bots/telegram"
  | "/services/bots/max"
  | "/services/bots/miniapp"
  | "/services/support";

export type CategoryPath = "/services/websites" | "/services/bots" | "/services/support";

export type Service = {
  id: ServiceId;
  category: ServiceCategoryId;
  /** Заголовок на странице услуги и в списках направления: «Лендинг». */
  title: string;
  /** Заголовок в общем каталоге, где нужен контекст: «Сайт-лендинг». */
  cardTitle: string;
  path: ServicePath;
  /** Число — единственная запись цены. Строка собирается `formatPrice`. */
  priceValue: number;
  priceUnit: PriceUnit;
  /** Готовая строка вида «от 60 000 ₽» — считается из `priceValue`. */
  priceFrom: string;
  timeline: string;
  /** Одна строка для карточки каталога. */
  short: string;
  /** Развёрнутое описание: хабы направлений и MCP. */
  description: string;
};

export type ServiceCategory = {
  id: ServiceCategoryId;
  title: string;
  path: CategoryPath;
  description: string;
};

export type PackageId = "start" | "business" | "system";

export type Package = {
  id: PackageId;
  name: string;
  /** Кому подходит — одна строка над названием. */
  who: string;
  priceValue: number;
  priceFrom: string;
  featured: boolean;
  points: string[];
  /** Расширенные детали для `/packages`. */
  term: string;
  result: string;
  notFor: string;
};

/** «от 60 000 ₽» / «от 15 000 ₽/мес» — единый формат цены по всему сайту. */
export function formatPrice(value: number, unit: PriceUnit = "project"): string {
  const digits = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `от${NBSP}${digits}${NBSP}₽${unit === "month" ? "/мес" : ""}`;
}

export const CATEGORIES: ServiceCategory[] = [
  {
    id: "websites",
    title: "Сайты",
    path: "/services/websites",
    description: "Лендинги, корпоративные сайты и e-commerce в связке с ботом и админкой.",
  },
  {
    id: "bots",
    title: "Боты и MiniApp",
    path: "/services/bots",
    description:
      "Чат-боты и мини-приложения внутри Telegram и MAX: заказы, оплаты, поддержка, программы лояльности.",
  },
  {
    id: "support",
    title: "Поддержка и SEO",
    path: "/services/support",
    description: "Мониторинг, обновления, SEO и аналитика после запуска.",
  },
];

export type ServiceSeed = Omit<Service, "priceFrom">;

export const SERVICE_SEEDS: ServiceSeed[] = [
  {
    id: "websites/landing",
    category: "websites",
    title: "Лендинг",
    cardTitle: "Сайт-лендинг",
    path: "/services/websites/landing",
    priceValue: 60_000,
    priceUnit: "project",
    timeline: "около 3 недель",
    short: "Одностраничный сайт для запуска продукта или услуги.",
    description:
      "Одностраничный сайт для запуска продукта, услуги или мероприятия. Фокус на конверсии.",
  },
  {
    id: "websites/corporate",
    category: "websites",
    title: "Корпоративный сайт",
    cardTitle: "Корпоративный сайт",
    path: "/services/websites/corporate",
    priceValue: 150_000,
    priceUnit: "project",
    timeline: "1,5–2 месяца",
    short: "Многостраничный сайт с каталогом, кейсами и блогом.",
    description: "Многостраничный сайт компании с каталогом услуг, кейсами и блогом.",
  },
  {
    id: "websites/ecommerce",
    category: "websites",
    title: "Интернет-магазин",
    cardTitle: "Интернет-магазин",
    path: "/services/websites/ecommerce",
    priceValue: 250_000,
    priceUnit: "project",
    timeline: "3–4 месяца",
    short: "Каталог, корзина, оплата и админка.",
    description: "Магазин с каталогом, корзиной, оплатой и админкой.",
  },
  {
    id: "bots/telegram",
    category: "bots",
    title: "Telegram-бот",
    cardTitle: "Telegram-бот",
    path: "/services/bots/telegram",
    priceValue: 40_000,
    priceUnit: "project",
    timeline: "2–3 недели",
    short: "Бот для продаж, поддержки, записи или автоматизации.",
    description: "Боты для продаж, поддержки и автоматизации процессов в Telegram.",
  },
  {
    id: "bots/max",
    category: "bots",
    title: "MAX-бот",
    cardTitle: "MAX-бот",
    path: "/services/bots/max",
    priceValue: 40_000,
    priceUnit: "project",
    timeline: "около месяца",
    short: "Бот для платформы MAX от VK.",
    description: "Боты для российского мессенджера MAX от VK.",
  },
  {
    id: "bots/miniapp",
    category: "bots",
    title: "MiniApp",
    cardTitle: "MiniApp",
    path: "/services/bots/miniapp",
    priceValue: 120_000,
    priceUnit: "project",
    timeline: "около 3 месяцев",
    short: "Мини-приложение в Telegram с каталогом и профилем.",
    description:
      "Мини-приложения внутри Telegram и MAX — полноценный интерфейс с оплатой и личным кабинетом.",
  },
  {
    id: "support",
    category: "support",
    title: "Поддержка и SEO",
    cardTitle: "Поддержка и SEO",
    path: "/services/support",
    priceValue: 15_000,
    priceUnit: "month",
    timeline: "от месяца",
    short: "Настройка, аналитика, SEO и мониторинг.",
    description: "Поддержка сайтов и ботов: мониторинг, обновления, SEO, аналитика.",
  },
];

export const SERVICES: Service[] = SERVICE_SEEDS.map((seed) => ({
  ...seed,
  priceFrom: formatPrice(seed.priceValue, seed.priceUnit),
}));

export const SERVICE_BY_ID = Object.fromEntries(
  SERVICES.map((service) => [service.id, service]),
) as Record<ServiceId, Service>;

/** Порядок карточек в общем каталоге на `/` и `/packages`. */
export const CATALOG_ORDER: ServiceId[] = [
  "websites/landing",
  "websites/corporate",
  "bots/telegram",
  "bots/miniapp",
  "bots/max",
  "websites/ecommerce",
  "support",
];

export const CATALOG: Service[] = CATALOG_ORDER.map((id) => SERVICE_BY_ID[id]);

export function getService(id: ServiceId): Service {
  return SERVICE_BY_ID[id];
}

export function servicesOf(category: ServiceCategoryId): Service[] {
  return SERVICES.filter((service) => service.category === category);
}

export type PackageSeed = Omit<Package, "priceFrom">;

export const PACKAGE_SEEDS: PackageSeed[] = [
  {
    id: "start",
    name: "Старт",
    who: "Первый простой запуск",
    priceValue: 60_000,
    featured: false,
    points: ["Лендинг на одной странице", "Форма заявки", "Уведомления в Telegram"],
    term: "около месяца",
    result: "Сайт принимает заявки, менеджер видит их в чате",
    notFor: "Не подойдёт, если нужен каталог и статусы",
  },
  {
    id: "business",
    name: "Бизнес",
    who: "Основной выбор для работающих компаний",
    priceValue: 180_000,
    featured: true,
    points: [
      "Сайт из нескольких страниц",
      "Админка для контента и заявок",
      "Статусы, история клиента",
      "Уведомления менеджеру",
    ],
    term: "2,5–3 месяца",
    result: "Заявки в одном месте со статусами и историей",
    notFor: "Не нужно, если хватает одной формы и чата",
  },
  {
    id: "system",
    name: "Система",
    who: "Следующий уровень: логика и интеграции",
    priceValue: 420_000,
    featured: false,
    points: [
      "Всё из «Бизнеса»",
      "Распределение заявок по правилам",
      "Интеграции: CRM, оплаты, аналитика",
      "Сопровождение и развитие",
    ],
    term: "2 этапа, от 4 месяцев",
    result: "Автоматизированный поток заявок и работы с клиентами",
    notFor: "Избыточно на старте проекта",
  },
];

export const PACKAGES: Package[] = PACKAGE_SEEDS.map((seed) => ({
  ...seed,
  priceFrom: formatPrice(seed.priceValue),
}));

export const PACKAGE_BY_ID = Object.fromEntries(PACKAGES.map((pkg) => [pkg.id, pkg])) as Record<
  PackageId,
  Package
>;
