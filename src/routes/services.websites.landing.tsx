import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Zap, Target, Rocket, Gauge, Search, Palette, Puzzle } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { SERVICE_BY_ID } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";

/* Значения по умолчанию — для мета-тегов и микроразметки, которые
   собираются до отрисовки. Цена и срок на самой странице берутся
   из снимка контента: они правятся из админки. */
const service = SERVICE_BY_ID["websites/landing"];

export const Route = createFileRoute("/services/websites/landing")({
  head: () => {
    const base = seo({
      title: "Лендинг — Сайты — IT-Agent",
      description:
        "Одностраничный сайт под запуск, услугу или продукт. Дизайн, тексты, формы, аналитика.",
      path: service.path,
      socialTitle: "Лендинг под ключ — IT-Agent",
      socialDescription: "Быстрый одностраничник, который приводит заявки с первого дня.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: LandingPage,
});

function LandingPage() {
  const { serviceById } = useLoaderData({ from: "__root__" });
  const live = serviceById["websites/landing"];

  return (
    <ServiceVariationPage
      eyebrow="Сайты · Лендинг"
      title={
        <>
          Лендинг, который <span className="text-accent">конвертирует</span>
        </>
      }
      description="Одностраничный сайт под запуск продукта, услугу или рекламную кампанию. Быстро, красиво и с формой, из которой заявки не теряются."
      icon={Zap}
      accent="indigo"
      timeline={live.timeline}
      priceFrom={live.priceFrom}
      bestFor={[
        "Запуск услуги или продукта",
        "Реклама Яндекс / Telegram Ads",
        "Проверка спроса и MVP",
      ]}
      features={[
        {
          icon: Palette,
          title: "Уникальный дизайн",
          text: "Не шаблон. Собираем под бренд, продукт и целевую аудиторию.",
        },
        {
          icon: Gauge,
          title: "Скорость 90+",
          text: "Lighthouse 90+, оптимизация картинок, ленивая загрузка.",
        },
        {
          icon: Target,
          title: "Форма → Telegram",
          text: "Заявка падает менеджеру в чат за секунды, с UTM-метками.",
        },
        {
          icon: Search,
          title: "Базовое SEO",
          text: "Meta, OpenGraph, sitemap, Schema.org, аналитика.",
        },
        {
          icon: Puzzle,
          title: "Интеграции",
          text: "CRM, Google Sheets, Telegram, платёжки — по запросу.",
        },
        {
          icon: Rocket,
          title: "Готов к рекламе",
          text: "События конверсий, A/B-варианты первого экрана.",
        },
      ]}
      process={[
        {
          step: "1–2 дня",
          title: "Бриф и структура",
          text: "Разбираем оффер, ЦА, собираем прототип и структуру блоков.",
        },
        {
          step: "2–3 дня",
          title: "Дизайн",
          text: "Показываем первый экран, дорабатываем, собираем остальные секции.",
        },
        {
          step: "2–3 дня",
          title: "Вёрстка и логика",
          text: "Адаптив, анимации, формы, интеграции и аналитика.",
        },
        {
          step: "1 день",
          title: "Запуск",
          text: "Домен, SSL, метрики, финальные правки — и в бой.",
        },
      ]}
      siblings={[
        { to: "/services/websites/corporate", label: "Корпоративный сайт" },
        { to: "/services/websites/ecommerce", label: "E-commerce" },
        { to: "/services/bots/miniapp", label: "Telegram MiniApp" },
      ]}
    />
  );
}
