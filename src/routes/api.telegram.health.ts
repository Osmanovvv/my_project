import { createFileRoute } from "@tanstack/react-router";

import { getTelegramTransportHealth } from "../server/telegram-health.server";

function json(body: unknown, status: number, allow?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(allow ? { allow } : {}),
    },
  });
}

function handleHealth({ request }: { request: Request }): Response {
  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, "GET");
  }
  const health = getTelegramTransportHealth();
  return json(health, health.ok ? 200 : 503);
}

export const Route = createFileRoute("/api/telegram/health")({
  server: {
    handlers: {
      GET: handleHealth,
      POST: handleHealth,
      PUT: handleHealth,
      PATCH: handleHealth,
      DELETE: handleHealth,
      HEAD: handleHealth,
      OPTIONS: handleHealth,
    },
  },
});
