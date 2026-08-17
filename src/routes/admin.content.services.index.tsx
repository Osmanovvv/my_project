import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { PageHead } from "../components/admin/fields";
import { fetchAdminContent } from "../lib/admin.rpc";
import { serviceSlug, type ServiceId } from "../data/services";

/**
 * Список услуг: выбор, что править.
 *
 * Раньше все семь услуг лежали одной страницей сворачивающимися карточками,
 * и правились у них только цена, срок и два описания. Теперь у каждой услуги
 * свой экран, а на нём — весь текст её страницы: первый экран, «кому
 * подходит», «что получите», шаги. Складывать это в аккордеон на общей
 * странице было бы ровно тем, на что владелец уже жаловался.
 */

export const Route = createFileRoute("/admin/content/services/")({
  loader: () => fetchAdminContent(),
  head: () => ({
    meta: [
      { title: "Услуги — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ServicesList,
});

function ServicesList() {
  const { services } = Route.useLoaderData();

  return (
    <div className="space-y-5 pb-8">
      <PageHead
        title="Услуги"
        note="Добавить или удалить услугу отсюда нельзя — у каждой свой адрес на сайте. Внутри правятся цена, срок и весь текст её страницы."
      />

      <ul className="space-y-2">
        {services.map((service) => (
          <li key={service.id}>
            <Link
              to="/admin/content/services/$slug"
              params={{ slug: serviceSlug(service.id as ServiceId) }}
              className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition hover:border-accent/40 hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{service.cardTitle}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {service.short}
                </span>
              </span>

              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {service.priceFrom} · {service.timeline}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
