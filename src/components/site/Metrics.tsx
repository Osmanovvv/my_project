import { Mascot } from "./Mascot";
import { SectionEyebrow } from "./SectionEyebrow";

const metrics = [
  { v: "+40%", label: "заявок в среднем за первый месяц" },
  { v: "<2 нед", label: "до запуска простого проекта" },
  { v: "100%", label: "заявок в одном месте со статусом" },
  { v: "24/7", label: "приём заявок без участия менеджера" },
];

export function Metrics() {
  return (
    <div className="relative rounded-4xl border border-border bg-surface p-6 sm:p-10 overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      {/* mascot corner peek — on top of the cards */}
      <Mascot
        decorative
        className="pointer-events-none absolute bottom-6 right-6 sm:right-8 h-32 sm:h-36 w-auto z-20 hidden sm:block"
        style={{ animation: "mascot-float 6s ease-in-out infinite" }}
      />

      <div className="relative flex items-end justify-between mb-8 gap-4">
        <div>
          <SectionEyebrow>Цифры</SectionEyebrow>
          <h3 className="mt-2 font-display text-2xl sm:text-3xl max-w-md">
            Что меняется после запуска
          </h3>
        </div>
      </div>

      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="group relative min-w-0 rounded-2xl bg-background border border-border p-5 sm:p-6 last:sm:pr-24 hover:border-accent/40 transition-all"
          >
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition" />
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
              0{i + 1}
            </div>
            {/* Кегль растёт ступенями, а не сразу до 5xl: на 360 в две колонки
                и на 1024 в четыре (где у последней карточки ещё pr-24 под
                маскота) число «+40%» и «24/7» не помещалось и обрезалось. */}
            <div
              className="font-display text-3xl sm:text-4xl xl:text-5xl font-semibold tracking-tight leading-none"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, var(--foreground)))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {m.v}
            </div>
            <div className="mt-4 text-xs sm:text-sm text-muted-foreground leading-snug">
              {m.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
