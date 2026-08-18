import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ExternalLink, RotateCcw } from "lucide-react";

import { AccentPreview, SaveBar, TextArea, TextInput } from "../components/admin/fields";
import { ImageField } from "../components/admin/ImageField";
import { useSaver } from "../components/admin/use-saver";
import type { UploadedImage } from "../components/admin/upload";
import { fetchAdminContent, saveImageForSlot, saveMetrics, saveSiteTexts } from "../lib/admin.rpc";
import { sectionBySlug, sectionTextKeys } from "../data/sections";
import {
  ACCENT_TEXT_KEYS,
  IMAGE_SLOTS,
  TEXT_DEFAULTS,
  TEXT_LABELS,
  TEXT_LIMITS,
  type ImageSlotKey,
  type TextKey,
} from "../data/texts";

/**
 * Один раздел сайта целиком.
 *
 * Здесь всё, что в этом куске страницы есть: заголовки, тексты, снимки
 * в рамках, подписи под ними и числа на плитках. Раньше это лежало в трёх
 * разных местах админки, и правка первого экрана означала три захода.
 *
 * Поля идут в том же порядке, в каком стоят на странице, и разбиты теми же
 * блоками: «Окно браузера», «Чат бота». Так найти нужную строку можно, глядя
 * на сайт, а не вспоминая её название.
 *
 * Сохранение одно на весь раздел, запросов может быть три (тексты, картинки,
 * плитки): для владельца это одна страница, и три кнопки «сохранить» тут
 * были бы ловушкой.
 */

/** Длинная строка правится в текстовой области: в строку её не прочитать. */
const MULTILINE_THRESHOLD = 90;

export const Route = createFileRoute("/admin/content/sections/$slug")({
  loader: async ({ params }) => {
    const section = sectionBySlug(params.slug);
    if (!section) throw notFound();
    return { section, content: await fetchAdminContent() };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.section.label ?? "Раздел"} — админка IT-Agent` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SectionEditor,
});

function SectionEditor() {
  const { section, content } = Route.useLoaderData();

  const keys = useMemo(() => sectionTextKeys(section), [section]);
  const tiles = useMemo(
    () => (section.metricArea ? content.metrics[section.metricArea] : []),
    [section, content],
  );

  const initialTexts = useMemo(
    () =>
      Object.fromEntries(keys.map((key) => [key, content.texts[key]])) as Record<TextKey, string>,
    [keys, content],
  );
  const [texts, setTexts] = useState(initialTexts);

  /**
   * Выбранная картинка ждёт сохранения вместе со всем разделом.
   *
   * `undefined` — не трогали, `null` — вернуть исходную, объект — своя новая.
   * Файл при этом уже загружен на сервер: сжатие и отправка идут сразу,
   * иначе кнопка «Сохранить» висела бы полминуты на мобильном интернете.
   */
  const [images, setImages] = useState<Partial<Record<ImageSlotKey, UploadedImage | null>>>({});

  const initialTiles = useMemo(
    () => tiles.map((tile) => ({ id: tile.id, value: tile.value, label: tile.label })),
    [tiles],
  );
  const [tileRows, setTileRows] = useState(initialTiles);

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  const textsDirty = !same(texts, initialTexts);
  const imagesDirty = Object.keys(images).length > 0;
  const tilesDirty = !same(tileRows, initialTiles);
  const dirty = textsDirty || imagesDirty || tilesDirty;

  const save = useSaver(async () => {
    if (textsDirty) {
      await saveSiteTexts({
        data: { items: Object.entries(texts).map(([key, value]) => ({ key, value })) },
      });
    }
    for (const [slot, picked] of Object.entries(images)) {
      await saveImageForSlot({ data: { slot, mediaId: picked ? picked.id : 0 } });
    }
    if (tilesDirty) {
      await saveMetrics({ data: { items: tileRows } });
    }
    return { ok: true as const };
  }, dirty);

  function setText(key: TextKey, value: string) {
    setTexts((prev) => ({ ...prev, [key]: value }));
    save.reset();
  }

  /** Что показывать в поле снимка: выбранное сейчас или то, что на сайте. */
  function shownImage(slot: ImageSlotKey) {
    const picked = images[slot];
    if (picked) return { image: picked, custom: true };
    if (picked === null) return { image: IMAGE_SLOTS[slot].fallback, custom: false };

    const live = content.images[slot];
    return { image: live, custom: live.url !== IMAGE_SLOTS[slot].fallback.url };
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-3">
        <Link
          to="/admin/content/sections"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Разделы сайта
        </Link>
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-xl tracking-tight">{section.label}</h1>
            {/* Ссылка на живую страницу: посмотреть, что получилось, — половина
                работы с текстом, а искать адрес руками неудобно. */}
            <a
              href={section.path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-accent"
            >
              {section.path}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{section.note}</p>
        </div>
      </div>

      {section.blocks.map((block, index) => (
        <div key={index} className="rounded-xl border border-border bg-background p-4">
          {block.title && (
            <div className="mb-3">
              <div className="text-sm font-medium">{block.title}</div>
              {block.note && <p className="mt-0.5 text-xs text-muted-foreground">{block.note}</p>}
            </div>
          )}

          <div className="space-y-3">
            {block.fields.map((field) => {
              if (field.kind === "image") {
                const slot = field.slot;
                const meta = IMAGE_SLOTS[slot];
                const { image, custom } = shownImage(slot);
                return (
                  <ImageField
                    key={slot}
                    label={meta.label}
                    hint={meta.hint}
                    ratio={meta.ratio}
                    current={image}
                    custom={custom}
                    onChange={(media) => {
                      setImages((prev) => ({ ...prev, [slot]: media }));
                      save.reset();
                    }}
                  />
                );
              }

              const key = field.key;
              const value = texts[key] ?? "";
              const changed = value !== TEXT_DEFAULTS[key];
              const accent = ACCENT_TEXT_KEYS.has(key);
              const long = TEXT_DEFAULTS[key].length > MULTILINE_THRESHOLD;

              return (
                <div key={key}>
                  {long ? (
                    <TextArea
                      label={TEXT_LABELS[key]}
                      value={value}
                      onChange={(next) => setText(key, next)}
                      rows={2}
                      limit={TEXT_LIMITS[key]}
                    />
                  ) : (
                    <TextInput
                      label={TEXT_LABELS[key]}
                      hint={accent ? "часть в *звёздочках* красится акцентом" : undefined}
                      value={value}
                      onChange={(next) => setText(key, next)}
                      limit={TEXT_LIMITS[key]}
                    />
                  )}

                  {accent && <AccentPreview value={value} />}

                  {/* Возврат к исходному — рядом с полем, а не общей кнопкой
                      на страницу: сбрасывать нужно обычно одну строку. */}
                  {changed && (
                    <button
                      type="button"
                      onClick={() => setText(key, TEXT_DEFAULTS[key])}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      вернуть как было
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {tileRows.length > 0 && (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="mb-3">
            <div className="text-sm font-medium">Плитки с числами</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Количество не меняется — под него рассчитана раскладка. Значение короткое: «+40%»,
              «24/7».
            </p>
          </div>
          <div className="space-y-3">
            {tileRows.map((tile, index) => (
              <div key={tile.id} className="grid gap-2.5 sm:grid-cols-[7rem_1fr]">
                <TextInput
                  label="Значение"
                  value={tile.value}
                  onChange={(v) => {
                    setTileRows((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, value: v } : row)),
                    );
                    save.reset();
                  }}
                  limit={7}
                />
                <TextInput
                  label="Подпись"
                  value={tile.label}
                  onChange={(v) => {
                    setTileRows((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, label: v } : row)),
                    );
                    save.reset();
                  }}
                  limit={40}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {section.related && (
        <Link
          to={section.related.to}
          className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 text-sm transition hover:border-accent/40 hover:bg-muted/40"
        >
          <span className="min-w-0 flex-1">
            {section.related.label}
            <span className="ml-2 text-xs text-muted-foreground">правится в своём разделе</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
