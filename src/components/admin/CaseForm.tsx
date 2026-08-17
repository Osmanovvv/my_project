import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, TriangleAlert } from "lucide-react";

import { Section } from "./Section";
import { ListField } from "./ListField";
import { CoverField } from "./CoverField";
import { GRADIENT_LABELS } from "../../data/case-presets";
import { TAG_ORDER, type CaseStudy, type CaseTag } from "../../data/cases";
import { SERVICES, type ServiceId } from "../../data/services";

/**
 * Форма кейса.
 *
 * Разложена по сворачиваемым секциям: полей полтора десятка, и вываленные
 * разом они дают простыню, в которой не видно, что уже заполнено. Открытой
 * по умолчанию оставлена только первая — остальные владелец открывает
 * по мере надобности, и его выбор запоминается.
 *
 * Сохранение — по кнопке, а не автоматически. У заявок автосохранение
 * заметки уместно (одно поле, короткий текст), здесь же случайная правка
 * в открытом кейсе ушла бы на сайт мгновенно. Пока есть несохранённое,
 * уход со страницы перехватывается.
 */

export type CaseFormValues = Omit<CaseStudy, "position">;

type Props = {
  initial: CaseFormValues;
  /** Заголовок кнопки: «Создать» или «Сохранить». */
  submitLabel: string;
  onSubmit: (values: CaseFormValues) => Promise<void>;
  /** Адрес страницы кейса на сайте — показываем ссылку «Открыть». */
  publicHref?: string;
};

export function CaseForm({ initial, submitLabel, onSubmit, publicHref }: Props) {
  const [values, setValues] = useState<CaseFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedInitial = useRef(initial);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedInitial.current),
    [values],
  );

  /* Уход со страницы с несохранёнными правками — предупреждение браузера.
     Формы кейса заполняют по десять минут, и потерять это из-за случайного
     закрытия вкладки особенно обидно. */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function set<K extends keyof CaseFormValues>(key: K, value: CaseFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleTag(tag: CaseTag) {
    set(
      "tags",
      values.tags.includes(tag) ? values.tags.filter((t) => t !== tag) : [...values.tags, tag],
    );
  }

  function toggleService(id: ServiceId) {
    set(
      "services",
      values.services.includes(id)
        ? values.services.filter((s) => s !== id)
        : [...values.services, id],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!values.title.trim()) {
      setError("Без названия кейс не сохранить.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      savedInitial.current = values;
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Не удалось сохранить. Проверьте связь и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  const listSummary = (items: string[]) =>
    items.length
      ? `${items.length} ${plural(items.length, "пункт", "пункта", "пунктов")}`
      : "пусто";

  return (
    <form method="post" onSubmit={submit} className="space-y-3 pb-24">
      <Section id="case-main" title="Главное" defaultOpen summary={values.title || "без названия"}>
        <Field
          label="Название"
          value={values.title}
          onChange={(v) => set("title", v)}
          placeholder="Магазин керамики"
        />
        <Field
          label="Подпись под названием"
          value={values.client}
          onChange={(v) => set("client", v)}
          placeholder="Ручная работа · Симферополь"
          hint="строка над названием на карточке"
        />
        <Field
          label="Отрасль"
          value={values.industry}
          onChange={(v) => set("industry", v)}
          placeholder="Розница и хендмейд"
        />
        <Field
          label="Итог"
          value={values.result}
          onChange={(v) => set("result", v)}
          placeholder="Витрина знает, что осталось"
          hint="короткая строка внизу карточки"
        />

        <div>
          <span className="text-xs text-muted-foreground">Что входило</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TAG_ORDER.map((tag) => (
              <Chip key={tag} active={values.tags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      <Section id="case-summary" title="Описание" summary={values.summary ? "заполнено" : "пусто"}>
        <div>
          <span className="text-xs text-muted-foreground">
            Подводка — что было у клиента до работы
          </span>
          <textarea
            value={values.summary}
            onChange={(event) => set("summary", event.target.value)}
            rows={3}
            placeholder="Мастерская продавала через личные сообщения: заказы терялись в переписке."
            className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
          />
        </div>
      </Section>

      <Section
        id="case-problem"
        title="Задача и решение"
        summary={`${listSummary(values.challenge)} · ${listSummary(values.solution)}`}
      >
        <ListField
          label="Что болело"
          hint="проблемы клиента до работы"
          value={values.challenge}
          onChange={(v) => set("challenge", v)}
          placeholder="Заказы приходили в трёх мессенджерах"
        />
        <ListField
          label="Что предложили"
          hint="решения, которые вы придумали"
          value={values.solution}
          onChange={(v) => set("solution", v)}
          placeholder="Витрина с карточками и понятной формой заказа"
        />
      </Section>

      <Section
        id="case-delivered"
        title="Состав и срок"
        summary={`${listSummary(values.delivered)} · ${values.timeline || "срок не указан"}`}
      >
        <ListField
          label="Что вошло в проект"
          hint="что клиент получил на руки"
          value={values.delivered}
          onChange={(v) => set("delivered", v)}
          placeholder="Каталог с фотогалереей и фильтром"
        />
        <ListField
          label="Стек"
          hint="из чего собрано"
          value={values.stack}
          onChange={(v) => set("stack", v)}
          placeholder="Telegram Bot API"
        />
        <Field
          label="Срок"
          value={values.timeline}
          onChange={(v) => set("timeline", v)}
          placeholder="4 недели"
        />
      </Section>

      <Section
        id="case-services"
        title="Связанные услуги"
        summary={
          values.services.length ? `${values.services.length} из ${SERVICES.length}` : "не выбраны"
        }
      >
        <p className="text-xs text-muted-foreground">
          Внизу страницы кейса появятся ссылки на эти услуги.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SERVICES.map((service) => (
            <Chip
              key={service.id}
              active={values.services.includes(service.id)}
              onClick={() => toggleService(service.id)}
            >
              {service.cardTitle}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        id="case-cover"
        title="Обложка"
        summary={values.cover ? "фотография" : `заглушка · ${GRADIENT_LABELS[values.gradient]}`}
      >
        <CoverField
          value={values.cover}
          onChange={(next) => set("cover", next)}
          gradient={values.gradient}
          pattern={values.pattern}
          onGradientChange={(next) => set("gradient", next)}
          onPatternChange={(next) => set("pattern", next)}
        />
      </Section>

      {/* Полоса сохранения прилипает к низу: форма длинная, и кнопка,
          уехавшая под сгиб, каждый раз требовала бы прокрутки. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.published}
              onChange={(event) => set("published", event.target.checked)}
              className="h-4 w-4 rounded border-input accent-[var(--accent)]"
            />
            Опубликован
            <span className="text-xs text-muted-foreground">
              {values.published ? "виден на сайте" : "черновик, виден только здесь"}
            </span>
          </label>

          <div className="ml-auto flex items-center gap-3">
            {error && (
              <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                <TriangleAlert className="h-3.5 w-3.5" />
                {error}
              </span>
            )}
            {saved && !dirty && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                сохранено
              </span>
            )}
            {publicHref && values.published && (
              <a
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Открыть</span>
              </a>
            )}
            <button
              type="submit"
              disabled={saving || (!dirty && submitLabel === "Сохранить")}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Сохраняем…" : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────── мелочи ─────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
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
        className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-lg px-3 py-1.5 text-sm transition " +
        (active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
