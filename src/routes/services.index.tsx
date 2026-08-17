import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Globe, Bot, LifeBuoy, Sparkles } from "lucide-react";
import { PageHero } from "../components/site/PageHero";
import { ContactSection } from "../components/site/ContactSection";
import { Mascot } from "../components/site/Mascot";
import { CATEGORIES } from "../data/services";
import { seo } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CtaLink } from "../components/site/CtaLink";

export const Route = createFileRoute("/services/")({
  head: () =>
    seo({
      title: "Разработка сайтов и Telegram-ботов под ключ — IT-Agent",
      description:
        "Разрабатываем сайты, Telegram и MAX ботов, MiniApp и админку заявок. Собираем их в одну систему: заявка с сайта приходит менеджеру в Telegram за секунды. Цены от 40 000 ₽.",
      path: "/services",
      socialDescription: "Три направления IT-Agent: сайты, боты и MiniApp, поддержка и SEO.",
    }),
  component: ServicesHub,
});

/* Пути направлений — из каталога, чтобы ссылка не разъехалась с роутами. */
const [websitesCategory, botsCategory, supportCategory] = CATEGORIES;

const categories = [
  {
    to: websitesCategory.path,
    step: "01",
    icon: Globe,
    title: "Сайты",
    tagline: "Точка входа",
    text: "Лендинги, корпоративные сайты и e-commerce в связке с ботом и админкой.",
    bullets: [
      "Дизайн под ваш бренд",
      "Формы, интеграции, аналитика",
      "Скорость и мобильная версия",
    ],
    gradient: "from-indigo-500/25 via-violet-500/15 to-transparent",
    accent: "text-indigo-500",
  },
  {
    to: botsCategory.path,
    step: "02",
    icon: Bot,
    title: "Боты и MiniApp",
    tagline: "Telegram · MAX · MiniApp",
    text: "Чат-боты и мини-приложения внутри Telegram и MAX: заказы, оплаты, поддержка, программы лояльности.",
    bullets: ["Telegram и MAX боты", "Telegram MiniApp / Web App", "CRM, платежи, уведомления"],
    gradient: "from-cyan-500/25 via-teal-500/15 to-transparent",
    accent: "text-teal-500",
  },
  {
    to: supportCategory.path,
    step: "03",
    icon: LifeBuoy,
    title: "Поддержка и SEO",
    tagline: "Сопровождение",
    text: "Следим, обновляем, продвигаем. Ваш сайт не ломается и растёт в поиске.",
    bullets: ["Мониторинг 24/7 и бэкапы", "SEO, аналитика, отчёты", "Правки контента и доработки"],
    gradient: "from-amber-400/25 via-rose-400/15 to-transparent",
    accent: "text-amber-500",
  },
];

function ServicesHub() {
  return (
    <>
      <PageHero
        eyebrow="Услуги"
        title={
          <>
            Три направления, <span className="text-accent">одна команда</span>
          </>
        }
        description="Сайты, боты и MiniApp, поддержка и SEO — выбирайте одно направление или собирайте связку под задачу."
      >
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-background/80 backdrop-blur text-sm text-foreground hover:border-accent hover:text-accent transition"
            >
              <c.icon className="h-3.5 w-3.5 text-accent" />
              {c.title}
            </Link>
          ))}
        </div>
      </PageHero>

      <section className="container-page py-16 sm:py-24">
        <div className="grid md:grid-cols-3 gap-6">
          {categories.map(
            ({ to, step, icon: Icon, title, tagline, text, bullets, gradient, accent }) => (
              <Link
                key={to}
                to={to}
                className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-7 hover:border-accent/50 hover:card-lift transition-all"
              >
                <div
                  className={`pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br ${gradient} blur-3xl opacity-70 group-hover:opacity-100 transition`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-xl bg-background border border-border ${accent}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <span className="font-display text-xs tracking-[0.16em] text-muted-foreground">
                      {step}
                    </span>
                  </div>
                  <div className="mt-6 font-display text-2xl">{title}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-accent/80">
                    {tagline}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{text}</p>
                  <ul className="mt-5 space-y-2">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground/85">
                        <Sparkles className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    Подробнее
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ),
          )}
        </div>
      </section>

      {/* Mascot promo strip */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-accent/10 via-surface to-background p-8 sm:p-12">
          <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
          <Mascot
            decorative
            className="pointer-events-none absolute -bottom-4 right-6 h-40 sm:h-52 w-auto z-20 hidden md:block"
            style={{ animation: "mascot-float 6s ease-in-out infinite" }}
          />
          <div className="relative max-w-xl">
            <SectionEyebrow>Не уверены, что выбрать?</SectionEyebrow>
            <h3 className="mt-3 font-display text-3xl sm:text-4xl leading-tight">
              Разберём задачу — предложим комбинацию.
            </h3>
            <p className="mt-4 text-muted-foreground">
              Сайт + бот, только MiniApp, поддержка старого проекта — расскажите и IT-Agent соберёт
              схему под ваш кейс.
            </p>
            <CtaLink to="/contacts" className="mt-8">
              Получить разбор
              <ArrowRight className="h-4 w-4" />
            </CtaLink>
          </div>
        </div>
      </section>

      <ContactSection compact />
    </>
  );
}
