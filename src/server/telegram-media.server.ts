/** Ограничения Telegram-медиа до появления отдельного object storage. */

export const TELEGRAM_MEDIA_LIMITS = {
  photo: 10 * 1024 * 1024,
  file: 20 * 1024 * 1024,
  voice: 10 * 1024 * 1024,
} as const;

const FILE_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const FILE_EXTENSIONS = /\.(?:pdf|zip|7z|rar|doc|docx|xls|xlsx|txt|csv|jpe?g|png|webp)$/i;

export type TelegramMediaValidation =
  | { ok: true }
  | { ok: false; code: "too_large" | "unsupported_type" | "invalid_metadata"; message: string };

export function validateTelegramMedia(
  kind: "photo" | "file" | "voice",
  media: Record<string, unknown> | undefined,
): TelegramMediaValidation {
  if (!media) {
    return {
      ok: false,
      code: "invalid_metadata",
      message: "Не удалось прочитать данные вложения.",
    };
  }
  const bytes = media.bytes;
  if (bytes != null && (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0)) {
    return { ok: false, code: "invalid_metadata", message: "Размер вложения указан некорректно." };
  }
  const limit = TELEGRAM_MEDIA_LIMITS[kind];
  if (typeof bytes === "number" && bytes > limit) {
    return {
      ok: false,
      code: "too_large",
      message: `Вложение слишком большое. Максимальный размер: ${Math.round(limit / 1024 / 1024)} МБ.`,
    };
  }
  if (kind === "photo") return { ok: true };

  const mime = typeof media.mime === "string" ? media.mime.trim().toLowerCase() : "";
  const name = typeof media.name === "string" ? media.name.trim() : "";
  if (kind === "voice") {
    if (!mime || mime.startsWith("audio/")) return { ok: true };
    return {
      ok: false,
      code: "unsupported_type",
      message: "Поддерживаются только аудиосообщения.",
    };
  }
  if (FILE_MIME_TYPES.has(mime) || (!mime && FILE_EXTENSIONS.test(name))) return { ok: true };
  return {
    ok: false,
    code: "unsupported_type",
    message:
      "Тип файла не поддерживается. Разрешены PDF, DOC/DOCX, XLS/XLSX, TXT, CSV, ZIP, RAR, 7Z и изображения.",
  };
}

export function mediaDescription(
  kind: "photo" | "file" | "voice",
  media?: Record<string, unknown>,
): string {
  const name = typeof media?.name === "string" && media.name ? ` «${media.name.slice(0, 80)}»` : "";
  const bytes = typeof media?.bytes === "number" ? `, ${Math.ceil(media.bytes / 1024)} КБ` : "";
  return `${kind === "photo" ? "фото" : kind === "voice" ? "голосовое сообщение" : `файл${name}`}${bytes}`;
}
