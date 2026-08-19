/**
 * Проверка настроек при старте сервера.
 *
 * ЗАЧЕМ. Забыть переменную окружения на боевом сервере не просто легко —
 * это ещё и не видно. Сайт поднимется, форма ответит «отправлено», заявка
 * ляжет в базу, а уведомление в Telegram не придёт. Узнать об этом можно
 * было только по молчащему чату, то есть через неделю и от клиента.
 *
 * Проверено на живом сервере: запуск без переменных дал ровно такую картину
 * — 200 и `{"ok":true}` на форме, и одна строка «Telegram не настроен»
 * в логе, которую видно, лишь когда заявка уже пришла.
 *
 * Теперь состояние печатается один раз — при первом запросе к серверу.
 * Не при старте: Nitro подгружает точку входа лениво, и раньше первого
 * обращения этот код просто не выполняется. Проверено на собранном сервере.
 * На практике разницы нет: проверка после развёртывания начинается с curl
 * по адресу сайта, и отчёт оказывается в логе ровно тогда, когда его ищут.
 *
 * Плюс `.env` рядом с процессом подхватывается сам — systemd с его
 * `Environment=` остаётся правильным способом, но для первого развёртывания
 * файл проще и прощает больше.
 *
 * ⚠️ У ЭТОГО ЕСТЬ ОБОРОТНАЯ СТОРОНА, и на неё уже наступили. Проверочный
 * сервер, запущенный из каталога проекта, тоже подхватит `.env` — и каждая
 * тестовая заявка уедет НАСТОЯЩИМ сообщением в рабочий Telegram владельца.
 * Отключается пустым значением в окружении: пустая строка «определена»,
 * поэтому файл её не перебивает.
 *
 *   TELEGRAM_BOT_TOKEN= TELEGRAM_CHAT_ID= node .output/server/index.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Ключи, из-за которых сайт работает не полностью. */
const REQUIRED_FOR_LEADS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const;

/**
 * Заполняет из `.env` только то, чего в окружении ещё нет.
 *
 * Именно так, а не наоборот: переменная, переданная процессу, должна быть
 * главнее файла, иначе забытый в каталоге `.env` тихо переопределит
 * настройки systemd — и разбираться придётся долго.
 */
function loadEnvFile(): string | null {
  if (typeof process === "undefined" || !process.versions?.node) return null;

  try {
    const file = resolve(process.cwd(), ".env");
    if (!existsSync(file)) return null;

    let applied = 0;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;

      const key = match[1];
      /* Кавычки вокруг значения снимаются: в .env их пишут по привычке
         из shell, а в process.env они попали бы частью значения. */
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      if (value === "" || process.env[key] !== undefined) continue;

      process.env[key] = value;
      applied++;
    }
    return applied > 0 ? `${file} (${applied})` : null;
  } catch {
    /* Нет прав, нет файловой системы, битый файл — не повод не стартовать. */
    return null;
  }
}

/** Одна строка на настройку: что включено, что нет и чем это грозит. */
export function reportStartupConfig(): void {
  if (typeof process === "undefined") return;

  const fromFile = loadEnvFile();
  const say = (text: string) => console.log(`[настройки] ${text}`);

  if (fromFile) say(`подхвачен .env: ${fromFile} переменных`);

  say(`каталог данных: ${process.env.DATA_DIR?.trim() || ".data (рядом с процессом)"}`);

  const missing = REQUIRED_FOR_LEADS.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) {
    say("уведомления о заявках: включены");
  } else {
    say(`уведомления о заявках: ВЫКЛЮЧЕНЫ — нет ${missing.join(" и ")}`);
    say("           заявки будут сохраняться, но в Telegram ничего не придёт");
  }

  /* Адрес вшивается при СБОРКЕ, поэтому читается из бандла, а не из
     process.env: задавать его при запуске бесполезно, и об этом стоит
     сказать ровно там, где человек смотрит на настройки. */
  const siteUrl = import.meta.env?.VITE_SITE_URL?.trim();
  say(
    siteUrl
      ? `адрес сайта: ${siteUrl}`
      : "адрес сайта: https://itagent.ru (VITE_SITE_URL не задавали при сборке)",
  );
}
