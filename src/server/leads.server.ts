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
};

/**
 * Сохранить заявку. Возвращает id, по которому потом отмечается доставка.
 *
 * Ошибки записи здесь НЕ проглатываются: если база недоступна, вызывающий
 * код должен об этом знать и ответить клиенту честно, а не делать вид,
 * что заявка принята.
 */
export function insertLead(lead: Lead): number {
  const { lastId } = run(
    `INSERT INTO lead (created_at, name, contact, task, page, source)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Date.now(), lead.name, lead.contact, lead.task, lead.page, lead.source],
  );
  return lastId;
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
}
