/**
 * Публичные контакты и данные организации.
 *
 * Значения живут в базе и правятся из админки. Здесь — список возможных
 * каналов и их подписи, то есть скелет: добавить четвёртый канал из админки
 * нельзя, потому что под него нет ни иконки, ни правил ссылки.
 *
 * ПРАВИЛО: пустое значение = канала нет. Он не показывается ни на странице
 * контактов, ни в подвале, ни в микроразметке для поисковиков. Так нельзя
 * случайно опубликовать заглушку вроде «+7 (000) 000-00-00» — её просто
 * негде взять.
 */

export type ContactChannelId = "telegram" | "phone" | "email";

export type ContactChannel = {
  id: ContactChannelId;
  label: string;
  /** Что видит посетитель. Пусто — канала нет. */
  value: string;
  href: string;
};

/** Возможные каналы и их подписи. Значения по умолчанию пустые. */
export const CONTACT_SEEDS: Array<{ id: ContactChannelId; label: string; value: string }> = [
  { id: "telegram", label: "Telegram", value: "" },
  { id: "phone", label: "Телефон", value: "" },
  { id: "email", label: "Почта", value: "" },
];

/** Подсказки в админке: что именно вводить. */
export const CONTACT_HINTS: Record<ContactChannelId, string> = {
  telegram: "ник без собаки, например itagent_ru",
  phone: "в любом виде: +7 978 123-45-67",
  email: "почта на своём домене",
};

/**
 * Бот, который принимает заявки с формы, — подтверждённый и наш.
 * Публичным контактом не является: в него пишет сервер, а не посетитель.
 * Ник нужен, чтобы не потерять, к какому боту относятся `TELEGRAM_*`
 * в переменных окружения.
 */
export const TELEGRAM_BOT_USERNAME = "ITagent_bot";

export const ORGANIZATION = {
  name: "IT-Agent",
  legalName: "IT-Agent",
  description:
    "Студия, которая собирает сайты, Telegram-боты и админку заявок в одну систему: заявка приходит менеджеру моментально и не теряется.",
  /** Города/страна для микроразметки. */
  areaServed: "RU",
  language: "ru",
} as const;
