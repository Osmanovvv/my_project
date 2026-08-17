/**
 * Тексты главной страницы, которые правятся из админки.
 *
 * Устройство — накладка: здесь лежит значение ПО УМОЛЧАНИЮ, в базе только
 * то, что владелец действительно изменил. Отсюда три следствия:
 *
 *   1. Пустая база не ломает сайт — он отрисуется этими значениями.
 *   2. Новый ключ не требует миграции: добавили строку сюда, и всё.
 *   3. Кнопка «вернуть как было» — это просто удаление строки из базы.
 *
 * ПОЧЕМУ ТОЛЬКО ГЛАВНАЯ. Заголовков разделов по сайту сотни, и половина
 * содержит цветное выделение внутри. Прогнать через каталог строк всю вёрстку
 * — это дни работы и постоянный риск, что макет поедет от чужой правки.
 * Первый экран видит каждый посетитель, поэтому он здесь; подписи на
 * внутренних страницах правятся в коде, если реально понадобится.
 *
 * ВЫДЕЛЕНИЕ ЦВЕТОМ. В заголовке часть слов покрашена акцентом. Хранить
 * там HTML нельзя — это дыра. Поэтому выделенный кусок берётся в звёздочки:
 * «Сайт, который *не теряет заявки*». Разбирает их `AccentText`.
 */

export type TextKey = keyof typeof TEXT_DEFAULTS;

export const TEXT_DEFAULTS = {
  "home.hero.eyebrow": "Сайт · Telegram-бот · Админка",
  "home.hero.title": "Сайт, который *не теряет заявки*",
  "home.hero.subtitle": "Единая система: сайт, бот в Telegram и админка работают вместе.",
  "home.hero.primaryCta": "Получить разбор",
  "home.hero.secondaryCta": "Как это работает",

  "home.works.eyebrow": "Работы",
  "home.works.title": "Что мы уже сделали",
  "home.works.note": "Каждый проект — сайт, бот и админка, собранные под конкретный поток заявок.",

  "home.process.eyebrow": "Как работаем",
  "home.packages.eyebrow": "Пакеты и услуги",
  "home.packages.title": "С чего начать",

  "home.metrics.eyebrow": "Цифры",
  "home.metrics.title": "Что меняется после запуска",
} as const;

/** Человеческие подписи полей в админке. */
export const TEXT_LABELS: Record<TextKey, string> = {
  "home.hero.eyebrow": "Плашка над заголовком",
  "home.hero.title": "Заголовок первого экрана",
  "home.hero.subtitle": "Подзаголовок",
  "home.hero.primaryCta": "Главная кнопка",
  "home.hero.secondaryCta": "Вторая кнопка",

  "home.works.eyebrow": "Работы — надзаголовок",
  "home.works.title": "Работы — заголовок",
  "home.works.note": "Работы — подпись справа",

  "home.process.eyebrow": "Как работаем — надзаголовок",
  "home.packages.eyebrow": "Пакеты — надзаголовок",
  "home.packages.title": "Пакеты — заголовок",

  "home.metrics.eyebrow": "Цифры — надзаголовок",
  "home.metrics.title": "Цифры — заголовок",
};

/** Группировка для формы: не сваливать четырнадцать полей в один список. */
export const TEXT_GROUPS: Array<{ title: string; keys: TextKey[] }> = [
  {
    title: "Первый экран",
    keys: [
      "home.hero.eyebrow",
      "home.hero.title",
      "home.hero.subtitle",
      "home.hero.primaryCta",
      "home.hero.secondaryCta",
    ],
  },
  {
    title: "Блок работ",
    keys: ["home.works.eyebrow", "home.works.title", "home.works.note"],
  },
  {
    title: "Остальные блоки главной",
    keys: [
      "home.process.eyebrow",
      "home.packages.eyebrow",
      "home.packages.title",
      "home.metrics.eyebrow",
      "home.metrics.title",
    ],
  },
];

export const TEXT_KEYS = Object.keys(TEXT_DEFAULTS) as TextKey[];

export function isTextKey(value: string): value is TextKey {
  return value in TEXT_DEFAULTS;
}
