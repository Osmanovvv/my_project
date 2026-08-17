/**
 * Палитра иконок, из которой владелец выбирает значок для пункта услуги.
 *
 * ЗДЕСЬ ТОЛЬКО КЛЮЧИ — без единого импорта из lucide. Причина та же, по
 * которой её нет в каталоге услуг: этот модуль читает и серверный MCP-бандл,
 * и валидатор серверных функций, а тянуть туда React-иконки незачем.
 * Сопоставление ключа с компонентом живёт в `components/site/Icon.tsx`.
 *
 * Почему список закрытый, а не «любая иконка lucide». Их там больше полутора
 * тысяч: выбирать не из чего, а имя вводить руками — верный способ получить
 * пустой квадрат на странице услуги. Здесь ровно те, что нужны студии,
 * с русскими подписями и по темам — выбор занимает секунды.
 *
 * Ключ БЕЗОПАСНО удалять из палитры нельзя: он мог быть уже сохранён в базе.
 * Удалённый ключ не сломает страницу (нарисуется запасная иконка), но пункт
 * молча сменит вид. Добавлять — можно свободно, миграция не нужна.
 */

export type IconGroup = {
  title: string;
  keys: string[];
};

/** Ключ → подпись в выпадающем списке админки. */
export const ICON_LABELS: Record<string, string> = {
  // Сайты и разработка
  layout: "Макет страницы",
  "layout-template": "Шаблон",
  code: "Код",
  palette: "Палитра",
  image: "Картинка",
  smartphone: "Телефон",
  monitor: "Экран",
  languages: "Языки",

  // Скорость и качество
  zap: "Молния",
  gauge: "Спидометр",
  rocket: "Ракета",
  sparkles: "Искры",
  "trending-up": "Рост",
  award: "Награда",
  star: "Звезда",
  check: "Галочка",

  // Боты и общение
  bot: "Бот",
  send: "Отправка",
  "message-square": "Сообщение",
  bell: "Колокольчик",
  megaphone: "Рупор",
  workflow: "Схема",
  headphones: "Поддержка",
  "life-buoy": "Спасательный круг",

  // Торговля
  "shopping-bag": "Сумка",
  "shopping-cart": "Корзина",
  "credit-card": "Карта оплаты",
  wallet: "Кошелёк",
  tag: "Ценник",
  truck: "Доставка",
  "package-search": "Поиск товара",
  boxes: "Склад",

  // Данные и аналитика
  search: "Поиск",
  "bar-chart": "Столбцы",
  "line-chart": "График",
  "pie-chart": "Круговая",
  database: "База данных",
  filter: "Фильтр",
  target: "Мишень",
  activity: "Пульс",

  // Люди и организация
  users: "Люди",
  user: "Человек",
  "building-2": "Здание",
  handshake: "Рукопожатие",
  briefcase: "Портфель",
  calendar: "Календарь",
  clock: "Часы",
  "map-pin": "Метка на карте",

  // Надёжность и служебное
  "shield-check": "Щит",
  lock: "Замок",
  "refresh-cw": "Обновление",
  wrench: "Гаечный ключ",
  settings: "Шестерёнка",
  layers: "Слои",
  puzzle: "Пазл",
  "file-text": "Документ",
  newspaper: "Газета",
  globe: "Глобус",
  link: "Ссылка",
  mail: "Почта",
};

/** Группировка для выбора: полсотни иконок сплошной сеткой не выбираются. */
export const ICON_GROUPS: IconGroup[] = [
  {
    title: "Сайты и дизайн",
    keys: [
      "layout",
      "layout-template",
      "code",
      "palette",
      "image",
      "smartphone",
      "monitor",
      "languages",
    ],
  },
  {
    title: "Скорость и результат",
    keys: ["zap", "gauge", "rocket", "sparkles", "trending-up", "award", "star", "check"],
  },
  {
    title: "Боты и общение",
    keys: [
      "bot",
      "send",
      "message-square",
      "bell",
      "megaphone",
      "workflow",
      "headphones",
      "life-buoy",
    ],
  },
  {
    title: "Торговля",
    keys: [
      "shopping-bag",
      "shopping-cart",
      "credit-card",
      "wallet",
      "tag",
      "truck",
      "package-search",
      "boxes",
    ],
  },
  {
    title: "Данные и аналитика",
    keys: [
      "search",
      "bar-chart",
      "line-chart",
      "pie-chart",
      "database",
      "filter",
      "target",
      "activity",
    ],
  },
  {
    title: "Люди и работа",
    keys: ["users", "user", "building-2", "handshake", "briefcase", "calendar", "clock", "map-pin"],
  },
  {
    title: "Надёжность и прочее",
    keys: [
      "shield-check",
      "lock",
      "refresh-cw",
      "wrench",
      "settings",
      "layers",
      "puzzle",
      "file-text",
      "newspaper",
      "globe",
      "link",
      "mail",
    ],
  },
];

export const ICON_KEYS: string[] = ICON_GROUPS.flatMap((group) => group.keys);

/** Ключ по умолчанию: им рисуется пункт с неизвестным или пустым значком. */
export const FALLBACK_ICON = "sparkles";

export function isIconKey(value: unknown): value is string {
  return typeof value === "string" && value in ICON_LABELS;
}
