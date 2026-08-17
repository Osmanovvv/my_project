/**
 * Источник заявки: UTM-метки и внешний реферер.
 *
 * Считываются один раз при первом заходе и живут в sessionStorage — иначе
 * при переходе на `/contacts` метки из URL уже потеряны и в Telegram
 * приходит заявка «ниоткуда».
 */

const STORAGE_KEY = "it-agent:attribution";
const MAX_LENGTH = 500;

const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "yclid",
];

function collect(): string {
  const params = new URLSearchParams(window.location.search);
  const parts: string[] = [];

  for (const name of TRACKED_PARAMS) {
    const value = params.get(name);
    if (value) parts.push(`${name}=${value}`);
  }

  const referrer = document.referrer;
  if (referrer && !referrer.startsWith(window.location.origin)) {
    parts.push(`referrer=${referrer}`);
  }

  return parts.join(" · ").slice(0, MAX_LENGTH);
}

/** Возвращает строку меток или пустую строку. Безопасно вызывать при SSR. */
export function readAttribution(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored;

    const collected = collect();
    window.sessionStorage.setItem(STORAGE_KEY, collected);
    return collected;
  } catch {
    // Приватный режим или запрет storage — метки не критичны, заявка важнее.
    try {
      return collect();
    } catch {
      return "";
    }
  }
}
