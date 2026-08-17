import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, Trash2, TriangleAlert } from "lucide-react";

import {
  GRADIENT_KEYS,
  GRADIENT_LABELS,
  GRADIENTS,
  CASE_PATTERNS,
  PATTERN_LABELS,
  type CasePattern,
  type GradientKey,
} from "../../data/case-presets";
import { Pattern } from "../site/Portfolio";

/**
 * Обложка кейса: загрузка фотографии, а градиент — запасной вариант.
 *
 * Отдельной медиатеки нет намеренно. Фото нужно ровно в одном месте —
 * там, где его вставляют; отдельная страница со всеми картинками добавила бы
 * шаг «загрузить, найти, выбрать» вместо «перетащить сюда».
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

export type CoverValue = {
  id: number;
  url: string;
  width: number;
  height: number;
} | null;

type Props = {
  value: CoverValue;
  onChange: (next: CoverValue) => void;
  gradient: GradientKey;
  pattern: CasePattern;
  onGradientChange: (next: GradientKey) => void;
  onPatternChange: (next: CasePattern) => void;
};

/** Ужимает файл и отдаёт WebP; если браузер не умеет — JPEG. */
async function compress(file: File): Promise<Blob> {
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

export function CoverField({
  value,
  onChange,
  gradient,
  pattern,
  onGradientChange,
  onPatternChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await compress(file);

      const form = new FormData();
      form.append("file", blob, "cover.webp");

      const response = await fetch("/api/media", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as {
        ok: boolean;
        media?: { id: number; url: string; width: number; height: number };
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.media) {
        setError(messageFor(payload?.error, response.status));
        return;
      }
      onChange(payload.media);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "decode"
          ? "Не удалось прочитать файл. Если это снимок с айфона в формате HEIC, сохраните его как JPEG."
          : "Не удалось обработать картинку. Попробуйте другой файл.",
      );
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        /* Поле спрятано визуально, но остаётся в дереве доступности:
           без подписи скринридер объявит его безымянным. */
        aria-label="Файл обложки"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />

      {value ? (
        <div>
          <span className="text-xs text-muted-foreground">Фотография</span>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <img
              src={value.url}
              width={value.width}
              height={value.height}
              alt="Обложка кейса"
              className="aspect-[4/3] w-44 rounded-xl border border-border object-cover"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
              >
                {busy ? "Загружаем…" : "Заменить"}
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Убрать
              </button>
              <p className="max-w-40 text-xs text-muted-foreground">
                {value.width}×{value.height}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <span className="text-xs text-muted-foreground">Фотография</span>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={
              "mt-2 rounded-xl border-2 border-dashed p-6 text-center transition " +
              (dragging ? "border-accent bg-accent-soft" : "border-border")
            }
          >
            {busy ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Обрабатываем снимок…
              </div>
            ) : (
              <>
                <ImagePlus className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                <p className="mt-2 text-sm">
                  Перетащите снимок сюда или{" "}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="-my-1 rounded px-1 py-2 font-medium text-accent underline underline-offset-4"
                  >
                    выберите файл
                  </button>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPEG, PNG или WebP. Большой снимок ужмётся сам — грузить уменьшенный заранее не
                  нужно.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}

      {/* Градиент показывается только пока снимка нет: это заглушка,
          чтобы карточка не была пустой, а не второй способ оформления.
          Загрузили фото — выбор цвета исчезает и не отвлекает. */}
      {!value && (
        <div className="space-y-3 rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            Пока снимка нет, на карточке будет цветная заглушка.
          </p>

          <div>
            <span className="text-xs text-muted-foreground">Цвет</span>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {GRADIENT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onGradientChange(key)}
                  aria-pressed={gradient === key}
                  title={GRADIENT_LABELS[key]}
                  className={
                    "aspect-[4/3] overflow-hidden rounded-lg border-2 transition " +
                    (gradient === key ? "border-accent" : "border-transparent hover:border-border")
                  }
                >
                  <span className={`block h-full w-full bg-gradient-to-br ${GRADIENTS[key]}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground">Узор</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CASE_PATTERNS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onPatternChange(kind)}
                  aria-pressed={pattern === kind}
                  className={
                    "rounded-lg px-2.5 py-1.5 text-xs transition " +
                    (pattern === kind
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  {PATTERN_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`relative aspect-[4/3] w-40 overflow-hidden rounded-lg bg-gradient-to-br ${GRADIENTS[gradient]}`}
          >
            <Pattern kind={pattern} />
          </div>
        </div>
      )}
    </div>
  );
}

function messageFor(error: string | undefined, status: number): string {
  if (error === "too_large" || status === 413) {
    return "Файл слишком большой даже после сжатия. Попробуйте снимок поменьше.";
  }
  if (error === "bad_format" || status === 415) {
    return "Это не картинка или формат не поддерживается. Нужен JPEG, PNG или WebP.";
  }
  if (status === 401) return "Сессия закончилась. Обновите страницу и войдите заново.";
  return "Не удалось загрузить. Проверьте связь и попробуйте ещё раз.";
}
