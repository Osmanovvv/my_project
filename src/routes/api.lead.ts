import { createFileRoute } from "@tanstack/react-router";

import { normalizeLead, validateLead, type Lead } from "../lib/lead";
import { formatLeadMessage, readTelegramConfig, sendTelegramMessage } from "../lib/telegram.server";
import { insertLead, markDelivery, purgeExpiredLeads } from "../server/leads.server";

/**
 * POST /api/lead — приём заявки: сохранение в базу и доставка в Telegram.
 *
 * ПОРЯДОК ВАЖЕН: сначала запись в базу, потом отправка. Раньше единственной
 * копией заявки был чат Telegram, и при сбое доставки контакт клиента оставался
 * только в `console.error` — то есть терялся. Теперь база принимает заявку
 * первой, а Telegram работает уведомлением.
 *
 * Ответы:
 *   200 { ok: true }                            — заявка принята хотя бы одним каналом
 *   400/413/415 { ok: false, error }            — некорректный запрос
 *   422 { ok: false, error, fields }            — ошибки полей, включая
 *                                                 не отмеченное согласие
 *   429 { ok: false, error: "rate_limited" }
 *   502 { ok: false, error: "delivery_failed" } — не сохранилась И не доставилась
 *
 * ИЗМЕНЕНИЕ ПОВЕДЕНИЯ. Ответы 503 `not_configured` больше нет, а 502 отдаётся
 * только когда отказали ОБА канала. Если Telegram не настроен или недоступен,
 * но заявка легла в базу — посетитель видит успех, и это правда: заявку
 * получили, она ждёт в админке с отметкой о недоставке. Говорить человеку
 * «не получилось, напишите позже», когда его контакт уже у нас, — вранье,
 * которое стоит клиента.
 */

const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 3, maxKeys: 500 };

/**
 * Ограничение частоты — best effort. На serverless-рантайме память живёт
 * в пределах инстанса, поэтому это защита от случайного спама, а не от атаки.
 *
 * IP-адрес — персональные данные, и политика обещает держать его в памяти
 * не дольше минуты. Поэтому просроченные адреса вычищаются при КАЖДОМ
 * вызове, а не только когда таблица переполнится: раньше адрес единственного
 * за день посетителя лежал здесь до перезапуска процесса. Таблица маленькая
 * (не больше `maxKeys`), обход дешёвый.
 */
const recentHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();

  for (const [otherKey, hits] of recentHits) {
    if (otherKey !== key && hits.every((at) => now - at >= RATE_LIMIT.windowMs)) {
      recentHits.delete(otherKey);
    }
  }

  const fresh = (recentHits.get(key) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);

  if (fresh.length >= RATE_LIMIT.maxRequests) {
    recentHits.set(key, fresh);
    return true;
  }

  fresh.push(now);
  recentHits.set(key, fresh);

  /* Страховка от наплыва разных адресов: всё равно не держим больше maxKeys. */
  if (recentHits.size > RATE_LIMIT.maxKeys) {
    const oldest = recentHits.keys().next().value;
    if (oldest !== undefined) recentHits.delete(oldest);
  }

  return false;
}

/**
 * Адрес посетителя — из заголовков прокси. Nginx перед приложением ОБЯЗАН
 * пробрасывать X-Forwarded-For (см. DEPLOY.md), иначе все посетители
 * окажутся в одной корзине "unknown" и лимит «3 в минуту» станет общим
 * на весь сайт: четвёртый человек за минуту получит отказ.
 */
function clientKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("cf-connecting-ip") ?? forwarded ?? "unknown";
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * В лог — содержимое заявки ТОЛЬКО если она не записалась в базу: тогда
 * журнал — последняя копия, и потерять её значит потерять клиента.
 *
 * Если заявка в базе, в журнал идёт её номер и причина. Раньше имя,
 * контакт и текст задачи печатались и при ненастроенном Telegram — то есть
 * в штатном режиме персональные данные копились в journald без срока,
 * а политика обещала, что журналы содержат только адрес и время.
 */
function logLead(reason: string, lead: Lead, leadId: number, detail?: string): void {
  const why = `[lead] ${reason}${detail ? ` (${detail})` : ""}`;
  if (leadId) {
    console.error(`${why} — заявка №${leadId} сохранена в базе`);
    return;
  }
  console.error(
    `${why} — В БАЗУ НЕ ЗАПИСАНА, единственная копия здесь: ` +
      `имя: ${lead.name}; контакт: ${lead.contact}; страница: ${lead.page}; задача: ${lead.task || "—"}`,
  );
}

async function handleLead({ request }: { request: Request }): Promise<Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // Honeypot: поле спрятано от людей, заполняют его только боты.
  // Отвечаем успехом, чтобы спамер не подбирал обход.
  const honeypot = (parsed as Record<string, unknown> | null)?.company;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return json({ ok: true }, 200);
  }

  const lead = normalizeLead(parsed);
  const fields = validateLead(lead);
  if (Object.keys(fields).length > 0) {
    return json({ ok: false, error: "validation_failed", fields }, 422);
  }

  if (isRateLimited(clientKey(request))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  /* Шаг 1. База. Падение здесь не прерывает обработку: Telegram ещё может
     доставить заявку, и терять её из-за проблем с диском незачем. */
  let leadId = 0;
  try {
    leadId = insertLead(lead);
    /* Срок хранения из политики поддерживается здесь же: новая заявка —
       повод убрать те, что старше трёх лет. Сбой чистки не должен
       мешать приёму, поэтому она в своём try. */
    try {
      const purged = purgeExpiredLeads();
      if (purged > 0) console.log(`[lead] удалено заявок старше срока хранения: ${purged}`);
    } catch (error) {
      console.error("[lead] чистка старых заявок не удалась", error);
    }
  } catch (error) {
    logLead("не удалось записать в базу", lead, 0, String(error));
  }

  /* Шаг 2. Уведомление. */
  const config = readTelegramConfig();
  if (!config) {
    logLead("Telegram не настроен: нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID", lead, leadId);
    if (leadId) markDelivery(leadId, false, "не настроен TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID");
    return leadId ? json({ ok: true }, 200) : json({ ok: false, error: "delivery_failed" }, 502);
  }

  const result = await sendTelegramMessage(config, formatLeadMessage(lead));
  if (!result.ok) {
    logLead("не доставлено в Telegram", lead, leadId, result.detail);
    if (leadId) markDelivery(leadId, false, result.detail ?? "неизвестная ошибка");
    return leadId ? json({ ok: true }, 200) : json({ ok: false, error: "delivery_failed" }, 502);
  }

  if (leadId) markDelivery(leadId, true);
  return json({ ok: true }, 200);
}

function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
    status: 405,
    headers: {
      "content-type": "application/json; charset=utf-8",
      allow: "POST",
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/lead")({
  server: {
    handlers: {
      POST: handleLead,
      GET: methodNotAllowed,
    },
  },
});
