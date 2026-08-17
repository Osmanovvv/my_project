import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { NumberInput, PageHead, SaveBar, TextInput } from "../components/admin/fields";
import { EntityCard } from "../components/admin/EntityCard";
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
  const [openId, setOpenId] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(services), [rows, services]);
  const save = useSaver(() => saveServices({ data: { items: rows } }), dirty);

  function patch(id: string, key: string, value: string | number) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    save.reset();
  }

  /** Изменилась ли конкретная услуга — на точку в заголовке. */
  const changed = (id: string) =>
    JSON.stringify(rows.find((r) => r.id === id)) !==
    JSON.stringify(services.find((r) => r.id === id));

  return (
    <div className="space-y-2 pb-24">
      <PageHead
        title="Услуги и цены"
        note="Добавить или удалить услугу отсюда нельзя — у каждой своя страница со своей вёрсткой и текстами. Правятся цена, срок и описания."
      />

      <div className="space-y-2 pt-2">
        {rows.map((row) => (
          <EntityCard
            key={row.id}
            title={row.cardTitle}
            summary={`${row.priceFrom} · ${row.timeline}`}
            open={openId === row.id}
            onToggle={() => setOpenId(openId === row.id ? null : row.id)}
            dirty={changed(row.id)}
          >
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
          </EntityCard>
        ))}
      </div>

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
