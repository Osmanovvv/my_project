/**
 * Кейсы: чтение для сайта и правка из админки.
 *
 * Публичные страницы дёргают `publishedCases()` на каждый запрос, поэтому
 * результат кешируется по версии контента: пока никто ничего не менял,
 * в базу не ходим. Версия живёт в самой базе, а не в памяти процесса, —
 * значит кеш сбросится и после перезапуска, и если процессов вдруг станет
 * несколько.
 */

import { all, get, run, transaction, contentVersion, bumpContentVersion } from "./db.server";
import { LEGACY_CASES, type CaseStudy, type CaseTag } from "../data/cases";
import { isGradientKey, isPattern } from "../data/case-presets";
import { purgeUnusedMedia } from "./media.server";
import type { ServiceId } from "../data/services";

type CaseRow = {
  slug: string;
  title: string;
  client: string;
  industry: string;
  result: string;
  summary: string;
  timeline: string;
  gradient: string;
  pattern: string;
  cover_id: number | null;
  tags: string;
  challenge: string;
  solution: string;
  delivered: string;
  stack: string;
  services: string;
  published: number;
  position: number;
  created_at: number;
  updated_at: number;
  /* Поля обложки приходят соединением с таблицей картинок. */
  cover_hash: string | null;
  cover_ext: string | null;
  cover_width: number | null;
  cover_height: number | null;
};

/** Разбор JSON-списка из базы. Битое значение не должно ронять страницу. */
function parseList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function toCase(row: CaseRow): CaseStudy {
  return {
    slug: row.slug,
    title: row.title,
    client: row.client,
    industry: row.industry,
    result: row.result,
    summary: row.summary,
    timeline: row.timeline,
    /* Значения из базы проверяются: в админке выбор из списка, но база
       переживает и ручную правку, и откат миграции. Неизвестный ключ
       заменяется на рабочий, а не роняет сетку кейсов. */
    gradient: isGradientKey(row.gradient) ? row.gradient : "indigo",
    pattern: isPattern(row.pattern) ? row.pattern : "grid",
    /* Обложка собирается только если картинка на месте: запись могли
       удалить, и тогда кейс должен нарисоваться заглушкой, а не битым
       изображением. */
    cover:
      row.cover_id && row.cover_hash && row.cover_ext && row.cover_width && row.cover_height
        ? {
            id: row.cover_id,
            url: `/media/${row.cover_hash}.${row.cover_ext}`,
            width: row.cover_width,
            height: row.cover_height,
          }
        : null,
    tags: parseList(row.tags) as CaseTag[],
    challenge: parseList(row.challenge),
    solution: parseList(row.solution),
    delivered: parseList(row.delivered),
    stack: parseList(row.stack),
    services: parseList(row.services) as ServiceId[],
    published: row.published === 1,
    position: row.position,
  };
}

/**
 * Кейс вместе с обложкой. LEFT JOIN, а не INNER: у большинства кейсов
 * снимка нет, и они должны читаться так же, как с ним.
 */
const SELECT = `
  SELECT c.*,
         m.hash   AS cover_hash,
         m.ext    AS cover_ext,
         m.width  AS cover_width,
         m.height AS cover_height
  FROM case_study c
  LEFT JOIN media m ON m.id = c.cover_id`;

// ──────────────────────────────────────────────── первичное заполнение ──────

/**
 * Переносит кейсы из кода в базу — один раз, пока таблица пуста.
 *
 * Нужно ровно для одного: чтобы сайт после переезда на базу выглядел так же,
 * как выглядел из файла. Дальше владелец правит кейсы из админки, а массив
 * в `data/cases.ts` больше не участвует.
 *
 * Повторно не срабатывает: если владелец удалит все кейсы намеренно, они
 * не должны воскреснуть при следующем перезапуске сервера. Отметка о том,
 * что заполнение уже было, хранится отдельно от количества записей.
 */
export function seedCasesIfNeeded(): void {
  const done = get<{ value: string }>("SELECT value FROM meta WHERE key = 'cases_seeded'");
  if (done?.value === "1") return;

  transaction(() => {
    const existing = get<{ n: number }>("SELECT COUNT(*) AS n FROM case_study");
    if (Number(existing?.n ?? 0) === 0) {
      for (const item of LEGACY_CASES) insertCase(item);
    }
    run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cases_seeded', '1')");
  });
  bumpContentVersion();
}

function insertCase(item: CaseStudy): void {
  const now = Date.now();
  run(
    `INSERT INTO case_study
       (slug, title, client, industry, result, summary, timeline, gradient, pattern,
        cover_id, tags, challenge, solution, delivered, stack, services, published,
        position, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      item.slug,
      item.title,
      item.client,
      item.industry,
      item.result,
      item.summary,
      item.timeline,
      item.gradient,
      item.pattern,
      item.cover?.id ?? null,
      JSON.stringify(item.tags),
      JSON.stringify(item.challenge),
      JSON.stringify(item.solution),
      JSON.stringify(item.delivered),
      JSON.stringify(item.stack),
      JSON.stringify(item.services),
      item.published ? 1 : 0,
      item.position,
      now,
      now,
    ],
  );
}

// ─────────────────────────────────────────────────────────── чтение ─────────

let cache: { version: number; cases: CaseStudy[] } | null = null;

/** Опубликованные кейсы в порядке сетки. Кешируется до следующей правки. */
export function publishedCases(): CaseStudy[] {
  seedCasesIfNeeded();

  const version = contentVersion();
  if (cache && cache.version === version) return cache.cases;

  const rows = all<CaseRow>(
    `${SELECT} WHERE c.published = 1 ORDER BY c.position ASC, c.created_at ASC`,
  );
  const cases = rows.map(toCase);
  cache = { version, cases };
  return cases;
}

/** Все кейсы, включая черновики. Только для админки. */
export function allCases(): CaseStudy[] {
  seedCasesIfNeeded();
  return all<CaseRow>(`${SELECT} ORDER BY c.position ASC, c.created_at ASC`).map(toCase);
}

/** Кейс по адресу. `includeDrafts` — для предпросмотра из админки. */
export function caseBySlug(slug: string, includeDrafts = false): CaseStudy | undefined {
  seedCasesIfNeeded();
  const row = get<CaseRow>(
    includeDrafts ? `${SELECT} WHERE c.slug = ?` : `${SELECT} WHERE c.slug = ? AND c.published = 1`,
    [slug],
  );
  return row ? toCase(row) : undefined;
}

// ─────────────────────────────────────────────────────────── запись ─────────

export type CaseInput = Omit<CaseStudy, "position"> & { position?: number };

/** Адрес страницы из названия: «Магазин керамики» → `magazin-keramiki`. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return input
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Свободный адрес: к занятому добавляется номер. */
export function uniqueSlug(base: string, exceptSlug?: string): string {
  const clean = slugify(base) || "case";
  for (let i = 0; i < 200; i++) {
    const candidate = i === 0 ? clean : `${clean}-${i + 1}`;
    const row = get<{ slug: string }>("SELECT slug FROM case_study WHERE slug = ?", [candidate]);
    if (!row || row.slug === exceptSlug) return candidate;
  }
  return `${clean}-${Date.now()}`;
}

export function createCase(input: CaseInput): string {
  const slug = uniqueSlug(input.slug || input.title);
  const last = get<{ p: number }>("SELECT MAX(position) AS p FROM case_study");
  insertCase({ ...input, slug, position: Number(last?.p ?? -1) + 1 });
  bumpContentVersion();
  return slug;
}

export function updateCase(slug: string, input: CaseInput): void {
  run(
    `UPDATE case_study SET
       title = ?, client = ?, industry = ?, result = ?, summary = ?, timeline = ?,
       gradient = ?, pattern = ?, cover_id = ?, tags = ?, challenge = ?,
       solution = ?, delivered = ?, stack = ?, services = ?, published = ?,
       updated_at = ?
     WHERE slug = ?`,
    [
      input.title,
      input.client,
      input.industry,
      input.result,
      input.summary,
      input.timeline,
      input.gradient,
      input.pattern,
      input.cover?.id ?? null,
      JSON.stringify(input.tags),
      JSON.stringify(input.challenge),
      JSON.stringify(input.solution),
      JSON.stringify(input.delivered),
      JSON.stringify(input.stack),
      JSON.stringify(input.services),
      input.published ? 1 : 0,
      Date.now(),
      slug,
    ],
  );
  bumpContentVersion();
}

export function deleteCase(slug: string): void {
  run("DELETE FROM case_study WHERE slug = ?", [slug]);
  /* Снимок удалённого кейса больше не нужен. Не подобрать его сейчас —
     значит копить в каталоге файлы, про которые через год никто
     не вспомнит, используются они или нет. */
  purgeUnusedMedia();
  bumpContentVersion();
}

export function setPublished(slug: string, published: boolean): void {
  run("UPDATE case_study SET published = ?, updated_at = ? WHERE slug = ?", [
    published ? 1 : 0,
    Date.now(),
    slug,
  ]);
  bumpContentVersion();
}

/** Переставить кейсы: массив адресов в нужном порядке. */
export function reorderCases(slugs: string[]): void {
  transaction(() => {
    slugs.forEach((slug, index) => {
      run("UPDATE case_study SET position = ? WHERE slug = ?", [index, slug]);
    });
  });
  bumpContentVersion();
}
