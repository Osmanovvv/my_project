// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { resolve } from "node:path";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { loadEnv, type Plugin } from "vite";

/**
 * Vite сам кладёт в `import.meta.env` только VITE_*-переменные, а они попадают
 * и в клиентский бандл. Серверные секреты (токен Telegram) так отдавать нельзя,
 * поэтому переносим весь `.env` в `process.env` процесса dev-сервера — оттуда
 * их читает SSR. В проде переменные приходят из окружения площадки.
 */
function serverEnvPlugin(): Plugin {
  return {
    name: "it-agent:server-env",
    config(_config, { mode }) {
      const fileEnv = loadEnv(mode, process.cwd(), "");
      for (const [key, value] of Object.entries(fileEnv)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },
  };
}

/**
 * `@lovable.dev/mcp-js@0.23.0` не стартует на Windows:
 *
 *   routesDir "src/routes" must resolve under C:/…/IT-Agent,
 *   got C:\…\IT-Agent\src\routes
 *
 * Внутри плагин делает `path.resolve(config.root, "src/routes")` — на Windows
 * это обратные слэши — и сравнивает результат с `config.root`, который Vite
 * нормализует в прямые. Проверка не проходит, dev-сервер и сборка падают.
 *
 * Чинится без правки пакета: отдаём плагину `root` в нативном для платформы
 * виде. На Linux и macOS `resolve` для уже абсолютного пути ничего не меняет,
 * так что сборка на Lovable работает ровно как раньше.
 */
function crossPlatformMcpPlugin(): Plugin {
  const plugin = mcpPlugin() as Plugin;
  const configResolved = plugin.configResolved;

  // Если в новой версии пакета хук изменит форму — молча отдаём плагин как есть.
  if (typeof configResolved !== "function") return plugin;

  return {
    ...plugin,
    configResolved(config) {
      const nativeRoot = new Proxy(config, {
        get: (target, prop, receiver) =>
          prop === "root" ? resolve(target.root) : Reflect.get(target, prop, receiver),
      });
      return configResolved.call(this, nativeRoot);
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [serverEnvPlugin(), crossPlatformMcpPlugin()],
    build: {
      rollupOptions: {
        output: {
          /**
           * Без этого сборка резала клиент на 53 куска: каждая иконка
           * lucide уезжала в отдельный файл по 0.5–1 КБ. По размеру
           * копейки, но на мобильной сети это десятки последовательных
           * запросов по 35–40 мс — Lighthouse показывал FCP 5.8 с при
           * нулевом времени блокировки, то есть страница ждала не
           * вычислений, а сеть.
           *
           * Собираем зависимости в две предсказуемые пачки: React с
           * роутером — то, без чего страница не отрисуется вообще,
           * и всё остальное из node_modules.
           */
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (/[\\/]node_modules[\\/](react|react-dom|@tanstack)[\\/]/.test(id))
              return "framework";
            return "vendor";
          },
        },
      },
    },
  },
});
