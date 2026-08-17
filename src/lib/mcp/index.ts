import { defineMcp } from "@lovable.dev/mcp-js";
import listServicesTool from "./tools/list-services";
import getServiceTool from "./tools/get-service";
import getContactsTool from "./tools/get-contacts";

export default defineMcp({
  name: "it-agent-mcp",
  title: "IT-Agent MCP",
  version: "0.1.0",
  instructions:
    "Инструменты для агентства IT-Agent: каталог услуг (сайты, боты/MiniApp, поддержка), детали по услуге и публичные контакты.",
  tools: [listServicesTool, getServiceTool, getContactsTool],
});
