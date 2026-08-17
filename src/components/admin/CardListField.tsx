import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { TextArea, TextInput } from "./fields";
import { IconPicker } from "./IconPicker";
import { FALLBACK_ICON } from "../../data/icons";

/**
 * Редактор списка карточек: «что получите» и «как работаем» на странице услуги.
 *
 * Отличие от `ListField` — там строки, здесь у каждого пункта три поля.
 * Поэтому и вид другой: пункт занимает блок, а не строку, и перестановка
 * нужна не меньше — порядок карточек на странице значимый, сильное
 * преимущество ставят первым.
 *
 * Количество не ограничено жёстко, но сетка рассчитана на кратное трём
 * (карточки) и на четыре (шаги). Об этом сказано подписью под кнопкой
 * добавления: правило вёрстки, о котором иначе узнают, только сломав
 * раскладку.
 */

export type CardItem = {
  icon?: string;
  /** Только у шагов: «2–3 дня». */
  step?: string;
  title: string;
  text: string;
};

type Props = {
  value: CardItem[];
  onChange: (next: CardItem[]) => void;
  /** Показывать выбор значка — у шагов его нет, у карточек «что получите» есть. */
  withIcon?: boolean;
  /** Показывать поле длительности — только у шагов. */
  withStep?: boolean;
  titleLabel: string;
  titleLimit: number;
  textLabel: string;
  textLimit: number;
  addLabel: string;
  /** Подсказка про количество: «сетка рассчитана на 3, 6 или 9». */
  countHint?: string;
};

export function CardListField({
  value,
  onChange,
  withIcon = false,
  withStep = false,
  titleLabel,
  titleLimit,
  textLabel,
  textLimit,
  addLabel,
  countHint,
}: Props) {
  function setAt(index: number, patch: Partial<CardItem>) {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([
      ...value,
      {
        ...(withIcon ? { icon: FALLBACK_ICON } : {}),
        ...(withStep ? { step: "" } : {}),
        title: "",
        text: "",
      },
    ]);
  }

  return (
    <div className="space-y-2.5">
      {value.map((item, index) => (
        <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {index + 1}
            </span>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Выше"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                aria-label="Ниже"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Удалить пункт"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-[9rem_1fr]">
              {withIcon && (
                <IconPicker
                  value={item.icon ?? FALLBACK_ICON}
                  onChange={(icon) => setAt(index, { icon })}
                />
              )}
              {withStep && (
                <TextInput
                  label="Длительность"
                  hint="чистая работа"
                  value={item.step ?? ""}
                  onChange={(step) => setAt(index, { step })}
                  placeholder="2–3 дня"
                  limit={16}
                />
              )}
              <TextInput
                label={titleLabel}
                value={item.title}
                onChange={(title) => setAt(index, { title })}
                limit={titleLimit}
              />
            </div>
            <TextArea
              label={textLabel}
              value={item.text}
              onChange={(text) => setAt(index, { text })}
              rows={2}
              limit={textLimit}
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
        {countHint && <span className="text-[11px] text-muted-foreground/70">{countHint}</span>}
      </div>
    </div>
  );
}
