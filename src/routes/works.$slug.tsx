import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Clock, Layers, Target } from "lucide-react";
import { ContactSection } from "../components/site/ContactSection";
import { Pattern } from "../components/site/Portfolio";
import { gradientClasses } from "../data/case-presets";
import { fetchCasePage } from "../lib/content.rpc";
import { SERVICE_BY_ID } from "../data/services";
import { absoluteUrl, jsonLd, seo, SITE_NAME } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CheckMark } from "../components/site/CheckMark";

export const Route = createFileRoute("/works/$slug")({
  /* Неизвестный или неопубликованный slug — 404, а не пустая страница.
     Черновик снаружи не показывается: `fetchCasePage` отдаёт только
     опубликованные. */
  loader: async ({ params }) => {
    const page = await fetchCasePage({ data: { slug: params.slug } });
    if (!page.study) throw notFound();
    return { study: page.study, related: page.related };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.study) return {};
    const study = loaderData.study;

    const path = `/works/${study.slug}`;
    const base = seo({
      title: `${study.title} — работы IT-Agent`,
      description: study.summary,
      path,
      socialTitle: `${study.title} · ${study.result}`,
      type: "article",
    });

    return {
      ...base,
      meta: [
        ...base.meta,
        jsonLd({
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: study.title,
          headline: `${study.title} — ${study.result}`,
          description: study.summary,
          url: absoluteUrl(path),
          about: study.industry,
          keywords: study.tags.join(", "),
          creator: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
        }),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Работы", item: absoluteUrl("/works") },
            { "@type": "ListItem", position: 3, name: study.title, item: absoluteUrl(path) },
          ],
        }),
      ],
    };
  },
  component: CasePage,
});

function CasePage() {
  const { study, related } = Route.useLoaderData();
  const services = study.services.map((id) => SERVICE_BY_ID[id]);

  return (
    <>
      {/* Шапка кейса */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute top-20 right-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container-page pt-10 sm:pt-14 pb-12 sm:pb-16">
          {/* Область нажатия расширена паддингом, раскладка не сдвигается —
              см. такую же ссылку в ServiceDetailLayout. */}
          <Link
            to="/works"
            className="-my-3 -ml-1 inline-flex items-center gap-1.5 px-1 py-3 text-xs text-muted-foreground hover:text-accent transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Все работы
          </Link>

          <div className="mt-8 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
            <div>
              <div className="flex flex-wrap gap-1.5">
                {study.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="mt-5 font-display text-4xl sm:text-5xl leading-[1.05] tracking-tight">
                {study.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {study.client} · {study.industry}
              </p>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
                {study.summary}
              </p>

              <dl className="mt-8 flex flex-wrap gap-3">
                <Fact icon={Target} label="Результат" value={study.result} accent />
                <Fact icon={Clock} label="Срок" value={study.timeline} />
              </dl>
            </div>

            {/* Обложка — та же, что в карточке на /works: снимок или заглушка. */}
            <div
              className={`relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${gradientClasses(study.gradient)}`}
            >
              {study.cover ? (
                /* Обложка кейса — крупнейшая картинка первого экрана,
                   поэтому грузится сразу, а не лениво. */
                <img
                  src={study.cover.url}
                  width={study.cover.width}
                  height={study.cover.height}
                  alt={study.title}
                  loading="eager"
                  decoding="sync"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Pattern kind={study.pattern} />
              )}
              <div className="absolute inset-x-0 bottom-0 p-6">
                {/* Затемнение снизу: поверх фотографии белый текст на
                    полупрозрачной плашке читается не на каждом снимке. */}
                {study.cover && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
                )}
                <div className="relative inline-flex rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                  {study.result}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Задача и решение */}
      <section className="container-page py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-border bg-surface p-7 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Что было
            </p>
            <h2 className="mt-3 font-display text-2xl">Задача</h2>
            <ul className="mt-6 space-y-3">
              {study.challenge.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-accent/25 bg-accent-soft/50 p-7 sm:p-8">
            <SectionEyebrow>Что сделали</SectionEyebrow>
            <h2 className="mt-3 font-display text-2xl">Решение</h2>
            <ul className="mt-6 space-y-3">
              {study.solution.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <CheckMark />
                  <span className="text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Что вошло в проект */}
      <section className="container-page pb-16 border-t border-border pt-16">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div>
            <SectionEyebrow>Состав</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl">Что вошло в проект</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {study.stack.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-muted-foreground"
                >
                  <Layers className="h-3 w-3 text-accent" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3">
            {study.delivered.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed"
              >
                <CheckMark />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Связанные услуги */}
      {services.length > 0 && (
        <section className="container-page pb-16">
          <div className="rounded-3xl border border-border bg-surface p-7 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Такой же проект собирается из
            </p>
            <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <Link
                  key={service.id}
                  to={service.path}
                  className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50"
                >
                  <div className="font-display text-lg group-hover:text-accent transition-colors">
                    {service.title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{service.priceFrom}</div>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    Подробнее
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Соседние кейсы */}
      {related.length > 0 && (
        <section className="container-page pb-16 border-t border-border pt-16">
          <h2 className="font-display text-2xl sm:text-3xl">Похожие работы</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((item) => (
              <Link
                key={item.slug}
                to="/works/$slug"
                params={{ slug: item.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/40"
              >
                <div
                  className={`relative aspect-[16/9] bg-gradient-to-br ${gradientClasses(item.gradient)} overflow-hidden`}
                >
                  {item.cover ? (
                    <img
                      src={item.cover.url}
                      width={item.cover.width}
                      height={item.cover.height}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <Pattern kind={item.pattern} />
                  )}
                </div>
                <div className="p-5">
                  <div className="text-xs text-muted-foreground">{item.client}</div>
                  <div className="mt-1 font-display text-lg group-hover:text-accent transition-colors">
                    {item.title}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ContactSection compact />
    </>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border px-4 py-3 " +
        (accent ? "border-accent/30 bg-accent-soft" : "border-border bg-background")
      }
    >
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className={"h-3 w-3 " + (accent ? "text-accent" : "")} />
        {label}
      </dt>
      <dd className={"mt-1 font-display text-lg " + (accent ? "text-accent" : "")}>{value}</dd>
    </div>
  );
}
