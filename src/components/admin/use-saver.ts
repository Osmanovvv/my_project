import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Состояние кнопки сохранения на странице контента.
 *
 * Живёт в отдельном файле, а не рядом с полями: экспорт хука вместе
 * с компонентами ломает горячую перезагрузку при разработке.
 *
 * Заодно сторожит несохранённое: пока правки не отправлены, уход со
 * страницы перехватывается браузером. Формы контента заполняют не спеша,
 * и потерять набранное из-за случайного закрытия вкладки особенно обидно.
 */
export function useSaver(run: () => Promise<unknown>, dirty = false) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty || done) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, done]);

  return {
    busy,
    done,
    error,
    reset() {
      setDone(false);
      setError(null);
    },
    async submit() {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await run();
        await router.invalidate();
        setDone(true);
        window.setTimeout(() => setDone(false), 2500);
      } catch {
        setError("Не удалось сохранить. Проверьте связь и попробуйте ещё раз.");
      } finally {
        setBusy(false);
      }
    },
  };
}

export type Saver = ReturnType<typeof useSaver>;
