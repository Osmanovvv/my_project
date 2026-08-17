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
import { SEO_DEFAULTS, type SeoEntry } from "../data/seo-pages";
import {
  SERVICE_PAGE_SEEDS,
  SUPPORT_PLAN_SEEDS,
  type ServiceFeature,
  type ServicePageContent,
  type ServiceStep,
  type SupportPlan,
} from "../data/service-pages";

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
  /**
   * Мета-теги всех страниц, ключ — путь.
   *
   * Едут в снимке, а не в загрузчике каждой страницы, намеренно: `head()`
   * страницы читает их из данных корня через `matches`, и пятнадцать
   * одинаковых загрузчиков ради этого заводить не нужно. Объём небольшой —
   * заголовок и описание, — а вот содержимое страниц услуг сюда НЕ едет:
   * оно нужно одной странице из семи и грузится отдельно.
   */
  seo: Record<string, SeoEntry>;
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
  eyebrow: string | null;
  hero_title: string | null;
  hero_lead: string | null;
  best_for: string | null;
  features: string | null;
  steps: string | null;
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

/**
 * Список из накладки или список из кода.
 *
 * Битый JSON не роняет страницу, а означает «взять из кода» — то же правило,
 * что и у пустой строки. Проверки json_valid в схеме на этих колонках нет
 * (их добавляли через ALTER TABLE), поэтому разбор здесь и обязан быть
 * защищённым, а не «на всякий случай».
 */
function pickList<T>(
  override: string | null | undefined,
  fallback: T[],
  isValid: (item: unknown) => item is T,
): T[] {
  if (!override) return fallback;
  try {
    const parsed: unknown = JSON.parse(override);
    if (!Array.isArray(parsed)) return fallback;
    const clean = parsed.filter(isValid);
    return clean.length > 0 ? clean : fallback;
  } catch {
    return fallback;
  }
}

const isNonEmptyString = (item: unknown): item is string =>
  typeof item === "string" && item.trim() !== "";

const isFeature = (item: unknown): item is ServiceFeature => {
  const value = item as ServiceFeature | null;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.icon === "string" &&
    typeof value.title === "string" &&
    typeof value.text === "string"
  );
};

const isStep = (item: unknown): item is ServiceStep => {
  const value = item as ServiceStep | null;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.step === "string" &&
    typeof value.title === "string" &&
    typeof value.text === "string"
  );
};

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

  /* Мета-теги. Плейсхолдеры разбираются здесь же: в описании `/packages`
     перечислены цены пакетов, и без подстановки они разъехались бы
     с тарифами при первой правке цен в админке. */
  const seoRows = all<{
    path: string;
    title: string | null;
    description: string | null;
    social_title: string | null;
    social_description: string | null;
  }>("SELECT * FROM seo_override");
  const seoByPath = new Map(seoRows.map((row) => [row.path, row]));

  const seo: Record<string, SeoEntry> = {};
  for (const [path, fallback] of Object.entries(SEO_DEFAULTS)) {
    const patch = seoByPath.get(path);
    seo[path] = {
      title: resolvePlaceholders(pick(patch?.title, fallback.title), packageById, services),
      description: resolvePlaceholders(
        pick(patch?.description, fallback.description),
        packageById,
        services,
      ),
      socialTitle: resolvePlaceholders(
        pick(patch?.social_title, fallback.socialTitle),
        packageById,
        services,
      ),
      socialDescription: resolvePlaceholders(
        pick(patch?.social_description, fallback.socialDescription),
        packageById,
        services,
      ),
    };
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
    seo,
  };
}

// ───────────────────────────────────────────── содержимое страниц услуг ─────

export type ServicePageData = {
  page: ServicePageContent;
  /** Только для `/services/support`; у остальных пустой массив. */
  supportPlans: SupportPlan[];
  /** Мета-теги страницы: `head()` видит только свой загрузчик, не корневой. */
  seo: SeoEntry | null;
  /** Живая услуга — для микроразметки с актуальной ценой. */
  service: Service | null;
};

let pageCache: { version: number; byId: Map<string, ServicePageData> } | null = null;

/**
 * Тексты одной страницы услуги.
 *
 * Отдельно от общего снимка: они нужны ровно одной странице из семи, а снимок
 * едет в разметке КАЖДОЙ страницы сайта. Класть сюда девяносто объектов ради
 * страницы, которую посетитель может и не открыть, — лишний вес на главной,
 * на работах и везде ещё.
 */
export function servicePage(id: string): ServicePageData | null {
  if (!(id in SERVICE_PAGE_SEEDS)) return null;
  seedContentIfNeeded();

  const version = contentVersion();
  if (!pageCache || pageCache.version !== version) {
    pageCache = { version, byId: new Map() };
  }

  const cached = pageCache.byId.get(id);
  if (cached) return cached;

  const seed = SERVICE_PAGE_SEEDS[id as ServiceId];
  const patch = get<ServiceOverrideRow>("SELECT * FROM service_override WHERE id = ?", [id]);
  const snapshot = content();
  const service = snapshot.serviceById[id as ServiceId] ?? null;

  const data: ServicePageData = {
    page: {
      eyebrow: pick(patch?.eyebrow, seed.eyebrow),
      heroTitle: pick(patch?.hero_title, seed.heroTitle),
      heroLead: pick(patch?.hero_lead, seed.heroLead),
      bestFor: pickList(patch?.best_for, seed.bestFor, isNonEmptyString),
      features: pickList(patch?.features, seed.features, isFeature),
      steps: pickList(patch?.steps, seed.steps, isStep),
    },
    supportPlans: id === "support" ? supportPlans() : [],
    seo: service ? (snapshot.seo[service.path] ?? null) : null,
    service,
  };

  pageCache.byId.set(id, data);
  return data;
}

/**
 * Мета-теги одной страницы (и вопросы для страницы вопросов).
 *
 * Нужно потому, что `head()` роута видит только СВОЙ `loaderData`: данных
 * корневого загрузчика там нет — они ещё не готовы к моменту сборки тегов.
 * Значит, страница обязана загрузить их сама, и это самый маленький запрос,
 * каким это можно сделать.
 */
export type PageMeta = {
  seo: SeoEntry | null;
  /** Непусто только для `/faq` — на них строится разметка FAQPage. */
  faq: Array<{ q: string; a: string }>;
};

export function pageMeta(path: string): PageMeta {
  const snapshot = content();
  return {
    seo: snapshot.seo[path] ?? null,
    faq: path === "/faq" ? snapshot.faq.map((item) => ({ q: item.q, a: item.a })) : [],
  };
}

function supportPlans(): SupportPlan[] {
  const rows = all<{
    id: string;
    name: string | null;
    price_value: number | null;
    price_text: string | null;
    features: string | null;
  }>("SELECT * FROM support_plan_override");
  const byId = new Map(rows.map((row) => [row.id, row]));

  return SUPPORT_PLAN_SEEDS.map((seed) => {
    const patch = byId.get(seed.id);
    return {
      ...seed,
      name: pick(patch?.name, seed.name),
      /* Ноль — «цена не числовая»: показывается `priceText`. Поэтому здесь
         не `patch?.price_value ?? seed`, а явная проверка: сохранённый ноль
         должен уметь перебить число из кода. */
      priceValue:
        patch && patch.price_value !== null ? Math.max(0, patch.price_value) : seed.priceValue,
      priceText: patch && patch.price_text !== null ? patch.price_text : seed.priceText,
      features: pickList(patch?.features, seed.features, isNonEmptyString),
    };
  });
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

/**
 * `{{business.price}}` и `{{start.term}}` → значения тарифа,
 * `{{minPrice}}` → самая низкая цена в каталоге разовых услуг.
 *
 * Последнее нужно описанию раздела услуг: там стоит «цены от такой-то суммы»,
 * и без подстановки эта цифра начала бы врать в выдаче в тот же день, когда
 * владелец поднимет цену самой дешёвой услуги.
 *
 * Неизвестный плейсхолдер остаётся в тексте как есть — так опечатка видна
 * сразу, а не превращается в пустое место.
 */
function resolvePlaceholders(
  text: string,
  packages: Record<PackageId, Package>,
  services?: Service[],
): string {
  return text
    .replace(/\{\{minPrice\}\}/g, () => {
      const oneOff = (services ?? []).filter((s) => s.priceUnit === "project");
      if (oneOff.length === 0) return "{{minPrice}}";
      const cheapest = oneOff.reduce((a, b) => (b.priceValue < a.priceValue ? b : a));
      return cheapest.priceFrom;
    })
    .replace(/\{\{(\w+)\.(\w+)\}\}/g, (whole, id: string, field: string) => {
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

/**
 * Тексты страницы услуги. Пишется в ту же накладку, что и цена со сроком —
 * ключ один и тот же, — но отдельным запросом: разделы админки разные,
 * и сохранение одного не должно затирать другой.
 */
export function saveServicePageOverride(
  id: string,
  patch: {
    eyebrow: string;
    heroTitle: string;
    heroLead: string;
    bestFor: string[];
    features: ServiceFeature[];
    steps: ServiceStep[];
  },
): void {
  run(
    `INSERT INTO service_override (id, eyebrow, hero_title, hero_lead, best_for, features, steps, updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       eyebrow = excluded.eyebrow, hero_title = excluded.hero_title,
       hero_lead = excluded.hero_lead, best_for = excluded.best_for,
       features = excluded.features, steps = excluded.steps,
       updated_at = excluded.updated_at`,
    [
      id,
      patch.eyebrow,
      patch.heroTitle,
      patch.heroLead,
      JSON.stringify(patch.bestFor),
      JSON.stringify(patch.features),
      JSON.stringify(patch.steps),
      Date.now(),
    ],
  );
  bumpContentVersion();
}

export function saveSeoOverride(
  path: string,
  patch: { title: string; description: string; socialTitle: string; socialDescription: string },
): void {
  run(
    `INSERT INTO seo_override (path, title, description, social_title, social_description, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(path) DO UPDATE SET
       title = excluded.title, description = excluded.description,
       social_title = excluded.social_title,
       social_description = excluded.social_description,
       updated_at = excluded.updated_at`,
    [path, patch.title, patch.description, patch.socialTitle, patch.socialDescription, Date.now()],
  );
  bumpContentVersion();
}

export function saveSupportPlans(
  plans: Array<{
    id: string;
    name: string;
    priceValue: number;
    priceText: string;
    features: string[];
  }>,
): void {
  transaction(() => {
    const now = Date.now();
    for (const plan of plans) {
      run(
        `INSERT INTO support_plan_override (id, name, price_value, price_text, features, updated_at)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, price_value = excluded.price_value,
           price_text = excluded.price_text, features = excluded.features,
           updated_at = excluded.updated_at`,
        [plan.id, plan.name, plan.priceValue, plan.priceText, JSON.stringify(plan.features), now],
      );
    }
  });
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
