#!/usr/bin/env node

/** Проверяет production env, не печатая значения секретов. */
const env = process.env;
const errors = [];
const warnings = [];

const required = (name) => {
  if (!env[name]?.trim()) errors.push(`${name} не задан`);
};
const numericList = (name) => {
  const value = env[name]?.trim() ?? "";
  if (value && value.split(",").some((item) => !/^[1-9]\d*$/.test(item.trim())))
    errors.push(`${name} содержит нечисловой ID`);
};

if (env.APP_ENV?.trim().toLowerCase() !== "production") errors.push("APP_ENV должен быть production");
if (env.DATA_DIR?.trim() !== "/var/lib/itagent") warnings.push("DATA_DIR не равен /var/lib/itagent");
if (env.TELEGRAM_DELIVERY_ENABLED?.trim().toLowerCase() === "false")
  errors.push("TELEGRAM_DELIVERY_ENABLED выключен");

required("TELEGRAM_BOT_TOKEN");
required("TELEGRAM_CHAT_ID");
required("TELEGRAM_WEBHOOK_SECRET");
if (env.TELEGRAM_BOT_TOKEN && !/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN.trim()))
  errors.push("TELEGRAM_BOT_TOKEN имеет неожиданный формат");
if (env.TELEGRAM_CHAT_ID && !/^-?\d+$/.test(env.TELEGRAM_CHAT_ID.trim()))
  errors.push("TELEGRAM_CHAT_ID должен быть числовым");
if (env.TELEGRAM_WEBHOOK_SECRET && !/^[A-Za-z0-9_-]{16,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET.trim()))
  errors.push("TELEGRAM_WEBHOOK_SECRET должен быть 16–256 символов A-Z/a-z/0-9/_/-");

numericList("TELEGRAM_OPERATOR_IDS");
numericList("TELEGRAM_TEST_USER_IDS");
if (env.TELEGRAM_OPERATOR_NOTIFICATIONS?.trim().toLowerCase() === "true") {
  required("TELEGRAM_OPERATOR_IDS");
  required("TELEGRAM_OPERATOR_CHAT_ID");
  if (env.TELEGRAM_OPERATOR_CHAT_ID && !/^-?\d+$/.test(env.TELEGRAM_OPERATOR_CHAT_ID.trim()))
    errors.push("TELEGRAM_OPERATOR_CHAT_ID должен быть числовым");
}
if (env.VITE_SITE_URL && !env.VITE_SITE_URL.trim().startsWith("https://"))
  errors.push("VITE_SITE_URL в production должен быть HTTPS");
if (env.TELEGRAM_MINIAPP_URL && !env.TELEGRAM_MINIAPP_URL.trim().startsWith("https://"))
  errors.push("TELEGRAM_MINIAPP_URL в production должен быть HTTPS");

if (warnings.length) for (const warning of warnings) console.warn(`[production-env] WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[production-env] FAIL: ${error}`);
  process.exitCode = 1;
} else {
  console.log("[production-env] OK: production env прошёл проверку; секреты не печатались");
}
