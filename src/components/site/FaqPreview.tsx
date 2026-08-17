import { Link, useLoaderData } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Plus, Minus } from "lucide-react";
import type { FaqItem } from "../../data/faq";
import { AccentText } from "./AccentText";
import { SectionEyebrow } from "./SectionEyebrow";

/* Раньше здесь лежал свой набор из четырёх вопросов с формулировками,
   отличными от `/faq`. Теперь список общий — расходиться нечему.
   Приходит пропом: вопросы правятся из админки и живут в базе. */
export function FaqPreview({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();
  const { texts } = useLoaderData({ from: "__root__" });
  return (
    <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16 items-start">
      <div>
        <SectionEyebrow>{texts["home.faq.eyebrow"]}</SectionEyebrow>
        <h2 className="mt-3 text-3xl sm:text-4xl font-display">
          <AccentText text={texts["home.faq.title"]} />
        </h2>
        <p className="mt-4 text-muted-foreground max-w-sm">{texts["home.faq.note"]}</p>
        <Link
          to="/faq"
          className="mt-4 -mx-1 inline-flex px-1 py-2.5 text-sm text-accent hover:brightness-110 font-medium"
        >
          Все вопросы →
        </Link>
      </div>

      <div className="divide-y divide-border border-t border-b border-border">
        {items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={it.q}>
              {/* `aria-expanded` и `aria-controls` обязательны: без них
                  скринридер объявляет строку просто кнопкой и не сообщает,
                  раскрыт ответ или свёрнут. */}
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`${baseId}-answer-${i}`}
                className="w-full flex items-center justify-between gap-6 py-5 text-left group"
              >
                <span className="font-display text-lg font-medium group-hover:text-accent transition-colors">
                  {it.q}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-full border border-border shrink-0 text-muted-foreground group-hover:text-accent group-hover:border-accent transition">
                  {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
              {/* `invisible` в свёрнутом состоянии: высота схлопывается через
                  grid-rows, но сам текст оставался в дереве доступности —
                  скринридер зачитывал все ответы подряд как сплошное полотно.
                  `invisible` убирает его оттуда и не мешает анимации. */}
              <div
                id={`${baseId}-answer-${i}`}
                role="region"
                className={
                  "grid transition-all duration-300 " +
                  (isOpen
                    ? "grid-rows-[1fr] opacity-100 pb-5"
                    : "invisible grid-rows-[0fr] opacity-0")
                }
              >
                <div className="overflow-hidden">
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{it.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
