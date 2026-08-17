import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { PageHead, SaveBar, TextArea, TextInput } from "../components/admin/fields";
import { EntityCard } from "../components/admin/EntityCard";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveFaq } from "../lib/admin.rpc";

export const Route = createFileRoute("/admin/content/faq")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Вопросы и ответы — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FaqPage,
});

type Row = { id?: number; q: string; a: string; preview?: boolean };

/** Ключ карточки: у новых записей id ещё нет. */
const keyOf = (row: Row, index: number) => (row.id != null ? `id-${row.id}` : `new-${index}`);

function FaqPage() {
  const { faq } = Route.useLoaderData();
  const [rows, setRows] = useState<Row[]>(faq);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(faq), [rows, faq]);
  const save = useSaver(() => saveFaq({ data: { items: rows } }), dirty);

  function patch(index: number, key: keyof Row, value: string | boolean) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
    save.reset();
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    save.reset();
  }

  function add() {
    const index = rows.length;
    setRows((prev) => [...prev, { q: "", a: "", preview: false }]);
    /* Новый вопрос сразу раскрыт: иначе после нажатия «Добавить»
       на экране ничего не меняется, кроме ещё одной свёрнутой строки. */
    setOpenKey(`new-${index}`);
    save.reset();
  }

  const previewCount = rows.filter((r) => r.preview).length;

  return (
    <div className="space-y-2 pb-24">
      <PageHead
        title="Вопросы и ответы"
        note="Порядок здесь — порядок на странице вопросов. Отмеченные попадают в краткий блок на главной."
      />

      <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        В ответе можно подставить цену или срок тарифа:{" "}
        <code className="rounded bg-background px-1">{"{{business.price}}"}</code>,{" "}
        <code className="rounded bg-background px-1">{"{{start.term}}"}</code>. Тогда они не
        разойдутся с тарифами, когда поменяете цены. Доступны start, business, system.
      </div>

      <div className="space-y-2 pt-1">
        {rows.map((row, index) => (
          <EntityCard
            key={keyOf(row, index)}
            title={row.q || "Новый вопрос"}
            summary={
              (row.preview ? "на главной · " : "") +
              (row.a ? row.a.slice(0, 70) + (row.a.length > 70 ? "…" : "") : "ответ не заполнен")
            }
            open={openKey === keyOf(row, index)}
            onToggle={() => setOpenKey(openKey === keyOf(row, index) ? null : keyOf(row, index))}
            dirty={JSON.stringify(row) !== JSON.stringify(faq[index])}
            actions={
              <>
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
                  onClick={() => {
                    setRows((prev) => prev.filter((_, i) => i !== index));
                    save.reset();
                  }}
                  aria-label="Удалить вопрос"
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            }
          >
            <TextInput
              label="Вопрос"
              value={row.q}
              onChange={(v) => patch(index, "q", v)}
              placeholder="Нужно ли готовить ТЗ?"
            />
            <TextArea
              label="Ответ"
              value={row.a}
              onChange={(v) => patch(index, "a", v)}
              rows={3}
              placeholder="Нет. На первом этапе достаточно короткого разговора."
            />
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.preview === true}
                onChange={(event) => patch(index, "preview", event.target.checked)}
                className="h-4 w-4 rounded border-input accent-[var(--accent)]"
              />
              показывать на главной
              <span className="text-xs text-muted-foreground">
                {previewCount > 0 ? `сейчас там ${previewCount}` : "сейчас блок скрыт"}
              </span>
            </label>
          </EntityCard>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-border px-4 text-sm text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Добавить вопрос
      </button>

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
