#!/usr/bin/env node
/** Проверяет, что секреты и server-only переменные не попали в публичный bundle. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";

const root = resolve(process.argv[2] || ".output/public");
const textExtensions = new Set([".js", ".mjs", ".css", ".html", ".map"]);
const forbidden = [
  /TELEGRAM_BOT_TOKEN/,
  /TELEGRAM_WEBHOOK_SECRET/,
  /TELEGRAM_OPERATOR_CHAT_ID/,
  /ADMIN_PASSWORD/,
  /bot\d{5,}:[A-Za-z0-9_-]{20,}/,
];

function files(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...files(path));
    else if (textExtensions.has(extname(entry.name).toLowerCase())) result.push(path);
  }
  return result;
}

const matches = [];
for (const file of files(root)) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) matches.push(`${relative(process.cwd(), file)} matches ${pattern}`);
  }
}

if (matches.length) {
  console.error("client bundle audit failed:");
  for (const match of matches) console.error(`- ${match}`);
  process.exitCode = 1;
} else {
  console.log(`client bundle audit passed: ${files(root).length} public files scanned`);
}

