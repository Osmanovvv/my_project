import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ExternalLink, RotateCcw } from "lucide-react";

import { SaveBar, TextArea, TextInput } from "../components/admin/fields";
import { useSaver } from "../components/admin/use-saver";
import { fetchAdminContent, saveSeoPage } from "../lib/admin.rpc";
import { SEO_DEFAULTS, SEO_LIMITS, seoPageBySlug } from "../data/seo-pages";
import { SITE_URL } from "../lib/seo";

/* Домен берётся из настроек сайта, а не пишется строкой: на превью-домене
   в предпросмотре стоял бы чужой адрес. */
const HOST = SITE_URL.replace(/^https?:\/\//, "");

/**
 * Заголовок и описание одной страницы для поисковой выдачи.
 *
 * Главное здесь — предпросмотр сниппета. Длина `<title>` и `description` —
 * единственное свойство контента, которое НИКАК не видно на самом сайте:
 * ошибиться можно только один раз и узнать об этом через неделю по обрезанной
 * строке в выдаче. Поэтому под полями нарисована карточка ровно с теми
 * ограничениями, с которыми её показывает поисковик.
 */

export const Route = createFileRoute("/admin/content/seo/$slug")({
  loader: async ({ params }) => {
    const page = seoPageBySlug(params.slug);
    if (!page) throw notFound();

    const content = await fetchAdminContent();
    return { page, entry: content.seo[page.path] };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.page.label ?? "Страница"} — заголовки для поиска` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SeoEditor,
});

function SeoEditor() {
  const { page, entry } = Route.useLoaderData();
  const defaults = SEO_DEFAULTS[page.path];

  const initial = useMemo(
    () => ({
      title: entry?.title ?? defaults.title,
      description: entry?.description ?? defaults.description,
      socialTitle: entry?.socialTitle ?? defaults.socialTitle,
      socialDescription: entry?.socialDescription ?? defaults.socialDescription,
    }),
    [entry, defaults],
  );

  const [form, setForm] = useState(initial);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const save = useSaver(() => saveSeoPage({ data: { path: page.path, ...form } }), dirty);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    save.reset();
  }

  const changedFromDefault =
    form.title !== defaults.title || form.description !== defaults.description;

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-3">
        <Link
          to="/admin/content/seo"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Заголовки для поиска
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-xl tracking-tight">{page.label}</h1>
          <a
            href={page.path}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-accent"
          >
            {page.path}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 space-y-3">
        <TextInput
          label="Заголовок в выдаче"
          hint={`Яндекс обрезает примерно на ${SEO_LIMITS.title.good} символах`}
          value={form.title}
          onChange={(v) => set("title", v)}
          limit={SEO_LIMITS.title.good}
        />
        <TextArea
          label="Описание под заголовком"
          hint={`видно примерно ${SEO_LIMITS.description.good} символов`}
          value={form.description}
          onChange={(v) => set("description", v)}
          rows={3}
          limit={SEO_LIMITS.description.good}
        />

        <SnippetPreview path={page.path} title={form.title} description={form.description} />

        {changedFromDefault && (
          <button
            type="button"
            onClick={() => {
              setForm({
                title: defaults.title,
                description: defaults.description,
                socialTitle: defaults.socialTitle,
                socialDescription: defaults.socialDescription,
              });
              save.reset();
            }}
            className="inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            вернуть как было
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background p-4 space-y-3">
        <div className="text-sm font-medium">Превью ссылки в мессенджере</div>
        <p className="text-xs text-muted-foreground">
          Что увидит человек, когда вы отправите ему ссылку в Telegram или WhatsApp. Пусто —
          возьмётся то же, что и для поиска.
        </p>
        <TextInput
          label="Заголовок"
          value={form.socialTitle}
          onChange={(v) => set("socialTitle", v)}
          placeholder={form.title}
          limit={SEO_LIMITS.title.max}
        />
        <TextArea
          label="Описание"
          value={form.socialDescription}
          onChange={(v) => set("socialDescription", v)}
          rows={2}
          placeholder={form.description}
          limit={SEO_LIMITS.description.good}
        />
      </div>

      <PlaceholderHelp />

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}

/**
 * Карточка «как это выглядит в выдаче».
 *
 * Обрезка здесь не декоративная: строка режется ровно по той длине, после
 * которой поисковик ставит многоточие. Увидеть в поле «73/60» — это одно,
 * а увидеть, что от заголовка отвалилось название студии, — совсем другое.
 */
function SnippetPreview({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  const clip = (text: string, limit: number) =>
    text.length > limit ? text.slice(0, limit).trimEnd() + "…" : text;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3.5">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Как в поиске
      </div>
      <div className="text-xs text-muted-foreground">
        {HOST}
        {path === "/" ? "" : path}
      </div>
      <div className="mt-0.5 text-[15px] leading-snug text-accent">
        {clip(title, SEO_LIMITS.title.good) || "— заголовок не заполнен —"}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {clip(description, SEO_LIMITS.description.good) || "— описание не заполнено —"}
      </div>
    </div>
  );
}

/** Подстановки — иначе цены в описании разъедутся с тарифами. */
function PlaceholderHelp() {
  return (
    <details className="rounded-xl border border-border bg-background p-4">
      <summary className="cursor-pointer text-sm font-medium">Подстановка цен и сроков</summary>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <p>
          В описание можно вставить цену или срок тарифа — они подставятся сами и не разъедутся с
          прайсом, когда вы поменяете цены.
        </p>
        <ul className="space-y-1 font-mono">
          <li>{"{{start.price}}"} — цена пакета «Старт»</li>
          <li>{"{{business.price}}"} — цена пакета «Бизнес»</li>
          <li>{"{{system.price}}"} — цена пакета «Система»</li>
          <li>{"{{start.term}}"} — срок пакета (так же для business и system)</li>
          <li>{"{{minPrice}}"} — самая низкая цена в каталоге услуг</li>
        </ul>
      </div>
    </details>
  );
}
