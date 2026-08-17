import type { ReactNode } from "react";
import { Mascot } from "./Mascot";
import { SectionEyebrow } from "./SectionEyebrow";

type Props = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /* Был ещё вариант "float", но ветвления под него в компоненте нет —
     он вёл себя как "wave" и никем не использовался. */
  mascotPose?: "wave" | "peek";
};

export function PageHero({ eyebrow, title, description, children, mascotPose = "wave" }: Props) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-40 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute top-10 right-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
          }}
        />
      </div>

      <div className="container-page pt-16 sm:pt-24 pb-14 sm:pb-20">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-14 items-end">
          <div>
            <SectionEyebrow>{eyebrow}</SectionEyebrow>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.03] tracking-tight max-w-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
            {children && <div className="mt-8">{children}</div>}
          </div>

          <div className="relative hidden md:block shrink-0">
            <div className="absolute inset-0 -m-6 bg-accent/20 rounded-full blur-3xl" />
            <Mascot
              /* `hidden md:block` — на мобильных не показывается, поэтому
                 без priority: ленивая картинка в display:none не качается.
                 `decorative` — маскот тут украшение, а не содержание: без
                 него скринридер на каждой странице зачитывал «Маскот IT-Agent»
                 перед основным текстом. */
              decorative
              className="relative h-40 lg:h-48 w-auto object-contain"
              style={{
                animation:
                  mascotPose === "peek"
                    ? "mascot-float 5s ease-in-out infinite"
                    : "mascot-float 6s ease-in-out infinite",
                transform: mascotPose === "peek" ? "rotate(-8deg)" : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
