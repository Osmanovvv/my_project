import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageHead, SaveBar } from "../components/admin/fields";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveMetrics } from "../lib/admin.rpc";

export const Route = createFileRoute("/admin/content/metrics")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [{ title: "Цифры — админка IT-Agent" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const { metrics } = Route.useLoaderData();
  const initial = useMemo(() => [...metrics.home, ...metrics.works], [metrics]);
  const [rows, setRows] = useState(initial);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(initial), [rows, initial]);
  const save = useSaver(() => saveMetrics({ data: { items: rows } }), dirty);

  function patch(id: string, key: "value" | "label", value: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  const group = (source: typeof metrics.home, title: string, note: string) => (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      <div className="mt-3 space-y-2">
        {source.map((tile) => {
          const row = rows.find((r) => r.id === tile.id);
          if (!row) return null;
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
    <div className="space-y-4 pb-24">
      <PageHead
        title="Цифры"
        note="Количество плиток менять нельзя: четыре на главной становятся в ряд, у последней оставлено место под маскота. Значение — до семи знаков, иначе не поместится на телефоне."
      />

      {group(metrics.home, "Блок на главной", "«Что меняется после запуска»")}
      {group(metrics.works, "Над списком работ", "три плитки в шапке страницы")}

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
