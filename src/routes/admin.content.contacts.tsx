import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageHead, SaveBar, TextInput } from "../components/admin/fields";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveContactChannels } from "../lib/admin.rpc";
import { CONTACT_HINTS, type ContactChannelId } from "../data/contacts";

export const Route = createFileRoute("/admin/content/contacts")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Контакты — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ContactsPage,
});

const LABELS: Record<ContactChannelId, string> = {
  telegram: "Telegram",
  phone: "Телефон",
  email: "Почта",
};

function ContactsPage() {
  const { contacts } = Route.useLoaderData();

  const initial = useMemo(
    () =>
      (["telegram", "phone", "email"] as ContactChannelId[]).map((id) => ({
        id,
        value: contacts.find((c) => c.id === id)?.value ?? "",
      })),
    [contacts],
  );

  const [rows, setRows] = useState(initial);
  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(initial), [rows, initial]);
  const save = useSaver(() => saveContactChannels({ data: { items: rows } }), dirty);

  return (
    <div className="space-y-4 pb-24">
      <PageHead
        title="Контакты"
        note="Пустое поле — канала нет нигде: ни на странице контактов, ни в подвале, ни в разметке для поисковиков. Так нельзя случайно опубликовать заглушку вроде «+7 (000) 000-00-00»."
      />

      <div className="space-y-3 rounded-xl border border-border bg-background p-4">
        {rows.map((row) => (
          <TextInput
            key={row.id}
            label={LABELS[row.id]}
            hint={CONTACT_HINTS[row.id]}
            value={row.value}
            onChange={(v) => {
              setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, value: v } : r)));
              save.reset();
            }}
          />
        ))}
      </div>

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
