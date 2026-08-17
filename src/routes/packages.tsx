import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Packages } from "../components/site/Packages";
import { ContactSection } from "../components/site/ContactSection";
import { PageHero } from "../components/site/PageHero";
import { CATALOG_ORDER, type Service } from "../data/services";
import { AccentText } from "../components/site/AccentText";
import { fetchPageMeta } from "../lib/content.rpc";
import { pageSeo } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { ServiceCard } from "../components/site/ServiceCard";
export const Route = createFileRoute("/packages")({
  loader: () => fetchPageMeta({ data: { path: "/packages" } }),
  head: ({ loaderData }) => pageSeo("/packages", loaderData),
  component: PackagesPage,
});
function PackagesPage() {
  /* Порядок карточек задан кодом, цены — из снимка: они правятся из админки. */
  const { services, texts } = useLoaderData({ from: "__root__" });
  const catalog = CATALOG_ORDER.map((id) =>
    services.find((item: Service) => item.id === id),
  ).filter((s): s is Service => Boolean(s));

  return (
    <>
      <div>
        <PageHero
          eyebrow={texts["page.packages.eyebrow"]}
          title={<AccentText text={texts["page.packages.title"]} />}
          description={texts["page.packages.lead"]}
        />
      </div>
      <section className="container-page py-16 sm:py-24">
        <Packages extended />
      </section>
      <section className="container-page pb-20 sm:pb-24">
        <div className="mb-10">
          <SectionEyebrow>{texts["page.packages.singleEyebrow"]}</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">
            {texts["page.packages.singleTitle"]}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            {texts["page.packages.singleLead"]}
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
