/**
 * Кейсы: тип, вспомогательные функции и данные для первичного заполнения базы.
 *
 * С этого момента источник правды — база: кейсы создаёт владелец через
 * админку. Массив ниже используется ОДИН раз, когда база пуста, чтобы сайт
 * после переезда выглядел ровно так же, как выглядел из файла.
 *
 * ⚠️ СОДЕРЖИМОЕ НИЖЕ ВЫДУМАНО. Клиентов, проектов и результатов не было:
 * это осталось от шаблона. Заполнение нужно только чтобы переезд на базу
 * ничего не сдвинул; заменить на настоящие проекты — отдельная задача,
 * и делается она уже из админки, а не правкой этого файла.
 */

import type { ServiceId } from "./services";
import type { CasePattern, GradientKey } from "./case-presets";

export type CaseTag = "Сайт" | "Бот" | "Админка" | "MiniApp";

export type CaseStudy = {
  slug: string;
  title: string;
  client: string;
  /** Ниша — показывается в шапке кейса. */
  industry: string;
  tags: CaseTag[];
  /** Короткий итог для карточки. */
  result: string;
  /**
   * Загруженная обложка. Пока её нет, карточка рисуется градиентом —
   * это заглушка на время, а не второй способ оформления.
   */
  cover: { id: number; url: string; width: number; height: number } | null;
  /** Ключ пресета заглушки, НЕ классы Tailwind. См. `case-presets.ts`. */
  gradient: GradientKey;
  pattern: CasePattern;
  /** Абзац-подводка на странице кейса. */
  summary: string;
  /** Что болело у клиента. */
  challenge: string[];
  /** Что предложили. */
  solution: string[];
  /** Что в итоге отдали. */
  delivered: string[];
  stack: string[];
  timeline: string;
  /** Связанные услуги — для перелинковки. */
  services: ServiceId[];
  /** Черновик виден только в админке. */
  published: boolean;
  /** Порядок в сетке; меньше — раньше. */
  position: number;
};

/** Порядок тегов в фильтре — одинаковый на сайте и в админке. */
export const TAG_ORDER: CaseTag[] = ["Сайт", "Бот", "Админка", "MiniApp"];

/**
 * Кейсы для первичного заполнения базы — ПУСТО, и это намеренно.
 *
 * Здесь лежали шесть выдуманных кейсов из шаблона: магазин керамики,
 * клиника, онлайн-школа, автосервис, ремонт квартир, B2B-каталог. Ни одного
 * из них не существует, а «×2 конверсия в оплату» и «+62% заявок» никто
 * не измерял.
 *
 * Владелец удалил их из своей базы, но код продолжал бы засевать их заново
 * в любую ЧИСТУЮ базу — то есть ровно при переезде на боевой сервер, где
 * каталог данных пустой. Выдуманное портфолио вернулось бы именно в тот
 * момент, когда сайт впервые увидят посторонние.
 *
 * Пустой массив означает: новая база стартует без кейсов. Сайт это умеет —
 * блок работ на главной скрывается, а страница работ показывает «Ваш кейс
 * будет здесь». Первый кейс заводится из админки.
 */
export const LEGACY_CASES: CaseStudy[] = [];

// ─────────────────────────────────────── функции над готовым списком ────────
// Чистые: получают массив кейсов (из базы) и ничего сами не загружают.

/** Теги для фильтра — только те, что реально встречаются. */
export function tagsOf(cases: CaseStudy[]): CaseTag[] {
  return TAG_ORDER.filter((tag) => cases.some((item) => item.tags.includes(tag)));
}

export function filterCases(cases: CaseStudy[], tag: CaseTag | "Все"): CaseStudy[] {
  if (tag === "Все") return cases;
  return cases.filter((item) => item.tags.includes(tag));
}

/** Соседние кейсы для перелинковки внизу страницы кейса. */
export function relatedCases(cases: CaseStudy[], slug: string, limit = 3): CaseStudy[] {
  const current = cases.find((item) => item.slug === slug);
  if (!current) return cases.slice(0, limit);

  return cases
    .filter((item) => item.slug !== slug)
    .map((item) => ({
      item,
      score: item.tags.filter((tag) => current.tags.includes(tag)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
