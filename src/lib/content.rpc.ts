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
import type { ContentSnapshot } from "../server/content.server";

export type { CaseStudy, ContentSnapshot };

/**
 * Весь редактируемый контент одним запросом: услуги, пакеты, вопросы,
 * цифры, контакты, тексты.
 *
 * Одним, а не по кусочкам, намеренно. Страницы показывают всё вперемешку —
 * главная и цены, и вопросы, и плитки, — и раздельные запросы дали бы пять
 * походов на сервер при каждом переходе. На сервере снимок к тому же
 * кешируется по версии контента, так что цена этого вызова — почти ноль.
 */
export const fetchSiteContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<ContentSnapshot> => {
    const { content } = await import("../server/content.server");
    return content();
  },
);

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
