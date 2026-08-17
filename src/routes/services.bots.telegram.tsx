import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Send, Bell, CreditCard, Users, Bot, Workflow, BarChart3 } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { SERVICE_BY_ID } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";

/* Значения по умолчанию — для мета-тегов и микроразметки, которые
   собираются до отрисовки. Цена и срок на самой странице берутся
   из снимка контента: они правятся из админки. */
const service = SERVICE_BY_ID["bots/telegram"];

export const Route = createFileRoute("/services/bots/telegram")({
  head: () => {
    const base = seo({
      title: "Telegram-бот — Боты — IT-Agent",
      description:
        "Telegram-боты для заявок, продаж и поддержки: воронки, оплаты, CRM и аналитика.",
      path: service.path,
      socialTitle: "Telegram-бот под ключ — IT-Agent",
      socialDescription: "Автоворонки, оплата, уведомления, поддержка 24/7 — в одном боте.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: TelegramBotPage,
});

function TelegramBotPage() {
  const { serviceById } = useLoaderData({ from: "__root__" });
  const live = serviceById["bots/telegram"];

  return (
    <ServiceVariationPage
      eyebrow="Боты · Telegram"
      title={
        <>
          Telegram-бот, который <span className="text-accent">работает 24/7</span>
        </>
      }
      description="Приём заявок, автоворонки, приём оплат, поддержка пользователей и уведомления менеджерам. Всё внутри одного бота."
      icon={Send}
      accent="teal"
      timeline={live.timeline}
      priceFrom={live.priceFrom}
      bestFor={["Услуги с заявками", "Инфопродукты и курсы", "Локальный бизнес и доставки"]}
      features={[
        {
          icon: Workflow,
          title: "Автоворонки",
          text: "Приветствие, квалификация, догрев, продажа — по расписанию.",
        },
        {
          icon: CreditCard,
          title: "Приём оплат",
          text: "Telegram Payments, ЮKassa, Stripe — прямо в чате.",
        },
        {
          icon: Bell,
          title: "Уведомления",
          text: "Клиенту — статус заявки, менеджеру — новый лид с UTM.",
        },
        {
          icon: Users,
          title: "Роли и права",
          text: "Клиенты, менеджеры, админы — каждый видит своё.",
        },
        {
          icon: Bot,
          title: "AI-ответы",
          text: "Отвечает на частые вопросы, переводит на человека при необходимости.",
        },
        {
          icon: BarChart3,
          title: "Аналитика",
          text: "Дашборд по лидам, конверсиям и источникам трафика.",
        },
      ]}
      process={[
        {
          step: "2–3 дня",
          title: "Сценарий",
          text: "Карта диалогов, сообщения, кнопки, точки интеграций.",
        },
        {
          step: "3–5 дней",
          title: "Разработка ядра",
          text: "База, авторизация, роли, основные команды и меню.",
        },
        {
          step: "3–7 дней",
          title: "Интеграции",
          text: "Оплаты, CRM, рассылки, уведомления, аналитика.",
        },
        {
          step: "1–2 дня",
          title: "Запуск",
          text: "Тестовая группа, правки, релиз, обучение менеджеров.",
        },
      ]}
      siblings={[
        { to: "/services/bots/max", label: "MAX-бот" },
        { to: "/services/bots/miniapp", label: "Telegram MiniApp" },
        { to: "/services/websites/landing", label: "Сайт под бота" },
      ]}
    />
  );
}
