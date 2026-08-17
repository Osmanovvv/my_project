import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { ContactSection } from "../components/site/ContactSection";
import { PageHero } from "../components/site/PageHero";
import { FAQ } from "../data/faq";
import { faqJsonLd, seo } from "../lib/seo";

export const Route = createFileRoute("/faq")({
  head: () => {
    const base = seo({
      title: "Вопросы о разработке сайтов и Telegram-ботов | IT-Agent",
      description:
        "Сколько стоит сайт с ботом, какие сроки, нужно ли техзадание, что будет после запуска и можно ли заказать что-то одно. Отвечаем коротко и по делу.",
      path: "/faq",
      socialTitle: "Вопросы — IT-Agent",
      socialDescription: "Что нужно на старте, сколько занимает запуск, что делаем после.",
    });
    return { ...base, meta: [...base.meta, faqJsonLd(FAQ)] };
  },
  component: FaqPage,
});

function FaqPage() {
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
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-border/70">
                <AccordionTrigger className="text-left font-display text-lg hover:text-accent hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <ContactSection compact />
    </>
  );
}
