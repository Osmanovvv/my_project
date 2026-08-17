import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { KeyRound, TriangleAlert } from "lucide-react";

import { submitLogin } from "../lib/admin.rpc";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    /* Админка не должна попадать в поиск. `noindex` — на случай, если кто-то
       поставит ссылку: robots.txt закрывает обход, но не индексацию по ссылке. */
    meta: [{ title: "Вход — админка IT-Agent" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const passwordId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (!password) {
      setError("Введите пароль.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await submitLogin({ data: { password } });
      if (result.ok) {
        /* Сессия появилась — контекст роутера устарел. Без сброса охрана
           в beforeLoad увидит старое состояние и отправит обратно на вход. */
        await router.invalidate();
        router.navigate({ to: "/admin" });
        return;
      }
      setError(result.message);
    } catch {
      setError("Сервер недоступен. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <KeyRound className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-xl tracking-tight">Админка IT-Agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">Вход для владельца сайта</p>
        </div>

        {/* method="post" — не декорация. По умолчанию форма отправляется
            методом GET, и если JavaScript не успел загрузиться или упал,
            браузер уводит пароль в строку адреса: `?password=...`. Оттуда он
            попадает в историю, в логи сервера и в заголовок Referer.
            С POST тело запроса в адрес не превращается ни при каком сбое. */}
        <form
          method="post"
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-sm"
        >
          <div>
            <label htmlFor={passwordId} className="text-xs text-muted-foreground">
              Пароль
            </label>
            <input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${passwordId}-error` : undefined}
              className={
                "mt-2 h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none transition focus:ring-2 focus:ring-ring " +
                (error ? "border-destructive" : "border-input")
              }
            />
          </div>

          {error && (
            <div
              id={`${passwordId}-error`}
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span className="text-foreground">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-lg bg-accent text-sm font-medium text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? "Проверяем…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
