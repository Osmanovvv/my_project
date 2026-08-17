import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Sparkles, ShoppingBag, User, CreditCard, Layers, Rocket, Palette } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { SERVICE_BY_ID } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";

/* Значения по умолчанию — для мета-тегов и микроразметки, которые
   собираются до отрисовки. Цена и срок на самой странице берутся
   из снимка контента: они правятся из админки. */
const service = SERVICE_BY_ID["bots/miniapp"];

export const Route = createFileRoute("/services/bots/miniapp")({
  head: () => {
    const base = seo({
      title: "Telegram MiniApp — Боты — IT-Agent",
      description:
        "MiniApp — полноценное веб-приложение внутри Telegram: каталог, оплата, личный кабинет.",
      path: service.path,
      socialTitle: "Telegram MiniApp — IT-Agent",
      socialDescription: "Native-опыт внутри мессенджера, без установки из стора.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: MiniAppPage,
});

function MiniAppPage() {
  const { serviceById } = useLoaderData({ from: "__root__" });
  const live = serviceById["bots/miniapp"];

  return (
    <ServiceVariationPage
      eyebrow="Боты · MiniApp"
      title={
        <>
          MiniApp внутри <span className="text-accent">Telegram и MAX</span>
        </>
      }
      description="Полноценное приложение открывается прямо в мессенджере: каталог, корзина, оплата, личный кабинет. Без публикации в сторах."
      icon={Sparkles}
      accent="teal"
      timeline={live.timeline}
      priceFrom={live.priceFrom}
      bestFor={["Магазины и маркетплейсы", "Клубы и подписки", "Программы лояльности и билеты"]}
      features={[
        {
          icon: ShoppingBag,
          title: "Каталог и корзина",
          text: "Категории, поиск, карточка товара, корзина и чекаут.",
        },
        {
          icon: CreditCard,
          title: "Оплата в мессенджере",
          text: "Telegram Payments, ЮKassa, Stripe — в один тап.",
        },
        {
          icon: User,
          title: "Личный кабинет",
          text: "История заказов, бонусы, адреса, уведомления.",
        },
        {
          icon: Palette,
          title: "Тёмная / светлая тема",
          text: "Автоподхват темы Telegram, native-ощущение UI.",
        },
        {
          icon: Layers,
          title: "Синхронизация с сайтом",
          text: "Одна база, единый заказ, общая CRM и склад.",
        },
        {
          icon: Rocket,
          title: "Быстрый рост",
          text: "Виральные ссылки, приглашения, шаринг прямо в чат.",
        },
      ]}
      process={[
        {
          step: "3–5 дней",
          title: "Продукт и сценарии",
          text: "Ключевые экраны, роли, интеграции с ботом и сайтом.",
        },
        {
          step: "1 неделя",
          title: "Дизайн",
          text: "UI под Telegram, тёмная тема, анимации, компоненты.",
        },
        {
          step: "2–3 недели",
          title: "Разработка",
          text: "React WebApp, авторизация через Telegram, оплаты, API.",
        },
        {
          step: "3–5 дней",
          title: "Запуск",
          text: "Регистрация MiniApp у BotFather, тесты, релиз, аналитика.",
        },
      ]}
      siblings={[
        { to: "/services/bots/telegram", label: "Telegram-бот" },
        { to: "/services/bots/max", label: "MAX-бот" },
        { to: "/services/websites/ecommerce", label: "E-commerce" },
      ]}
    />
  );
}
