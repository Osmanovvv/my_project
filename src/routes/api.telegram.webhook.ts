import { createFileRoute } from "@tanstack/react-router";

import { handleTelegramWebhook } from "../server/telegram-webhook-http.server";

const handle = ({ request }: { request: Request }) => handleTelegramWebhook(request);

export const Route = createFileRoute("/api/telegram/webhook")({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      HEAD: handle,
      OPTIONS: handle,
    },
  },
});
