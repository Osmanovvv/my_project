import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { ServiceDetailLayout } from "./ServiceDetailLayout";
import type { ServicePath } from "../../data/services";
import { SectionEyebrow } from "./SectionEyebrow";

/** `to` — литеральный путь из каталога: опечатку ловит компилятор, без `as never`. */
type Sibling = { to: ServicePath; label: string };

type Props = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  accent?: "indigo" | "teal" | "amber";
  timeline: string;
  priceFrom: string;
  bestFor: string[];
  features: { icon: LucideIcon; title: string; text: string }[];
  process: { step: string; title: string; text: string }[];
  siblings: Sibling[];
};

export function ServiceVariationPage({
  eyebrow,
  title,
  description,
  icon,
  accent = "indigo",
  timeline,
  priceFrom,
  bestFor,
  features,
  process,
  siblings,
}: Props) {
  return (
    <ServiceDetailLayout
      eyebrow={eyebrow}
      title={title}
      description={description}
      icon={icon}
      accentColor={accent}
    >
      {/* Quick facts */}
      <section className="container-page pt-14">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent font-semibold">
              <Clock className="h-3.5 w-3.5" /> Срок
            </div>
            <div className="mt-2 font-display text-2xl">{timeline}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> От
            </div>
            <div className="mt-2 font-display text-2xl">{priceFrom}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-accent font-semibold">
              Кому подходит
            </div>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1">
              {bestFor.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <span className="mt-2 h-1 w-1 rounded-full bg-accent shrink-0" /> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-16 sm:py-24">
        <div className="mb-10">
          <SectionEyebrow>Что получите</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">Готовое решение под ключ</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title: t, text }) => (
            <div
              key={t}
              className="rounded-2xl border border-border bg-surface p-6 hover:border-accent/50 transition"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent mb-4">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="font-display text-lg">{t}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="container-page py-16 sm:py-24 border-t border-border">
        <div className="mb-10">
          <SectionEyebrow>Как работаем</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl">Шаги от идеи до запуска</h2>
        </div>
        <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {process.map(({ step, title: t, text }, i) => (
            <li key={t} className="relative rounded-2xl border border-border bg-surface p-6">
              <div className="text-[11px] uppercase tracking-[0.16em] text-accent font-semibold">
                Шаг {i + 1}
              </div>
              <div className="mt-2 font-display text-lg">{t}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
              <div className="mt-4 text-xs text-muted-foreground">{step}</div>
            </li>
          ))}
        </ol>

        {/* Без этой строки шаги противоречат общему сроку: сложив их, клиент
            получает вдвое меньше заявленного и решает, что его обманывают.
            А расходятся они честно — в шагах чистая работа, в общем сроке
            ещё и ожидание материалов с согласованиями, которое обычно
            занимает больше самой работы. */}
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          Здесь указано время работы. Общий срок больше: в него входит сбор текстов и фотографий,
          согласование макета и правки — и обычно именно это, а не разработка, занимает основное
          время.
        </p>
      </section>

      {/* CTA + siblings */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-accent-soft/60 via-background to-background p-8 sm:p-10">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <h3 className="font-display text-2xl sm:text-3xl">Обсудим ваш проект?</h3>
              <p className="mt-2 text-muted-foreground max-w-xl">
                Расскажите задачу — вернёмся с идеями, примерами и точной оценкой в течение дня.
              </p>
            </div>
            <Link
              to="/contacts"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-medium text-background hover:bg-accent transition"
            >
              Обсудить <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {siblings.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-4">
                Смотрите также
              </div>
              <div className="flex flex-wrap gap-2">
                {siblings.map((s) => (
                  <Link
                    key={s.to}
                    to={s.to}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:text-accent hover:border-accent transition"
                  >
                    {s.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </ServiceDetailLayout>
  );
}
