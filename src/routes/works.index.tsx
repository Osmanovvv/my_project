import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Filter } from "lucide-react";
import { PageHero } from "../components/site/PageHero";
import { Portfolio } from "../components/site/Portfolio";
import { ContactSection } from "../components/site/ContactSection";
import { Mascot } from "../components/site/Mascot";
import { filterCases, tagsOf, type CaseTag } from "../data/cases";
import { fetchCases, fetchPageMeta } from "../lib/content.rpc";
import { AccentText } from "../components/site/AccentText";
import { absoluteUrl, jsonLd, pageSeo, SITE_NAME } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CtaLink } from "../components/site/CtaLink";

export const Route = createFileRoute("/works/")({
  loader: async () => {
    const [cases, meta] = await Promise.all([
      fetchCases(),
      fetchPageMeta({ data: { path: "/works" } }),
    ]);
    return { cases, meta };
  },
  head: ({ loaderData }) => {
    const cases = loaderData?.cases ?? [];
    const base = pageSeo("/works", loaderData?.meta);
    return {
      ...base,
      meta: [
        ...base.meta,
        jsonLd({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Работы IT-Agent",
          url: absoluteUrl("/works"),
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
          hasPart: cases.map((item) => ({
            "@type": "CreativeWork",
            name: item.title,
            url: absoluteUrl(`/works/${item.slug}`),
          })),
        }),
      ],
    };
  },
  component: WorksPage,
});

function WorksPage() {
  const { cases } = Route.useLoaderData();
  const { metrics, texts } = useLoaderData({ from: "__root__" });
  const stats = metrics.works;
  const [active, setActive] = useState<CaseTag | "Все">("Все");

  /* Фильтры строятся по тому, что реально есть в базе: кейс с тегом
     «MiniApp» может появиться завтра, а может не появиться никогда —
     вкладка, всегда дающая пустой список, только мешает. */
  const filters = useMemo(() => ["Все", ...tagsOf(cases)] as const, [cases]);
  const visible = useMemo(() => filterCases(cases, active), [cases, active]);

  const description =
    active === "Все"
      ? texts["page.works.lead"]
      : `Проекты с направлением «${active}» — в связке с остальной инфраструктурой.`;

  return (
    <>
      <PageHero
        eyebrow={texts["page.works.eyebrow"]}
        title={<AccentText text={texts["page.works.title"]} />}
        description={description}
        mascotPose="peek"
      >
        <div className="mt-2 flex flex-wrap gap-3">
          {stats.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border bg-background/70 backdrop-blur px-4 py-3"
            >
              <div className="font-display text-xl text-accent">{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </PageHero>

      <section className="container-page py-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground mr-2">
            <Filter className="h-3.5 w-3.5" /> Фильтр
          </span>
          {filters.map((t) => {
            const count = t === "Все" ? cases.length : filterCases(cases, t as CaseTag).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActive(t)}
                aria-pressed={active === t}
                className={`min-h-10 px-4 py-2 rounded-full text-xs font-medium tracking-wide transition ${
                  active === t
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-muted-foreground hover:text-accent hover:border-accent"
                }`}
              >
                {t}
                <span className={active === t ? "ml-1.5 opacity-60" : "ml-1.5 opacity-50"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="container-page pb-16">
        <Portfolio cases={visible} />
      </section>

      {/* Mascot promo */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-accent/10 via-surface to-background p-8 sm:p-12">
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
          <Mascot
            decorative
            className="pointer-events-none absolute -bottom-4 right-6 h-40 sm:h-56 w-auto z-20 hidden md:block"
            style={{ animation: "mascot-float 6s ease-in-out infinite" }}
          />
          <div className="relative max-w-xl">
            <SectionEyebrow>Ваш кейс будет здесь</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl leading-tight">
              Соберём такую же связку под ваш бизнес.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Расскажите задачу — покажем похожие кейсы и предложим схему сайта, бота и админки под
              неё.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink to="/contacts">
                Обсудить проект <ArrowRight className="h-4 w-4" />
              </CtaLink>
              <CtaLink to="/services" variant="secondary">
                Смотреть услуги
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      <ContactSection compact />
    </>
  );
}
