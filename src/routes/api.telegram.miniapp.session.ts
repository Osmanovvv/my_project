import { createFileRoute } from "@tanstack/react-router";
import { isSameOriginRequest, readJsonRequest } from "../server/http-security.server";
import { currentTelegramEnvironment } from "../server/telegram-data.server";

import {
  createTelegramMiniAppSession,
  miniAppSessionCookie,
  readTelegramMiniAppSession,
} from "../server/telegram-miniapp.server";

const MAX_BODY_BYTES = 24_000;

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

function secureRequest(request: Request): boolean {
  if (currentTelegramEnvironment() === "production") return true;
  if (request.url.startsWith("https://")) return true;
  return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}

async function handleSession({ request }: { request: Request }): Promise<Response> {
  if (request.method === "GET") {
    const session = readTelegramMiniAppSession(request.headers.get("cookie"));
    if (!session) return json({ ok: false, error: "unauthorized" }, 401);
    return json({
      ok: true,
      environment: session.environment,
      user: session.user,
      expires_at: session.expiresAt,
    });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, POST" });
  }

  if (!isSameOriginRequest(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const body = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!body.ok) return json({ ok: false, error: body.error }, body.status);
  const initData = body.value.initData;
  if (typeof initData !== "string" || !initData)
    return json({ ok: false, error: "bad_request" }, 400);

  try {
    const session = createTelegramMiniAppSession(initData);
    const token = session.sessionToken;
    if (!token) return json({ ok: false, error: "session_failed" }, 500);
    return json(
      {
        ok: true,
        environment: session.environment,
        user: session.user,
        expires_at: session.expiresAt,
      },
      200,
      {
        "set-cookie": miniAppSessionCookie(token, session.expiresAt, secureRequest(request)),
      },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "telegram_miniapp_session_failed";
    const publicError =
      code === "telegram_miniapp_not_configured"
        ? "not_configured"
        : code === "telegram_miniapp_test_user_not_allowed"
          ? "test_user_not_allowed"
          : code.includes("expired") || code.includes("auth_date")
            ? "init_data_expired"
            : "invalid_init_data";
    const status =
      publicError === "not_configured" ? 503 : publicError === "test_user_not_allowed" ? 403 : 401;
    return json({ ok: false, error: publicError }, status);
  }
}

export const Route = createFileRoute("/api/telegram/miniapp/session")({
  server: {
    handlers: {
      GET: handleSession,
      POST: handleSession,
      PUT: handleSession,
      PATCH: handleSession,
      DELETE: handleSession,
      HEAD: handleSession,
      OPTIONS: handleSession,
    },
  },
});
