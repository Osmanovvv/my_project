import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { ContactSection } from "../components/site/ContactSection";
import { FaqList } from "../components/site/FaqList";
import { PageHero } from "../components/site/PageHero";
import { AccentText } from "../components/site/AccentText";
import { fetchPageMeta } from "../lib/content.rpc";
import { faqJsonLd, pageSeo } from "../lib/seo";

export const Route = createFileRoute("/faq")({
  /* Вопросы грузятся здесь, а не берутся из корня: head() видит только свой
     loaderData. Раньше список пытались достать из match.context — там лежит
     контекст роутера, а не данные, и в разметку FAQPage молча уходило
     mainEntity: []. То есть поисковику сообщалось, что вопросов на странице
     нет ни одного, при том что страница целиком из них и состоит. */
  loader: () => fetchPageMeta({ data: { path: "/faq" } }),
  head: ({ loaderData }) => {
    const base = pageSeo("/faq", loaderData);
    return { ...base, meta: [...base.meta, faqJsonLd(loaderData?.faq ?? [])] };
  },
  component: FaqPage,
});

function FaqPage() {
  const { faq, texts } = useLoaderData({ from: "__root__" });

  return (
    <>
      <PageHero
        eyebrow={texts["page.faq.eyebrow"]}
        title={<AccentText text={texts["page.faq.title"]} />}
        description={texts["page.faq.lead"]}
        mascotPose="peek"
      />

      <section className="container-page py-16 sm:py-24">
        <div className="max-w-3xl">
          <FaqList items={faq} />
        </div>
      </section>

      <ContactSection compact />
    </>
  );
}
