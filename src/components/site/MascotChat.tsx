import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, X, ArrowLeft } from "lucide-react";
import { Mascot } from "./Mascot";
import { getService, PACKAGE_BY_ID } from "../../data/services";

const landing = getService("websites/landing");
const telegramBot = getService("bots/telegram");
const miniapp = getService("bots/miniapp");
const business = PACKAGE_BY_ID.business;

type Answer = {
  text: string;
  /** Ссылка внутри сайта */
  link?: { to: string; label: string };
};

type Topic = {
  id: string;
  question: string;
  answer: Answer;
  /** Следующие подсказки */
  next?: string[];
};

const TOPICS: Topic[] = [
  {
    id: "price",
    question: "Сколько стоит?",
    answer: {
      text:
        `Лендинг — ${landing.priceFrom}, Telegram-бот или MAX-бот — ${telegramBot.priceFrom}, ` +
        `MiniApp — ${miniapp.priceFrom}. Полная связка сайт + бот + админка — пакет «Бизнес» ` +
        `${business.priceFrom}. Точная цена зависит от задач: считаем после короткого разбора, он бесплатный.`,
      link: { to: "/packages", label: "Смотреть пакеты" },
    },
    next: ["terms", "separate", "support"],
  },
  {
    id: "terms",
    question: "Сколько занимает по времени?",
    answer: {
      text:
        `Лендинг — ${landing.timeline}, Telegram-бот — ${telegramBot.timeline}, ` +
        `MiniApp — ${miniapp.timeline}, полная связка «Бизнес» — ${business.term}. ` +
        `Первый рабочий прототип показываем уже на 3–5 день.`,
    },
    next: ["price", "process", "support"],
  },
  {
    id: "process",
    question: "Как строится работа?",
    answer: {
      text: "4 шага: разбор задачи → прототип и смета → сборка сайта, бота и админки → запуск и поддержка. Всё это время вы в одном чате со мной, без менеджеров-посредников.",
      link: { to: "/services", label: "Подробнее про услуги" },
    },
    next: ["terms", "separate", "support"],
  },
  {
    id: "separate",
    question: "Можно заказать что-то одно?",
    answer: {
      text: "Да. Можно только сайт, только Telegram-бота, только MiniApp или только поддержку и SEO. Пакеты — это готовые комплекты, но собираем и по частям.",
      link: { to: "/packages", label: "Услуги по отдельности" },
    },
    next: ["price", "bots", "support"],
  },
  {
    id: "bots",
    question: "Что умеют боты и MiniApp?",
    answer: {
      text: "Приём заявок, уведомления менеджеру, каталог и заказ внутри Telegram, оплата, напоминания, база клиентов. MiniApp — это полноценный мини-сайт прямо в мессенджере.",
      link: { to: "/services/bots", label: "Боты и MiniApp" },
    },
    next: ["price", "separate", "support"],
  },
  {
    id: "support",
    question: "Что после запуска?",
    answer: {
      text: "Берём проект на поддержку: правки, обновления, аналитика, SEO и слежение за доступностью. Можно разово, можно ежемесячно.",
      link: { to: "/services/support", label: "Поддержка и SEO" },
    },
    next: ["price", "process"],
  },
];

const START_IDS = ["price", "terms", "separate", "bots", "support"];

type Msg = { id: number; from: "bot" | "user"; text: string; link?: Answer["link"] };

let msgId = 0;
const nextId = () => ++msgId;

export function MascotChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(START_IDS);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);

  // Первое приветствие
  useEffect(() => {
    if (!open || messages.length) return;
    setMessages([
      {
        id: nextId(),
        from: "bot",
        text: "Привет! Я IT-Agent 🤖 Отвечу на частые вопросы про сайты, ботов и цены. Выбери тему ниже — или оставь заявку, и с тобой поговорит живой человек.",
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, suggestions]);

  const ask = (topicId: string) => {
    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic || typing) return;
    setSuggestions([]);
    setMessages((m) => [...m, { id: nextId(), from: "user", text: topic.question }]);
    setTyping(true);
    const t = window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: nextId(), from: "bot", text: topic.answer.text, link: topic.answer.link },
      ]);
      setSuggestions(topic.next ?? START_IDS);
    }, 700);
    timers.current.push(t);
  };

  const [draft, setDraft] = useState("");
  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    setDraft("");
    setSuggestions([]);
    setMessages((m) => [...m, { id: nextId(), from: "user", text }]);
    setTyping(true);
    const t = window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          from: "bot",
          text: "Это уже личный вопрос — лучше отвечу сам, а не готовым сценарием. Оставь заявку по кнопке ниже, и я вернусь с ответом. А пока можешь глянуть популярные темы 👇",
        },
      ]);
      setSuggestions(START_IDS);
    }, 700);
    timers.current.push(t);
  };

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute bottom-full right-0 mb-3 w-[min(88vw,22rem)] origin-bottom-right animate-scale-in">
      <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/95 shadow-[0_24px_70px_-24px_color-mix(in_oklab,var(--accent)_50%,transparent)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-accent-soft/60 px-4 py-3">
          <Mascot size="sm" decorative glow={false} className="h-9 w-9 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">IT-Agent</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-status-online" />
              обычно отвечает сразу
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть чат"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.from === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.from === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-[13px] leading-snug text-background"
                    : "max-w-[90%] rounded-2xl rounded-bl-md border border-border/60 bg-surface px-3.5 py-2.5 text-[13px] leading-snug text-foreground"
                }
              >
                {m.text}
                {m.link && (
                  <Link
                    to={m.link.to}
                    onClick={onClose}
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                  >
                    {m.link.label} →
                  </Link>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-md border border-border/60 bg-surface px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
                    style={{ animation: `chat-dot 1s ${i * 0.15}s ease-in-out infinite` }}
                  />
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && !typing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestions.map((id) => {
                const t = TOPICS.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <button
                    key={id}
                    onClick={() => ask(id)}
                    className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-[12px] font-medium text-accent transition hover:bg-accent hover:text-background"
                  >
                    {t.question}
                  </button>
                );
              })}
              {messages.length > 1 && (
                <button
                  onClick={() => {
                    setMessages((m) => m.slice(0, 1));
                    setSuggestions(START_IDS);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />В начало
                </button>
              )}
            </div>
          )}
        </div>

        {/* Composer + support */}
        <div className="border-t border-border/60 bg-background/80 px-3 py-3">
          <form onSubmit={onSend} className="flex items-center gap-2">
            {/* placeholder — не подпись: он исчезает при вводе и не читается
                скринридером как имя поля. */}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Задать свой вопрос…"
              aria-label="Вопрос помощнику"
              className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-[13px] outline-none transition focus:border-accent"
            />
            <button
              type="submit"
              aria-label="Отправить"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background transition hover:bg-accent disabled:opacity-40"
              disabled={!draft.trim()}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <Link
            to="/contacts"
            onClick={onClose}
            className="mt-2 flex h-10 items-center justify-center rounded-xl border border-accent/40 bg-accent-soft text-[13px] font-medium text-accent transition hover:bg-accent hover:text-background"
          >
            Оставить заявку
          </Link>
        </div>
      </div>
    </div>
  );
}
