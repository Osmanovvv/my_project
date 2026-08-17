import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { ShoppingBag, CreditCard, Truck, PackageSearch, Boxes, BarChart3, Tag } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { SERVICE_BY_ID } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";

/* Значения по умолчанию — для мета-тегов и микроразметки, которые
   собираются до отрисовки. Цена и срок на самой странице берутся
   из снимка контента: они правятся из админки. */
const service = SERVICE_BY_ID["websites/ecommerce"];

export const Route = createFileRoute("/services/websites/ecommerce")({
  head: () => {
    const base = seo({
      title: "Интернет-магазин — Сайты — IT-Agent",
      description:
        "E-commerce под ключ: каталог, корзина, оплата, доставка, интеграции с CRM и 1С.",
      path: service.path,
      socialTitle: "Интернет-магазин — IT-Agent",
      socialDescription:
        "Магазин, который продаёт: удобный каталог, оплата и доставка, аналитика заказов.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: EcommercePage,
});

function EcommercePage() {
  const { serviceById } = useLoaderData({ from: "__root__" });
  const live = serviceById["websites/ecommerce"];

  return (
    <ServiceVariationPage
      eyebrow="Сайты · E-commerce"
      title={
        <>
          Интернет-магазин, <span className="text-accent">который продаёт</span>
        </>
      }
      description="Каталог, корзина, оплата, доставка и личный кабинет. Всё связано с CRM, складом и уведомлениями в Telegram."
      icon={ShoppingBag}
      accent="indigo"
      timeline={live.timeline}
      priceFrom={live.priceFrom}
      bestFor={[
        "Бренды и производители",
        "Локальные магазины и шоурумы",
        "D2C и подписочные модели",
      ]}
      features={[
        {
          icon: PackageSearch,
          title: "Каталог и фильтры",
          text: "Категории, фасетные фильтры, поиск, рекомендации.",
        },
        {
          icon: CreditCard,
          title: "Оплата онлайн",
          text: "ЮKassa, Stripe, СБП, Telegram Payments — на выбор.",
        },
        {
          icon: Truck,
          title: "Доставка",
          text: "Расчёт стоимости, интеграции со СДЭК, Почтой, курьерами.",
        },
        {
          icon: Boxes,
          title: "Склад и 1С",
          text: "Синхронизация остатков и заказов с 1С, МойСклад, CRM.",
        },
        {
          icon: Tag,
          title: "Промо и лояльность",
          text: "Купоны, скидки, реферальная программа, кэшбек.",
        },
        {
          icon: BarChart3,
          title: "Аналитика продаж",
          text: "Дашборд заказов, воронка, e-commerce события в GA4.",
        },
      ]}
      process={[
        {
          step: "1 неделя",
          title: "Аналитика и UX",
          text: "Ассортимент, сценарии покупки, прототипы ключевых экранов.",
        },
        {
          step: "1–2 недели",
          title: "Дизайн",
          text: "Каталог, карточка товара, корзина, чекаут, ЛК.",
        },
        {
          step: "2–3 недели",
          title: "Разработка",
          text: "Каталог, оплата, доставка, интеграции с CRM и складом.",
        },
        {
          step: "3–5 дней",
          title: "Запуск",
          text: "Тестовые заказы, тренировка команды, релиз в прод.",
        },
      ]}
      siblings={[
        { to: "/services/websites/landing", label: "Лендинг" },
        { to: "/services/websites/corporate", label: "Корпоративный сайт" },
        { to: "/services/bots/miniapp", label: "Telegram MiniApp" },
      ]}
    />
  );
}
