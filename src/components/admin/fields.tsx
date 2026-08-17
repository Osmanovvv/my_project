import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Loader2, TriangleAlert } from "lucide-react";

import type { Saver } from "./use-saver";

/**
 * Поля и обвязка страниц контента.
 *
 * Раньше все шесть разделов жили на одной странице сворачивающимися
 * секциями. По замечанию владельца это оказалось неудобно: чтобы добраться
 * до нужного, приходилось сворачивать и разворачивать соседние, а длинные
 * формы всё равно требовали прокрутки мимо чужих полей. Теперь у каждого
 * раздела своя страница, а эти компоненты — то общее, что у них есть.
 */

/**
 * Счётчик длины под полем.
 *
 * Ограничение мягкое — ввести больше можно. Жёсткий запрет здесь вреден:
 * иногда длиннее действительно нужно, и решать должен владелец, посмотрев
 * на результат. А вот не предупредить нельзя: длинная надпись на кнопке
 * в шапке выдавливает пункты меню, длинное название шага сдвигает иконку
 * относительно трёх соседних карточек — увидеть это можно только на сайте,
 * а узнать причину неоткуда.
 */
function LengthHint({ value, limit }: { value: string; limit: number }) {
  const length = value.trim().length;
  const over = length > limit;
  return (
    <span
      className={
        "shrink-0 text-[11px] tabular-nums " +
        (over ? "text-amber-600" : "text-muted-foreground/60")
      }
      title={over ? `Длиннее ${limit} символов — вёрстка может поехать` : undefined}
    >
      {length}/{limit}
    </span>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
  limit,
  mono,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  placeholder?: string;
  /** Мягкий предел длины: показывает счётчик и предупреждает при превышении. */
  limit?: number;
  /** Моноширинный шрифт — для путей и служебных значений. */
  mono?: boolean;
}) {
  const over = limit !== undefined && value.trim().length > limit;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <span className="min-w-0 flex-1 text-xs text-muted-foreground/70">— {hint}</span>}
        {limit !== undefined && <LengthHint value={value} limit={limit} />}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={
          "mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring " +
          (mono ? "font-mono " : "") +
          (over ? "border-amber-500/60" : "border-input")
        }
      />
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  limit,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  limit?: number;
}) {
  const over = limit !== undefined && value.trim().length > limit;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <span className="min-w-0 flex-1 text-xs text-muted-foreground/70">— {hint}</span>}
        {limit !== undefined && <LengthHint value={value} limit={limit} />}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
        className={
          "mt-1.5 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring " +
          (over ? "border-amber-500/60" : "border-input")
        }
      />
    </div>
  );
}

/**
 * Предпросмотр строки с выделением звёздочками — прямо под полем.
 *
 * Без него владелец узнаёт о забытой звёздочке, только открыв сайт: в поле
 * лежит «Сайт, который *не теряет заявки», а на странице появляется голая
 * звёздочка посреди заголовка. Здесь непарная звёздочка видна сразу,
 * и рядом сказано, что с ней не так.
 */
export function AccentPreview({ value }: { value: string }) {
  const stars = (value.match(/\*/g) ?? []).length;
  const unbalanced = stars % 2 === 1;

  const parts = value.split(/(\*[^*]+\*)/g).filter(Boolean);

  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-[11px] text-muted-foreground/70">на сайте:</span>
      <span className="text-sm">
        {parts.map((part, i) =>
          part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
            <span key={i} className="text-accent">
              {part.slice(1, -1)}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </span>
      {unbalanced && (
        <span className="text-[11px] text-amber-600">
          звёздочка не закрыта — она попадёт на сайт
        </span>
      )}
    </div>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        step={1000}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none transition focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

/** Шапка страницы раздела: возврат в меню, название, пояснение. */
export function PageHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="space-y-3">
      <Link
        to="/admin/content"
        className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Контент
      </Link>
      <div>
        <h1 className="font-display text-xl tracking-tight">{title}</h1>
        {note && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}

/**
 * Полоса сохранения, прилипшая к низу экрана.
 *
 * Именно прилипшая: формы разделов длиннее экрана, и кнопка, уехавшая
 * под сгиб, заставляла бы прокручивать страницу до конца после каждой
 * правки.
 */
export function SaveBar({ state, dirty }: { state: Saver; dirty: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={state.submit}
          disabled={state.busy || !dirty}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {state.busy ? "Сохраняем…" : "Сохранить"}
        </button>

        {dirty && !state.busy && (
          <span className="text-xs text-muted-foreground">есть несохранённые правки</span>
        )}
        {state.done && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            сохранено, на сайте уже видно
          </span>
        )}
        {state.error && (
          <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" />
            {state.error}
          </span>
        )}
      </div>
    </div>
  );
}

/** Карточка вокруг одной сущности внутри раздела: услуги, тарифа, вопроса. */
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
