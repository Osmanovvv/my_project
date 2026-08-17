import { createFileRoute } from "@tanstack/react-router";

import { normalizeLead, validateLead, type Lead } from "../lib/lead";
import { formatLeadMessage, readTelegramConfig, sendTelegramMessage } from "../lib/telegram.server";

/**
 * POST /api/lead — приём заявки с формы и доставка в Telegram.
 *
 * Ответы:
 *   200 { ok: true }
 *   400/413/415 { ok: false, error }            — некорректный запрос
 *   422 { ok: false, error, fields }            — ошибки полей
 *   429 { ok: false, error: "rate_limited" }
 *   502 { ok: false, error: "delivery_failed" } — Telegram недоступен
 *   503 { ok: false, error: "not_configured" }  — не заданы переменные окружения
 *
 * Любая недоставленная заявка пишется в `console.error`, чтобы её можно было
 * поднять из логов — терять контакт клиента нельзя ни при каком сбое.
 */

const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 3, maxKeys: 500 };

/**
 * Ограничение частоты — best effort. На serverless-рантайме память живёт
 * в пределах инстанса, поэтому это защита от случайного спама, а не от атаки.
 */
const recentHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const fresh = (recentHits.get(key) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);

  if (fresh.length >= RATE_LIMIT.maxRequests) {
    recentHits.set(key, fresh);
    return true;
  }

  fresh.push(now);
  recentHits.set(key, fresh);

  if (recentHits.size > RATE_LIMIT.maxKeys) {
    for (const [otherKey, hits] of recentHits) {
      if (hits.every((at) => now - at >= RATE_LIMIT.windowMs)) recentHits.delete(otherKey);
    }
  }

  return false;
}

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

/** В лог — только то, что нужно, чтобы связаться с клиентом вручную. */
function logLead(reason: string, lead: Lead, detail?: string): void {
  console.error(
    `[lead] ${reason}${detail ? ` (${detail})` : ""} — ` +
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

  const config = readTelegramConfig();
  if (!config) {
    logLead("Telegram не настроен: нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID", lead);
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const result = await sendTelegramMessage(config, formatLeadMessage(lead));
  if (!result.ok) {
    logLead("не доставлено в Telegram", lead, result.detail);
    return json({ ok: false, error: "delivery_failed" }, 502);
  }

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
