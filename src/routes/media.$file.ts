import { createFileRoute } from "@tanstack/react-router";

import { readMediaFile } from "../server/media.server";

/**
 * GET /media/<хеш>.<расширение> — раздача загруженных картинок.
 *
 * Файлы лежат вне `public/`, поэтому статикой не раздаются: `public/`
 * пересобирается при каждой сборке, и загруженное там бы не пережило деплой.
 *
 * Кеш выставлен НАВСЕГДА и `immutable`: в имени файла лежит хеш содержимого,
 * поэтому изменённая картинка получает другой адрес. Браузер и nginx могут
 * держать её сколько угодно и не переспрашивать.
 *
 * На боевом сервере этот роут можно перекрыть отдачей через nginx напрямую —
 * будет быстрее. Но и без такой настройки всё работает, и это намеренно:
 * забытая строка в конфиге не должна ломать картинки на сайте.
 */

const MIME: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

function handleMedia({ params }: { params: { file: string } }): Response {
  const name = params.file;

  /* Разбор имени и защита от выхода из каталога — внутри `readMediaFile`:
     имя обязано быть ровно хешем с расширением. */
  const bytes = readMediaFile(name);
  if (!bytes) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const ext = name.split(".").pop() ?? "";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "content-length": String(bytes.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

export const Route = createFileRoute("/media/$file")({
  server: {
    handlers: {
      GET: handleMedia,
    },
  },
});
