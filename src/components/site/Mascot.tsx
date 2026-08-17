import type { CSSProperties } from "react";

/**
 * Маскот IT-Agent. Единственное место, где знают про файл, его размеры
 * и свечение.
 *
 * Исходник был PNG на 620 КБ (636×928) и грузился жадно в девяти местах.
 * Теперь два WebP: 350×512 для крупных блоков (27 КБ) и 154×224 для
 * шапки и кнопки-компаньона (10 КБ).
 */

const SOURCES = {
  lg: { src: "/mascot.webp", width: 350, height: 512 },
  sm: { src: "/mascot-sm.webp", width: 154, height: 224 },
} as const;

type Props = {
  /** `lg` — герои и промо-блоки, `sm` — шапка, футер, кнопка чата. */
  size?: keyof typeof SOURCES;
  className?: string;
  style?: CSSProperties;
  /** Декоративная копия — прячем от скринридеров. */
  decorative?: boolean;
  alt?: string;
  /**
   * Первый экран: грузим сразу, не откладывая. Но БЕЗ `fetchPriority="high"` —
   * React 19 добавляет на такие картинки `<link rel="preload">`, и когда их
   * трое, они втроём конкурируют с CSS за канал. Высший приоритет заслуживает
   * ровно один элемент — самый крупный в первом экране, и это скриншот сайта,
   * а не маскот.
   */
  priority?: boolean;
  /** `false` убирает свечение — например для полупрозрачного вотермарка. */
  glow?: boolean | "sm";
};

export function Mascot({
  size = "lg",
  className = "",
  style,
  decorative = false,
  alt = "Маскот IT-Agent",
  priority = false,
  glow = true,
}: Props) {
  const source = SOURCES[size];
  const glowClass = glow === false ? "" : glow === "sm" ? "mascot-glow-sm" : "mascot-glow";

  return (
    <img
      src={source.src}
      width={source.width}
      height={source.height}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      className={`${glowClass} ${className}`.trim()}
      style={style}
    />
  );
}
