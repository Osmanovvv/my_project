import { createFileRoute } from "@tanstack/react-router";
import { isSameOriginRequest, readJsonRequest } from "../server/http-security.server";

import { normalizeLead, validateLead, type LeadErrors } from "../lib/lead";
import {
  createTelegramLeadFromDraft,
  listTelegramMiniAppLeads,
} from "../server/telegram-data.server";
import { readTelegramMiniAppSession } from "../server/telegram-miniapp.server";

const MAX_BODY_BYTES = 24_000;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,255}$/;

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function sessionFrom(request: Request) {
  return readTelegramMiniAppSession(request.headers.get("cookie"));
}

function operationKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  return IDEMPOTENCY_KEY_RE.test(key) ? key : "";
}

async function handleLeads({ request }: { request: Request }): Promise<Response> {
  const session = sessionFrom(request);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

  if (request.method === "GET") {
    return json({
      ok: true,
      leads: listTelegramMiniAppLeads({
        environment: session.environment,
        telegramContactId: session.contactId,
      }),
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, POST" });
  }

  if (!isSameOriginRequest(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.status);
  const body = parsed.value;

  const lead = normalizeLead({
    name: body.name,
    contact: body.contact,
    task: body.task,
    page: "/miniapp",
    source: "telegram_miniapp",
    source_detail: "telegram_session",
    consent: body.consent === true,
  });
  const fields: LeadErrors = validateLead(lead);
  if (Object.keys(fields).length > 0) {
    return json({ ok: false, error: "validation_failed", fields }, 422);
  }

  const key = operationKey(request);
  if (!key) return json({ ok: false, error: "invalid_idempotency_key" }, 400);

  try {
    const result = createTelegramLeadFromDraft({
      environment: session.environment,
      telegramUserId: session.user.id,
      chatId: session.user.id,
      operationKey: `miniapp:${key}`,
      draft: { ...lead, step: "summary" },
    });
    return json({
      ok: true,
      lead_id: result.leadId,
      conversation_id: result.conversationId,
      duplicate: result.duplicate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "miniapp_lead_failed";
    if (message === "operation_key принадлежит другому клиенту")
      return json({ ok: false, error: "idempotency_key_owner_mismatch" }, 409);
    if (message === "заявка без согласия на обработку данных")
      return json({ ok: false, error: "consent_required" }, 422);
    console.error("[miniapp] не удалось сохранить заявку", message);
    return json({ ok: false, error: "server_error" }, 500);
  }
}

export const Route = createFileRoute("/api/telegram/miniapp/leads")({
  server: {
    handlers: {
      GET: handleLeads,
      POST: handleLeads,
      PUT: handleLeads,
      PATCH: handleLeads,
      DELETE: handleLeads,
      HEAD: handleLeads,
      OPTIONS: handleLeads,
    },
  },
});
