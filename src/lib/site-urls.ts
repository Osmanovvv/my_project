/**
 * Список публичных страниц — для sitemap.xml.
 *
 * Собирается из тех же каталогов, что и сам сайт: добавили услугу или кейс —
 * они появятся в карте сайта сами, без ручной правки.
 */

import { CASES } from "../data/cases";
import { SERVICES } from "../data/services";

export type SiteUrl = {
  path: string;
  /** Приоритет относительно остальных страниц (0.0–1.0). */
  priority: number;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
};

const STATIC_PAGES: SiteUrl[] = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/services", priority: 0.9, changefreq: "monthly" },
  { path: "/services/websites", priority: 0.8, changefreq: "monthly" },
  { path: "/services/bots", priority: 0.8, changefreq: "monthly" },
  { path: "/packages", priority: 0.8, changefreq: "monthly" },
  { path: "/works", priority: 0.8, changefreq: "weekly" },
  { path: "/industries", priority: 0.7, changefreq: "monthly" },
  { path: "/faq", priority: 0.6, changefreq: "monthly" },
  { path: "/contacts", priority: 0.7, changefreq: "yearly" },
];

/** Страницы услуг: `/services/websites` и `/services/bots` уже есть выше. */
const SERVICE_PAGES: SiteUrl[] = SERVICES.map((service) => ({
  path: service.path,
  priority: 0.7,
  changefreq: "monthly" as const,
}));

const CASE_PAGES: SiteUrl[] = CASES.map((item) => ({
  path: `/works/${item.slug}`,
  priority: 0.6,
  changefreq: "yearly" as const,
}));

/** Уникальные пути в порядке убывания важности. */
export const SITE_URLS: SiteUrl[] = [...STATIC_PAGES, ...SERVICE_PAGES, ...CASE_PAGES].filter(
  (entry, index, all) => all.findIndex((other) => other.path === entry.path) === index,
);

/**
 * Определяет origin по заголовкам запроса — сайт может жить на превью-домене
 * Lovable, на своём домене и на локалхосте одновременно.
 */
export function originFromRequest(request: Request, fallback: string): string {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return fallback;

  const proto =
    headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
