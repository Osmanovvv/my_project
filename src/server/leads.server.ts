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

import { all, get, run, transaction } from "./db.server";
import type { Lead, LeadSource } from "../lib/lead";
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
  source: LeadSource;
  source_detail: string;
  status: LeadStatus;
  note: string;
  read_at: number | null;
  delivered: 0 | 1;
  delivery_error: string;
  /** Когда дано согласие на обработку. NULL — заявка до появления чекбокса. */
  consent_at: number | null;
  /** Дата редакции текста согласия, действовавшей в момент отправки. */
  consent_version: string;
  /** Ключ повторной отправки формы; пусто у старых/внутренних записей. */
  idempotency_key: string;
  /** Связь с Telegram хранится отдельно и может отсутствовать. */
  telegram_environment: string | null;
  telegram_conversation_id: number | null;
  telegram_chat_id: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  telegram_display_name: string | null;
  telegram_conversation_status: string | null;
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
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,255}$/;

function validateIdempotencyKey(key: string): string {
  const normalized = key.trim();
  if (normalized && !IDEMPOTENCY_KEY_RE.test(normalized)) {
    throw new Error("Некорректный idempotency key");
  }
  return normalized;
}

export type InsertLeadResult = { leadId: number; duplicate: boolean };

/**
 * Идемпотентная запись заявки. Проверка и INSERT находятся в одной
 * транзакции: повторный запрос получает исходный id и не создаёт новую
 * строку даже при гонке двух запросов.
 */
export function insertLeadWithIdempotency(lead: Lead, rawKey = ""): InsertLeadResult {
  /* Запись о согласии — доказательство. Функция не должна уметь его
     сфабриковать: вызов без согласия — ошибка вызывающего, а не заявка. */
  if (lead.consent !== true) throw new Error("заявка без согласия на обработку данных");
  const idempotencyKey = validateIdempotencyKey(rawKey);

  const now = Date.now();
  /* Согласие записывается тем же временем, что и заявка: это одно
     действие посетителя. Редакция — та, что опубликована на сайте
     этой же сборкой; клиент её не присылает, потому что присланному
     верить нельзя, а другой редакции у него и быть не могло. */
  return transaction(() => {
    if (idempotencyKey) {
      const existing = get<{ id: number }>("SELECT id FROM lead WHERE idempotency_key = ?", [
        idempotencyKey,
      ]);
      if (existing) return { leadId: existing.id, duplicate: true };
    }

    const { lastId } = run(
      `INSERT INTO lead
         (created_at, name, contact, task, page, source, source_detail, consent_at, consent_version, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        now,
        lead.name,
        lead.contact,
        lead.task,
        lead.page,
        lead.source,
        lead.sourceDetail,
        now,
        LEGAL_VERSION,
        idempotencyKey,
      ],
    );
    return { leadId: lastId, duplicate: false };
  });
}

/** Совместимый короткий вызов для внутренних импортов. */
export function insertLead(lead: Lead, idempotencyKey = ""): number {
  return insertLeadWithIdempotency(lead, idempotencyKey).leadId;
}

/** Быстрая проверка повтора до rate limit; сам INSERT всё равно перепроверяет. */
export function findLeadByIdempotencyKey(rawKey: string): number | undefined {
  const key = validateIdempotencyKey(rawKey);
  if (!key) return undefined;
  return get<{ id: number }>("SELECT id FROM lead WHERE idempotency_key = ?", [key])?.id;
}

/**
 * Удаляет заявки старше срока хранения.
 *
 * Политика обещает: «заявки старше трёх лет удаляются автоматически».
 * Обещание в документе, за которым не стоит код, — это ложь с отсрочкой.
 * Зовётся при старте сервера и далее планировщиком раз в сутки, а также
 * при каждой новой заявке. Запрос дешёвый — индекс по created_at есть с
 * первой миграции.
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

const LEAD_SELECT = `
  SELECT l.*,
         lt.environment AS telegram_environment,
         lt.conversation_id AS telegram_conversation_id,
         tc.client_chat_id AS telegram_chat_id,
         tp.telegram_user_id AS telegram_user_id,
         tp.username AS telegram_username,
         tp.display_name AS telegram_display_name,
         tc.status AS telegram_conversation_status
    FROM lead l
    LEFT JOIN lead_telegram lt ON lt.lead_id = l.id
    LEFT JOIN telegram_conversation tc
      ON tc.id = lt.conversation_id AND tc.environment = lt.environment
    LEFT JOIN telegram_contact tp
      ON tp.id = tc.telegram_contact_id AND tp.environment = lt.environment`;

/** Лента заявок для админки: новые сверху. */
export function listLeads({
  status = "all",
  limit = 50,
  offset = 0,
}: LeadFilter = {}): LeadRecord[] {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Math.max(offset, 0);

  if (status === "all") {
    return all<LeadRecord>(`${LEAD_SELECT} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, [
      safeLimit,
      safeOffset,
    ]);
  }

  return all<LeadRecord>(
    `${LEAD_SELECT} WHERE l.status = ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [status, safeLimit, safeOffset],
  );
}

export function getLead(id: number): LeadRecord | undefined {
  return get<LeadRecord>(`${LEAD_SELECT} WHERE l.id = ?`, [id]);
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
  transaction(() => {
    const conversations = all<{ id: number; telegram_contact_id: number }>(
      `SELECT id, telegram_contact_id
       FROM telegram_conversation
       WHERE lead_id = ?`,
      [id],
    );

    for (const conversation of conversations) {
      /* Foreign keys cascade to messages, files, outbox and lead_telegram. */
      run("DELETE FROM telegram_conversation WHERE id = ?", [conversation.id]);
    }
    run("DELETE FROM lead WHERE id = ?", [id]);

    for (const conversation of conversations) {
      /* A Telegram profile may still own other conversations or an active
         Mini App session, so remove it only when no local data refers to it. */
      run(
        `DELETE FROM telegram_contact
         WHERE id = ?
           AND NOT EXISTS (
             SELECT 1 FROM telegram_conversation
             WHERE telegram_contact_id = telegram_contact.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM telegram_miniapp_session
             WHERE telegram_contact_id = telegram_contact.id
           )`,
        [conversation.telegram_contact_id],
      );
    }
  });
  /* Удаление — событие, которое политика обещает журналировать. Номер,
     не содержимое: содержимого в журнале быть не должно. */
  console.log(`[admin] заявка №${id} удалена`);
}
