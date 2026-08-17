import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  LayoutTemplate,
  Globe,
  Bot,
  Smartphone,
  MessageSquare,
  ShoppingCart,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { CATALOG_ORDER, type ServiceId } from "../data/services";
import { AccentText } from "../components/site/AccentText";
import { fetchCases, fetchPageMeta } from "../lib/content.rpc";
import { pageSeo } from "../lib/seo";
import { ContactSection } from "../components/site/ContactSection";
import { Packages } from "../components/site/Packages";
import { Portfolio } from "../components/site/Portfolio";
import { Process } from "../components/site/Process";
import { Metrics } from "../components/site/Metrics";
import { FaqPreview } from "../components/site/FaqPreview";
import { ShowcaseStack } from "../components/site/ShowcaseStack";
import { Mascot } from "../components/site/Mascot";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CtaLink } from "../components/site/CtaLink";
import { ServiceCard } from "../components/site/ServiceCard";

export const Route = createFileRoute("/")({
  /* Мета-теги грузятся вместе с кейсами: head() видит только свой
     loaderData, до данных корня ему не добраться. */
  loader: async () => {
    const [cases, meta] = await Promise.all([fetchCases(), fetchPageMeta({ data: { path: "/" } })]);
    return { cases, meta };
  },
  head: ({ loaderData }) => pageSeo("/", loaderData?.meta),
  component: HomePage,
});
function HomePage() {
  return (
    <>
      <Hero />

      <PortfolioSection />
      <ProcessSection />
      <PackagesSection />
      <MetricsSection />
      <FaqSection />
      <ContactSection />
    </>
  );
}
function PortfolioSection() {
  const { cases } = Route.useLoaderData();
  const { texts } = useLoaderData({ from: "__root__" });

  /* Кейсов нет — раздела нет. Пустая сетка с заголовком «Что мы уже сделали»
     выглядит как поломка, а на новом сайте это обычное состояние: владелец
     ещё не завёл ни одного проекта. */
  if (cases.length === 0) return null;

  return (
    <section className="container-page py-20 sm:py-28">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
        <div>
          <SectionEyebrow>{texts["home.works.eyebrow"]}</SectionEyebrow>
          <h2 className="mt-3 text-3xl sm:text-4xl font-display max-w-xl">
            <AccentText text={texts["home.works.title"]} />
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm">{texts["home.works.note"]}</p>
      </div>
      <Portfolio cases={cases} />
      <div className="mt-12 flex justify-center">
        <CtaLink to="/works" variant="ghost">
          {texts["home.works.cta"]}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </CtaLink>
      </div>
    </section>
  );
}
function ProcessSection() {
  const { texts } = useLoaderData({ from: "__root__" });

  return (
    <section className="container-page py-20 sm:py-28 border-t border-border">
      <div className="mb-14">
        <SectionEyebrow>{texts["home.process.eyebrow"]}</SectionEyebrow>
        <h2 className="mt-3 text-3xl sm:text-4xl font-display max-w-xl">
          <AccentText text={texts["home.process.title"]} />
        </h2>
      </div>
      <Process />
    </section>
  );
}
function MetricsSection() {
  return (
    <section className="container-page py-12 sm:py-16">
      <Metrics />
    </section>
  );
}
function FaqSection() {
  const { faq } = useLoaderData({ from: "__root__" });
  const preview = faq.filter((item) => item.preview);

  /* Ни одного вопроса не помечено для главной — блок не рисуем.
     Заголовок «Отвечаем заранее» без единого вопроса выглядит как поломка. */
  if (preview.length === 0) return null;

  return (
    <section className="container-page py-20 sm:py-28 border-t border-border">
      <FaqPreview items={preview} />
    </section>
  );
}
/* ------------------------------- HERO ------------------------------- */
function Hero() {
  const { texts } = useLoaderData({ from: "__root__" });

  // Нижний паддинг больше верхнего: при `items-center` это поднимает
  // весь блок выше середины экрана, не ломая центрирование.
  return (
    <section className="relative isolate flex min-h-[calc(100vh-4rem)] items-center overflow-hidden pt-8 pb-20 sm:pt-10 sm:pb-28">
      {/* Лавандовая дымка. Раньше была четырьмя hex-константами — при смене
          акцентного цвета фон героя остался бы сиреневым и разъехался бы со
          всем остальным. Теперь оттенки считаются от `--accent`. */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg,
            color-mix(in oklab, var(--accent) 12%, var(--background)) 0%,
            color-mix(in oklab, var(--accent) 7%, var(--background)) 35%,
            color-mix(in oklab, var(--accent) 2%, var(--background)) 65%,
            var(--background) 100%)`,
        }}
      />

      <div className="container-page relative z-20 w-full">
        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-14 items-center">
          {/* Left column: text + mascot */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 sm:mb-8 text-[11px] font-semibold tracking-[0.18em] uppercase bg-accent-soft text-accent rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {texts["home.hero.eyebrow"]}
            </span>
            {/* Выделение цветом задаётся звёздочками в тексте, а не разметкой
                из базы: HTML оттуда пришлось бы вставлять небезопасно. */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight max-w-xl">
              <AccentText text={texts["home.hero.title"]} />
            </h1>
            <p className="mt-5 sm:mt-7 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              {texts["home.hero.subtitle"]}
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3">
              <CtaLink to="/contacts" cheer>
                {texts["home.hero.primaryCta"]}
                <ArrowRight className="h-4 w-4" />
              </CtaLink>
              <CtaLink to="/services" variant="secondary">
                {texts["home.hero.secondaryCta"]}
              </CtaLink>
            </div>

            {/*
              Маскот с репликой стоит ПОД кнопками, а не над заголовком.
              Сверху он съедал ~200px и опускал главный блок: заголовок
              начинался на 235px ниже макетов справа. Теперь колонки
              выровнены по верху, а маскот закрывает пустой низ и работает
              как дружелюбная подпись рядом с CTA.

              Пузырь — в потоке (flex), а не абсолютом через `left-full`:
              иначе группа имеет ширину одного маскота, реплика висит вне
              колонки и на узких экранах вылезает за край.
            */}
            <div className="relative mt-10 sm:mt-8 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 -m-6 bg-accent/25 rounded-full blur-3xl opacity-70 animate-pulse" />
                <Mascot
                  /* Крупная версия файла: на таком размере мелкая (224px)
                     мылила бы на 2x-экранах. Реплика рядом не масштабируется —
                     у неё свои фиксированные размеры. */
                  size="lg"
                  priority
                  alt="IT-Agent — маскот студии"
                  className="relative h-48 sm:h-52 w-auto object-contain"
                  style={{ animation: "mascot-float 6s ease-in-out infinite" }}
                />
              </div>
              {/* Mobile: greeting below mascot */}
              <div className="sm:hidden relative z-10">
                <div className="relative">
                  <div className="absolute -inset-4 bg-accent/10 blur-3xl -z-10 rounded-full" />
                  <div className="relative px-3 py-1.5 bg-background/70 backdrop-blur-xl border border-border/40 shadow-[0_8px_32px_color-mix(in_oklab,var(--foreground)_6%,transparent)] rounded-4xl flex items-center gap-2 whitespace-nowrap">
                    <p className="text-xs font-medium text-foreground tracking-tight whitespace-nowrap">
                      Привет! Я — твой <span className="text-accent font-semibold">IT-Agent</span>
                    </p>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  </div>
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3">
                    <div
                      className="absolute -inset-[0.5px] w-3 h-3 bg-border/40"
                      style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
                    />
                    <div
                      className="relative w-3 h-3 bg-background/70 backdrop-blur-xl"
                      style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
                    />
                  </div>
                </div>
              </div>
              {/* Desktop: greeting to the right of mascot */}
              <div className="hidden sm:block relative z-10">
                <div className="relative">
                  <div className="absolute -inset-4 bg-accent/10 blur-3xl -z-10 rounded-full" />
                  <div className="relative px-3.5 sm:px-4 py-2 sm:py-2.5 bg-background/70 backdrop-blur-xl border border-border/40 shadow-[0_8px_32px_color-mix(in_oklab,var(--foreground)_6%,transparent)] rounded-4xl flex items-center gap-2 sm:gap-3 whitespace-nowrap">
                    <p className="text-xs sm:text-sm font-medium text-foreground tracking-tight whitespace-nowrap">
                      Привет! Я — твой <span className="text-accent font-semibold">IT-Agent</span>
                    </p>
                    <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent animate-pulse" />
                  </div>
                  <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rotate-[-30deg] origin-right">
                    <div
                      className="absolute -inset-[0.5px] w-3 h-3 bg-border/40"
                      style={{ clipPath: "polygon(100% 0, 100% 100%, 0 50%)" }}
                    />
                    <div
                      className="relative w-3 h-3 bg-background/70 backdrop-blur-xl"
                      style={{ clipPath: "polygon(100% 0, 100% 100%, 0 50%)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: product examples */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />
            </div>
            <ShowcaseStack />
          </div>
        </div>
      </div>
    </section>
  );
}
/* --------------------------- PACKAGES --------------------------- */
/** Иконки — единственное, что не живёт в каталоге: он не тянет lucide. */
const SERVICE_ICONS: Record<ServiceId, LucideIcon> = {
  "websites/landing": LayoutTemplate,
  "websites/corporate": Globe,
  "websites/ecommerce": ShoppingCart,
  "bots/telegram": Bot,
  "bots/max": MessageSquare,
  "bots/miniapp": Smartphone,
  support: LifeBuoy,
};

function PackagesSection() {
  const { texts, services } = useLoaderData({ from: "__root__" });
  const [tab, setTab] = useState<"packages" | "single">("packages");

  /* Порядок карточек задан кодом, значения — из базы. */
  const catalog = CATALOG_ORDER.map((id) => services.find((s) => s.id === id)!).filter(Boolean);

  return (
    <section className="container-page py-20 sm:py-28">
      <div className="text-center mb-8 sm:mb-10">
        <SectionEyebrow>{texts["home.packages.eyebrow"]}</SectionEyebrow>
        <h2 className="mt-3 text-3xl sm:text-4xl font-display">
          <AccentText text={texts["home.packages.title"]} />
        </h2>
        <p className="mt-3 text-muted-foreground">{texts["home.packages.note"]}</p>
      </div>

      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {(
            [
              ["packages", "Пакеты"],
              ["single", "Отдельные услуги"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "min-h-10 px-5 py-2 text-sm font-medium rounded-full transition-all " +
                (tab === key
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "packages" ? (
        <>
          <Packages />
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              to="/packages"
              className="-my-2.5 -mx-1 px-1 py-2.5 text-sm text-muted-foreground hover:text-accent transition"
            >
              Подробности пакетов →
            </Link>
            <button
              type="button"
              onClick={() => setTab("single")}
              className="text-sm font-medium text-accent hover:underline underline-offset-4"
            >
              Нужно только одно? Смотреть отдельные услуги →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {catalog.map((service) => (
              <ServiceCard key={service.id} service={service} icon={SERVICE_ICONS[service.id]} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setTab("packages")}
              className="text-sm font-medium text-accent hover:underline underline-offset-4"
            >
              ← Показать пакеты «под ключ»
            </button>
          </div>
        </>
      )}
    </section>
  );
}
