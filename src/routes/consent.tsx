import { createFileRoute } from "@tanstack/react-router";

import { LegalDocument } from "../components/site/LegalDocument";
import { CONSENT_TEXT } from "../data/legal";
import { fetchPageMeta } from "../lib/content.rpc";
import { pageSeo } from "../lib/seo";

/**
 * Текст согласия, на который ведёт галочка на форме заявки.
 *
 * Отдельная страница, а не раздел политики: согласие должно быть
 * оформлено отдельно от иных документов (ч. 1 ст. 9 152-ФЗ). Адрес
 * постоянный — см. замечание в `privacy.tsx`.
 */
export const Route = createFileRoute("/consent")({
  loader: () => fetchPageMeta({ data: { path: "/consent" } }),
  head: ({ loaderData }) => pageSeo("/consent", loaderData),
  component: () => <LegalDocument doc={CONSENT_TEXT} />,
});
