import { createFileRoute } from "@tanstack/react-router";

import { verifySession } from "../server/auth.server";
import { saveImage, mediaUrl, MAX_UPLOAD_BYTES } from "../server/media.server";

/**
 * POST /api/media — приём картинки из админки.
 *
 * Отдельный роут, а не серверная функция: файл идёт как `multipart/form-data`,
 * а серверные функции работают с JSON. Здесь же можно ограничить размер тела
 * до того, как оно окажется в памяти целиком.
 *
 * Ответы:
 *   200 { ok: true, media }
 *   401 — нет сессии
 *   413 — файл больше лимита
 *   415 — не картинка (проверяется по содержимому, не по расширению)
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function sessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "itagent_admin") return rest.join("=") || undefined;
  }
  return undefined;
}

async function handleUpload({ request }: { request: Request }): Promise<Response> {
  if (!verifySession(sessionToken(request))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  /* Проверка Origin: загрузка меняет состояние, и запрос с чужой страницы
     сюда попадать не должен. */
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ ok: false, error: "bad_origin" }, 403);
    } catch {
      return json({ ok: false, error: "bad_origin" }, 403);
    }
  }

  /* Ранний отсев по заголовку: не тащим в память заведомо большой файл.
     Настоящая проверка всё равно ниже — заголовку верить нельзя. */
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_UPLOAD_BYTES * 1.2) {
    return json({ ok: false, error: "too_large" }, 413);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  if (!file) return json({ ok: false, error: "no_file" }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = saveImage(bytes, file.name);

  if (!result.ok) {
    const status = result.reason === "too_large" ? 413 : 415;
    return json({ ok: false, error: result.reason }, status);
  }

  const { media } = result;
  return json(
    {
      ok: true,
      media: {
        id: media.id,
        url: mediaUrl(media),
        width: media.width,
        height: media.height,
        bytes: media.bytes,
      },
    },
    200,
  );
}

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      POST: handleUpload,
    },
  },
});
