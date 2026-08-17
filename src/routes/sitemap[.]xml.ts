import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "../lib/seo";
import { originFromRequest, SITE_URLS } from "../lib/site-urls";

/**
 * GET /sitemap.xml
 *
 * Список страниц собирается из каталогов услуг и кейсов — новая услуга или
 * кейс попадают в карту сайта автоматически.
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

  const entries = SITE_URLS.map(({ path, priority, changefreq }) =>
    [
      "  <url>",
      `    <loc>${escapeXml(`${origin}${path === "/" ? "/" : path}`)}</loc>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority.toFixed(1)}</priority>`,
      "  </url>",
    ].join("\n"),
  ).join("\n");

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
