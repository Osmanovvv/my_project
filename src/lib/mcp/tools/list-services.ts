import { defineTool } from "@lovable.dev/mcp-js";
import { CATEGORIES, servicesOf } from "../../../data/services";

/** Каталог собирается из общего источника — цены и сроки не расходятся с сайтом. */
const SERVICES = CATEGORIES.map((category) => ({
  category: category.id,
  title: category.title,
  path: category.path,
  description: category.description,
  variations: servicesOf(category.id)
    // Для «поддержки» само направление и есть услуга — вариаций нет.
    .filter((service) => service.path !== category.path)
    .map((service) => ({
      id: service.id,
      slug: service.id.split("/")[1],
      title: service.title,
      path: service.path,
      priceFrom: service.priceFrom,
      timeline: service.timeline,
    })),
}));

export default defineTool({
  name: "list_services",
  title: "Список услуг",
  description:
    "Возвращает каталог услуг агентства: сайты, боты/MiniApp и поддержка, с ссылками на страницы.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(SERVICES, null, 2) }],
    structuredContent: { services: SERVICES },
  }),
});
