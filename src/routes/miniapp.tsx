import { createFileRoute } from "@tanstack/react-router";

import { MiniAppShell } from "../components/miniapp/MiniAppShell";
import { fetchCases } from "../lib/content.rpc";

export const Route = createFileRoute("/miniapp")({
  // Работы живут в базе отдельно от общего снимка контента. Загружаем их
  // здесь, чтобы Mini App использовал тот же опубликованный каталог, что и
  // публичный сайт, без копии данных в клиентском компоненте.
  loader: () => fetchCases(),
  head: () => ({
    meta: [
      { title: "IT-Agent в Telegram" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "color-scheme", content: "light dark" },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js?64" }],
  }),
  component: MiniAppPage,
});

function MiniAppPage() {
  return <MiniAppShell />;
}
