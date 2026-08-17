import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Send,
  MessageSquare,
  Sparkles,
  CreditCard,
  Bell,
  Users,
  Check,
} from "lucide-react";
import { ServiceDetailLayout } from "../components/site/ServiceDetailLayout";
import { seo } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CheckMark } from "../components/site/CheckMark";

export const Route = createFileRoute("/services/bots/")({
  head: () =>
    seo({
      title: "Боты и MiniApp — Услуги IT-Agent",
      description:
        "Telegram и MAX боты, Telegram MiniApp: заказы, оплаты, поддержка, программы лояльности.",
      path: "/services/bots",
      socialTitle: "Боты и MiniApp — IT-Agent",
      socialDescription: "Чат-боты Telegram и MAX, а также MiniApp внутри мессенджеров.",
    }),
  component: BotsPage,
});

const platforms = [
  {
    icon: Send,
    name: "Telegram-боты",
    desc: "Приём заявок, уведомления, воронки, автоответы.",
    to: "/services/bots/telegram" as const,
  },
  {
    icon: MessageSquare,
    name: "MAX-боты",
    desc: "Российский мессенджер MAX — новая аудитория, тот же движок.",
    to: "/services/bots/max" as const,
  },
  {
    icon: Sparkles,
    name: "Telegram MiniApp",
    desc: "Полноценное веб-приложение внутри Telegram: каталог, оплата, аккаунт.",
    to: "/services/bots/miniapp" as const,
  },
];

const useCases = [
  {
    icon: CreditCard,
    title: "Приём оплат",
    text: "Stripe, ЮKassa, Telegram Payments прямо в чате.",
  },
  { icon: Bell, title: "Уведомления", text: "Клиенту — статус заказа, менеджеру — новая заявка." },
  {
    icon: Users,
    title: "Клубы и лояльность",
    text: "Кэшбек, реферальная программа, закрытые сообщества.",
  },
  { icon: Bot, title: "AI-ассистент", text: "Отвечает на частые вопросы, квалифицирует лиды." },
];

function BotsPage() {
  return (
    <ServiceDetailLayout
      eyebrow="Боты и MiniApp"
      title={
        <>
          Боты в <span className="text-accent">Telegram и MAX</span>, MiniApp
        </>
      }
      description="Автоматизируем общение и продажи прямо в мессенджерах. Работает 24/7, не устаёт и не забывает."
      icon={Bot}
      accentColor="teal"
    >
      <section className="container-page py-16 sm:py-24">
        <div className="mb-10">
          <SectionEyebrow>Платформы</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">Где работаем</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {platforms.map(({ icon: Icon, name, desc, to }) => (
            <Link
              key={name}
              to={to}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-7 hover:border-accent/50 hover:-translate-y-0.5 transition"
            >
              <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl group-hover:bg-accent/30 transition" />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground mb-5">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="font-display text-xl">{name}</div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  Подробнее{" "}
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page py-16 sm:py-24 border-t border-border">
        <div className="mb-10">
          <SectionEyebrow>Что умеют</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl">Готовые сценарии</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {useCases.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-surface p-6 hover:border-accent/50 transition"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent mb-4">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="font-display text-base">{title}</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 sm:py-24 border-t border-border">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <SectionEyebrow>Стек</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl">MiniApp — сайт внутри мессенджера</h2>
            <p className="mt-4 text-muted-foreground">
              Каталог, корзина, личный кабинет, оплата — всё открывается прямо в Telegram или MAX,
              без установки приложений. Пользователь остаётся в мессенджере, вы получаете конверсию
              как у native app.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "React / Next.js внутри WebApp",
              "Telegram Payments и внешние платёжки",
              "Авторизация через мессенджер",
              "Синхронизация с CRM и админкой",
            ].map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm"
              >
                <CheckMark />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10">
          <Link
            to="/contacts"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-foreground px-6 text-sm font-medium text-background hover:bg-accent transition"
          >
            Обсудить бота или MiniApp <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </ServiceDetailLayout>
  );
}
