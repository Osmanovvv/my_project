import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";

import {
  AccentPreview,
  NumberInput,
  SaveBar,
  TextArea,
  TextInput,
} from "../components/admin/fields";
import { EntityCard } from "../components/admin/EntityCard";
import { ListField } from "../components/admin/ListField";
import { CardListField, type CardItem } from "../components/admin/CardListField";
import { useSaver } from "../components/admin/use-saver";
import {
  fetchAdminContent,
  fetchAdminServicePage,
  saveServicePage,
  saveServices,
  saveSupportTariffs,
} from "../lib/admin.rpc";
import { serviceFromSlug } from "../data/services";

/**
 * Полный редактор одной услуги.
 *
 * Разделы свёрнуты и открываются по одному: на этой странице живёт около
 * тридцати полей, и развернуть их все сразу — это ровно та жалоба, из-за
 * которой раздел контента и разнесли по страницам. В свёрнутом заголовке
 * видна сводка, чтобы не открывать раздел ради того, чтобы вспомнить,
 * что внутри.
 *
 * Сохранение одно на всю страницу, а запросов два (каталог и тексты
 * страницы): это разные накладки с разными правилами, но для владельца
 * они — одна услуга, и две кнопки «сохранить» тут были бы ловушкой.
 */

export const Route = createFileRoute("/admin/content/services/$slug")({
  loader: async ({ params }) => {
    const id = serviceFromSlug(params.slug);
    if (!id) throw notFound();

    const [content, page] = await Promise.all([
      fetchAdminContent(),
      fetchAdminServicePage({ data: { id } }),
    ]);

    const service = content.services.find((item) => item.id === id);
    if (!service) throw notFound();

    return { id, service, page };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.service.cardTitle ?? "Услуга"} — админка IT-Agent` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ServiceEditor,
});

type Section = "basics" | "hero" | "bestFor" | "features" | "steps" | "plans";

function ServiceEditor() {
  const { id, service, page } = Route.useLoaderData();

  const [basics, setBasics] = useState({
    priceValue: service.priceValue,
    timeline: service.timeline,
    short: service.short,
    description: service.description,
  });

  const [content, setContent] = useState({
    eyebrow: page?.page.eyebrow ?? "",
    heroTitle: page?.page.heroTitle ?? "",
    heroLead: page?.page.heroLead ?? "",
    bestFor: page?.page.bestFor ?? [],
    features: (page?.page.features ?? []) as CardItem[],
    steps: (page?.page.steps ?? []) as CardItem[],
  });

  const [plans, setPlans] = useState(page?.supportPlans ?? []);

  const [open, setOpen] = useState<Section | null>(null);

  const initialBasics = useMemo(
    () => ({
      priceValue: service.priceValue,
      timeline: service.timeline,
      short: service.short,
      description: service.description,
    }),
    [service],
  );
  const initialContent = useMemo(
    () => ({
      eyebrow: page?.page.eyebrow ?? "",
      heroTitle: page?.page.heroTitle ?? "",
      heroLead: page?.page.heroLead ?? "",
      bestFor: page?.page.bestFor ?? [],
      features: (page?.page.features ?? []) as CardItem[],
      steps: (page?.page.steps ?? []) as CardItem[],
    }),
    [page],
  );
  const initialPlans = useMemo(() => page?.supportPlans ?? [], [page]);

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  const basicsDirty = !same(basics, initialBasics);
  const heroDirty = !same(
    [content.eyebrow, content.heroTitle, content.heroLead],
    [initialContent.eyebrow, initialContent.heroTitle, initialContent.heroLead],
  );
  const bestForDirty = !same(content.bestFor, initialContent.bestFor);
  const featuresDirty = !same(content.features, initialContent.features);
  const stepsDirty = !same(content.steps, initialContent.steps);
  const plansDirty = !same(plans, initialPlans);

  const dirty =
    basicsDirty || heroDirty || bestForDirty || featuresDirty || stepsDirty || plansDirty;

  const save = useSaver(async () => {
    /* Последовательно, а не Promise.all: каждая запись поднимает версию
       контента, и параллельные транзакции к одному файлу базы дали бы
       ненужную конкуренцию за блокировку ради экономии миллисекунд. */
    if (basicsDirty) {
      await saveServices({ data: { items: [{ id, ...basics }] } });
    }
    if (heroDirty || bestForDirty || featuresDirty || stepsDirty) {
      await saveServicePage({ data: { id, ...content } });
    }
    if (plansDirty) {
      await saveSupportTariffs({ data: { items: plans } });
    }
    return { ok: true as const };
  }, dirty);

  const touch = () => save.reset();

  return (
    <div className="space-y-2 pb-24">
      <div className="space-y-3">
        <Link
          to="/admin/content/services"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Услуги
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-xl tracking-tight">{service.cardTitle}</h1>
          {/* Ссылка на живую страницу: посмотреть, что получилось, — это
              половина работы с текстом, а искать адрес руками неудобно. */}
          <a
            href={service.path}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-accent"
          >
            {service.path}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <EntityCard
          title="Цена и срок"
          summary={`${service.priceFrom} · ${basics.timeline}`}
          open={open === "basics"}
          onToggle={() => setOpen(open === "basics" ? null : "basics")}
          dirty={basicsDirty}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              label={service.priceUnit === "month" ? "Цена, ₽ в месяц" : "Цена, ₽"}
              value={basics.priceValue}
              onChange={(v) => {
                setBasics((p) => ({ ...p, priceValue: v }));
                touch();
              }}
            />
            <TextInput
              label="Срок"
              hint="общий, с ожиданием материалов"
              value={basics.timeline}
              onChange={(v) => {
                setBasics((p) => ({ ...p, timeline: v }));
                touch();
              }}
              limit={22}
            />
          </div>
          <TextInput
            label="Коротко"
            hint="строка на карточке в каталоге"
            value={basics.short}
            onChange={(v) => {
              setBasics((p) => ({ ...p, short: v }));
              touch();
            }}
            limit={70}
          />
          <TextInput
            label="Описание"
            hint="на странице направления и в микроразметке"
            value={basics.description}
            onChange={(v) => {
              setBasics((p) => ({ ...p, description: v }));
              touch();
            }}
            limit={130}
          />
        </EntityCard>

        <EntityCard
          title="Первый экран"
          summary={content.heroTitle.replace(/\*/g, "") || "не заполнен"}
          open={open === "hero"}
          onToggle={() => setOpen(open === "hero" ? null : "hero")}
          dirty={heroDirty}
        >
          <TextInput
            label="Плашка над заголовком"
            value={content.eyebrow}
            onChange={(v) => {
              setContent((p) => ({ ...p, eyebrow: v }));
              touch();
            }}
            limit={28}
          />
          <div>
            <TextInput
              label="Заголовок"
              hint="часть в *звёздочках* красится акцентом"
              value={content.heroTitle}
              onChange={(v) => {
                setContent((p) => ({ ...p, heroTitle: v }));
                touch();
              }}
              limit={42}
            />
            <AccentPreview value={content.heroTitle} />
          </div>
          <TextArea
            label="Текст под заголовком"
            value={content.heroLead}
            onChange={(v) => {
              setContent((p) => ({ ...p, heroLead: v }));
              touch();
            }}
            rows={3}
            limit={200}
          />
        </EntityCard>

        <EntityCard
          title="Кому подходит"
          summary={`${content.bestFor.length} пунктов`}
          open={open === "bestFor"}
          onToggle={() => setOpen(open === "bestFor" ? null : "bestFor")}
          dirty={bestForDirty}
        >
          <ListField
            label="Пункты"
            hint="узкая колонка рядом со сроком и ценой — коротко"
            value={content.bestFor}
            onChange={(v) => {
              setContent((p) => ({ ...p, bestFor: v }));
              touch();
            }}
            placeholder="Запуск услуги или продукта"
          />
        </EntityCard>

        <EntityCard
          title="Что получите"
          summary={`${content.features.length} карточек`}
          open={open === "features"}
          onToggle={() => setOpen(open === "features" ? null : "features")}
          dirty={featuresDirty}
        >
          <CardListField
            value={content.features}
            onChange={(v) => {
              setContent((p) => ({ ...p, features: v }));
              touch();
            }}
            withIcon
            titleLabel="Заголовок"
            titleLimit={24}
            textLabel="Описание"
            textLimit={90}
            addLabel="Добавить карточку"
            countHint="сетка по три в ряд — ровно ложатся 3, 6 или 9"
          />
        </EntityCard>

        {/* У поддержки шагов нет: там вместо них тарифы. Пустой раздел
            «как работаем» на её странице выглядел бы недоделкой. */}
        {id !== "support" && (
          <EntityCard
            title="Как работаем"
            summary={`${content.steps.length} шагов`}
            open={open === "steps"}
            onToggle={() => setOpen(open === "steps" ? null : "steps")}
            dirty={stepsDirty}
          >
            <CardListField
              value={content.steps}
              onChange={(v) => {
                setContent((p) => ({ ...p, steps: v }));
                touch();
              }}
              withStep
              titleLabel="Название шага"
              titleLimit={22}
              textLabel="Что происходит"
              textLimit={90}
              addLabel="Добавить шаг"
              countHint="сетка по четыре в ряд; в длительности — чистая работа, без ожидания материалов"
            />
          </EntityCard>
        )}

        {id === "support" && plans.length > 0 && (
          <EntityCard
            title="Тарифы сопровождения"
            summary={`${plans.length} тарифа`}
            open={open === "plans"}
            onToggle={() => setOpen(open === "plans" ? null : "plans")}
            dirty={plansDirty}
          >
            <div className="space-y-2.5">
              {plans.map((plan, index) => (
                <div key={plan.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <TextInput
                      label="Название"
                      value={plan.name}
                      onChange={(v) => {
                        setPlans((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, name: v } : p)),
                        );
                        touch();
                      }}
                      limit={24}
                    />
                    <NumberInput
                      label="Цена, ₽ в месяц"
                      value={plan.priceValue}
                      onChange={(v) => {
                        setPlans((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, priceValue: v } : p)),
                        );
                        touch();
                      }}
                    />
                  </div>
                  <div className="mt-2.5">
                    <TextInput
                      label="Вместо цены"
                      hint="показывается, когда цена 0; пусто — возьмётся цена услуги"
                      value={plan.priceText}
                      onChange={(v) => {
                        setPlans((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, priceText: v } : p)),
                        );
                        touch();
                      }}
                      placeholder="по запросу"
                      limit={20}
                    />
                  </div>
                  <div className="mt-2.5">
                    <ListField
                      label="Что входит"
                      hint="три тарифа стоят в ряд — держите одинаковое число пунктов"
                      value={plan.features}
                      onChange={(v) => {
                        setPlans((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, features: v } : p)),
                        );
                        touch();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </EntityCard>
        )}
      </div>

      <SaveBar state={save} dirty={dirty} />
    </div>
  );
}
