import { createFileRoute, redirect, Link, Outlet, useRouter } from "@tanstack/react-router";
import { ExternalLink, FolderOpen, Inbox, LogOut, SlidersHorizontal } from "lucide-react";

import { getAuthState, submitLogout } from "../lib/admin.rpc";

/**
 * Каркас админки и охрана всех её страниц.
 *
 * Проверка стоит здесь, на общем родителе, а не в каждой странице отдельно —
 * иначе новую страницу однажды забудут закрыть. Это единственное место,
 * где решается, пускать или нет.
 *
 * При этом охрана в `beforeLoad` — не единственный рубеж: каждая серверная
 * функция проверяет сессию сама (см. `assertAuth` в `admin.rpc`). Здесь
 * защищается интерфейс, там — данные; обходить надо оба.
 */

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const auth = await getAuthState();

    /* Страница входа лежит внутри /admin, поэтому её надо пропускать явно,
       иначе редирект зациклится сам на себя. */
    const isLoginPage = location.pathname.replace(/\/+$/, "") === "/admin/login";

    if (!auth.authorized && !isLoginPage) {
      throw redirect({ to: "/admin/login" });
    }
    if (auth.authorized && isLoginPage) {
      throw redirect({ to: "/admin" });
    }

    return { auth };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { auth } = Route.useRouteContext();

  /* Форма входа рисуется без обвязки: меню и кнопка «Выйти» там ни к чему.
     Но `<main>` нужен и здесь — без него скринридер не может перейти
     к основному содержимому, и Lighthouse справедливо снижает оценку. */
  if (!auth.authorized) {
    return (
      <main className="min-h-screen bg-surface">
        <Outlet />
      </main>
    );
  }

  /**
   * Фон админки — НЕПРОЗРАЧНЫЙ токен, и это важно. Раньше здесь стоял
   * `bg-muted/40`, и тем же классом красилось окно заявки на телефоне:
   * сквозь него просвечивал список под окном. Один и тот же непрозрачный
   * токен на фоне страницы и на окне гарантирует совпадение по построению,
   * а не на глаз.
   */
  return (
    <div className="min-h-screen bg-surface">
      <AdminHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function AdminHeader() {
  const router = useRouter();

  async function onLogout() {
    await submitLogout();
    await router.invalidate();
    router.navigate({ to: "/admin/login" });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      {/*
        НА ТЕЛЕФОНЕ ПОДПИСЕЙ НЕТ, ТОЛЬКО ЗНАЧКИ — и это не украшательство.
        С подписями строка шапки занимала 400px содержимого при 342 доступных
        на экране 390, и КАЖДАЯ страница админки уезжала вбок на 45 пикселей.
        Заметить это на широком экране невозможно, а с телефона видно сразу:
        страница ездит горизонтально при каждом касании.

        Раздел при этом не теряется: у него отдельный значок, активный
        подсвечен, а название повторено заголовком на самой странице.

        `aria-label` обязателен у каждой: без подписи у значка не остаётся
        вообще никакого имени, и скринридер читает такую ссылку как «ссылка».
        У кнопки выхода дыра была и раньше — подпись пряталась, а имя взамен
        не давалось.
      */}
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Link
          to="/admin"
          aria-label="IT-Agent, админка"
          className="-my-1 whitespace-nowrap rounded-lg py-2 font-display text-sm font-semibold tracking-tight transition hover:text-accent"
        >
          IT<span className="text-muted-foreground">—</span>Agent
          <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
            админка
          </span>
        </Link>

        <nav className="ml-1 flex items-center gap-1 sm:ml-2">
          <Link
            to="/admin"
            activeOptions={{ exact: true }}
            aria-label="Заявки"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:px-3 [&.active]:bg-accent-soft [&.active]:text-accent"
          >
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Заявки</span>
          </Link>
          <Link
            to="/admin/cases"
            aria-label="Кейсы"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:px-3 [&.active]:bg-accent-soft [&.active]:text-accent"
          >
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Кейсы</span>
          </Link>
          <Link
            to="/admin/content"
            aria-label="Контент сайта"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:px-3 [&.active]:bg-accent-soft [&.active]:text-accent"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Контент</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            target="_blank"
            aria-label="Открыть сайт в новой вкладке"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:px-3"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Сайт</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Выйти из админки"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>
    </header>
  );
}
