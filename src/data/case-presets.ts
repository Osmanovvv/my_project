/**
 * Оформление обложек кейсов: градиенты и узоры.
 *
 * ЭТО ДОЛЖНО ОСТАВАТЬСЯ В КОДЕ, и вот почему. Tailwind v4 собирает стили,
 * сканируя ИСХОДНИКИ (см. `@source "../src"` в styles.css). Классы вроде
 * `from-indigo-500/90` он находит как текст в файлах и только тогда
 * генерирует под них правила.
 *
 * Если хранить такие классы в базе, Tailwind их не увидит при сборке,
 * правил не создаст — и обложка станет прозрачной. Причём тихо: ошибок
 * не будет ни при сборке, ни в консоли, просто на сайте пропадёт фон.
 *
 * Поэтому в базе лежит КЛЮЧ пресета (`indigo`, `teal`, …), а классы
 * подставляются отсюда. Владелец в админке выбирает из готовых вариантов —
 * это и защита от такой поломки, и защита от «фиолетовый на лиловом».
 */

export const GRADIENT_KEYS = ["indigo", "teal", "amber", "slate", "emerald", "violet"] as const;

export type GradientKey = (typeof GRADIENT_KEYS)[number];

export const CASE_PATTERNS = ["grid", "waves", "dots", "circles", "diagonals", "blocks"] as const;

export type CasePattern = (typeof CASE_PATTERNS)[number];

/** Ключ → классы Tailwind. Значения записаны литералами, иначе их не найдёт сборщик. */
export const GRADIENTS: Record<GradientKey, string> = {
  indigo: "from-indigo-500/90 via-purple-500/80 to-pink-400/70",
  teal: "from-teal-400/90 via-cyan-500/80 to-blue-500/80",
  amber: "from-amber-400/90 via-orange-500/80 to-rose-500/80",
  slate: "from-slate-700/90 via-slate-800/90 to-slate-900/90",
  emerald: "from-emerald-500/90 via-teal-600/80 to-slate-800/80",
  violet: "from-violet-600/90 via-indigo-700/80 to-slate-900/80",
};

/** Человеческие подписи для выбора в админке. */
export const GRADIENT_LABELS: Record<GradientKey, string> = {
  indigo: "Сиреневый",
  teal: "Бирюзовый",
  amber: "Янтарный",
  slate: "Графитовый",
  emerald: "Изумрудный",
  violet: "Фиолетовый",
};

export const PATTERN_LABELS: Record<CasePattern, string> = {
  grid: "Сетка",
  waves: "Волны",
  dots: "Точки",
  circles: "Круги",
  diagonals: "Диагонали",
  blocks: "Блоки",
};

/** Неизвестный ключ из базы не должен ронять страницу — отдаём первый. */
export function gradientClasses(key: string): string {
  return GRADIENTS[key as GradientKey] ?? GRADIENTS.indigo;
}

export function isGradientKey(value: string): value is GradientKey {
  return (GRADIENT_KEYS as readonly string[]).includes(value);
}

export function isPattern(value: string): value is CasePattern {
  return (CASE_PATTERNS as readonly string[]).includes(value);
}
