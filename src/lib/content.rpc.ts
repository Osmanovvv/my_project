/**
 * Чтение контента для публичных страниц.
 *
 * Зачем прослойка, если данные и так на сервере: загрузчик роута (`loader`)
 * выполняется дважды — на сервере при первой отрисовке и в браузере при
 * переходах между страницами. Прямой импорт `cases.server` утащил бы
 * `node:sqlite` в клиентский бандл. Серверная функция превращается в браузере
 * в запрос к серверу, а тело обработчика туда не попадает вовсе.
 *
 * Импорты внутри обработчиков динамические — по той же причине, что
 * и в `admin.rpc.ts`: так утечка серверного кода в браузер невозможна
 * по построению, а не по обещанию сборщика.
 */

import { createServerFn } from "@tanstack/react-start";

import type { CaseStudy } from "../data/cases";
import type { ContentSnapshot, PageMeta, ServicePageData } from "../server/content.server";

export type { CaseStudy, ContentSnapshot, PageMeta, ServicePageData };

/**
 * Весь редактируемый контент одним запросом: услуги, пакеты, вопросы,
 * цифры, контакты, тексты.
 *
 * Одним, а не по кусочкам, намеренно. Страницы показывают всё вперемешку —
 * главная и цены, и вопросы, и плитки, — и раздельные запросы дали бы пять
 * походов на сервер при каждом переходе. На сервере снимок к тому же
 * кешируется по версии контента, так что цена этого вызова — почти ноль.
 *
 * БЕЗ мета-тегов. Они лежат в том же снимке, но нужны только `head()`
 * страницы, а он их отсюда всё равно не видит и грузит своим запросом.
 * Оставить их здесь значило бы возить описания всех шестнадцати страниц
 * в разметке КАЖДОЙ — четыре килобайта на каждый заход ни за чем.
 */
export type PublicContent = Omit<ContentSnapshot, "seo">;

export const fetchSiteContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicContent> => {
    const { content } = await import("../server/content.server");
    const { seo: _metaTags, ...rest } = content();
    return rest;
  },
);

/**
 * Заголовок и описание страницы для поисковика — правятся из админки.
 *
 * Отдельным запросом, а не из общего снимка, по устройству роутера: `head()`
 * получает только `loaderData` СВОЕГО роута, данных корня там нет — они ещё
 * не готовы к моменту сборки тегов. Запрос крошечный (две строки текста)
 * и на сервере отвечает из кеша по версии контента.
 */
export const fetchPageMeta = createServerFn({ method: "GET" })
  .validator((data: { path: string }) => ({ path: String(data?.path ?? "") }))
  .handler(async ({ data }): Promise<PageMeta> => {
    const { pageMeta } = await import("../server/content.server");
    return pageMeta(data.path);
  });

/**
 * Тексты одной страницы услуги: первый экран, «кому подходит», «что получите»,
 * шаги. Отдельно от общего снимка — он едет в разметке каждой страницы сайта,
 * а эти девяносто строк нужны одной странице из семи.
 *
 * Отдаёт заодно мета-теги и живую услугу: `head()` страницы собирается
 * из этого же ответа, второй запрос ради двух строк не нужен.
 */
export const fetchServicePage = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data }): Promise<ServicePageData | null> => {
    const { servicePage } = await import("../server/content.server");
    return servicePage(data.id);
  });

/** Опубликованные кейсы в порядке сетки. */
export const fetchCases = createServerFn({ method: "GET" }).handler(
  async (): Promise<CaseStudy[]> => {
    const { publishedCases } = await import("../server/cases.server");
    return publishedCases();
  },
);

export type CasePageData = {
  study: CaseStudy | null;
  related: CaseStudy[];
};

/**
 * Кейс и соседние к нему. Одним запросом, а не двумя: страница кейса всегда
 * показывает и то и другое, а лишний круг до сервера при переходе заметен.
 */
export const fetchCasePage = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => ({ slug: String(data?.slug ?? "") }))
  .handler(async ({ data }): Promise<CasePageData> => {
    const { publishedCases, caseBySlug } = await import("../server/cases.server");
    const { relatedCases } = await import("../data/cases");

    const study = caseBySlug(data.slug) ?? null;
    return {
      study,
      related: study ? relatedCases(publishedCases(), study.slug) : [],
    };
  });
