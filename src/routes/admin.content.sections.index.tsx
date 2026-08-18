import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { PageHead } from "../components/admin/fields";
import { fetchAdminContent } from "../lib/admin.rpc";
import { SECTIONS, SECTION_PLACES, sectionTextKeys } from "../data/sections";
import { TEXT_DEFAULTS } from "../data/texts";

/**
 * Разделы сайта: список кусков страницы, а не список строк.
 *
 * Так владелец и думает о своём сайте. Прежняя страница «Тексты сайта»
 * была отсортирована по тому, где строка живёт в коде, и чтобы поправить
 * первый экран, надо было зайти в отдельную вкладку и найти нужную строку
 * среди сотни чужих. Правится не «текст», правится ПЕРВЫЙ ЭКРАН — целиком,
 * вместе со снимками в рамках и подписями под ними.
 *
 * Порядок здесь — порядок на самой странице, сверху вниз: раздел ищут
 * глазами по сайту, а не по алфавиту.
 */

export const Route = createFileRoute("/admin/content/sections/")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Разделы сайта — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SectionsList,
});

function SectionsList() {
  const data = Route.useLoaderData();

  return (
    <div className="space-y-5 pb-8">
      <PageHead
        title="Разделы сайта"
        note="Выберите кусок страницы — внутри правится всё, что в нём есть: заголовки, тексты, снимки и подписи."
      />

      {SECTION_PLACES.map((place) => (
        <div key={place}>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {place}
          </div>
          <ul className="space-y-2">
            {SECTIONS.filter((section) => section.place === place).map((section) => {
              const keys = sectionTextKeys(section);
              const changed = keys.filter((key) => data.texts[key] !== TEXT_DEFAULTS[key]).length;

              return (
                <li key={section.slug}>
                  <Link
                    to="/admin/content/sections/$slug"
                    params={{ slug: section.slug }}
                    className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition hover:border-accent/40 hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{section.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {section.note}
                      </span>
                    </span>

                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {changed ? `изменено: ${changed}` : "как в исходном виде"}
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
