import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { PageHead, SaveBar, TextInput } from "../components/admin/fields";
import { EntityCard } from "../components/admin/EntityCard";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveSiteTexts } from "../lib/admin.rpc";
import { TEXT_DEFAULTS, TEXT_GROUPS, TEXT_LABELS, type TextKey } from "../data/texts";

export const Route = createFileRoute("/admin/content/texts")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Тексты главной — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TextsPage,
});

function TextsPage() {
  const { texts } = Route.useLoaderData();
  const [rows, setRows] = useState<Record<string, string>>({ ...texts });
  const [openGroup, setOpenGroup] = useState<string | null>(TEXT_GROUPS[0]?.title ?? null);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(texts), [rows, texts]);
  const save = useSaver(
    () =>
      saveSiteTexts({
        data: { items: Object.entries(rows).map(([key, value]) => ({ key, value })) },
      }),
    dirty,
  );

  return (
    <div className="space-y-2 pb-24">
      <PageHead
        title="Тексты главной"
        note="Чтобы выделить часть заголовка цветом, возьмите её в звёздочки: Сайт, который *не теряет заявки*."
      />

      <div className="space-y-2 pt-2">
        {TEXT_GROUPS.map((group) => {
          const groupChanged = group.keys.filter((k) => rows[k] !== TEXT_DEFAULTS[k]).length;
          const groupDirty = group.keys.some((k) => rows[k] !== texts[k]);

          return (
            <EntityCard
              key={group.title}
              title={group.title}
              summary={
                `${group.keys.length} строк` +
                (groupChanged ? ` · изменено ${groupChanged}` : " · как в исходном виде")
              }
              open={openGroup === group.title}
              onToggle={() => setOpenGroup(openGroup === group.title ? null : group.title)}
              dirty={groupDirty}
            >
              {group.keys.map((key) => {
                const changed = rows[key] !== TEXT_DEFAULTS[key];
                return (
                  <div key={key}>
                    <TextInput
                      label={TEXT_LABELS[key]}
                      value={rows[key] ?? ""}
                      onChange={(v) => {
                        setRows((prev) => ({ ...prev, [key]: v }));
                        save.reset();
                      }}
                    />
                    {/* Возврат к исходному — рядом с полем, а не общей кнопкой
                        на страницу: сбрасывать нужно обычно одну строку. */}
                    {changed && (
                      <button
                        type="button"
                        onClick={() => {
                          setRows((prev) => ({ ...prev, [key]: TEXT_DEFAULTS[key as TextKey] }));
                          save.reset();
                        }}
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        <RotateCcw className="h-3 w-3" />
                        вернуть как было
                      </button>
                    )}
                  </div>
                );
              })}
            </EntityCard>
          );
        })}
      </div>

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
