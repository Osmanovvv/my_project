import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  LifeBuoy,
  Search,
  Activity,
  ShieldCheck,
  LineChart,
  Wrench,
  RefreshCw,
  Check,
} from "lucide-react";
import { ServiceDetailLayout } from "../components/site/ServiceDetailLayout";
import { formatPrice, getService } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CheckMark } from "../components/site/CheckMark";

const service = getService("support");

export const Route = createFileRoute("/services/support")({
  head: () => {
    const base = seo({
      title: "Поддержка и SEO — Услуги IT-Agent",
      description:
        "Мониторинг 24/7, SEO, аналитика, доработки. Сайт не ломается и растёт в поиске.",
      path: service.path,
      socialTitle: "Поддержка и SEO — IT-Agent",
      socialDescription: "Сопровождение сайтов и ботов: мониторинг, SEO, аналитика, правки.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: SupportPage,
});

const services = [
  {
    icon: Activity,
    title: "Мониторинг 24/7",
    text: "Следим за доступностью, скоростью и ошибками. Реагируем до того, как заметит клиент.",
  },
  {
    icon: ShieldCheck,
    title: "Безопасность и бэкапы",
    text: "Обновления, SSL, защита от ботов, ежедневные резервные копии.",
  },
  {
    icon: Search,
    title: "SEO-продвижение",
    text: "Аудит, семантика, on-page оптимизация, техническая база, контент-стратегия.",
  },
  {
    icon: LineChart,
    title: "Аналитика и отчёты",
    text: "Настройка целей, дашборды, ежемесячные отчёты с рекомендациями.",
  },
  {
    icon: Wrench,
    title: "Правки и доработки",
    text: "Быстрые изменения контента, дизайна, новых блоков и интеграций.",
  },
  {
    icon: RefreshCw,
    title: "Регулярные апдейты",
    text: "Обновление зависимостей, рефакторинг, добавление новых фич.",
  },
];

const plans = [
  {
    name: "Базовый",
    /* Стартовая цена направления — из каталога, чтобы не разъезжалась с карточками. */
    price: getService("support").priceFrom,
    features: ["Мониторинг 24/7", "Бэкапы", "До 3 часов правок", "Отчёт раз в месяц"],
    highlight: false,
  },
  {
    name: "SEO + Поддержка",
    /* Через formatPrice, а не строкой: он ставит неразрывные пробелы, иначе
       «35 000 ₽/мес» рвалось по строкам в узкой колонке, пока соседний
       тариф из каталога оставался целым. */
    price: formatPrice(35_000, "month"),
    features: ["Всё из Базового", "SEO-работы: 20 часов", "Аналитика и цели", "Дашборд метрик"],
    highlight: true,
  },
  {
    name: "Полное сопровождение",
    price: "по запросу",
    features: ["Всё из SEO", "Выделенный менеджер", "Приоритет по правкам", "Разработка новых фич"],
    highlight: false,
  },
];

function SupportPage() {
  return (
    <ServiceDetailLayout
      eyebrow="Поддержка и SEO"
      title={
        <>
          Ваш сайт <span className="text-accent">под присмотром</span>
        </>
      }
      description="Не просто «работает» — растёт в поиске, не падает и обновляется. Возьмём всю рутину на себя."
      icon={LifeBuoy}
      accentColor="amber"
    >
      <section className="container-page py-16 sm:py-24">
        <div className="mb-10">
          <SectionEyebrow>Что делаем</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">Полный цикл сопровождения</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border bg-surface p-6 hover:border-accent/50 hover:-translate-y-0.5 transition-all"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent mb-5">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="font-display text-lg">{title}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 sm:py-24 border-t border-border">
        <div className="mb-10 text-center">
          <SectionEyebrow>Тарифы</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl">Выберите уровень</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 ${
                p.highlight
                  ? "border-accent bg-gradient-to-br from-accent/10 via-surface to-background shadow-2xl shadow-accent/20"
                  : "border-border bg-surface"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                  Популярно
                </span>
              )}
              <div className="font-display text-xl">{p.name}</div>
              <div className="mt-2 text-accent font-display text-2xl">{p.price}</div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckMark variant="plain" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/contacts"
                className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition ${
                  p.highlight
                    ? "bg-accent text-accent-foreground hover:brightness-110"
                    : "border border-border text-foreground hover:border-accent hover:text-accent"
                }`}
              >
                Обсудить <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </ServiceDetailLayout>
  );
}
