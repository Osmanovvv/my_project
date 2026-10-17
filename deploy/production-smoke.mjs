#!/usr/bin/env node

/** Post-release HTTP smoke-check. Bot API и webhook setWebhook не вызываются. */
const baseUrl = (process.argv[2] || process.env.VITE_SITE_URL || "https://itagent.ru").replace(/\/$/, "");
const requireWebhookActivity = process.argv.includes("--require-webhook-activity");
const forbidden = /(TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET|ADMIN_PASSWORD|bot\d{5,}:)/i;
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`[production-smoke] FAIL: ${message}`);
}

if (!baseUrl.startsWith("https://")) fail("base URL должен быть HTTPS");

async function request(path, init = {}) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
    return response;
  } catch (error) {
    fail(`${path}: ${error instanceof Error ? error.message : "сетевой сбой"}`);
    return null;
  }
}

const miniapp = await request("/miniapp");
if (miniapp && miniapp.status !== 200) fail(`/miniapp: HTTP ${miniapp.status}, ожидался 200`);
if (miniapp) {
  const body = await miniapp.text();
  if (forbidden.test(body)) fail("/miniapp содержит запрещённый секретный маркер");
}

for (const path of ["/api/telegram/miniapp/session", "/api/telegram/miniapp/leads"]) {
  const response = await request(path);
  if (response && response.status !== 401) fail(`${path}: HTTP ${response.status}, ожидался 401`);
}

const health = await request("/api/telegram/health");
if (health && health.status !== 200) fail(`/api/telegram/health: HTTP ${health.status}, ожидался 200`);
if (health) {
  const payload = await health.json().catch(() => null);
  if (!payload?.ok || payload.environment !== "production")
    fail("health не подтверждает рабочее production-окружение");
  if (forbidden.test(JSON.stringify(payload))) fail("health раскрывает секретный маркер");
  if (requireWebhookActivity && payload.webhook?.lastReceivedAt == null)
    fail("health ещё не видит ни одного принятого webhook update");
}

const webhookGet = await request("/api/telegram/webhook", { method: "GET" });
if (webhookGet && webhookGet.status !== 405)
  fail(`/api/telegram/webhook GET: HTTP ${webhookGet.status}, ожидался 405`);
const webhookNoSecret = await request("/api/telegram/webhook", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
if (webhookNoSecret && webhookNoSecret.status !== 403)
  fail(`/api/telegram/webhook без secret: HTTP ${webhookNoSecret.status}, ожидался 403`);

if (failures.length) process.exitCode = 1;
else console.log(`[production-smoke] OK: HTTPS/API/webhook checks passed for ${baseUrl}`);
