/**
 * Мета-теги страниц. Раньше в шестнадцати роутах лежала своя копия блока
 * `meta`, а og:image был захардкожен на превью-домен Lovable — на своём
 * домене картинка отвалилась бы.
 *
 * Домен берётся из `VITE_SITE_URL`. Префикс `VITE_` намеренный: адрес сайта
 * публичный, он должен попасть и в клиентский бандл.
 */

import type { DetailedHTMLProps, LinkHTMLAttributes, MetaHTMLAttributes } from "react";

import type { Service } from "../data/services";

/** Типы элементов, которые принимает `head()` роута. */
export type HeadMetaTag = DetailedHTMLProps<MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
export type HeadLinkTag = DetailedHTMLProps<LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;

/**
 * Запасной адрес на случай, если `VITE_SITE_URL` не задана в окружении.
 * Раньше тут стоял превью-домен Lovable — с ним канонические ссылки, sitemap
 * и og:image на своём хостинге указывали бы на чужой сайт. Теперь свой домен.
 */
const FALLBACK_SITE_URL = "https://itagent.ru";

/** Базовый адрес без завершающего слэша. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL?.trim() || FALLBACK_SITE_URL).replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "IT-Agent";
export const DEFAULT_OG_IMAGE = "/og-image.jpg";
export const LOCALE = "ru_RU";

/** Относительный путь → абсолютный URL. Внешние ссылки не трогает. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type SeoInput = {
  title: string;
  description: string;
  /** Путь страницы для canonical и og:url, например `/services/websites`. */
  path: string;
  /** Заголовок для соцсетей, если он должен отличаться от <title>. */
  socialTitle?: string;
  socialDescription?: string;
  image?: string;
  type?: "website" | "article";
};

/**
 * Собирает `meta` и `links` для `head()` роута: title, description,
 * OpenGraph, Twitter Card и canonical — согласованно и с абсолютными URL.
 */
export function seo({
  title,
  description,
  path,
  socialTitle,
  socialDescription,
  image = DEFAULT_OG_IMAGE,
  type = "website",
}: SeoInput): { meta: HeadMetaTag[]; links: HeadLinkTag[] } {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: LOCALE },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { property: "og:title", content: socialTitle ?? title },
      { property: "og:description", content: socialDescription ?? description },
      { property: "og:image", content: imageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: socialTitle ?? title },
      { name: "twitter:description", content: socialDescription ?? description },
      { name: "twitter:image", content: imageUrl },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

/**
 * Микроразметка. Роутер понимает ключ `script:ld+json` внутри `meta`
 * и сам рендерит `<script type="application/ld+json">` с экранированием.
 *
 * Приведение типа нужно потому, что `head().meta` типизирован React-атрибутами
 * тега `<meta>` — про служебный ключ роутера они не знают, хотя рантайм его
 * обрабатывает (см. `headContentUtils`).
 */
export function jsonLd(data: Record<string, unknown>): HeadMetaTag {
  return { "script:ld+json": data } as unknown as HeadMetaTag;
}

/** Разметка Service с ценой «от N» — минимальная граница, а не фиксированная. */
export function serviceJsonLd(service: Service) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    serviceType: service.title,
    description: service.description,
    url: absoluteUrl(service.path),
    areaServed: "RU",
    provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(service.path),
      availability: "https://schema.org/InStock",
      /* Помесячная цена — отдельный тип. У `PriceSpecification` свойства
         `unitText` нет вовсе: валидатор ругался «property not recognised»,
         а парсер читал абонентскую плату как разовый платёж. */
      priceSpecification:
        service.priceUnit === "month"
          ? {
              "@type": "UnitPriceSpecification",
              priceCurrency: "RUB",
              minPrice: service.priceValue,
              unitCode: "MON",
              billingDuration: 1,
              billingIncrement: 1,
            }
          : {
              "@type": "PriceSpecification",
              priceCurrency: "RUB",
              minPrice: service.priceValue,
            },
    },
  });
}

/** Разметка FAQPage — даёт расширенный сниппет в выдаче. */
export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  });
}
