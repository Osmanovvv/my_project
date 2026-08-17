import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Сворачиваемая секция формы.
 *
 * Владелец просил «чтобы не объёмно было, сворачивать и разворачивать».
 * У кейса полтора десятка полей, и вываленные разом они дают форму
 * на три экрана, в которой не видно, что уже заполнено.
 *
 * Два решения делают её полезной, а не просто складной:
 *
 * 1. В свёрнутом заголовке видна СВОДКА — «3 пункта», «4 недели».
 *    Иначе, чтобы вспомнить, что внутри, секцию приходится открывать,
 *    и сворачивание теряет смысл.
 *
 * 2. Состояние запоминается между заходами (localStorage). Человек
 *    сворачивает то, что для него редко, и не хочет делать это заново
 *    при каждом открытии формы.
 */

type Props = {
  /** Ключ для запоминания состояния. Уникален в пределах формы. */
  id: string;
  title: string;
  /** Короткая сводка в свёрнутом виде: что внутри заполнено. */
  summary?: string;
  /**
   * Открыта ли секция при первом заходе, пока выбор не сохранён.
   *
   * По умолчанию — закрыта. Открытыми должны быть только те, что нужны
   * почти всегда; иначе смысл сворачивания теряется: форма снова
   * разворачивается в простыню, ради избавления от которой всё и делалось.
   */
  defaultOpen?: boolean;
  children: ReactNode;
};

const STORAGE_PREFIX = "itagent-admin-section:";

export function Section({ id, title, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  /* Читаем сохранённое состояние после монтирования, а не при инициализации:
     на сервере localStorage нет, и попытка учесть его в первом рендере
     разошлась бы с разметкой при гидратации. */
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (saved === "1") setOpen(true);
    if (saved === "0") setOpen(false);
  }, [id]);

  function toggle() {
    setOpen((prev) => {
      window.localStorage.setItem(STORAGE_PREFIX + id, prev ? "0" : "1");
      return !prev;
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background">
      <h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/60"
        >
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
              (open ? "" : "-rotate-90")
            }
            aria-hidden="true"
          />
          <span className="text-sm font-medium">{title}</span>
          {!open && summary && (
            <span className="ml-auto truncate text-xs text-muted-foreground">{summary}</span>
          )}
        </button>
      </h3>

      {/* Содержимое размонтируется, а не прячется стилями: в свёрнутых
          секциях лежат поля ввода, и скрытые они всё равно ловили бы
          фокус при переходе по Tab. */}
      {open && <div className="space-y-4 border-t border-border px-4 py-4">{children}</div>}
    </section>
  );
}
