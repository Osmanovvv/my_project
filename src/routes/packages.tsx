import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Packages } from "../components/site/Packages";
import { ContactSection } from "../components/site/ContactSection";
import { PageHero } from "../components/site/PageHero";
import { CATALOG_ORDER, type Service } from "../data/services";
import { seo } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { ServiceCard } from "../components/site/ServiceCard";
export const Route = createFileRoute("/packages")({
  head: () =>
    seo({
      title: "Сколько стоит сайт с ботом — цены и пакеты | IT-Agent",
      description:
        "Пакет «Старт» от 60 000 ₽, «Бизнес» от 180 000 ₽, «Система» от 420 000 ₽. Что входит, срок запуска и результат по каждому — без скрытых доплат и длинного техзадания.",
      path: "/packages",
      socialDescription: "Старт, Бизнес, Система. Кому подходит, что на выходе, срок запуска.",
    }),
  component: PackagesPage,
});
function PackagesPage() {
  /* Порядок карточек задан кодом, цены — из снимка: они правятся из админки. */
  const { services } = useLoaderData({ from: "__root__" });
  const catalog = CATALOG_ORDER.map((id) =>
    services.find((item: Service) => item.id === id),
  ).filter((s): s is Service => Boolean(s));

  return (
    <>
      <div>
        <PageHero
          eyebrow="Пакеты"
          title={
            <>
              Выберите <span className="text-accent">с чего начать</span>
            </>
          }
          description="На старте достаточно простой формы и уведомлений. Дальше — админка и логика. Пакет можно выбрать после разбора."
        />
      </div>
      <section className="container-page py-16 sm:py-24">
        <Packages extended />
      </section>
      <section className="container-page pb-20 sm:pb-24">
        <div className="mb-10">
          <SectionEyebrow>Или по отдельности</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">
            Можно заказать только то, что нужно
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Пакеты — это типовые комбинации. Если нужен только сайт, бот или MiniApp — оценим и
            соберём отдельно.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {catalog.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              /* Поддержка идёт последней и добирает остаток ряда. */
              className={service.id === "support" ? "sm:col-span-2 lg:col-span-2" : undefined}
            />
          ))}
        </div>
      </section>
      <ContactSection compact />
    </>
  );
}
