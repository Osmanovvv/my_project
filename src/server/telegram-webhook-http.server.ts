import {
  acceptTelegramWebhookUpdate,
  authenticateTelegramWebhook,
  TELEGRAM_WEBHOOK_MAX_UPDATE_BYTES,
} from "./telegram-webhook.server";
import { processPendingTelegramInbox } from "./telegram-client-flow.server";

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

/** Читаем поток с лимитом, а не request.text() с проверкой после выделения памяти. */
async function readLimitedBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > TELEGRAM_WEBHOOK_MAX_UPDATE_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > TELEGRAM_WEBHOOK_MAX_UPDATE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

export async function handleTelegramWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST")
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  // Отказ по секрету до чтения любого тела запроса.
  const authError = authenticateTelegramWebhook(request);
  if (authError) return json({ ok: false, error: authError.error }, authError.status);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }
  let rawBody: string | null;
  try {
    rawBody = await readLimitedBody(request);
  } catch {
    return json({ ok: false, error: "bad_body" }, 400);
  }
  if (rawBody === null) return json({ ok: false, error: "payload_too_large" }, 413);
  const result = acceptTelegramWebhookUpdate(request, rawBody);
  if (!result.ok) return json({ ok: false, error: result.error }, result.status);
  if (!result.duplicate) {
    try {
      processPendingTelegramInbox();
    } catch (error) {
      // Update уже принят в inbox; Telegram не должен повторять его из-за
      // временной ошибки бизнес-обработчика. Повторная обработка произойдёт
      // следующим тиком при запуске client/operator flow.
      console.error(
        JSON.stringify({
          scope: "telegram.inbox",
          event: "processor_failed",
          code: error instanceof Error ? error.message : "processor_failed",
        }),
      );
    }
  }
  if (result.callbackQueryId) {
    // Это только ack нажатия, а не подтверждение доставки сообщения клиенту.
    return json(
      {
        method: "answerCallbackQuery",
        callback_query_id: result.callbackQueryId,
        ...(result.callbackRejected
          ? { text: "Кнопка устарела или недоступна. Откройте меню заново.", show_alert: true }
          : {}),
      },
      200,
    );
  }
  return json({ ok: true, duplicate: result.duplicate, ignored: result.ignored }, 200);
}
