import { createFileRoute } from "@tanstack/react-router";
import { Layout, FileText, Users, Building2, Newspaper, Search, Languages } from "lucide-react";
import { ServiceVariationPage } from "../components/site/ServiceVariationPage";
import { getService } from "../data/services";
import { seo, serviceJsonLd } from "../lib/seo";

const service = getService("websites/corporate");

export const Route = createFileRoute("/services/websites/corporate")({
  head: () => {
    const base = seo({
      title: "Корпоративный сайт — Сайты — IT-Agent",
      description:
        "Многостраничный сайт компании: услуги, кейсы, блог, вакансии. Собственная админка и SEO.",
      path: service.path,
      socialTitle: "Корпоративный сайт — IT-Agent",
      socialDescription:
        "Сайт с услугами, кейсами, командой и блогом — под управлением без разработчика.",
    });
    return { ...base, meta: [...base.meta, serviceJsonLd(service)] };
  },
  component: CorporatePage,
});

function CorporatePage() {
  return (
    <ServiceVariationPage
      eyebrow="Сайты · Корпоративный"
      title={
        <>
          Корпоративный сайт, <span className="text-accent">которым гордятся</span>
        </>
      }
      description="Многостраничник для компании: услуги, кейсы, команда, блог и вакансии. Управляется без разработчика и растёт в поиске."
      icon={Layout}
      accent="indigo"
      timeline={service.timeline}
      priceFrom={service.priceFrom}
      bestFor={["Агентства и студии", "B2B-услуги", "Производство и подрядчики"]}
      features={[
        {
          icon: FileText,
          title: "Услуги и кейсы",
          text: "Отдельные страницы под каждую услугу и кейс — важно для SEO.",
        },
        {
          icon: Users,
          title: "Команда и вакансии",
          text: "Раздел о команде, HR-страница, приём откликов в Telegram.",
        },
        {
          icon: Newspaper,
          title: "Блог и медиа",
          text: "Полноценный блог с рубриками, тегами и RSS.",
        },
        {
          icon: Search,
          title: "SEO из коробки",
          text: "Sitemap, robots, микроразметка, human-friendly URL.",
        },
        {
          icon: Building2,
          title: "Админка",
          text: "Редактируйте тексты, услуги, кейсы и команду без разработчика.",
        },
        { icon: Languages, title: "Мультиязычность", text: "RU / EN / другой язык — опционально." },
      ]}
      process={[
        {
          step: "3–5 дней",
          title: "Аналитика",
          text: "Разбираем структуру, конкурентов, собираем карту сайта.",
        },
        {
          step: "5–7 дней",
          title: "Дизайн",
          text: "Ключевые экраны, дизайн-система, шаблоны страниц.",
        },
        {
          step: "1–2 недели",
          title: "Разработка",
          text: "Вёрстка, админка, интеграции с CRM и почтой.",
        },
        {
          step: "2–3 дня",
          title: "Запуск и контент",
          text: "Наполняем реальным контентом, настраиваем аналитику, публикуем.",
        },
      ]}
      siblings={[
        { to: "/services/websites/landing", label: "Лендинг" },
        { to: "/services/websites/ecommerce", label: "E-commerce" },
        { to: "/services/support", label: "Поддержка и SEO" },
      ]}
    />
  );
}
