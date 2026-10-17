import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";

import { MiniAppHome } from "./MiniAppHome";

type TelegramThemeParams = Record<string, string | undefined>;

type TelegramWebApp = {
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type SessionState =
  | { status: "loading" }
  | { status: "missing_telegram" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      environment: "production" | "test";
      user: { id: string; username: string; firstName: string; lastName: string };
      expiresAt: number;
    };

const FALLBACK_THEME = {
  background: "#17212b",
  secondaryBackground: "#202b36",
  text: "#f4f7fb",
  hint: "#9aa9b6",
  button: "#2aabee",
  buttonText: "#ffffff",
} as const;

function themeValue(params: TelegramThemeParams, key: string, fallback: string): string {
  return params[key]?.trim() || fallback;
}

export function MiniAppShell() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [entry, setEntry] = useState<"catalog" | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [sessionRetry, setSessionRetry] = useState(0);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    const requestedEntry = new URLSearchParams(window.location.search).get("entry");
    if (requestedEntry === "catalog") setEntry("catalog");

    const telegram = window.Telegram?.WebApp;
    if (!telegram || !telegram.initData?.trim()) {
      setSession({ status: "missing_telegram" });
      return;
    }

    telegram.ready();
    telegram.expand();
    setWebApp(telegram);
    const theme = telegram.themeParams;
    telegram.setHeaderColor?.(themeValue(theme, "bg_color", FALLBACK_THEME.background));
    telegram.setBackgroundColor?.(
      themeValue(theme, "secondary_bg_color", FALLBACK_THEME.secondaryBackground),
    );

    if (!navigator.onLine) {
      setSession({ status: "error", message: "Нет соединения с интернетом." });
      return;
    }

    let cancelled = false;
    fetchWithTimeout("/api/telegram/miniapp/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ initData: telegram.initData }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean;
          error?: string;
          environment?: "production" | "test";
          user?: { id: string; username: string; firstName: string; lastName: string };
          expires_at?: number;
        };
        if (!response.ok || !body.ok || !body.environment || !body.user || !body.expires_at) {
          throw new Error(body.error || "Не удалось подтвердить Telegram-сессию.");
        }
        return body as {
          ok: true;
          environment: "production" | "test";
          user: { id: string; username: string; firstName: string; lastName: string };
          expires_at: number;
        };
      })
      .then((body) => {
        if (!cancelled) {
          setSession({
            status: "ready",
            environment: body.environment,
            user: body.user,
            expiresAt: body.expires_at,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSession({
            status: "error",
            message:
              error instanceof Error && error.message
                ? error.message
                : "Не удалось открыть Mini App.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionRetry]);

  const themeStyle = useMemo(() => {
    const params = webApp?.themeParams ?? {};
    return {
      "--mini-bg": themeValue(params, "bg_color", FALLBACK_THEME.background),
      "--mini-secondary": themeValue(
        params,
        "secondary_bg_color",
        FALLBACK_THEME.secondaryBackground,
      ),
      "--mini-text": themeValue(params, "text_color", FALLBACK_THEME.text),
      "--mini-hint": themeValue(params, "hint_color", FALLBACK_THEME.hint),
      "--mini-button": themeValue(params, "button_color", FALLBACK_THEME.button),
      "--mini-button-text": themeValue(params, "button_text_color", FALLBACK_THEME.buttonText),
    } as CSSProperties;
  }, [webApp]);

  return (
    <main
      className="min-h-screen min-h-dvh bg-[var(--mini-bg)] text-[var(--mini-text)]"
      style={themeStyle}
    >
      <div className="mx-auto flex min-h-screen min-h-dvh w-full max-w-xl flex-col px-4 pb-8 pt-5 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/telegram-bot-avatar.png"
              width={40}
              height={40}
              alt=""
              className="h-10 w-10 shrink-0 rounded-xl"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide">IT-Agent</p>
              <p className="mt-0.5 text-xs text-[var(--mini-hint)]">Сайты и Telegram</p>
            </div>
          </div>
          {session.status === "ready" && session.environment === "test" && (
            <span className="shrink-0 rounded-full bg-[var(--mini-secondary)] px-3 py-1.5 text-xs font-medium">
              Тестовый режим
            </span>
          )}
        </header>

        {session.status === "loading" && <LoadingState />}
        {!isOnline && <OfflineBanner />}
        {session.status === "missing_telegram" && (
          <StateCard
            icon={<MessageCircle className="h-5 w-5" />}
            title="Откройте Mini App в Telegram"
            text="Эта страница принимает данные пользователя только из Telegram. Обычный браузер не может создать сессию."
          />
        )}
        {session.status === "error" && (
          <StateCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Не удалось подтвердить вход"
            text={`${session.message} Закройте Mini App и откройте её из бота ещё раз.`}
            action={{
              label: "Повторить",
              onClick: () => {
                setSession({ status: "loading" });
                setSessionRetry((value) => value + 1);
              },
            }}
          />
        )}
        {session.status === "ready" && (
          <ReadyState session={session} webApp={webApp} isOnline={isOnline} entry={entry} />
        )}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="mt-8 flex flex-1 items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-[var(--mini-hint)]">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        Проверяем Telegram-сессию…
      </div>
    </div>
  );
}

function OfflineBanner() {
  return (
    <div
      role="status"
      className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
    >
      Нет соединения. Данные не отправляются — повторите действие после восстановления сети.
    </div>
  );
}

function StateCard({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="mt-8 rounded-3xl bg-[var(--mini-secondary)] p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--mini-button)] text-[var(--mini-button-text)]">
        {icon}
      </div>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--mini-hint)]">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--mini-button)] px-4 py-2.5 text-sm font-semibold text-[var(--mini-button-text)]"
        >
          {action.label}
        </button>
      )}
    </section>
  );
}

function ReadyState({
  session,
  webApp,
  isOnline,
  entry,
}: {
  session: Extract<SessionState, { status: "ready" }>;
  webApp: TelegramWebApp | null;
  isOnline: boolean;
  entry: "catalog" | null;
}) {
  const content = useLoaderData({ from: "__root__" });
  const cases = useLoaderData({ from: "/miniapp" });

  const openBot = () => {
    const url = "https://t.me/ITagent_bot";
    if (webApp?.openTelegramLink) webApp.openTelegramLink(url);
    else window.location.href = url;
  };

  const openConversation = async (conversationId: number) => {
    if (!isOnline) throw new Error("Нет соединения с интернетом.");
    const response = await fetchWithTimeout("/api/telegram/miniapp/conversation-link", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      telegram_url?: string;
    } | null;
    if (!response.ok || !body?.ok || !body.telegram_url) {
      throw new Error(
        response.status === 404 ? "Обращение не найдено." : "Не удалось открыть диалог.",
      );
    }
    if (webApp?.openTelegramLink) webApp.openTelegramLink(body.telegram_url);
    else window.location.href = body.telegram_url;
  };

  return (
    <MiniAppHome
      content={content}
      cases={cases}
      firstName={session.user.firstName}
      username={session.user.username}
      onOpenBot={openBot}
      onOpenConversation={openConversation}
      isOnline={isOnline}
      entry={entry}
    />
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Сервер не ответил вовремя. Проверьте соединение и повторите.");
    }
    if (!navigator.onLine) throw new Error("Нет соединения с интернетом.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
