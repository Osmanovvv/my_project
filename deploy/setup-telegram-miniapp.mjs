#!/usr/bin/env node

/**
 * Настройка запуска Mini App в Bot API.
 *
 * По умолчанию выполняет только идемпотентные setMyCommands и
 * setChatMenuButton. Для проверки без сетевого вызова используйте:
 *   node deploy/setup-telegram-miniapp.mjs --dry-run
 *
 * TELEGRAM_OPERATOR_CHAT_ID обязателен на production: для него меню
 * переключается обратно на команды, поэтому /admin не смешивается с Mini App.
 */

const API = "https://api.telegram.org";
const dryRun = process.argv.includes("--dry-run");
const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const appEnv = process.env.APP_ENV?.trim().toLowerCase() || "development";
const operatorChatId = process.env.TELEGRAM_OPERATOR_CHAT_ID?.trim() || "";
const configuredUrl = process.env.TELEGRAM_MINIAPP_URL?.trim() || "";
const siteUrl = process.env.VITE_SITE_URL?.trim() || "https://itagent.ru";
const miniAppUrl = (configuredUrl || `${siteUrl.replace(/\/$/, "")}/miniapp`).replace(/\/$/, "");

const clientCommands = [
  { command: "start", description: "Открыть главное меню" },
  { command: "help", description: "Помощь и контакты" },
  { command: "request", description: "Создать новую заявку" },
  { command: "status", description: "Мои обращения и статусы" },
  { command: "cancel", description: "Отменить текущее действие" },
];
const operatorCommands = [
  ...clientCommands,
  { command: "admin", description: "Открыть меню оператора" },
];

function fail(message) {
  console.error(`[telegram-miniapp] FAIL: ${message}`);
  process.exitCode = 1;
}

if (!miniAppUrl.startsWith("https://")) fail("URL Mini App должен начинаться с https://");
if (operatorChatId && !/^-?\d+$/.test(operatorChatId))
  fail("TELEGRAM_OPERATOR_CHAT_ID должен быть числовым chat ID");
if (appEnv === "production" && !operatorChatId)
  fail("в production нужен TELEGRAM_OPERATOR_CHAT_ID для сохранения меню /admin");
if (!dryRun && !token) fail("TELEGRAM_BOT_TOKEN не задан");
if (process.exitCode) process.exit();

const operations = [
  {
    method: "setMyCommands",
    body: { commands: clientCommands },
    label: "клиентские команды по умолчанию",
  },
  {
    method: "setChatMenuButton",
    body: {
      menu_button: {
        type: "web_app",
        text: "Открыть Mini App",
        web_app: { url: miniAppUrl },
      },
    },
    label: "кнопка Mini App по умолчанию",
  },
];

if (operatorChatId) {
  operations.push(
    {
      method: "setMyCommands",
      body: { commands: operatorCommands, scope: { type: "chat", chat_id: operatorChatId } },
      label: "команды оператора",
    },
    {
      method: "setChatMenuButton",
      body: { chat_id: operatorChatId, menu_button: { type: "commands" } },
      label: "командная кнопка оператора",
    },
  );
} else {
  console.warn(
    "[telegram-miniapp] TELEGRAM_OPERATOR_CHAT_ID не задан: chat-scoped меню оператора пропущено",
  );
}

if (dryRun) {
  for (const operation of operations) console.log(`[telegram-miniapp] DRY-RUN: ${operation.label}`);
  console.log(`[telegram-miniapp] URL Mini App: ${miniAppUrl}`);
  process.exit();
}

async function callBotApi(method, body) {
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(`HTTP ${response.status}`);
}

for (const operation of operations) {
  try {
    await callBotApi(operation.method, operation.body);
    console.log(`[telegram-miniapp] OK: ${operation.label}`);
  } catch (error) {
    fail(`${operation.label}: ${error instanceof Error ? error.message : "ошибка Bot API"}`);
    break;
  }
}
