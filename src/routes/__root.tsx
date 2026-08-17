import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/site/SiteHeader";
import { SiteFooter } from "../components/site/SiteFooter";
import { MascotCompanion } from "../components/site/MascotCompanion";
import { Toaster } from "../components/ui/sonner";
import { ORGANIZATION } from "../data/contacts";
import { fetchSiteContent } from "../lib/content.rpc";
import { absoluteUrl, jsonLd, seo, SITE_NAME } from "../lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm text-accent">404</p>
        <h1 className="mt-3 text-3xl font-display text-foreground">Страница не найдена</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Проверьте адрес или вернитесь на главную.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition hover:brightness-110"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-display text-foreground">Что-то пошло не так</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Попробуйте обновить страницу или вернуться на главную.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition hover:brightness-110"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium text-foreground transition hover:bg-surface-elevated"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

const rootSeo = seo({
  title: "IT-Agent — Сайт, который не теряет заявки",
  description:
    "IT-Agent проектирует сайты в связке с Telegram-ботом и админкой: заявки приходят менеджеру моментально и сохраняются в одном месте.",
  path: "/",
  socialDescription:
    "Сайт + Telegram-бот + админка. Единая система приёма и обработки заявок для бизнеса.",
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  /**
   * Редактируемый контент грузится в корне, а не в каждой странице отдельно.
   *
   * Причина простая: цены, вопросы и тексты нужны почти везде, и пятнадцать
   * одинаковых загрузчиков — это пятнадцать мест, где можно забыть про новую
   * страницу. Здесь же снимок берётся один раз за переход, а на сервере
   * он ещё и кеширован по версии контента.
   *
   * Страницы читают его через `useRouteContext({ from: "__root__" })`.
   */
  loader: () => fetchSiteContent(),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: ORGANIZATION.name },
      ...rootSeo.meta,
      jsonLd({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: ORGANIZATION.name,
        legalName: ORGANIZATION.legalName,
        description: ORGANIZATION.description,
        url: absoluteUrl("/"),
        logo: absoluteUrl("/mascot.webp"),
        image: absoluteUrl("/og-image.jpg"),
        areaServed: ORGANIZATION.areaServed,
        /* `sameAs` появляется только когда есть что показать. Пустой массив
           в разметке — сигнал поисковику «каналов нет», а не «пока не знаем». */
        ...(loaderData && loaderData.contacts.length > 0
          ? { sameAs: loaderData.contacts.map((channel) => channel.href) }
          : {}),
      }),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: absoluteUrl("/"),
        inLanguage: ORGANIZATION.language,
      }),
    ],
    links: [
      /* canonical сюда НЕ кладём: роутер склеивает теги всех совпавших роутов
         и дедуплицирует только полностью одинаковые. Корневой canonical дал бы
         второй тег на каждой странице — каждая страница ставит свой сама. */
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      /* preload маскота вручную не нужен: React 19 сам добавляет его
         для картинок с fetchPriority="high" (проп `priority` у <Mascot />). */
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  /**
   * Админка живёт под тем же корнем, но обвязка сайта ей не нужна и мешает:
   * меню «Услуги · Работы · Пакеты», подвал и кнопка-маскот с репликами
   * посреди рабочего экрана. У админки своя шапка (см. `admin.tsx`).
   *
   * Решение по адресу, а не отдельным корневым макетом: корень задаёт `<html>`,
   * шрифты, микроразметку и обработчик ошибок — дублировать это ради одной
   * ветки значило бы поддерживать две копии.
   */
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdmin) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <MascotCompanion />
      <Toaster />
    </QueryClientProvider>
  );
}
