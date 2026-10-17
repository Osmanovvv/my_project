#!/usr/bin/env node

/** Регистрирует webhook только после явного --apply и production preflight. */
const apply = process.argv.includes("--apply");
const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
const appEnv = process.env.APP_ENV?.trim().toLowerCase() || "";
const siteUrl = (process.env.VITE_SITE_URL?.trim() || "https://itagent.ru").replace(/\/$/, "");
const webhookUrl = `${siteUrl}/api/telegram/webhook`;

function fail(message) {
  console.error(`[telegram-webhook] FAIL: ${message}`);
  process.exitCode = 1;
}

if (appEnv !== "production") fail("регистрация разрешена только при APP_ENV=production");
if (!siteUrl.startsWith("https://")) fail("VITE_SITE_URL должен быть HTTPS");
if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) fail("TELEGRAM_BOT_TOKEN имеет неожиданный формат");
if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) fail("TELEGRAM_WEBHOOK_SECRET должен быть 16–256 символов");
if (process.exitCode) process.exit();

const payload = {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: false,
};

if (!apply) {
  console.log(`[telegram-webhook] DRY-RUN: setWebhook ${webhookUrl}`);
  console.log("[telegram-webhook] Для регистрации добавьте --apply; pending updates не удаляются.");
  process.exit();
}

try {
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(`HTTP ${response.status}`);
  console.log(`[telegram-webhook] OK: webhook зарегистрирован на ${webhookUrl}`);
} catch (error) {
  fail(error instanceof Error ? error.message : "Bot API error");
}
