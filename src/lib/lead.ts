/**
 * Правила заявки. Один модуль на клиент и сервер: браузер показывает ошибки
 * сразу, сервер валидирует заново — доверять клиентской проверке нельзя.
 *
 * Без зависимостей: zod остаётся в серверном MCP-бандле и не попадает
 * в клиентский, где живёт форма.
 */

export const LEAD_LIMITS = {
  name: { min: 2, max: 80 },
  contact: { min: 3, max: 120 },
  task: { max: 1000 },
  page: { max: 300 },
  source: { max: 500 },
} as const;

export type LeadField = "name" | "contact" | "task";

export type Lead = {
  name: string;
  contact: string;
  /** Необязательное описание задачи. */
  task: string;
  /** Страница, с которой отправлена заявка. */
  page: string;
  /** UTM-метки и реферер, собранные при заходе. */
  source: string;
};

export type LeadErrors = Partial<Record<LeadField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const TELEGRAM_RE = /^@?[a-zA-Z0-9_]{4,32}$/;

/** Однострочные поля: схлопываем любые пробелы и переводы строк. */
function cleanLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

/** Многострочное поле: пробелы схлопываем, абзацы сохраняем. */
function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/** Приводит произвольный JSON к форме заявки. Не обрезает — длину проверяет `validateLead`. */
export function normalizeLead(raw: unknown): Lead {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    name: cleanLine(input.name),
    contact: cleanLine(input.contact),
    task: cleanText(input.task),
    page: cleanLine(input.page).slice(0, LEAD_LIMITS.page.max),
    source: cleanLine(input.source).slice(0, LEAD_LIMITS.source.max),
  };
}

export function validateLead(lead: Lead): LeadErrors {
  const errors: LeadErrors = {};

  if (lead.name.length < LEAD_LIMITS.name.min) {
    errors.name = "Напишите, как к вам обращаться";
  } else if (lead.name.length > LEAD_LIMITS.name.max) {
    errors.name = `Не длиннее ${LEAD_LIMITS.name.max} символов`;
  }

  if (lead.contact.length < LEAD_LIMITS.contact.min) {
    errors.contact = "Оставьте телефон, @username в Telegram или email";
  } else if (lead.contact.length > LEAD_LIMITS.contact.max) {
    errors.contact = `Не длиннее ${LEAD_LIMITS.contact.max} символов`;
  } else if (
    !isPhone(lead.contact) &&
    !TELEGRAM_RE.test(lead.contact) &&
    !EMAIL_RE.test(lead.contact)
  ) {
    errors.contact = "Похоже на опечатку: нужен телефон, @username или email";
  }

  if (lead.task.length > LEAD_LIMITS.task.max) {
    errors.task = `Сократите до ${LEAD_LIMITS.task.max} символов`;
  }

  return errors;
}

/** Порядок полей для автофокуса на первой ошибке. */
export const LEAD_FIELD_ORDER: LeadField[] = ["name", "contact", "task"];
