/**
 * Хранение заявок.
 *
 * Смысл модуля — в порядке действий: заявка записывается в базу ДО попытки
 * отправить её в Telegram. До этой правки единственной копией был чат: если
 * бот недоступен (а в России Telegram сейчас работает с перебоями), контакт
 * клиента оставался только в `console.error` на сервере — то есть терялся.
 *
 * Теперь сбой доставки — это неприятность, а не потеря: заявка лежит в базе
 * с отметкой `delivered = 0`, и в админке такие видно отдельно.
 */

import { all, get, run } from "./db.server";
import type { Lead } from "../lib/lead";
import { LEAD_RETENTION_YEARS, LEGAL_VERSION } from "../data/legal";

export const LEAD_STATUSES = ["new", "in_progress", "won", "lost", "spam"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Подписи статусов для админки. Порядок тот же, что в `LEAD_STATUSES`. */
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  won: "Клиент",
  lost: "Отказ",
  spam: "Спам",
};

export type LeadRecord = {
  id: number;
  created_at: number;
  name: string;
  contact: string;
  task: string;
  page: string;
  source: string;
  status: LeadStatus;
  note: string;
  read_at: number | null;
  delivered: 0 | 1;
  delivery_error: string;
  /** Когда дано согласие на обработку. NULL — заявка до появления чекбокса. */
  consent_at: number | null;
  /** Дата редакции текста согласия, действовавшей в момент отправки. */
  consent_version: string;
};

/** Срок хранения заявок в миллисекундах — то, что обещано в политике. */
const RETENTION_MS = LEAD_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000;

/**
 * Сохранить заявку. Возвращает id, по которому потом отмечается доставка.
 *
 * Ошибки записи здесь НЕ проглатываются: если база недоступна, вызывающий
 * код должен об этом знать и ответить клиенту честно, а не делать вид,
 * что заявка принята.
 */
export function insertLead(lead: Lead): number {
  /* Запись о согласии — доказательство. Функция не должна уметь его
     сфабриковать: вызов без согласия — ошибка вызывающего, а не заявка. */
  if (lead.consent !== true) throw new Error("заявка без согласия на обработку данных");

  const now = Date.now();
  /* Согласие записывается тем же временем, что и заявка: это одно
     действие посетителя. Редакция — та, что опубликована на сайте
     этой же сборкой; клиент её не присылает, потому что присланному
     верить нельзя, а другой редакции у него и быть не могло. */
  const { lastId } = run(
    `INSERT INTO lead (created_at, name, contact, task, page, source, consent_at, consent_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [now, lead.name, lead.contact, lead.task, lead.page, lead.source, now, LEGAL_VERSION],
  );
  return lastId;
}

/**
 * Удаляет заявки старше срока хранения.
 *
 * Политика обещает: «заявки старше трёх лет удаляются автоматически».
 * Обещание в документе, за которым не стоит код, — это ложь с отсрочкой.
 * Зовётся при каждой новой заявке: отдельного планировщика у процесса
 * нет, а сайт без заявок и хранить нечего. Запрос дешёвый — индекс
 * по created_at есть с первой миграции.
 */
export function purgeExpiredLeads(now: number = Date.now()): number {
  const { changes } = run("DELETE FROM lead WHERE created_at < ?", [now - RETENTION_MS]);
  return changes;
}

/** Отметить результат доставки в Telegram. */
export function markDelivery(id: number, ok: boolean, error = ""): void {
  run("UPDATE lead SET delivered = ?, delivery_error = ? WHERE id = ?", [
    ok ? 1 : 0,
    ok ? "" : error.slice(0, 500),
    id,
  ]);
}

export type LeadFilter = {
  status?: LeadStatus | "all";
  limit?: number;
  offset?: number;
};

/** Лента заявок для админки: новые сверху. */
export function listLeads({
  status = "all",
  limit = 50,
  offset = 0,
}: LeadFilter = {}): LeadRecord[] {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Math.max(offset, 0);

  if (status === "all") {
    return all<LeadRecord>("SELECT * FROM lead ORDER BY created_at DESC LIMIT ? OFFSET ?", [
      safeLimit,
      safeOffset,
    ]);
  }

  return all<LeadRecord>(
    "SELECT * FROM lead WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [status, safeLimit, safeOffset],
  );
}

export function getLead(id: number): LeadRecord | undefined {
  return get<LeadRecord>("SELECT * FROM lead WHERE id = ?", [id]);
}

/** Сколько заявок ещё не открывали — на бейдж в меню админки. */
export function unreadCount(): number {
  const row = get<{ n: number }>("SELECT COUNT(*) AS n FROM lead WHERE read_at IS NULL");
  return Number(row?.n ?? 0);
}

/** Счётчики по статусам — для вкладок фильтра. */
export function statusCounts(): Record<LeadStatus | "all", number> {
  const rows = all<{ status: LeadStatus; n: number }>(
    "SELECT status, COUNT(*) AS n FROM lead GROUP BY status",
  );

  const counts = { all: 0 } as Record<LeadStatus | "all", number>;
  for (const status of LEAD_STATUSES) counts[status] = 0;

  for (const row of rows) {
    counts[row.status] = Number(row.n);
    counts.all += Number(row.n);
  }
  return counts;
}

export function setLeadStatus(id: number, status: LeadStatus): void {
  run("UPDATE lead SET status = ? WHERE id = ?", [status, id]);
}

export function setLeadNote(id: number, note: string): void {
  run("UPDATE lead SET note = ? WHERE id = ?", [note.slice(0, 4000), id]);
}

/** Пометить прочитанной. Повторный вызов время не переписывает. */
export function markRead(id: number): void {
  run("UPDATE lead SET read_at = ? WHERE id = ? AND read_at IS NULL", [Date.now(), id]);
}

export function deleteLead(id: number): void {
  run("DELETE FROM lead WHERE id = ?", [id]);
  /* Удаление — событие, которое политика обещает журналировать. Номер,
     не содержимое: содержимого в журнале быть не должно. */
  console.log(`[admin] заявка №${id} удалена`);
}
