import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "../lib/seo";
import { originFromRequest, siteUrls } from "../lib/site-urls";
import { publishedCases } from "../server/cases.server";

/**
 * GET /sitemap.xml
 *
 * Страницы услуг берутся из каталога в коде, кейсы — из базы на момент
 * запроса. Опубликовал кейс в админке — он в карте сайта сразу, без
 * пересборки и перезапуска. Черновики сюда не попадают.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function handleSitemap({ request }: { request: Request }): Response {
  const origin = originFromRequest(request, SITE_URL);

  const slugs = publishedCases().map((item) => item.slug);

  const entries = siteUrls(slugs)
    .map(({ path, priority, changefreq }) =>
      [
        "  <url>",
        `    <loc>${escapeXml(`${origin}${path === "/" ? "/" : path}`)}</loc>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: handleSitemap,
    },
  },
});
