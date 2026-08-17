import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { ServiceDetailLayout } from "../components/site/ServiceDetailLayout";
import { formatPrice, SERVICE_BY_ID } from "../data/services";
import { fetchServicePage } from "../lib/content.rpc";
import { pageSeo, serviceJsonLd } from "../lib/seo";
import { SectionEyebrow } from "../components/site/SectionEyebrow";
import { CheckMark } from "../components/site/CheckMark";
import { AccentText } from "../components/site/AccentText";
import { Icon } from "../components/site/Icon";

/* Из кода берётся только то, что не правится: путь страницы. Цена, срок
   и весь текст приходят из снимка контента — их меняют из админки. */
const service = SERVICE_BY_ID["support"];

export const Route = createFileRoute("/services/support")({
  loader: () => fetchServicePage({ data: { id: "support" } }),
  head: ({ loaderData }) => {
    const base = pageSeo(service.path, loaderData);
    return { ...base, meta: [...base.meta, serviceJsonLd(loaderData?.service ?? service)] };
  },
  component: SupportPage,
});

function SupportPage() {
  const data = Route.useLoaderData();
  const { serviceById, texts } = useLoaderData({ from: "__root__" });
  const live = serviceById.support;

  const page = data?.page ?? null;
  const plans = data?.supportPlans ?? [];

  return (
    <ServiceDetailLayout
      eyebrow={page?.eyebrow ?? ""}
      title={<AccentText text={page?.heroTitle ?? ""} />}
      description={page?.heroLead ?? ""}
      icon={LifeBuoy}
      accentColor="amber"
    >
      {(page?.features.length ?? 0) > 0 && (
        <section className="container-page py-16 sm:py-24">
          <div className="mb-10">
            <SectionEyebrow>Что делаем</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Полный цикл сопровождения</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {page?.features.map(({ icon, title, text }) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-border bg-surface p-6 hover:border-accent/50 hover:-translate-y-0.5 transition-all"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent mb-5">
                  <Icon name={icon} className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="font-display text-lg">{title}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container-page py-16 sm:py-24 border-t border-border">
        <div className="mb-10 text-center">
          <SectionEyebrow>Тарифы</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl">Выберите уровень</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            /* Цена собирается форматтером, а не берётся строкой: он ставит
               неразрывные пробелы, без которых «35 000 ₽/мес» рвётся по
               строкам в узкой колонке, пока соседний тариф остаётся целым.
               Нулевая цена без своего текста означает «как у услуги
               в каталоге» — так базовый тариф не разъезжается с прайсом. */
            const price =
              plan.priceValue > 0
                ? formatPrice(plan.priceValue, "month")
                : plan.priceText || live.priceFrom;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-7 ${
                  plan.highlight
                    ? "border-accent bg-gradient-to-br from-accent/10 via-surface to-background shadow-2xl shadow-accent/20"
                    : "border-border bg-surface"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                    Популярно
                  </span>
                )}
                <div className="font-display text-xl">{plan.name}</div>
                <div className="mt-2 text-accent font-display text-2xl">{price}</div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckMark variant="plain" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contacts"
                  className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition ${
                    plan.highlight
                      ? "bg-accent text-accent-foreground hover:brightness-110"
                      : "border border-border text-foreground hover:border-accent hover:text-accent"
                  }`}
                >
                  {texts["cta.discuss"]} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </ServiceDetailLayout>
  );
}
