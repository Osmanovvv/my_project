import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Card, NumberInput, PageHead, SaveBar, TextInput } from "../components/admin/fields";
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

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(packages), [rows, packages]);
  const save = useSaver(() => savePackages({ data: { items: rows } }), dirty);

  function patch(id: string, key: string, value: string | number | string[]) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHead
        title="Пакеты"
        note="Три тарифа на главной и на странице пакетов. Количество тарифов не меняется: вёрстка рассчитана на три колонки."
      />

      {rows.map((row) => (
        <Card key={row.id} title={`«${row.name}»`}>
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
            hint="честная оговорка, она снимает лишние вопросы"
            value={row.notFor}
            onChange={(v) => patch(row.id, "notFor", v)}
          />
          <ListField
            label="Что входит"
            value={row.points}
            onChange={(v) => patch(row.id, "points", v)}
            placeholder="Сайт из нескольких страниц"
          />
        </Card>
      ))}

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
