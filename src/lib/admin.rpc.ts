/**
 * Серверные функции админки — единственный мост между её интерфейсом и базой.
 *
 * Почему импорты базы динамические (`await import`), а не сверху файла:
 * этот модуль попадает и в клиентский бандл — там от него остаются заглушки,
 * которые делают запрос на сервер. Обычный импорт `db.server` наверху означал
 * бы, что сборщик обязан доказать ненужность `node:sqlite` в браузере.
 * Импорт внутри обработчика такой задачи не ставит вовсе: тела обработчиков
 * в клиент не попадают. Проверяется это не на веру — см. проверку бандла
 * в этапе сборки.
 *
 * ПРАВИЛО БЕЗОПАСНОСТИ: каждая функция, кроме входа, начинается с `assertAuth`.
 * Ни одна не полагается на то, что интерфейс её «не покажет» неавторизованному:
 * серверную функцию можно позвать напрямую из консоли браузера.
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie, getRequestHeader } from "@tanstack/react-start/server";

import type { LeadRecord, LeadStatus } from "../server/leads.server";

export type { LeadRecord, LeadStatus };

const COOKIE = "itagent_admin";

/** Бросает, если сессии нет. Возврата из этой функции достаточно как допуска. */
async function assertAuth(): Promise<void> {
  const { verifySession } = await import("../server/auth.server");
  if (!verifySession(getCookie(COOKIE))) {
    throw new Error("unauthorized");
  }
}

/**
 * Защита от запросов с чужого сайта. Cookie помечена `SameSite=Lax`, поэтому
 * межсайтовый POST её и так не получит, но проверка Origin — второй рубеж
 * на случай, если браузер посетителя старый или настройка потеряется.
 */
function assertSameOrigin(): void {
  const origin = getRequestHeader("origin");
  if (!origin) return; // обычная навигация без Origin — не межсайтовый запрос
  const host = getRequestHeader("host");
  if (!host) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("bad_origin");
  }
  if (originHost !== host) throw new Error("bad_origin");
}

/** Идёт ли запрос по HTTPS. За nginx определяется по X-Forwarded-Proto. */
function isSecureRequest(): boolean {
  const forwarded = getRequestHeader("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return false;
}

// ─────────────────────────────────────────────────────────────── доступ ─────

export type AuthState = { authorized: boolean; configured: boolean };

/** Состояние доступа. Зовётся из `beforeLoad` всех страниц админки. */
export const getAuthState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthState> => {
    const { verifySession, isConfigured, ensurePasswordFromEnv } =
      await import("../server/auth.server");
    ensurePasswordFromEnv();
    return {
      authorized: verifySession(getCookie(COOKIE)),
      configured: isConfigured(),
    };
  },
);

export type LoginOutcome = { ok: true } | { ok: false; message: string };

export const submitLogin = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => ({
    password: typeof data?.password === "string" ? data.password : "",
  }))
  .handler(async ({ data }): Promise<LoginOutcome> => {
    assertSameOrigin();

    const { login, SESSION_COOKIE_OPTIONS } = await import("../server/auth.server");
    const result = login(data.password);

    if (result.ok) {
      setCookie(COOKIE, result.token, {
        ...SESSION_COOKIE_OPTIONS,
        secure: isSecureRequest(),
      });
      return { ok: true };
    }

    if (result.reason === "not_configured") {
      return {
        ok: false,
        message:
          "Пароль ещё не задан. Задайте ADMIN_PASSWORD в окружении сервера и перезапустите его.",
      };
    }
    if (result.reason === "locked") {
      const minutes = Math.ceil((result.retryInMs ?? 0) / 60000);
      return { ok: false, message: `Слишком много попыток. Вход закрыт на ${minutes} мин.` };
    }
    return { ok: false, message: "Неверный пароль." };
  });

export const submitLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession, SESSION_COOKIE_OPTIONS } = await import("../server/auth.server");
  destroySession(getCookie(COOKIE));
  deleteCookie(COOKIE, { ...SESSION_COOKIE_OPTIONS, secure: isSecureRequest() });
  return { ok: true as const };
});

// ─────────────────────────────────────────────────────────────── заявки ─────

export type LeadsPage = {
  leads: LeadRecord[];
  counts: Record<LeadStatus | "all", number>;
  unread: number;
};

export const fetchLeads = createServerFn({ method: "GET" })
  .validator((data?: { status?: string }) => ({ status: data?.status ?? "all" }))
  .handler(async ({ data }): Promise<LeadsPage> => {
    await assertAuth();
    const { listLeads, statusCounts, unreadCount, LEAD_STATUSES } =
      await import("../server/leads.server");

    const status = (LEAD_STATUSES as readonly string[]).includes(data.status)
      ? (data.status as LeadStatus)
      : "all";

    return {
      leads: listLeads({ status }),
      counts: statusCounts(),
      unread: unreadCount(),
    };
  });

export const changeLeadStatus = createServerFn({ method: "POST" })
  .validator((data: { id: number; status: string }) => ({
    id: Number(data?.id),
    status: String(data?.status ?? ""),
  }))
  .handler(async ({ data }) => {
    await assertAuth();
    assertSameOrigin();
    const { setLeadStatus, LEAD_STATUSES } = await import("../server/leads.server");
    if (!(LEAD_STATUSES as readonly string[]).includes(data.status)) {
      throw new Error("bad_status");
    }
    setLeadStatus(data.id, data.status as LeadStatus);
    return { ok: true as const };
  });

export const saveLeadNote = createServerFn({ method: "POST" })
  .validator((data: { id: number; note: string }) => ({
    id: Number(data?.id),
    note: String(data?.note ?? ""),
  }))
  .handler(async ({ data }) => {
    await assertAuth();
    assertSameOrigin();
    const { setLeadNote } = await import("../server/leads.server");
    setLeadNote(data.id, data.note);
    return { ok: true as const };
  });

export const readLead = createServerFn({ method: "POST" })
  .validator((data: { id: number }) => ({ id: Number(data?.id) }))
  .handler(async ({ data }) => {
    await assertAuth();
    assertSameOrigin();
    const { markRead } = await import("../server/leads.server");
    markRead(data.id);
    return { ok: true as const };
  });

export const removeLead = createServerFn({ method: "POST" })
  .validator((data: { id: number }) => ({ id: Number(data?.id) }))
  .handler(async ({ data }) => {
    await assertAuth();
    assertSameOrigin();
    const { deleteLead } = await import("../server/leads.server");
    deleteLead(data.id);
    return { ok: true as const };
  });
