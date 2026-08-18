import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, RotateCcw, TriangleAlert } from "lucide-react";

import { uploadImage, type UploadedImage } from "./upload";

/**
 * Снимок в макете первого экрана.
 *
 * Отличие от обложки кейса — в том, что значит «пусто». У кейса без снимка
 * рисуется цветная заглушка, а здесь пустого состояния не бывает вовсе:
 * рамка на главной не может стоять без картинки. Поэтому «убрать» означает
 * «вернуть ту, что в коде», а не «оставить дыру», и написано это прямо.
 *
 * Превью показано в той же пропорции, в какой снимок будет кадрирован
 * на сайте. Иначе владелец загрузит вертикальное фото в горизонтальное окно
 * браузера, увидит его целиком в админке — и обрезанным на странице.
 */

type Props = {
  label: string;
  hint: string;
  /** Пропорция кадра: «16/10», «9/16». */
  ratio: string;
  /** Что сейчас показывается на сайте. */
  current: { url: string; width: number; height: number };
  /** Своя картинка загружена — можно вернуть исходную. */
  custom: boolean;
  onChange: (media: UploadedImage | null) => void;
};

export function ImageField({ label, hint, ratio, current, custom, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    const result = await uploadImage(file);
    setBusy(false);
    if (result.ok) onChange(result.media);
    else setError(result.message);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handle(file);
  }

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 text-xs text-muted-foreground/70">— {hint}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        /* Поле спрятано визуально, но остаётся в дереве доступности:
           без подписи скринридер объявит его безымянным. */
        aria-label={label}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handle(file);
          event.target.value = "";
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "mt-2 flex flex-wrap items-start gap-3 rounded-xl border-2 border-dashed p-3 transition " +
          (dragging ? "border-accent bg-accent-soft" : "border-border")
        }
      >
        <img
          src={current.url}
          width={current.width}
          height={current.height}
          alt=""
          style={{ aspectRatio: ratio }}
          className="w-32 shrink-0 rounded-lg border border-border object-cover"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Обрабатываем…
              </>
            ) : (
              <>
                <ImagePlus className="h-3.5 w-3.5" />
                {custom ? "Заменить снимок" : "Загрузить свой"}
              </>
            )}
          </button>

          {custom && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              вернуть исходный
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            {current.width}×{current.height}
            {custom ? " · ваш снимок" : " · пока стоит исходный"}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Можно перетащить файл сюда. Большой снимок ужмётся сам.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
