import { ChevronDown } from "lucide-react";

import type { FaqItem } from "../../data/faq";

/**
 * Список вопросов и ответов.
 *
 * Собран на нативных `<details>`, а не на компоненте-аккордеоне, и это
 * не вкусовщина. Аккордеон не выводил содержимое, пока пункт закрыт:
 * поисковый робот получал восемь вопросов и НИ ОДНОГО ответа — при том,
 * что страница вопросов лучше всего отвечает на запросы вида «сколько
 * стоит телеграм бот». Текст был написан и просто не существовал для поиска.
 *
 * У `<details>` содержимое всегда в разметке. Побочно: работает без
 * JavaScript, доступно с клавиатуры без единой строки кода и не тянет
 * за собой библиотеку.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="w-full">
      {items.map((item, index) => (
        <details
          key={item.id ?? item.q}
          /* Первый пункт открыт: пустой список из одних заголовков выглядит
             так, будто страница не догрузилась. */
          open={index === 0}
          className="group border-b border-border/70"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-display text-lg transition hover:text-accent [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="pb-6 text-[15px] leading-relaxed text-muted-foreground">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
