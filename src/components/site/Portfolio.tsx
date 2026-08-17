import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { CaseStudy } from "../../data/cases";
import { gradientClasses, type CasePattern } from "../../data/case-presets";

/**
 * Сетка кейсов.
 *
 * Кейсы приходят пропом: они живут в базе, а этот компонент рендерится и на
 * клиенте — читать базу отсюда нельзя. Загружает их страница в своём loader.
 */
export function Portfolio({ cases }: { cases: CaseStudy[] }) {
  if (cases.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        В этом направлении кейсов пока нет — покажем похожие по запросу.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cases.map((c) => (
        <Link
          key={c.slug}
          to="/works/$slug"
          params={{ slug: c.slug }}
          className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface hover:border-accent/40 hover:card-lift transition-all duration-300"
        >
          {/* Классы градиента подставляются из реестра по ключу: в базе
              лежит `indigo`, а не строка классов — иначе Tailwind не увидел бы
              их при сборке и обложка осталась бы прозрачной. */}
          <div
            className={`relative aspect-[4/3] bg-gradient-to-br ${gradientClasses(c.gradient)} overflow-hidden`}
          >
            <Pattern kind={c.pattern} />
            {/* Плашка тёмная, а не светлая: градиенты карточек разной светлоты,
                и на янтарном или бирюзовом белый текст на `bg-white/20`
                выцветал до нечитаемого. Белое на затемнении читается на любом. */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-medium tracking-wider uppercase px-2 py-1 rounded-full bg-black/40 text-white backdrop-blur-md"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="text-xs text-muted-foreground">{c.client}</div>
            <div className="mt-1 font-display text-xl font-semibold group-hover:text-accent transition-colors">
              {c.title}
            </div>
            <div className="mt-4 pt-4 border-t border-border text-sm text-foreground/80">
              <span className="text-accent font-medium">→</span> {c.result}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Pattern({ kind }: { kind: CasePattern }) {
  // id паттерна обязан быть уникальным: на странице работ карточек несколько,
  // с константным id в DOM появлялись дубликаты, а `url(#…)` во всех карточках
  // ссылался на первый. Сейчас паттерны одинаковые и подмена незаметна, но
  // любое их расхождение превратилось бы в загадочный баг.
  const uid = useId();
  const common = "absolute inset-0 opacity-30 text-white/60";
  if (kind === "grid") {
    const id = `grid-${uid}`;
    return (
      <svg className={common} xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0 L0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    );
  }
  if (kind === "dots") {
    const id = `dots-${uid}`;
    return (
      <svg className={common} xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    );
  }
  if (kind === "waves") {
    return (
      <svg className={common} viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
        {[...Array(8)].map((_, i) => (
          <path
            key={i}
            d={`M0 ${40 + i * 32} Q100 ${20 + i * 32}, 200 ${40 + i * 32} T400 ${40 + i * 32}`}
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        ))}
      </svg>
    );
  }
  if (kind === "circles") {
    return (
      <svg className={common} viewBox="0 0 400 300" aria-hidden>
        {[...Array(6)].map((_, i) => (
          <circle
            key={i}
            cx="200"
            cy="150"
            r={30 + i * 35}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>
    );
  }
  if (kind === "diagonals") {
    return (
      <svg className={common} xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <pattern
            id="p-diag"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="16" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p-diag)" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 400 300" aria-hidden>
      {[...Array(24)].map((_, i) => {
        const x = (i % 6) * 66 + 8;
        const y = Math.floor(i / 6) * 70 + 8;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={50}
            height={54}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            rx="6"
          />
        );
      })}
    </svg>
  );
}
