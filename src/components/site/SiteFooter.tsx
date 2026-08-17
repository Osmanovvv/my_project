import { Link } from "@tanstack/react-router";
import { Mascot } from "./Mascot";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 mt-24 overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-accent/10 blur-3xl" />

      <div className="container-page relative py-10">
        <div className="flex flex-col items-center text-center mb-8">
          {/* Крупная версия файла оправдана: на 112px мелкая (224px высотой)
              мылила бы на 2x-экранах. Свечение растёт вместе с фигурой —
              иначе ореол становится тесным воротником. */}
          <div className="relative mb-4">
            <div className="absolute inset-0 -m-6 rounded-full bg-accent/20 blur-2xl" />
            <Mascot
              className="relative h-28 w-auto"
              style={{ animation: "mascot-float 6s ease-in-out infinite" }}
            />
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            IT-Agent всегда на связи — сайт, бот и админка в одной системе.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 overflow-hidden">
              <Mascot size="sm" glow={false} className="h-7 w-auto" />
            </span>
            <span className="font-display text-sm">IT-Agent</span>
            <span className="text-xs text-muted-foreground ml-3">© {new Date().getFullYear()}</span>
          </div>

          {/* `-my-2 py-2` у ссылок ниже: строка текста даёт цель высотой 20px,
              по ней тяжело попасть пальцем. Паддинг расширяет область нажатия
              до 36px, отрицательный margin гасит его для раскладки — футер
              не становится выше. */}
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <Link to="/services" className="-my-2 py-2 hover:text-foreground transition">
              Услуги
            </Link>
            <Link to="/packages" className="-my-2 py-2 hover:text-foreground transition">
              Пакеты
            </Link>
            <Link to="/industries" className="-my-2 py-2 hover:text-foreground transition">
              Для кого
            </Link>
            <Link to="/faq" className="-my-2 py-2 hover:text-foreground transition">
              Вопросы
            </Link>
            <Link to="/contacts" className="-my-2 py-2 hover:text-foreground transition">
              Контакты
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
