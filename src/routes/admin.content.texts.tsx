import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { AccentPreview, PageHead, SaveBar, TextArea, TextInput } from "../components/admin/fields";
import { EntityCard } from "../components/admin/EntityCard";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveSiteTexts } from "../lib/admin.rpc";
import {
  ACCENT_TEXT_KEYS,
  TEXT_DEFAULTS,
  TEXT_GROUPS,
  TEXT_LABELS,
  TEXT_LIMITS,
  type TextKey,
} from "../data/texts";

/**
 * Тексты сайта по группам.
 *
 * Групп стало вдвое больше, чем было: сюда переехал весь продающий текст,
 * который живёт вне каталога услуг — главная целиком, блок заявки, шапки
 * внутренних страниц, шесть карточек ниш. Открыта всегда одна группа:
 * полторы сотни полей подряд — это ровно то, на что владелец жаловался.
 *
 * Длинный текст правится в textarea, короткий — в строке. Решает не тип
 * поля в базе, а предел длины: строку в 200 символов в однострочном поле
 * не прочитать целиком, а заголовок кнопки в текстовой области выглядит
 * приглашением написать абзац.
 */

export const Route = createFileRoute("/admin/content/texts")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Тексты сайта — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TextsPage,
});

/** Длинные строки — в текстовую область: в одну строку их не прочитать. */
const MULTILINE_THRESHOLD = 90;

function TextsPage() {
  const { texts } = Route.useLoaderData();
  const [rows, setRows] = useState<Record<string, string>>({ ...texts });
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(texts), [rows, texts]);
  const save = useSaver(
    () =>
      saveSiteTexts({
        data: { items: Object.entries(rows).map(([key, value]) => ({ key, value })) },
      }),
    dirty,
  );

  function set(key: TextKey, value: string) {
    setRows((prev) => ({ ...prev, [key]: value }));
    save.reset();
  }

  return (
    <div className="space-y-2 pb-24">
      <PageHead
        title="Тексты сайта"
        note="Чтобы выделить часть заголовка цветом, возьмите её в звёздочки: Сайт, который *не теряет заявки*. Под полем сразу видно, как это будет выглядеть."
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
                group.note +
                ` · ${group.keys.length} строк` +
                (groupChanged ? `, изменено ${groupChanged}` : "")
              }
              open={openGroup === group.title}
              onToggle={() => setOpenGroup(openGroup === group.title ? null : group.title)}
              dirty={groupDirty}
            >
              {group.keys.map((key) => {
                const changed = rows[key] !== TEXT_DEFAULTS[key];
                const value = rows[key] ?? "";
                const limit = TEXT_LIMITS[key];
                const accent = ACCENT_TEXT_KEYS.has(key);
                const long = TEXT_DEFAULTS[key].length > MULTILINE_THRESHOLD;

                return (
                  <div key={key}>
                    {long ? (
                      <TextArea
                        label={TEXT_LABELS[key]}
                        value={value}
                        onChange={(v) => set(key, v)}
                        rows={2}
                        limit={limit}
                      />
                    ) : (
                      <TextInput
                        label={TEXT_LABELS[key]}
                        hint={accent ? "часть в *звёздочках* красится акцентом" : undefined}
                        value={value}
                        onChange={(v) => set(key, v)}
                        limit={limit}
                      />
                    )}

                    {accent && <AccentPreview value={value} />}

                    {/* Возврат к исходному — рядом с полем, а не общей кнопкой
                        на страницу: сбрасывать нужно обычно одну строку. */}
                    {changed && (
                      <button
                        type="button"
                        onClick={() => set(key, TEXT_DEFAULTS[key])}
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
