import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Mail, Phone, Send, type LucideIcon } from "lucide-react";
import { ContactSection } from "../components/site/ContactSection";
import { PageHero } from "../components/site/PageHero";
import { ORGANIZATION, type ContactChannel } from "../data/contacts";
import { absoluteUrl, jsonLd, seo } from "../lib/seo";

export const Route = createFileRoute("/contacts")({
  head: () => {
    const base = seo({
      title: "Заказать сайт, Telegram-бота или админку | Контакты IT-Agent",
      description:
        "Оставьте заявку — вернёмся с коротким разбором вашей ситуации. Без длинного техзадания и обязательств на старте.",
      path: "/contacts",
      socialTitle: "Контакты — IT-Agent",
      socialDescription: "Форма заявки. Отвечаем в течение рабочего дня.",
    });
    return {
      ...base,
      meta: [
        ...base.meta,
        jsonLd({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Контакты IT-Agent",
          url: absoluteUrl("/contacts"),
          about: { "@type": "Organization", name: ORGANIZATION.name, url: absoluteUrl("/") },
        }),
      ],
    };
  },
  component: ContactsPage,
});

const ICONS: Record<ContactChannel["id"], LucideIcon> = {
  telegram: Send,
  phone: Phone,
  email: Mail,
};

function ContactsPage() {
  const { contacts } = useLoaderData({ from: "__root__" });

  return (
    <>
      <PageHero
        eyebrow="Контакты"
        title={
          <>
            Первый шаг — <span className="text-accent">короткий разговор</span>
          </>
        }
        description="Оставьте заявку — ответим в течение рабочего дня."
      />

      {/* Пока каналов нет, сетку не рисуем: пустой ряд карточек читается как
          поломка вёрстки. Появится первый контакт в `CONTACT_CHANNELS` —
          блок вернётся сам, править здесь ничего не нужно. */}
      {contacts.length > 0 && (
        <section className="container-page pt-8 pb-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {contacts.map((channel: ContactChannel) => {
              const Icon = ICONS[channel.id];
              const external = channel.href.startsWith("http");
              return (
                <a
                  key={channel.id}
                  href={channel.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="rounded-2xl border border-border bg-surface/60 p-6 transition hover:border-accent/40 hover:bg-surface"
                >
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
                  <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                    {channel.label}
                  </div>
                  <div className="mt-1 font-display text-lg">{channel.value}</div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <ContactSection />
    </>
  );
}
