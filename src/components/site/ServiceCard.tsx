import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { Service } from "../../data/services";

/**
 * Карточка отдельной услуги: название, цена «от», короткое описание.
 *
 * Была продублирована между главной и `/packages` и успела разойтись —
 * на главной у названия иконка и отступ до цены `mt-3`, на пакетах иконки
 * нет и отступ `mt-1`. Один и тот же объект в каталоге выглядел на двух
 * страницах по-разному.
 *
 * `icon` необязательна: на главной карточек шесть в три колонки и иконка
 * помогает их различать, на пакетах — четыре в ряд, там она бы тесно.
 */
export function ServiceCard({
  service,
  icon: Icon,
  className = "",
}: {
  service: Service;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Link
      to={service.path}
      className={`group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-accent/50 hover:card-lift ${className}`.trimEnd()}
    >
      {Icon ? (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-5 w-5" />
          </span>
          <div className="font-display text-lg transition-colors group-hover:text-accent">
            {service.cardTitle}
          </div>
        </div>
      ) : (
        <div className="font-display text-lg transition-colors group-hover:text-accent">
          {service.cardTitle}
        </div>
      )}

      <div className={`${Icon ? "mt-3" : "mt-1"} font-display text-xl font-semibold`}>
        {service.priceFrom}
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.short}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        Подробнее{" "}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
