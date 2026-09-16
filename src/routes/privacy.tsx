import { createFileRoute } from "@tanstack/react-router";

import { LegalDocument } from "../components/site/LegalDocument";
import { PRIVACY_POLICY } from "../data/legal";
import { fetchPageMeta } from "../lib/content.rpc";
import { pageSeo } from "../lib/seo";

/**
 * Политика обработки персональных данных.
 *
 * Постоянный адрес: на него ссылаются форма заявки и подвал, его же
 * укажет владелец в уведомлении Роскомнадзору. Менять путь нельзя без
 * переадресации со старого.
 */
export const Route = createFileRoute("/privacy")({
  loader: () => fetchPageMeta({ data: { path: "/privacy" } }),
  head: ({ loaderData }) => pageSeo("/privacy", loaderData),
  component: () => <LegalDocument doc={PRIVACY_POLICY} />,
});
