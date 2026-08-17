import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Mascot } from "./Mascot";

const nav = [
  { to: "/services", label: "Услуги" },
  { to: "/works", label: "Работы" },
  { to: "/packages", label: "Пакеты" },
  { to: "/industries", label: "Для кого" },
  { to: "/faq", label: "Вопросы" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 group relative py-2"
          onClick={() => setOpen(false)}
        >
          {/* Без отрицательного отступа: `-mr-2` вместе с наклоном маскота
              задвигал робота на букву «И» — логотип читался как «T—Agent». */}
          <span className="relative inline-block h-14 w-14 shrink-0 z-10">
            <span className="absolute inset-0 rounded-full bg-accent/25 blur-xl opacity-70 group-hover:opacity-100 transition" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-9 rounded-full bg-accent/30 blur-md" />
            <Mascot
              size="sm"
              decorative
              priority
              glow="sm"
              className="relative h-14 w-14 object-contain origin-bottom-right transition-transform duration-500 ease-out group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]"
              style={{ transform: "rotate(8deg) translateY(2px)" }}
            />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight leading-none select-none">
            <span className="text-foreground">IT</span>
            <span className="text-accent mx-0.5">—</span>
            <span className="relative text-foreground">
              Agent
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-accent to-transparent transition-all duration-500 group-hover:w-full" />
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-muted-foreground transition hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/contacts"
            data-mascot-cheer
            className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:brightness-110"
          >
            Получить разбор
          </Link>
        </div>

        <button
          className="md:hidden -mr-2 grid h-10 w-10 place-items-center rounded-lg text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="md:hidden border-t border-border/60 bg-background">
          <div className="container-page py-4 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-3 text-[15px] text-muted-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/contacts"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
            >
              Получить разбор
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
