import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Кнопка-ссылка под секцией: тёмная основная и светлая второстепенная.
 *
 * Обе были набраны классами вручную в нескольких местах и уже начали
 * расходиться — где-то `px-6`, где-то `px-7`, где-то `transition` вместо
 * `transition-all`. Отличия в пару пикселей, но именно из таких мелочей
 * складывается ощущение, что страницы делали разные люди.
 *
 * Здесь собраны только те варианты, что совпадали дословно. Разошедшиеся
 * копии оставлены на местах намеренно: их приведение к общему виду меняет
 * картинку, и это отдельное решение, а не механическая замена.
 */

const BASE = "inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium";

const VARIANTS = {
  /** Главное действие страницы: тёмная заливка. */
  primary: `${BASE} gap-2 bg-foreground text-background hover:bg-accent transition shadow-xl shadow-accent/10`,
  /** Второе действие рядом с главным: приглушённая обводка. */
  secondary: `${BASE} border border-border bg-background text-muted-foreground hover:text-accent hover:border-accent transition`,
  /** Самостоятельная ссылка-кнопка в конце секции — текст обычной яркости. */
  ghost: `group ${BASE} gap-2 border border-border bg-background text-foreground hover:border-accent hover:text-accent transition`,
} as const;

type Props = {
  to: "/contacts" | "/services" | "/works" | "/packages";
  variant?: keyof typeof VARIANTS;
  className?: string;
  /** Маскот-компаньон подпрыгивает при наведении. Только для главной CTA. */
  cheer?: boolean;
  children: ReactNode;
};

export function CtaLink({ to, variant = "primary", className = "", cheer, children }: Props) {
  return (
    <Link
      to={to}
      data-mascot-cheer={cheer ? "" : undefined}
      className={`${VARIANTS[variant]} ${className}`.trimEnd()}
    >
      {children}
    </Link>
  );
}
