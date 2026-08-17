import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { NumberInput, PageHead, SaveBar, TextInput } from "../components/admin/fields";
import { EntityCard } from "../components/admin/EntityCard";
import { ListField } from "../components/admin/ListField";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, savePackages } from "../lib/admin.rpc";

export const Route = createFileRoute("/admin/content/packages")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Пакеты — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PackagesPage,
});

function PackagesPage() {
  const { packages } = Route.useLoaderData();
  const [rows, setRows] = useState(packages);
  const [openId, setOpenId] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(packages), [rows, packages]);
  const save = useSaver(() => savePackages({ data: { items: rows } }), dirty);

  function patch(id: string, key: string, value: string | number | string[]) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  const changed = (id: string) =>
    JSON.stringify(rows.find((r) => r.id === id)) !==
    JSON.stringify(packages.find((r) => r.id === id));

  return (
    <div className="space-y-2 pb-24">
      <PageHead
        title="Пакеты"
        note="Три тарифа на главной и на странице пакетов. Количество не меняется: вёрстка рассчитана на три колонки."
      />

      <div className="space-y-2 pt-2">
        {rows.map((row) => (
          <EntityCard
            key={row.id}
            title={`«${row.name}»`}
            summary={`${row.priceFrom} · ${row.term} · ${row.points.length} пунктов`}
            open={openId === row.id}
            onToggle={() => setOpenId(openId === row.id ? null : row.id)}
            dirty={changed(row.id)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberInput
                label="Цена, ₽"
                value={row.priceValue}
                onChange={(v) => patch(row.id, "priceValue", v)}
              />
              <TextInput label="Срок" value={row.term} onChange={(v) => patch(row.id, "term", v)} />
            </div>
            <TextInput
              label="Кому подходит"
              hint="строка над названием"
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
              hint="честная оговорка снимает лишние вопросы"
              value={row.notFor}
              onChange={(v) => patch(row.id, "notFor", v)}
            />
            <ListField
              label="Что входит"
              value={row.points}
              onChange={(v) => patch(row.id, "points", v)}
              placeholder="Сайт из нескольких страниц"
            />
          </EntityCard>
        ))}
      </div>

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
