import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { PageHead } from "../components/admin/fields";
import { fetchAdminContent } from "../lib/admin.rpc";
import { SEO_DEFAULTS, SEO_GROUPS, SEO_LIMITS, SEO_PAGES } from "../data/seo-pages";

/**
 * Список страниц: где править заголовок и описание для поиска.
 *
 * Раздел появился потому, что сайт строится ради позиций в выдаче, а `<title>`
 * и `description` — ровно тот текст, который человек видит в Яндексе и по
 * которому решает, кликать или нет. До этого их можно было поменять только
 * через разработчика: шестнадцать страниц, шестнадцать литералов в коде.
 *
 * В строке списка видно, изменена ли страница и не вылезает ли заголовок
 * за границу сниппета: перебор длины — самая частая и самая незаметная
 * ошибка, потому что на сайте она никак не проявляется.
 */

export const Route = createFileRoute("/admin/content/seo/")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Заголовки для поиска — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SeoList,
});

function SeoList() {
  const { seo } = Route.useLoaderData();

  return (
    <div className="space-y-5 pb-8">
      <PageHead
        title="Заголовки для поиска"
        note="Что видно в Яндексе и Google: заголовок ссылки и описание под ней. На самих страницах этот текст не показывается."
      />

      {SEO_GROUPS.map((group) => (
        <div key={group}>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {group}
          </div>
          <ul className="space-y-2">
            {SEO_PAGES.filter((page) => page.group === group).map((page) => {
              const entry = seo[page.path];
              const fallback = SEO_DEFAULTS[page.path];
              const changed =
                entry &&
                fallback &&
                (entry.title !== fallback.title || entry.description !== fallback.description);
              const tooLong = (entry?.title.length ?? 0) > SEO_LIMITS.title.max;

              return (
                <li key={page.path}>
                  <Link
                    to="/admin/content/seo/$slug"
                    params={{ slug: page.slug }}
                    className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition hover:border-accent/40 hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{page.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {entry?.title ?? page.path}
                      </span>
                    </span>

                    {tooLong && (
                      <span className="shrink-0 text-[11px] text-amber-600">длинный заголовок</span>
                    )}
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {changed ? "изменено" : "как в исходном виде"}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
