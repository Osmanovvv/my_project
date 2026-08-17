import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Mascot } from "./Mascot";
import { MascotChat } from "./MascotChat";

/**
 * Site-wide mascot companion.
 * - Sits in the bottom-right corner with idle float.
 * - Changes pose based on scroll progress (peek → point → wave → sleep).
 * - Emits contextual speech bubble on route change + at random intervals.
 * - Peek-a-boo: hides & slides back in from off-screen occasionally.
 * - Reacts (jump) when the user hovers any element with data-mascot-cheer.
 * - Clickable: wiggles and shows a random line.
 */

type Pose = "idle" | "wave" | "point" | "peek" | "sleep" | "cheer" | "wiggle";

const ROUTE_TIPS: Record<string, string[]> = {
  "/": [
    "Скролль вниз — покажу как это всё работает 👇",
    "Ниже — наши работы, зацени",
    "Готов забирать заявки без потерь ⚡",
  ],
  "/services": ["Сайт, бот, админка — всё в одной связке", "Тут вся кухня по шагам"],
  "/packages": ["Не знаешь с чего начать? Бери «Старт»", "Пакет можно поменять после разбора"],
  "/industries": ["Найди свой сценарий ниже 👇", "Работаем и с сервисами, и с B2B"],
  "/faq": ["Не нашёл ответ? Пиши в Контакты", "Тут коротко о главном"],
  "/contacts": ["Оставь заявку — отвечу за пару минут 👋", "Ща познакомимся!"],
};

export function MascotCompanion() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [pose, setPose] = useState<Pose>("wave");
  const [hidden, setHidden] = useState(false); // peek-a-boo off-screen
  const [bubble, setBubble] = useState<string | null>(null);
  const [dismissedRoute, setDismissedRoute] = useState<string | null>(null);
  const bubbleTimer = useRef<number | null>(null);
  const poseTimer = useRef<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

  // ---- Speech helpers ----
  const showBubble = (text: string, ms = 5200) => {
    setBubble(text);
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  };

  // ---- On route change: peek-a-boo entrance + contextual tip ----
  useEffect(() => {
    setHidden(true);
    setBubble(null);
    const t1 = window.setTimeout(() => {
      setHidden(false);
      setPose("wave");
    }, 350);
    const t2 = window.setTimeout(() => {
      if (dismissedRoute === pathname) return;
      const tips = ROUTE_TIPS[pathname] ?? ROUTE_TIPS["/"];
      showBubble(tips[Math.floor(Math.random() * tips.length)]);
    }, 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ---- Scroll-driven pose (traveler effect) ----
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const p = max > 0 ? window.scrollY / max : 0;
        // Don't override transient poses
        setPose((prev) => {
          if (prev === "cheer" || prev === "wiggle") return prev;
          if (p < 0.05) return "wave";
          if (p < 0.35) return "point";
          if (p < 0.7) return "peek";
          if (p < 0.95) return "idle";
          return "sleep";
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [pathname]);

  // ---- Random peek-a-boo every 35-60s ----
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 35000 + Math.random() * 25000;
      window.setTimeout(() => {
        if (cancelled) return;
        if (chatOpenRef.current) {
          loop();
          return;
        }
        setHidden(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setHidden(false);
          loop();
        }, 900);
      }, delay);
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Global cheer reactions on [data-mascot-cheer] hover ----
  useEffect(() => {
    let revert: number | null = null;
    const cheer = () => {
      setPose("cheer");
      if (revert) window.clearTimeout(revert);
      revert = window.setTimeout(() => setPose("wave"), 900);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-mascot-cheer]")) cheer();
    };
    document.addEventListener("mouseover", onOver);
    return () => {
      document.removeEventListener("mouseover", onOver);
      if (revert) window.clearTimeout(revert);
    };
  }, []);

  // Таймеры реплики и позы держим в ref и снимаем при размонтировании:
  // иначе после ухода со страницы срабатывал setState на снятом компоненте.
  useEffect(
    () => () => {
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
      if (poseTimer.current) window.clearTimeout(poseTimer.current);
    },
    [],
  );

  const onMascotClick = () => {
    setPose("wiggle");
    if (poseTimer.current) window.clearTimeout(poseTimer.current);
    poseTimer.current = window.setTimeout(() => setPose("wave"), 800);
    setBubble(null);
    setChatOpen((v) => !v);
  };

  const onDismissBubble = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBubble(null);
    setDismissedRoute(pathname);
  };

  // ---- Pose → transform mapping ----
  const poseStyle: Record<Pose, string> = {
    idle: "rotate(-2deg)",
    wave: "rotate(-6deg)",
    point: "rotate(8deg) translateY(-2px)",
    peek: "rotate(-14deg) translateX(-4px)",
    sleep: "rotate(-22deg) translateY(4px)",
    cheer: "rotate(0deg) translateY(-10px) scale(1.08)",
    wiggle: "rotate(-6deg)",
  };

  return (
    <div
      aria-hidden={false}
      className="pointer-events-none fixed bottom-5 right-5 z-50 select-none sm:bottom-6 sm:right-6"
      style={{
        transform: hidden ? "translateX(160%) rotate(20deg)" : "translateX(0) rotate(0)",
        transition: "transform 700ms cubic-bezier(.34,1.56,.64,1)",
      }}
    >
      <MascotChat open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Speech bubble */}
      {bubble && !chatOpen && (
        <div
          className="pointer-events-auto absolute bottom-full right-2 mb-2 w-56 origin-bottom-right animate-scale-in"
          style={{ animationDuration: "220ms" }}
        >
          <div className="relative rounded-2xl border border-border/60 bg-background/95 px-3.5 py-2.5 pr-7 text-[13px] leading-snug text-foreground shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--accent)_30%,transparent)] backdrop-blur-xl">
            {bubble}
            <button
              onClick={onDismissBubble}
              aria-label="Скрыть подсказку"
              className="absolute right-0.5 top-0.5 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <span className="text-xs leading-none">×</span>
            </button>
            <span
              className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-border/60 bg-background/95"
              aria-hidden
            />
          </div>
        </div>
      )}

      {/* Mascot bubble button */}
      <button
        type="button"
        onClick={onMascotClick}
        aria-label={chatOpen ? "Закрыть чат с IT-Agent" : "Открыть чат с IT-Agent"}
        aria-expanded={chatOpen}
        className="pointer-events-auto group relative grid h-16 w-16 place-items-center rounded-full bg-background/70 backdrop-blur-xl border border-border/60 shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--accent)_45%,transparent)] transition-transform hover:scale-[1.06] active:scale-95 sm:h-[72px] sm:w-[72px]"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-accent/20 blur-xl opacity-70 group-hover:opacity-100 transition" />
        <span
          className="pointer-events-none absolute -top-1 right-0 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
          style={{ animation: "mascot-pulse 2.4s ease-in-out infinite" }}
        />
        <Mascot
          size="sm"
          decorative
          glow="sm"
          className="relative h-14 w-14 object-contain sm:h-16 sm:w-16"
          style={{
            transform: poseStyle[pose],
            transition: "transform 600ms cubic-bezier(.34,1.56,.64,1)",
            animation:
              pose === "wiggle"
                ? "mascot-wiggle 700ms ease-in-out"
                : pose === "sleep"
                  ? "mascot-sleep 3.4s ease-in-out infinite"
                  : "mascot-float-sm 4.2s ease-in-out infinite",
          }}
        />
      </button>
    </div>
  );
}
