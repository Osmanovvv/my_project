/**
 * Контент сайта: услуги, пакеты, вопросы, цифры, контакты, тексты.
 *
 * Устройство — накладка поверх кода. В `src/data/*` лежит скелет: какие
 * бывают услуги, как считается цена, какие есть тексты по умолчанию.
 * В базе — только то, что владелец действительно поменял.
 *
 * Из этого следует главное свойство: пустая, потерянная или откатившаяся
 * база НЕ роняет сайт. Он отрисуется значениями из кода — ровно так, как
 * выглядел до появления админки. Ошибиться в админке и сломать вёрстку тоже
 * нельзя: типы и структура заданы кодом, из базы приходят только значения.
 *
 * Всё читается одним снимком и кешируется по версии контента: страница
 * не должна делать десяток запросов к базе на каждый заход.
 */

import { all, get, run, transaction, contentVersion, bumpContentVersion } from "./db.server";
import {
  SERVICE_SEEDS,
  PACKAGE_SEEDS,
  formatPrice,
  type Service,
  type Package,
  type ServiceId,
  type PackageId,
} from "../data/services";
import { FAQ_SEEDS, type FaqItem } from "../data/faq";
import { TEXT_DEFAULTS, type TextKey } from "../data/texts";
import { METRIC_SEEDS, type MetricTile } from "../data/metrics";
import { CONTACT_SEEDS, type ContactChannel } from "../data/contacts";

// ───────────────────────────────────────────────────────────── снимок ───────

export type ContentSnapshot = {
  services: Service[];
  serviceById: Record<ServiceId, Service>;
  packages: Package[];
  packageById: Record<PackageId, Package>;
  faq: FaqItem[];
  metrics: { home: MetricTile[]; works: MetricTile[] };
  contacts: ContactChannel[];
  texts: Record<TextKey, string>;
};

let cache: { version: number; snapshot: ContentSnapshot } | null = null;

export function content(): ContentSnapshot {
  seedContentIfNeeded();

  const version = contentVersion();
  if (cache && cache.version === version) return cache.snapshot;

  const snapshot = buildSnapshot();
  cache = { version, snapshot };
  return snapshot;
}

// ────────────────────────────────────────────────────── первичный посев ─────

/**
 * Переносит вопросы, плитки и контакты из кода в базу — один раз.
 *
 * Услуги и пакеты НЕ переносятся: у них накладка, и отсутствие строки
 * означает «взять из кода». А вопросы и плитки владелец правит и удаляет,
 * поэтому им нужна собственная запись.
 */
function seedContentIfNeeded(): void {
  const done = get<{ value: string }>("SELECT value FROM meta WHERE key = 'content_seeded'");
  if (done?.value === "1") return;

  const now = Date.now();
  transaction(() => {
    if (Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM faq_item")?.n ?? 0) === 0) {
      FAQ_SEEDS.forEach((item, index) => {
        run(
          "INSERT INTO faq_item (question, answer, preview, position, updated_at) VALUES (?,?,?,?,?)",
          [item.q, item.a, item.preview ? 1 : 0, index, now],
        );
      });
    }

    if (Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM metric_tile")?.n ?? 0) === 0) {
      for (const tile of METRIC_SEEDS) {
        run(
          "INSERT INTO metric_tile (id, area, value, label, position, updated_at) VALUES (?,?,?,?,?,?)",
          [tile.id, tile.area, tile.value, tile.label, tile.position, now],
        );
      }
    }

    if (Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM contact_channel")?.n ?? 0) === 0) {
      CONTACT_SEEDS.forEach((channel, index) => {
        run("INSERT INTO contact_channel (id, value, position, updated_at) VALUES (?,?,?,?)", [
          channel.id,
          channel.value,
          index,
          now,
        ]);
      });
    }

    run("INSERT OR REPLACE INTO meta (key, value) VALUES ('content_seeded', '1')");
  });
  bumpContentVersion();
}

// ────────────────────────────────────────────────────────── сборка ──────────

type ServiceOverrideRow = {
  id: string;
  price_value: number | null;
  timeline: string | null;
  short: string | null;
  description: string | null;
};

type PackageOverrideRow = {
  id: string;
  price_value: number | null;
  who: string | null;
  term: string | null;
  result: string | null;
  not_for: string | null;
  points: string | null;
};

/** Непустое значение накладки или значение из кода. */
function pick(override: string | null | undefined, fallback: string): string {
  const value = (override ?? "").trim();
  return value === "" ? fallback : value;
}

function buildSnapshot(): ContentSnapshot {
  const serviceRows = all<ServiceOverrideRow>("SELECT * FROM service_override");
  const overridesByService = new Map(serviceRows.map((row) => [row.id, row]));

  const services: Service[] = SERVICE_SEEDS.map((seed) => {
    const patch = overridesByService.get(seed.id);
    const priceValue =
      patch?.price_value && patch.price_value > 0 ? patch.price_value : seed.priceValue;
    return {
      ...seed,
      priceValue,
      priceFrom: formatPrice(priceValue, seed.priceUnit),
      timeline: pick(patch?.timeline, seed.timeline),
      short: pick(patch?.short, seed.short),
      description: pick(patch?.description, seed.description),
    };
  });

  const packageRows = all<PackageOverrideRow>("SELECT * FROM package_override");
  const overridesByPackage = new Map(packageRows.map((row) => [row.id, row]));

  const packages: Package[] = PACKAGE_SEEDS.map((seed) => {
    const patch = overridesByPackage.get(seed.id);
    const priceValue =
      patch?.price_value && patch.price_value > 0 ? patch.price_value : seed.priceValue;
    let points = seed.points;
    if (patch?.points) {
      try {
        const parsed = JSON.parse(patch.points);
        if (Array.isArray(parsed) && parsed.length > 0) {
          points = parsed.filter((x) => typeof x === "string" && x.trim() !== "");
        }
      } catch {
        /* Битый JSON — остаётся список из кода. */
      }
    }
    return {
      ...seed,
      priceValue,
      priceFrom: formatPrice(priceValue),
      who: pick(patch?.who, seed.who),
      term: pick(patch?.term, seed.term),
      result: pick(patch?.result, seed.result),
      notFor: pick(patch?.not_for, seed.notFor),
      points,
    };
  });

  const packageById = Object.fromEntries(packages.map((p) => [p.id, p])) as Record<
    PackageId,
    Package
  >;

  /* Ответы на вопросы могут ссылаться на цены и сроки пакетов. Раньше это
     были шаблонные строки прямо в коде; теперь текст лежит в базе, поэтому
     подстановка идёт через плейсхолдеры вида {{business.price}}. Так цена
     в ответе не разъезжается с ценой в тарифе. */
  const faqRows = all<{ id: number; question: string; answer: string; preview: number }>(
    "SELECT id, question, answer, preview FROM faq_item ORDER BY position ASC, id ASC",
  );
  const faq: FaqItem[] = faqRows.map((row) => ({
    id: row.id,
    q: row.question,
    a: resolvePlaceholders(row.answer, packageById),
    preview: row.preview === 1,
  }));

  const metricRows = all<{
    id: string;
    area: string;
    value: string;
    label: string;
    position: number;
  }>("SELECT id, area, value, label, position FROM metric_tile ORDER BY position ASC");
  const metrics = {
    home: metricRows.filter((r) => r.area === "home").map(toTile),
    works: metricRows.filter((r) => r.area === "works").map(toTile),
  };

  const contactRows = all<{ id: string; value: string; position: number }>(
    "SELECT id, value, position FROM contact_channel ORDER BY position ASC",
  );
  /* Пустое значение = канала нет: он не показывается ни на странице
     контактов, ни в подвале, ни в микроразметке. Правило то же, что было
     в коде до переезда. */
  const contacts: ContactChannel[] = contactRows
    .filter((row) => row.value.trim() !== "")
    .map((row) => {
      const seed = CONTACT_SEEDS.find((s) => s.id === row.id);
      return {
        id: row.id as ContactChannel["id"],
        label: seed?.label ?? row.id,
        value: row.value.trim(),
        href: hrefFor(row.id, row.value.trim()),
      };
    });

  const textRows = all<{ key: string; value: string }>("SELECT key, value FROM text_override");
  const texts = { ...TEXT_DEFAULTS } as Record<TextKey, string>;
  for (const row of textRows) {
    if (row.key in texts && row.value.trim() !== "") {
      texts[row.key as TextKey] = row.value;
    }
  }

  return {
    services,
    serviceById: Object.fromEntries(services.map((s) => [s.id, s])) as Record<ServiceId, Service>,
    packages,
    packageById,
    faq,
    metrics,
    contacts,
    texts,
  };
}

function toTile(row: {
  id: string;
  area: string;
  value: string;
  label: string;
  position: number;
}): MetricTile {
  return {
    id: row.id,
    area: row.area as MetricTile["area"],
    value: row.value,
    label: row.label,
    position: row.position,
  };
}

/** `{{business.price}}` и `{{start.term}}` → значения тарифа. */
function resolvePlaceholders(text: string, packages: Record<PackageId, Package>): string {
  return text.replace(/\{\{(\w+)\.(\w+)\}\}/g, (whole, id: string, field: string) => {
    const pkg = packages[id as PackageId];
    if (!pkg) return whole;
    if (field === "price") return pkg.priceFrom;
    if (field === "term") return pkg.term;
    return whole;
  });
}

function hrefFor(id: string, value: string): string {
  if (id === "telegram") return `https://t.me/${value.replace(/^@/, "")}`;
  if (id === "phone") return `tel:+${value.replace(/\D/g, "")}`;
  if (id === "email") return `mailto:${value}`;
  return value;
}

// ────────────────────────────────────────────────────────── запись ──────────

export function saveServiceOverride(
  id: string,
  patch: { priceValue: number; timeline: string; short: string; description: string },
): void {
  run(
    `INSERT INTO service_override (id, price_value, timeline, short, description, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       price_value = excluded.price_value, timeline = excluded.timeline,
       short = excluded.short, description = excluded.description,
       updated_at = excluded.updated_at`,
    [id, patch.priceValue || null, patch.timeline, patch.short, patch.description, Date.now()],
  );
  bumpContentVersion();
}

export function savePackageOverride(
  id: string,
  patch: {
    priceValue: number;
    who: string;
    term: string;
    result: string;
    notFor: string;
    points: string[];
  },
): void {
  run(
    `INSERT INTO package_override (id, price_value, who, term, result, not_for, points, updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       price_value = excluded.price_value, who = excluded.who, term = excluded.term,
       result = excluded.result, not_for = excluded.not_for, points = excluded.points,
       updated_at = excluded.updated_at`,
    [
      id,
      patch.priceValue || null,
      patch.who,
      patch.term,
      patch.result,
      patch.notFor,
      JSON.stringify(patch.points),
      Date.now(),
    ],
  );
  bumpContentVersion();
}

export function saveFaqItems(items: Array<{ q: string; a: string; preview: boolean }>): void {
  transaction(() => {
    run("DELETE FROM faq_item");
    const now = Date.now();
    items.forEach((item, index) => {
      run(
        "INSERT INTO faq_item (question, answer, preview, position, updated_at) VALUES (?,?,?,?,?)",
        [item.q, item.a, item.preview ? 1 : 0, index, now],
      );
    });
  });
  bumpContentVersion();
}

export function saveMetricTiles(tiles: Array<{ id: string; value: string; label: string }>): void {
  transaction(() => {
    for (const tile of tiles) {
      /* Плитки не создаются и не удаляются — только правятся: вёрстка
         рассчитана на фиксированное количество. */
      run("UPDATE metric_tile SET value = ?, label = ?, updated_at = ? WHERE id = ?", [
        tile.value,
        tile.label,
        Date.now(),
        tile.id,
      ]);
    }
  });
  bumpContentVersion();
}

export function saveContacts(channels: Array<{ id: string; value: string }>): void {
  transaction(() => {
    for (const channel of channels) {
      run("UPDATE contact_channel SET value = ?, updated_at = ? WHERE id = ?", [
        channel.value,
        Date.now(),
        channel.id,
      ]);
    }
  });
  bumpContentVersion();
}

export function saveTexts(entries: Array<{ key: string; value: string }>): void {
  transaction(() => {
    const now = Date.now();
    for (const entry of entries) {
      if (!(entry.key in TEXT_DEFAULTS)) continue;

      /* Пустое значение или совпадение со значением по умолчанию — это
         «вернуть как было»: строку из базы убираем, и текст снова берётся
         из кода. Хранить копию значения по умолчанию незачем. */
      const value = entry.value.trim();
      const isDefault = value === TEXT_DEFAULTS[entry.key as TextKey];
      if (value === "" || isDefault) {
        run("DELETE FROM text_override WHERE key = ?", [entry.key]);
        continue;
      }

      run(
        `INSERT INTO text_override (key, value, updated_at) VALUES (?,?,?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [entry.key, value, now],
      );
    }
  });
  bumpContentVersion();
}
