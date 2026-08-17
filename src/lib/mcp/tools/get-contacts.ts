import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_contacts",
  title: "Контакты",
  description: "Возвращает публичные контакты и ссылки для связи с агентством.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const contacts = {
      site: "/",
      contactsPage: "/contacts",
      services: "/services",
      works: "/works",
      faq: "/faq",
    };
    return {
      content: [
        {
          type: "text",
          text: "Свяжитесь через страницу /contacts на сайте. Разделы: /services (услуги), /works (работы), /faq (вопросы).",
        },
      ],
      structuredContent: { contacts },
    };
  },
});
