import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { ICON_GROUPS, ICON_LABELS } from "../../data/icons";
import { Icon } from "../site/Icon";

/**
 * Выбор иконки для пункта «что получите».
 *
 * Почему сетка с картинками, а не выпадающий список с названиями: иконку
 * узнают в лицо, а не по имени. «Gauge» и «Activity» в списке неразличимы,
 * а на глаз — спидометр и пульс, и понятно за секунду.
 *
 * Список закрытый (см. `data/icons.ts`): полторы тысячи иконок lucide
 * выбирать не из чего, а ввод имени руками — верный способ получить пустое
 * место на странице услуги.
 */
export function IconPicker({
  value,
  onChange,
  label = "Значок",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Клик мимо и Escape закрывают панель. Без этого она остаётся висеть
     поверх соседних полей, и до них не добраться. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${label}: ${ICON_LABELS[value] ?? "не выбран"}`}
        className="mt-1.5 flex h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-background px-3 text-left text-sm outline-none transition hover:border-accent/50 focus:ring-2 focus:ring-ring"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Icon name={value} className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{ICON_LABELS[value] ?? "выбрать"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-xl">
          {ICON_GROUPS.map((group) => (
            <div key={group.title} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {group.title}
              </div>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
                {group.keys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    title={ICON_LABELS[key]}
                    aria-label={ICON_LABELS[key]}
                    aria-pressed={key === value}
                    className={
                      "relative grid h-10 place-items-center rounded-lg border transition " +
                      (key === value
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground")
                    }
                  >
                    <Icon name={key} className="h-4 w-4" />
                    {key === value && (
                      <Check className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-accent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
