import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

/**
 * Редактор списка строк: «что болело», «что предложили», «что вошло», стек.
 *
 * Три вещи, ради которых это отдельный компонент, а не textarea со строками:
 *
 * 1. КЛАВИАТУРА. Enter добавляет пункт ниже и переводит на него фокус —
 *    список набирается подряд, без возврата к мыши. Backspace в пустом
 *    пункте удаляет его и возвращает фокус в предыдущий, как в обычном
 *    редакторе. Без этого каждый пункт стоит трёх движений мышью.
 *
 * 2. ВСТАВКА. Скопировал список из письма или заметок — он разложится
 *    по пунктам сам, а не слипнется в одну строку. Маркеры («—», «•», «1.»)
 *    срезаются: их вставляют вместе с текстом почти всегда.
 *
 * 3. ПОРЯДОК. Кнопками вверх-вниз, а не перетаскиванием: перетаскивание
 *    без библиотеки плохо работает пальцем, а кейсы заводят и с телефона.
 */

type Props = {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Подсказка под полем — чем этот список отличается от соседнего. */
  hint?: string;
};

/** Срезает маркеры списка, которые обычно копируются вместе с текстом. */
function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-–—•*·]|\d+[.)])\s+/, "").trim();
}

export function ListField({ label, value, onChange, placeholder, hint }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(index: number, text: string) {
    const next = [...value];
    next[index] = text;
    onChange(next);
  }

  function insertAt(index: number) {
    const next = [...value];
    next.splice(index, 0, "");
    onChange(next);
    /* Фокус ставим после того, как React отрисует новый ряд. */
    window.setTimeout(() => refs.current[index]?.focus(), 0);
  }

  function removeAt(index: number, focusPrevious = false) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    if (focusPrevious && index > 0) {
      window.setTimeout(() => {
        const previous = refs.current[index - 1];
        previous?.focus();
        const end = previous?.value.length ?? 0;
        previous?.setSelectionRange(end, end);
      }, 0);
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    window.setTimeout(() => refs.current[target]?.focus(), 0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      insertAt(index + 1);
      return;
    }
    if (event.key === "Backspace" && value[index] === "" && value.length > 1) {
      event.preventDefault();
      removeAt(index, true);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData("text");
    if (!text.includes("\n")) return; // одна строка — обычная вставка

    event.preventDefault();
    const lines = text.split(/\r?\n/).map(stripBullet).filter(Boolean);
    if (lines.length === 0) return;

    const next = [...value];
    next.splice(index, 1, ...lines);
    onChange(next);
  }

  const rows = value.length > 0 ? value : [""];

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground/70">— {hint}</span>}
      </div>

      <ul className="mt-2 space-y-1.5">
        {rows.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <input
              ref={(node) => {
                refs.current[index] = node;
              }}
              value={item}
              onChange={(event) => setAt(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPaste={(event) => onPaste(event, index)}
              placeholder={index === 0 ? placeholder : ""}
              aria-label={`${label}, пункт ${index + 1}`}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
            />
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Выше"
                className="grid h-9 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label="Ниже"
                className="grid h-9 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Удалить пункт"
                className="grid h-9 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => insertAt(rows.length)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Добавить пункт
      </button>
    </div>
  );
}
