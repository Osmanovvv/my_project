import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ArrowRight, Globe, Zap, ShoppingBag, Layout, Search, Check } from "lucide-react";
import { ServiceDetailLayout } from "../components/site/ServiceDetailLayout";
import type { ServiceId } from "../data/services";
import { fetchPageMeta } from "../lib/content.rpc";
import { pageSeo } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CheckMark } from "../components/site/CheckMark";

export const Route = createFileRoute("/services/websites/")({
  loader: () => fetchPageMeta({ data: { path: "/services/websites" } }),
  head: ({ loaderData }) => pageSeo("/services/websites", loaderData),
  component: WebsitesPage,
});

/**
 * Иконка и подводка — страничные, идентификатор услуги — ссылка в каталог.
 *
 * Сам срок здесь НЕ записан. Раньше он приходил из `getService`, то есть
 * прямо из кода, мимо снимка контента: владелец правил срок в админке,
 * страница услуги показывала новый, а этот хаб — прежний. Две страницы
 * про одну услугу с разными сроками, и заметить это можно было только
 * открыв обе.
 */
const types: Array<{ icon: typeof Zap; id: ServiceId; title: string; text: string }> = [
  {
    icon: Zap,
    id: "websites/landing",
    title: "Лендинг",
    text: "Одностраничник под конкретную услугу или запуск.",
  },
  {
    icon: Layout,
    id: "websites/corporate",
    title: "Корпоративный сайт",
    text: "Многостраничный сайт с услугами, кейсами, блогом.",
  },
  {
    icon: ShoppingBag,
    id: "websites/ecommerce",
    title: "E-commerce",
    text: "Магазин с корзиной, оплатой, доставкой, интеграциями.",
  },
];

const includes = [
  "Уникальный дизайн под бренд",
  "Адаптив: телефон, планшет, десктоп",
  "Формы с уведомлением в Telegram",
  "Админка для контента без разработчика",
  "SEO-оптимизация базовых страниц",
  "Аналитика: Яндекс.Метрика, GA4",
];

function WebsitesPage() {
  /* Срок и путь — из снимка контента: он знает про правки в админке. */
  const { serviceById } = useLoaderData({ from: "__root__" });

  return (
    <ServiceDetailLayout
      eyebrow="Сайты"
      title={
        <>
          Сайты, которые <span className="text-accent">приводят клиентов</span>
        </>
      }
      description="От лендинга до магазина. Собираем в связке с ботом и админкой, чтобы ни одна заявка не терялась."
      icon={Globe}
      accentColor="indigo"
    >
      <section className="container-page py-16 sm:py-24">
        <div className="mb-10">
          <SectionEyebrow>Форматы</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">Что можем сделать</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {types.map(({ icon: Icon, id, title, text }) => {
            const service = serviceById[id];
            return (
              <Link
                key={title}
                to={service.path}
                className="group relative rounded-2xl border border-border bg-surface p-6 hover:border-accent/50 hover:-translate-y-0.5 transition flex flex-col"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent mb-5 group-hover:bg-accent group-hover:text-accent-foreground transition">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="font-display text-lg">{title}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
                <div className="mt-4 pt-4 border-t border-border text-xs uppercase tracking-[0.14em] text-accent/80 flex items-center justify-between">
                  <span>{service.timeline}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-accent group-hover:translate-x-1 transition" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-page py-16 sm:py-24 border-t border-border">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div>
            <SectionEyebrow>Что входит</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl">В базовом пакете</h2>
            <p className="mt-4 text-muted-foreground max-w-md">
              Всё нужное, чтобы сайт заработал и приводил заявки — с первого дня.
            </p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {includes.map((it) => (
              <li
                key={it}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm"
              >
                <CheckMark />
                {it}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page pb-16 sm:pb-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4 text-accent" />
            Нужна поддержка и SEO после запуска?
          </div>
          <Link
            to="/services/support"
            className="-my-2.5 -mx-1 inline-flex items-center gap-2 px-1 py-2.5 text-sm font-medium text-accent"
          >
            Смотреть поддержку <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </ServiceDetailLayout>
  );
}
