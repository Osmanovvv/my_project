import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";

import { Section } from "../components/admin/Section";
import { ListField } from "../components/admin/ListField";
import {
  fetchAdminContent,
  saveServices,
  savePackages,
  saveFaq,
  saveMetrics,
  saveContactChannels,
  saveSiteTexts,
} from "../lib/admin.rpc";
import { TEXT_DEFAULTS, TEXT_GROUPS, TEXT_LABELS } from "../data/texts";
import { CONTACT_HINTS, type ContactChannelId } from "../data/contacts";

/**
 * Контент сайта: цены, сроки, вопросы, цифры, контакты, тексты главной.
 *
 * Всё на одной странице, разложенное по сворачиваемым секциям. Разводить
 * шесть отдельных экранов не за чем: заходят сюда редко и обычно за одной
 * правкой, а меню из шести пунктов заставляло бы каждый раз вспоминать,
 * в каком из них живёт цена лендинга.
 *
 * Каждая секция сохраняется отдельно. Одна кнопка на всю страницу означала бы,
 * что правка цены тащит за собой перезапись вопросов и текстов — и любая
 * ошибка в одном месте отменяла бы всё остальное.
 */

export const Route = createFileRoute("/admin/content")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Контент сайта — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ContentPage,
});

function ContentPage() {
  const data = Route.useLoaderData();

  return (
    <div className="space-y-3 pb-10">
      <div className="mb-2">
        <h1 className="font-display text-xl tracking-tight">Контент сайта</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Правки видны на сайте сразу после сохранения.
        </p>
      </div>

      <ServicesSection services={data.services} />
      <PackagesSection packages={data.packages} />
      <FaqSection faq={data.faq} />
      <MetricsSection metrics={data.metrics} />
      <ContactsSection contacts={data.contacts} />
      <TextsSection texts={data.texts} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────── услуги ───────

type ServiceRow = {
  id: string;
  cardTitle: string;
  priceValue: number;
  priceUnit: string;
  timeline: string;
  short: string;
  description: string;
};

function ServicesSection({ services }: { services: ServiceRow[] }) {
  const [rows, setRows] = useState(services);
  const save = useSaver(() => saveServices({ data: { items: rows } }));

  function patch(id: string, key: keyof ServiceRow, value: string | number) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  return (
    <Section id="content-services" title="Услуги и цены" summary={`${services.length} услуг`}>
      <p className="text-xs text-muted-foreground">
        Добавить или удалить услугу отсюда нельзя — у каждой своя страница со своей вёрсткой.
        Правятся цена, срок и описания.
      </p>

      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-border p-3">
          <div className="text-sm font-medium">{row.cardTitle}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumberInput
              label={row.priceUnit === "month" ? "Цена, ₽ в месяц" : "Цена, ₽"}
              value={row.priceValue}
              onChange={(v) => patch(row.id, "priceValue", v)}
            />
            <TextInput
              label="Срок"
              value={row.timeline}
              onChange={(v) => patch(row.id, "timeline", v)}
            />
          </div>
          <div className="mt-3 grid gap-3">
            <TextInput
              label="Коротко — строка на карточке"
              value={row.short}
              onChange={(v) => patch(row.id, "short", v)}
            />
            <TextInput
              label="Описание — на странице направления"
              value={row.description}
              onChange={(v) => patch(row.id, "description", v)}
            />
          </div>
        </div>
      ))}

      <SaveBar state={save} />
    </Section>
  );
}

// ──────────────────────────────────────────────────────────── пакеты ────────

type PackageRow = {
  id: string;
  name: string;
  priceValue: number;
  who: string;
  term: string;
  result: string;
  notFor: string;
  points: string[];
};

function PackagesSection({ packages }: { packages: PackageRow[] }) {
  const [rows, setRows] = useState(packages);
  const save = useSaver(() => savePackages({ data: { items: rows } }));

  function patch(id: string, key: keyof PackageRow, value: string | number | string[]) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  return (
    <Section id="content-packages" title="Пакеты" summary={`${packages.length} тарифа`}>
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-border p-3">
          <div className="text-sm font-medium">«{row.name}»</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumberInput
              label="Цена, ₽"
              value={row.priceValue}
              onChange={(v) => patch(row.id, "priceValue", v)}
            />
            <TextInput label="Срок" value={row.term} onChange={(v) => patch(row.id, "term", v)} />
          </div>
          <div className="mt-3 grid gap-3">
            <TextInput
              label="Кому подходит"
              value={row.who}
              onChange={(v) => patch(row.id, "who", v)}
            />
            <TextInput
              label="Что получится"
              value={row.result}
              onChange={(v) => patch(row.id, "result", v)}
            />
            <TextInput
              label="Кому не подойдёт"
              value={row.notFor}
              onChange={(v) => patch(row.id, "notFor", v)}
            />
            <ListField
              label="Что входит"
              value={row.points}
              onChange={(v) => patch(row.id, "points", v)}
              placeholder="Сайт из нескольких страниц"
            />
          </div>
        </div>
      ))}

      <SaveBar state={save} />
    </Section>
  );
}

// ──────────────────────────────────────────────────────────── вопросы ───────

type FaqRow = { id?: number; q: string; a: string; preview?: boolean };

function FaqSection({ faq }: { faq: FaqRow[] }) {
  const [rows, setRows] = useState<FaqRow[]>(faq);
  const save = useSaver(() => saveFaq({ data: { items: rows } }));

  function patch(index: number, key: keyof FaqRow, value: string | boolean) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
    save.reset();
  }

  return (
    <Section
      id="content-faq"
      title="Вопросы и ответы"
      summary={`${faq.length} · на главной ${faq.filter((f) => f.preview).length}`}
    >
      <p className="text-xs text-muted-foreground">
        В ответе можно подставить цену или срок тарифа:{" "}
        <code className="rounded bg-muted px-1">{"{{business.price}}"}</code>,{" "}
        <code className="rounded bg-muted px-1">{"{{start.term}}"}</code>. Тогда они не разойдутся с
        тарифами при смене цен.
      </p>

      {rows.map((row, index) => (
        <div key={row.id ?? `new-${index}`} className="rounded-lg border border-border p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <TextInput label="Вопрос" value={row.q} onChange={(v) => patch(index, "q", v)} />
              <div>
                <span className="text-xs text-muted-foreground">Ответ</span>
                <textarea
                  value={row.a}
                  onChange={(event) => patch(index, "a", event.target.value)}
                  aria-label="Ответ"
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.preview === true}
                  onChange={(event) => patch(index, "preview", event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input accent-[var(--accent)]"
                />
                показывать на главной
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setRows((prev) => prev.filter((_, i) => i !== index));
                save.reset();
              }}
              aria-label="Удалить вопрос"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          setRows((prev) => [...prev, { q: "", a: "", preview: false }]);
          save.reset();
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Добавить вопрос
      </button>

      <SaveBar state={save} />
    </Section>
  );
}

// ───────────────────────────────────────────────────────────── цифры ────────

type Tile = { id: string; value: string; label: string };

function MetricsSection({ metrics }: { metrics: { home: Tile[]; works: Tile[] } }) {
  const [rows, setRows] = useState<Tile[]>([...metrics.home, ...metrics.works]);
  const save = useSaver(() => saveMetrics({ data: { items: rows } }));

  function patch(id: string, key: "value" | "label", value: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  const group = (ids: Tile[], title: string) => (
    <div>
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-2 space-y-2">
        {ids.map((tile) => {
          const row = rows.find((r) => r.id === tile.id)!;
          return (
            <div key={tile.id} className="flex gap-2">
              <input
                value={row.value}
                onChange={(event) => patch(tile.id, "value", event.target.value)}
                maxLength={7}
                aria-label="Значение"
                className="h-10 w-24 shrink-0 rounded-lg border border-input bg-background px-3 text-center font-display text-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
              <input
                value={row.label}
                onChange={(event) => patch(tile.id, "label", event.target.value)}
                aria-label="Подпись"
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Section id="content-metrics" title="Цифры" summary={`${rows.length} плиток`}>
      <p className="text-xs text-muted-foreground">
        Количество плиток менять нельзя: вёрстка рассчитана ровно на это число. Значение — до семи
        знаков, иначе не поместится на телефоне.
      </p>
      {group(metrics.home, "Блок на главной")}
      {group(metrics.works, "Над списком работ")}
      <SaveBar state={save} />
    </Section>
  );
}

// ─────────────────────────────────────────────────────────── контакты ───────

type ContactRow = { id: string; label: string; value: string };

function ContactsSection({ contacts }: { contacts: ContactRow[] }) {
  const all: ContactRow[] = (["telegram", "phone", "email"] as ContactChannelId[]).map((id) => {
    const found = contacts.find((c) => c.id === id);
    return {
      id,
      label: found?.label ?? { telegram: "Telegram", phone: "Телефон", email: "Почта" }[id],
      value: found?.value ?? "",
    };
  });

  const [rows, setRows] = useState(all);
  const save = useSaver(() => saveContactChannels({ data: { items: rows } }));

  return (
    <Section
      id="content-contacts"
      title="Контакты"
      summary={
        rows.filter((r) => r.value).length
          ? `${rows.filter((r) => r.value).length} канала`
          : "не заполнены"
      }
    >
      <p className="text-xs text-muted-foreground">
        Пустое поле — канала нет нигде: ни на странице контактов, ни в подвале, ни в разметке для
        поисковиков. Так нельзя случайно опубликовать заглушку.
      </p>

      {rows.map((row) => (
        <TextInput
          key={row.id}
          label={row.label}
          hint={CONTACT_HINTS[row.id as ContactChannelId]}
          value={row.value}
          onChange={(v) => {
            setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, value: v } : r)));
            save.reset();
          }}
        />
      ))}

      <SaveBar state={save} />
    </Section>
  );
}

// ───────────────────────────────────────────────────────────── тексты ───────

function TextsSection({ texts }: { texts: Record<string, string> }) {
  const [rows, setRows] = useState<Record<string, string>>({ ...texts });
  const save = useSaver(() =>
    saveSiteTexts({
      data: { items: Object.entries(rows).map(([key, value]) => ({ key, value })) },
    }),
  );

  const changed = Object.entries(rows).filter(
    ([key, value]) => value !== TEXT_DEFAULTS[key as keyof typeof TEXT_DEFAULTS],
  ).length;

  return (
    <Section
      id="content-texts"
      title="Тексты главной"
      summary={changed ? `изменено: ${changed}` : "как в исходном виде"}
    >
      <p className="text-xs text-muted-foreground">
        Чтобы выделить часть заголовка цветом, возьмите её в звёздочки:{" "}
        <code className="rounded bg-muted px-1">Сайт, который *не теряет заявки*</code>. Пустое поле
        вернёт текст, который был изначально.
      </p>

      {TEXT_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="text-xs font-medium">{group.title}</div>
          <div className="mt-2 space-y-2">
            {group.keys.map((key) => (
              <TextInput
                key={key}
                label={TEXT_LABELS[key]}
                value={rows[key] ?? ""}
                onChange={(v) => {
                  setRows((prev) => ({ ...prev, [key]: v }));
                  save.reset();
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <SaveBar state={save} />
    </Section>
  );
}

// ───────────────────────────────────────────────────────────── мелочи ───────

function TextInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
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
        aria-label={label}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function NumberInput({
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

/** Состояние кнопки сохранения одной секции. */
function useSaver(run: () => Promise<unknown>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    busy,
    done,
    error,
    reset() {
      setDone(false);
      setError(null);
    },
    async submit() {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await run();
        await router.invalidate();
        setDone(true);
        window.setTimeout(() => setDone(false), 2500);
      } catch {
        setError("Не удалось сохранить. Проверьте связь.");
      } finally {
        setBusy(false);
      }
    },
  };
}

function SaveBar({ state }: { state: ReturnType<typeof useSaver> }) {
  return (
    <div className="flex items-center gap-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={state.submit}
        disabled={state.busy}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-foreground transition hover:brightness-110 disabled:opacity-50"
      >
        {state.busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {state.busy ? "Сохраняем…" : "Сохранить"}
      </button>
      {state.done && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          сохранено
        </span>
      )}
      {state.error && (
        <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" />
          {state.error}
        </span>
      )}
    </div>
  );
}
