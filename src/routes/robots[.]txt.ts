import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "../lib/seo";
import { originFromRequest } from "../lib/site-urls";

/**
 * GET /robots.txt
 *
 * Отдаётся сервером, а не лежит статикой в `public/`: адрес sitemap должен
 * совпадать с доменом, на котором сайт реально открыли (превью Lovable,
 * свой домен, локалхост).
 *
 * Служебные разделы закрыты: `/admin*` — админка, `/api/*` — приём заявок,
 * `/mcp`, `/.mcp/*` и `/.well-known/*` — MCP-сервер. Индексировать их незачем.
 *
 * Запрет обхода админки — не единственная мера и не главная: строка в robots
 * лишь просит роботов не ходить, а на страницах админки стоит ещё и
 * `noindex, nofollow`. Настоящая защита — пароль, всё остальное косметика.
 */
function handleRobots({ request }: { request: Request }): Response {
  const origin = originFromRequest(request, SITE_URL);

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /mcp",
    "Disallow: /.mcp/",
    "Disallow: /.well-known/",
    "",
    "User-agent: Yandex",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /mcp",
    "Disallow: /.mcp/",
    "Disallow: /.well-known/",
    `Host: ${origin.replace(/^https?:\/\//, "")}`,
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: handleRobots,
    },
  },
});
