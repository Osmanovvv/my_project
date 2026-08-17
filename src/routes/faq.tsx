import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { ContactSection } from "../components/site/ContactSection";
import { FaqList } from "../components/site/FaqList";
import { PageHero } from "../components/site/PageHero";
import { faqJsonLd, seo } from "../lib/seo";

export const Route = createFileRoute("/faq")({
  head: ({ match }) => {
    /* Вопросы приходят из загрузчика корня — они правятся из админки. */
    const faq = (match.context as { faq?: Array<{ q: string; a: string }> })?.faq ?? [];
    const base = seo({
      title: "Вопросы о разработке сайтов и Telegram-ботов | IT-Agent",
      description:
        "Сколько стоит сайт с ботом, какие сроки, нужно ли техзадание, что будет после запуска и можно ли заказать что-то одно. Отвечаем коротко и по делу.",
      path: "/faq",
      socialTitle: "Вопросы — IT-Agent",
      socialDescription: "Что нужно на старте, сколько занимает запуск, что делаем после.",
    });
    return { ...base, meta: [...base.meta, faqJsonLd(faq)] };
  },
  component: FaqPage,
});

function FaqPage() {
  const { faq } = useLoaderData({ from: "__root__" });

  return (
    <>
      <PageHero
        eyebrow="Вопросы"
        title={
          <>
            Короткие <span className="text-accent">ответы</span>
          </>
        }
        description="Если чего-то не хватает — напишите, ответим лично."
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
