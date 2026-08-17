import { Check } from "lucide-react";

/**
 * Галочка перед пунктом списка.
 *
 * Было четыре трактовки одного и того же: кружок `bg-accent-soft`, кружок
 * `bg-accent/15`, кружок, залитый акцентом целиком, и голая иконка без
 * кружка. Плюс разъехавшиеся `mt-0.5` / `mt-1` и `strokeWidth`. На одной
 * странице это незаметно, но при переходе между страницами списки
 * выглядят собранными из разных макетов.
 *
 * `plain` оставлен намеренно: в тесной сетке тарифов кружок утяжеляет
 * строку, там нужна именно голая иконка.
 */
export function CheckMark({ variant = "circle" }: { variant?: "circle" | "plain" }) {
  if (variant === "plain") {
    return <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />;
  }
  return (
    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}
