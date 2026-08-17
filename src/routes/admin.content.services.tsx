import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Card, NumberInput, PageHead, SaveBar, TextInput } from "../components/admin/fields";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveServices } from "../lib/admin.rpc";

export const Route = createFileRoute("/admin/content/services")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Услуги и цены — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { services } = Route.useLoaderData();
  const [rows, setRows] = useState(services);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(services), [rows, services]);
  const save = useSaver(() => saveServices({ data: { items: rows } }), dirty);

  function patch(id: string, key: string, value: string | number) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHead
        title="Услуги и цены"
        note="Добавить или удалить услугу отсюда нельзя — у каждой своя страница со своей вёрсткой и текстами. Правятся цена, срок и описания."
      />

      {rows.map((row) => (
        <Card key={row.id} title={row.cardTitle}>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <TextInput
            label="Коротко"
            hint="строка на карточке в каталоге"
            value={row.short}
            onChange={(v) => patch(row.id, "short", v)}
          />
          <TextInput
            label="Описание"
            hint="на странице направления"
            value={row.description}
            onChange={(v) => patch(row.id, "description", v)}
          />
        </Card>
      ))}

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
