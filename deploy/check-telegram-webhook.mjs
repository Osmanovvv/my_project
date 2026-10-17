#!/usr/bin/env node

/**
 * Безопасная проверка перед setWebhook.
 *
 * Скрипт только читает HTTPS endpoints и намеренно не вызывает Telegram
 * setWebhook. Его можно запускать после релиза с любой машины:
 *   node deploy/check-telegram-webhook.mjs https://itagent.ru
 */

const baseUrl = (process.argv[2] || process.env.VITE_SITE_URL || "https://itagent.ru").replace(
  /\/$/,
  "",
);

function fail(message) {
  console.error(`[telegram-preflight] FAIL: ${message}`);
  process.exitCode = 1;
}

if (!baseUrl.startsWith("https://")) {
  fail("base URL должен начинаться с https://");
  process.exit();
}

async function check(path, init, expected, label) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
    if (!expected.includes(response.status)) {
      fail(`${label}: HTTP ${response.status}, ожидался ${expected.join(" или ")}`);
      return;
    }
    console.log(`[telegram-preflight] OK: ${label} (HTTP ${response.status})`);
  } catch (error) {
    fail(`${label}: ${error instanceof Error ? error.message : "сетевой сбой"}`);
  }
}

await check("/api/telegram/health", {}, [200, 503], "health route доступен");
await check(
  "/api/telegram/webhook",
  { method: "GET" },
  [405],
  "webhook route отвечает только POST",
);
await check(
  "/api/telegram/webhook",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  [403, 503],
  "webhook отклоняет запрос без secret",
);

if (process.exitCode) {
  console.error("[telegram-preflight] setWebhook не выполнялся; сначала исправьте FAIL.");
} else {
  console.log(
    "[telegram-preflight] Готово: можно переходить к отдельному шагу 10.7 и регистрировать webhook.",
  );
}
