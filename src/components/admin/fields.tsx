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

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground/70">— {hint}</span>}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
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
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
        className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
      />
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
