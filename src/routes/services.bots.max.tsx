import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { MessageSquare, Sparkles, ShieldCheck, Users, Zap, Bell, Rocket } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { SERVICE_BY_ID } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";

/* Значения по умолчанию — для мета-тегов и микроразметки, которые
   собираются до отрисовки. Цена и срок на самой странице берутся
   из снимка контента: они правятся из админки. */
const service = SERVICE_BY_ID["bots/max"];

export const Route = createFileRoute("/services/bots/max")({
  head: () => {
    const base = seo({
      title: "MAX-бот — Боты — IT-Agent",
      description:
        "Боты для российского мессенджера MAX: новая аудитория, тот же функционал, что и у Telegram-ботов.",
      path: service.path,
      socialTitle: "MAX-бот под ключ — IT-Agent",
      socialDescription: "Автоворонки, оплаты и поддержка внутри мессенджера MAX.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: MaxBotPage,
});

function MaxBotPage() {
  const { serviceById } = useLoaderData({ from: "__root__" });
  const live = serviceById["bots/max"];

  return (
    <ServiceVariationPage
      eyebrow="Боты · MAX"
      title={
        <>
          Бот в <span className="text-accent">мессенджере MAX</span>
        </>
      }
      description="Новый российский мессенджер, новая аудитория. Переносим бота из Telegram или собираем с нуля — воронки, оплаты, поддержка."
      icon={MessageSquare}
      accent="teal"
      timeline={live.timeline}
      priceFrom={live.priceFrom}
      bestFor={[
        "Госсектор и корпоративный сегмент",
        "Бренды, ориентированные на РФ",
        "Проекты с фокусом на приватность",
      ]}
      features={[
        {
          icon: Sparkles,
          title: "Первопроходцы",
          text: "Заходим в MAX раньше конкурентов и занимаем аудиторию.",
        },
        {
          icon: Rocket,
          title: "Перенос из Telegram",
          text: "Одна логика, две площадки — экономим бюджет на разработку.",
        },
        {
          icon: ShieldCheck,
          title: "Требования РФ",
          text: "Хостинг и данные внутри РФ, работа с 152-ФЗ.",
        },
        {
          icon: Users,
          title: "Роли и рассылки",
          text: "Сегменты пользователей, персональные сценарии.",
        },
        {
          icon: Bell,
          title: "Уведомления",
          text: "Клиенту — статусы, менеджеру — заявки, руководителю — отчёты.",
        },
        { icon: Zap, title: "Быстрый MVP", text: "Первая рабочая версия за 5–7 дней." },
      ]}
      process={[
        {
          step: "2–3 дня",
          title: "Сценарий и стек",
          text: "Определяем сценарии, API MAX, регистрируем бота.",
        },
        { step: "3–5 дней", title: "Ядро бота", text: "Меню, роли, база, ключевые команды." },
        { step: "3–7 дней", title: "Интеграции", text: "Оплаты, CRM, уведомления, аналитика." },
        { step: "1–2 дня", title: "Запуск", text: "Тесты, обучение команды, публичный релиз." },
      ]}
      siblings={[
        { to: "/services/bots/telegram", label: "Telegram-бот" },
        { to: "/services/bots/miniapp", label: "MiniApp" },
        { to: "/services/support", label: "Поддержка бота" },
      ]}
    />
  );
}
