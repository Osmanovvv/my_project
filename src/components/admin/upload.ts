/**
 * Загрузка картинки из админки: сжатие в браузере и отправка на сервер.
 *
 * Вынесено из `CoverField`, потому что снимок теперь ставят не только
 * на обложку кейса, но и в макеты первого экрана. Две копии этого кода
 * разошлись бы на первой же правке — например, в пределе размера.
 *
 * КАРТИНКА УЖИМАЕТСЯ В БРАУЗЕРЕ, до отправки. Причины две:
 *   1. Снимок с телефона весит 4–8 МБ, и на мобильном интернете его
 *      загрузка займёт минуту. После сжатия — секунды.
 *   2. Иначе сжимать пришлось бы на сервере, а это нативный модуль
 *      (sharp), который на Windows не собирается — та же беда, из-за
 *      которой отвергли better-sqlite3.
 */

/** Длинная сторона после сжатия. Хватает на экран с двойной плотностью. */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export type UploadedImage = { id: number; url: string; width: number; height: number };

/** Ужимает файл и отдаёт WebP; если браузер не умеет — JPEG. */
export async function compress(file: File): Promise<Blob> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("no-canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", QUALITY);
  });

  /* Safari научился сохранять в WebP только в 16-й версии. На старых
     `toBlob` отдаёт PNG или null — тогда берём JPEG, он есть везде. */
  if (blob && blob.type === "image/webp") return blob;

  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", QUALITY);
  });
  if (!jpeg) throw new Error("no-encode");
  return jpeg;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* HEIC с айфона и битые файлы сюда не пролезают — пробуем через <img>,
         вдруг браузер умеет показать то, что не смог разобрать напрямую. */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type UploadResult = { ok: true; media: UploadedImage } | { ok: false; message: string };

/** Сжать и отправить. Ошибки возвращаются текстом, готовым к показу. */
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    const blob = await compress(file);

    const form = new FormData();
    form.append("file", blob, "image.webp");

    const response = await fetch("/api/media", { method: "POST", body: form });
    const payload = (await response.json().catch(() => null)) as {
      ok: boolean;
      media?: UploadedImage;
      error?: string;
    } | null;

    if (!response.ok || !payload?.ok || !payload.media) {
      return { ok: false, message: messageFor(payload?.error, response.status) };
    }
    return { ok: true, media: payload.media };
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error && cause.message === "decode"
          ? "Не удалось прочитать файл. Если это снимок с айфона в формате HEIC, сохраните его как JPEG."
          : "Не удалось обработать картинку. Попробуйте другой файл.",
    };
  }
}

export function messageFor(error: string | undefined, status: number): string {
  if (error === "too_large" || status === 413) {
    return "Файл слишком большой даже после сжатия. Попробуйте снимок поменьше.";
  }
  if (error === "bad_format" || status === 415) {
    return "Это не картинка или формат не поддерживается. Нужен JPEG, PNG или WebP.";
  }
  if (status === 401) return "Сессия закончилась. Обновите страницу и войдите заново.";
  return "Не удалось загрузить. Проверьте связь и попробуйте ещё раз.";
}
