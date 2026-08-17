import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Карточка одной сущности внутри раздела: услуги, тарифа, вопроса.
 *
 * Открыта всегда ОДНА — открытие соседней закрывает предыдущую. Это не
 * прихоть: без этого страница услуг разворачивается в семь форм подряд,
 * и до нужной снова надо прокручивать мимо чужих полей. Ровно та жалоба,
 * из-за которой раздел контента и разнесли по отдельным страницам.
 *
 * В свёрнутом заголовке видна сводка — цена и срок, число пунктов, начало
 * ответа. Иначе, чтобы вспомнить, что внутри, карточку приходится открывать,
 * и сворачивание не помогает, а мешает.
 *
 * Точка у заголовка отмечает несохранённое: свернув карточку с правками,
 * легко забыть про них и уйти со страницы.
 */

type Props = {
  title: string;
  /** Что показать в свёрнутом виде: «от 60 000 ₽ · 5–10 дней». */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  /** В карточке есть несохранённые изменения. */
  dirty?: boolean;
  /** Кнопки справа в заголовке: удалить, переставить. Видны всегда. */
  actions?: ReactNode;
  children: ReactNode;
};

export function EntityCard({ title, summary, open, onToggle, dirty, actions, children }: Props) {
  return (
    <div
      className={
        "overflow-hidden rounded-xl border bg-background transition " +
        (open ? "border-accent/40" : "border-border")
      }
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/50"
        >
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
              (open ? "" : "-rotate-90")
            }
            aria-hidden="true"
          />

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{title}</span>
              {dirty && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  title="Есть несохранённые правки"
                />
              )}
            </span>
            {!open && summary && (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>
            )}
          </span>
        </button>

        {actions && <div className="flex shrink-0 items-center pr-2">{actions}</div>}
      </div>

      {/* Содержимое размонтируется, а не прячется стилями: в свёрнутых
          карточках лежат поля ввода, и скрытые они всё равно ловили бы
          фокус при переходе по Tab. */}
      {open && <div className="space-y-3 border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}
