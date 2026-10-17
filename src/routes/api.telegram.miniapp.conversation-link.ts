import { createFileRoute } from "@tanstack/react-router";
import { isSameOriginRequest, readJsonRequest } from "../server/http-security.server";

import { TELEGRAM_BOT_USERNAME } from "../data/contacts";
import {
  createTelegramLeadLink,
  getTelegramMiniAppConversation,
} from "../server/telegram-data.server";
import { readTelegramMiniAppSession } from "../server/telegram-miniapp.server";

const MAX_BODY_BYTES = 4_000;

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

async function handleConversationLink({ request }: { request: Request }): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  const session = readTelegramMiniAppSession(request.headers.get("cookie"));
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  if (!isSameOriginRequest(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const body = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!body.ok) return json({ ok: false, error: body.error }, body.status);
  const conversationId = body.value.conversation_id;
  if (
    typeof conversationId !== "number" ||
    !Number.isSafeInteger(conversationId) ||
    conversationId < 1
  ) {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const owned = getTelegramMiniAppConversation({
    environment: session.environment,
    telegramContactId: session.contactId,
    conversationId,
  });
  if (!owned) return json({ ok: false, error: "not_found" }, 404);

  try {
    const token = createTelegramLeadLink({
      environment: session.environment,
      leadId: owned.leadId,
    });
    const username = (process.env.TELEGRAM_BOT_USERNAME?.trim() || TELEGRAM_BOT_USERNAME).replace(
      /^@/,
      "",
    );
    if (!/^[A-Za-z0-9_]{5,32}$/.test(username))
      return json({ ok: false, error: "bot_not_configured" }, 503);
    return json({
      ok: true,
      telegram_url: `https://t.me/${username}?start=lead_${token}`,
    });
  } catch (error) {
    console.error(
      "[miniapp] не удалось создать ссылку на обращение",
      error instanceof Error ? error.message : "conversation_link_failed",
    );
    return json({ ok: false, error: "server_error" }, 500);
  }
}

export const Route = createFileRoute("/api/telegram/miniapp/conversation-link")({
  server: {
    handlers: {
      POST: handleConversationLink,
      GET: handleConversationLink,
      PUT: handleConversationLink,
      PATCH: handleConversationLink,
      DELETE: handleConversationLink,
      HEAD: handleConversationLink,
      OPTIONS: handleConversationLink,
    },
  },
});
