import { createFileRoute } from "@tanstack/react-router";
import {
  Wrench,
  Store,
  Briefcase,
  Cloud,
  Truck,
  Rocket,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { ContactSection } from "../components/site/ContactSection";
import { PageHero } from "../components/site/PageHero";
import { Mascot } from "../components/site/Mascot";
import { seo } from "../lib/seo";
export const Route = createFileRoute("/industries")({
  head: () =>
    seo({
      title: "Кому нужен сайт с Telegram-ботом и админкой | IT-Agent",
      description:
        "Сервисный бизнес, локальные компании, B2B, онлайн-сервисы и выездные услуги. Шесть типичных ситуаций: где теряются заявки и что мы с этим делаем.",
      path: "/industries",
      socialDescription: "Шесть типичных сценариев: задача бизнеса и что мы делаем.",
    }),
  component: IndustriesPage,
});
type Scenario = {
  name: string;
  icon: LucideIcon;
  problem: string;
  solution: string;
  tag: string;
};
const scenarios: Scenario[] = [
  {
    name: "Сервисный бизнес",
    icon: Wrench,
    tag: "ремонт · клининг · сервис",
    problem: "Заявки теряются между звонками и мессенджерами.",
    solution: "Сайт + Telegram-уведомления, менеджер видит всё в одном месте.",
  },
  {
    name: "Локальная компания",
    icon: Store,
    tag: "офлайн-точки · услуги района",
    problem: "Клиенты пишут в 3 канала, забываем перезвонить.",
    solution: "Единая админка со статусами и напоминаниями.",
  },
  {
    name: "B2B-услуги",
    icon: Briefcase,
    tag: "агентства · подрядчики",
    problem: "Долгий цикл сделки, теряется история клиента.",
    solution: "История, комментарии и следующий шаг по каждой заявке.",
  },
  {
    name: "Онлайн-сервис",
    icon: Cloud,
    tag: "SaaS · онлайн-запись",
    problem: "Нужно быстро обрабатывать входящие заявки.",
    solution: "Форма → бот → админка со статусами. Всё автоматически.",
  },
  {
    name: "Выездные услуги",
    icon: Truck,
    tag: "доставка · монтаж · выезд",
    problem: "Менеджер в разъездах, отвечать неудобно.",
    solution: "Заявки в Telegram — можно ответить с телефона за 30 секунд.",
  },
  {
    name: "Стартап",
    icon: Rocket,
    tag: "MVP · первые клиенты",
    problem: "Нет времени и бюджета на большую CRM.",
    solution: "Начинаем со «Старта» и растём по мере потока заявок.",
  },
];
function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Для кого"
        title={
          <>
            Шесть типичных <span className="text-accent">ситуаций</span>
          </>
        }
        description="Найдите свою — так проще понять, что именно мы будем делать."
        mascotPose="peek"
      />
      <section className="container-page py-16 sm:py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenarios.map((s, i) => (
            <ScenarioCard key={s.name} scenario={s} index={i} />
          ))}
        </div>
        {/* Mascot band */}
        <div className="mt-16 relative rounded-3xl border border-border bg-surface p-8 sm:p-10 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="relative shrink-0">
              <div className="absolute inset-0 -m-4 rounded-full bg-accent/25 blur-2xl" />
              <Mascot
                decorative
                className="relative h-32 sm:h-36 w-auto"
                style={{ animation: "mascot-float 6s ease-in-out infinite" }}
              />
            </div>
            <div className="text-center md:text-left">
              <div className="font-display text-2xl sm:text-3xl leading-tight max-w-xl">
                Не нашли свою нишу? Это не проблема.
              </div>
              <p className="mt-3 text-muted-foreground max-w-xl">
                Мы работаем с любым бизнесом, где есть входящие заявки. Расскажите про свой поток —
                предложим схему.
              </p>
            </div>
          </div>
        </div>
      </section>
      <ContactSection compact />
    </>
  );
}
function ScenarioCard({ scenario, index }: { scenario: Scenario; index: number }) {
  const { name, icon: Icon, problem, solution, tag } = scenario;
  return (
    <div className="group relative rounded-2xl border border-border bg-surface p-7 hover:border-accent/40 hover:card-lift transition-all">
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent group-hover:scale-105 transition-transform">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <span className="text-accent font-display text-xs tracking-widest">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-5 font-display text-xl">{name}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {tag}
      </div>
      <div className="mt-6 space-y-4">
        <div className="rounded-xl bg-muted/60 border border-border/60 p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Задача
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{problem}</p>
        </div>
        <div className="flex justify-center">
          <ArrowRight className="h-4 w-4 text-accent rotate-90" />
        </div>
        <div className="rounded-xl bg-accent-soft border border-accent/20 p-4">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-1.5 font-semibold">
            Что делаем
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{solution}</p>
        </div>
      </div>
    </div>
  );
}
