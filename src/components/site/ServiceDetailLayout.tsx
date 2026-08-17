import { Link, useLoaderData } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Mascot } from "./Mascot";
import { ContactSection } from "./ContactSection";
import { CtaLink } from "./CtaLink";

type Props = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  accentColor?: "indigo" | "teal" | "amber";
  children: ReactNode;
};

const bgByAccent = {
  indigo: "from-indigo-500/25 via-violet-500/15 to-transparent",
  teal: "from-cyan-500/25 via-teal-500/15 to-transparent",
  amber: "from-amber-400/25 via-rose-400/15 to-transparent",
};

export function ServiceDetailLayout({
  eyebrow,
  title,
  description,
  icon: Icon,
  accentColor = "indigo",
  children,
}: Props) {
  /* Надписи кнопок — из снимка контента: одна строка на смысл, а не своя
     копия в каждом файле. Раньше «Получить разбор» стояла в четырёх местах,
     и правка по отдельности рано или поздно дала бы сайт, где в шапке одно,
     а на странице услуги другое. */
  const { texts } = useLoaderData({ from: "__root__" });

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className={`absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br ${bgByAccent[accentColor]} blur-3xl`}
          />
          <div className="absolute top-20 right-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.3]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
            }}
          />
        </div>

        <div className="container-page pt-10 sm:pt-14 pb-14 sm:pb-20">
          {/* Ссылка «назад» — 16px по высоте, пальцем не попасть. Паддинг
              растит цель до 40px, отрицательный margin гасит его в раскладке. */}
          <Link
            to="/services"
            className="-my-3 -ml-1 inline-flex items-center gap-1.5 px-1 py-3 text-xs text-muted-foreground hover:text-accent transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Все услуги
          </Link>

          <div className="mt-8 grid md:grid-cols-[1fr_auto] gap-10 items-end">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/70 backdrop-blur">
                <Icon className="h-3.5 w-3.5 text-accent" />
                <span className="text-[11px] uppercase tracking-[0.18em] text-accent font-semibold">
                  {eyebrow}
                </span>
              </div>
              <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight max-w-3xl">
                {title}
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
                {description}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink to="/contacts">
                  {texts["cta.primary"]} <ArrowRight className="h-4 w-4" />
                </CtaLink>
                <CtaLink to="/works" variant="secondary">
                  {texts["cta.works"]}
                </CtaLink>
              </div>
            </div>

            <div className="relative hidden md:block shrink-0">
              <div className="absolute inset-0 -m-8 bg-accent/25 rounded-full blur-3xl" />
              <Mascot
                decorative
                /* Скрыт до md — грузим лениво, чтобы не тратить трафик мобильных. */
                className="relative h-44 lg:h-52 w-auto object-contain"
                style={{ animation: "mascot-float 6s ease-in-out infinite" }}
              />
            </div>
          </div>
        </div>
      </section>

      {children}

      <ContactSection compact />
    </>
  );
}
