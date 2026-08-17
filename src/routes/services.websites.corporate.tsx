import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Layout } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { SERVICE_BY_ID } from "../data/services";
import { fetchServicePage } from "../lib/content.rpc";
import { pageSeo, serviceJsonLd } from "../lib/seo";

/* Из кода берётся только то, что не правится: путь страницы. Цена, срок
   и весь текст приходят из снимка контента — их меняют из админки. */
const service = SERVICE_BY_ID["websites/corporate"];

export const Route = createFileRoute("/services/websites/corporate")({
  loader: () => fetchServicePage({ data: { id: "websites/corporate" } }),
  head: ({ loaderData }) => {
    /* Микроразметка собирается по ЖИВОЙ услуге, а не по значениям из кода:
       иначе поисковик получал бы старую цену ещё долго после того, как
       владелец поменял её в админке. */
    const base = pageSeo(service.path, loaderData);
    return { ...base, meta: [...base.meta, serviceJsonLd(loaderData?.service ?? service)] };
  },
  component: ServicePage,
});

function ServicePage() {
  const data = Route.useLoaderData();
  const { serviceById } = useLoaderData({ from: "__root__" });
  const live = serviceById["websites/corporate"];

  return (
    <ServiceVariationPage
      content={data?.page ?? null}
      icon={Layout}
      accent="indigo"
      timeline={live.timeline}
      priceFrom={live.priceFrom}
      siblings={[
        { to: "/services/websites/landing", label: "Лендинг" },
        { to: "/services/websites/ecommerce", label: "E-commerce" },
        { to: "/services/support", label: "Поддержка и SEO" },
      ]}
    />
  );
}
