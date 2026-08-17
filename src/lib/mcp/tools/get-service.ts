import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SERVICE_IDS, SERVICE_BY_ID, type ServiceId } from "../../../data/services";

const AVAILABLE = SERVICE_IDS.join(", ");

function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(value);
}

export default defineTool({
  name: "get_service",
  title: "Детали услуги",
  description:
    "Возвращает подробности услуги по идентификатору (например websites/landing, bots/telegram, support).",
  inputSchema: {
    id: z.string().min(1).describe(`Идентификатор услуги: ${AVAILABLE}`),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ id }) => {
    const key = id.trim().toLowerCase();
    if (!isServiceId(key)) {
      return {
        content: [{ type: "text", text: `Услуга "${id}" не найдена. Доступные: ${AVAILABLE}` }],
        isError: true,
      };
    }

    const service = SERVICE_BY_ID[key];
    const item = {
      id: service.id,
      title: service.title,
      description: service.description,
      path: service.path,
      timeline: service.timeline,
      priceFrom: service.priceFrom,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
      structuredContent: { service: item },
    };
  },
});
