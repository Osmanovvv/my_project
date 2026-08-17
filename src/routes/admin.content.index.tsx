import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CircleHelp,
  Hash,
  Layers,
  Phone,
  Search,
  Type,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { fetchAdminContent } from "../lib/admin.rpc";
import { TEXT_DEFAULTS } from "../data/texts";
import { SEO_DEFAULTS, SEO_PAGES } from "../data/seo-pages";

/**
 * Меню разделов контента.
 *
 * Раньше все шесть разделов лежали на одной странице сворачивающимися
 * секциями. Владелец сказал, что так неудобно, и был прав: чтобы добраться
 * до нужного, приходилось разворачивать соседние, а форма всё равно уезжала
 * за экран. Теперь у каждого раздела своя страница, а здесь — только выбор.
 *
 * У каждой строки показано, что внутри: сколько услуг, сколько вопросов,
 * заполнены ли контакты. Иначе меню превращается в список слов, по которому
 * каждый раз надо вспоминать, где что лежит.
 */

export const Route = createFileRoute("/admin/content/")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Контент сайта — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ContentMenu,
});

type Item = {
  to: string;
  icon: LucideIcon;
  title: string;
  note: string;
  summary: string;
};

function ContentMenu() {
  const data = Route.useLoaderData();

  const filledContacts = data.contacts.filter((c) => c.value).length;
  const changedTexts = Object.entries(data.texts).filter(
    ([key, value]) => value !== TEXT_DEFAULTS[key as keyof typeof TEXT_DEFAULTS],
  ).length;
  const previewCount = data.faq.filter((f) => f.preview).length;

  const changedSeo = SEO_PAGES.filter((page) => {
    const entry = data.seo[page.path];
    const fallback = SEO_DEFAULTS[page.path];
    return entry && fallback && entry.title !== fallback.title;
  }).length;

  const items: Item[] = [
    {
      to: "/admin/content/services",
      icon: Wallet,
      title: "Услуги",
      note: "Цена, срок и весь текст страницы каждой услуги",
      summary: `${data.services.length} услуг`,
    },
    {
      to: "/admin/content/packages",
      icon: Layers,
      title: "Пакеты",
      note: "Цена, срок, состав и кому подходит",
      summary: `${data.packages.length} тарифа`,
    },
    {
      to: "/admin/content/faq",
      icon: CircleHelp,
      title: "Вопросы и ответы",
      note: "Страница вопросов и краткий блок на главной",
      summary: `${data.faq.length} · на главной ${previewCount}`,
    },
    {
      to: "/admin/content/metrics",
      icon: Hash,
      title: "Цифры",
      note: "Плитки на главной и над списком работ",
      summary: `${data.metrics.home.length + data.metrics.works.length} плиток`,
    },
    {
      to: "/admin/content/contacts",
      icon: Phone,
      title: "Контакты",
      note: "Telegram, телефон и почта",
      summary: filledContacts ? `${filledContacts} заполнено` : "не заполнены",
    },
    {
      to: "/admin/content/texts",
      icon: Type,
      title: "Тексты сайта",
      note: "Главная, блок заявки, шапки страниц, карточки ниш",
      summary: changedTexts ? `изменено: ${changedTexts}` : "как в исходном виде",
    },
    {
      to: "/admin/content/seo",
      icon: Search,
      title: "Заголовки для поиска",
      note: "Что видно в Яндексе и Google по каждой странице",
      summary: changedSeo ? `изменено: ${changedSeo}` : `${SEO_PAGES.length} страниц`,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl tracking-tight">Контент сайта</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Выберите, что нужно поправить. Изменения видны на сайте сразу после сохранения.
        </p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition hover:border-accent/40 hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <item.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {item.note}
                </span>
              </span>

              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {item.summary}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
