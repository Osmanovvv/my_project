/**
 * Хранилище картинок: файлы на диске, описание в базе.
 *
 * Почему файлы не в `public/`: этот каталог пересобирается при каждой сборке
 * и целиком раздаётся статикой. Загруженное туда исчезло бы при первом же
 * деплое. Файлы лежат в `DATA_DIR/media` — рядом с базой, вне дерева проекта.
 *
 * Имя файла — хеш содержимого. Отсюда два следствия:
 *   1. Повторная загрузка того же снимка не плодит копии.
 *   2. Адрес можно кешировать навсегда: изменилось содержимое — изменился
 *      адрес. Раздача ставит `immutable`, и браузер больше не переспрашивает.
 *
 * Размеры (ширина/высота) читаются из ЗАГОЛОВКА файла, а не берутся из формы.
 * Причина не в недоверии, а в вёрстке: без явных размеров у `<img>` страница
 * дёргается при загрузке, и Lighthouse справедливо снижает оценку. Значение,
 * присланное клиентом, может разойтись с настоящим — тогда дёрганье вернётся.
 */

import { createHash } from "node:crypto";
import { writeFileSync, existsSync, readFileSync, unlinkSync, renameSync } from "node:fs";
import { join } from "node:path";

import { all, get, run, bumpContentVersion, MEDIA_DIR } from "./db.server";

export type MediaKind = "webp" | "jpg" | "png";

export type MediaRecord = {
  id: number;
  hash: string;
  ext: MediaKind;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  alt: string;
  source_name: string;
  created_at: number;
};

const MIME: Record<MediaKind, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

/** Максимум на файл. Клиент ужимает снимок до загрузки, так что это потолок. */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

// ────────────────────────────────────── определение формата и размеров ──────

type Probe = { ext: MediaKind; width: number; height: number } | null;

function readPng(bytes: Uint8Array): Probe {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  if (!signature.every((byte, i) => bytes[i] === byte)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  /* IHDR идёт первым чанком: 8 байт подписи + 4 длина + 4 тип, дальше размеры. */
  return { ext: "png", width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpeg(bytes: Uint8Array): Probe {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];

    /* SOF0…SOF15 несут размеры. Исключены DHT (c4), JPG (c8) и DAC (cc) —
       они лежат в том же диапазоне, но размеров не содержат. */
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        ext: "jpg",
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }

    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function readWebp(bytes: Uint8Array): Probe {
  if (bytes.length < 30) return null;
  const tag = (at: number) =>
    String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunk = tag(12);

  /* Три формата внутри одного контейнера, размеры лежат по-разному. */
  if (chunk === "VP8 ") {
    return {
      ext: "webp",
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const packed = view.getUint32(21, true);
    return { ext: "webp", width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { ext: "webp", width, height };
  }
  return null;
}

/**
 * Формат и размеры по содержимому файла.
 *
 * Именно по содержимому, а не по расширению или заголовку `Content-Type`:
 * и то и другое присылает клиент, и переименованный `.exe` прошёл бы
 * проверку. Не распознали заголовок — файл не принимаем.
 */
export function probeImage(bytes: Uint8Array): Probe {
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
}

// ───────────────────────────────────────────────────────── запись и чтение ──

export type SaveResult =
  | { ok: true; media: MediaRecord }
  | { ok: false; reason: "too_large" | "bad_format" | "bad_size" };

export function saveImage(bytes: Uint8Array, sourceName = "", alt = ""): SaveResult {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const probe = probeImage(bytes);
  if (!probe) return { ok: false, reason: "bad_format" };
  if (probe.width < 8 || probe.height < 8 || probe.width > 12000 || probe.height > 12000) {
    return { ok: false, reason: "bad_size" };
  }

  /* 128 бит хеша: коллизия невозможна на практике, а имя файла короче. */
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);

  const existing = get<MediaRecord>("SELECT * FROM media WHERE hash = ? AND ext = ?", [
    hash,
    probe.ext,
  ]);
  if (existing) return { ok: true, media: existing };

  const fileName = `${hash}.${probe.ext}`;
  const target = join(MEDIA_DIR, fileName);

  if (!existsSync(target)) {
    /* Пишем во временный файл и переименовываем: если процесс упадёт
       посередине, на диске не останется обрезанной картинки, на которую
       уже ссылается база. */
    const temp = `${target}.${process.pid}.tmp`;
    writeFileSync(temp, bytes);
    renameSync(temp, target);
  }

  const now = Date.now();
  const { lastId } = run(
    `INSERT INTO media (hash, ext, mime, width, height, bytes, alt, source_name, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      hash,
      probe.ext,
      MIME[probe.ext],
      probe.width,
      probe.height,
      bytes.byteLength,
      alt.slice(0, 300),
      sourceName.slice(0, 200),
      now,
    ],
  );
  bumpContentVersion();

  return {
    ok: true,
    media: {
      id: lastId,
      hash,
      ext: probe.ext,
      mime: MIME[probe.ext],
      width: probe.width,
      height: probe.height,
      bytes: bytes.byteLength,
      alt,
      source_name: sourceName,
      created_at: now,
    },
  };
}

export function mediaById(id: number): MediaRecord | undefined {
  return get<MediaRecord>("SELECT * FROM media WHERE id = ?", [id]);
}

export function setMediaAlt(id: number, alt: string): void {
  run("UPDATE media SET alt = ? WHERE id = ?", [alt.slice(0, 300), id]);
  bumpContentVersion();
}

/** Публичный адрес картинки. Содержит хеш, поэтому кешируется навсегда. */
export function mediaUrl(media: Pick<MediaRecord, "hash" | "ext">): string {
  return `/media/${media.hash}.${media.ext}`;
}

/** Имя файла → путь на диске. Возвращает null, если имя не наше. */
export function mediaPath(fileName: string): string | null {
  /* Единственная защита от выхода из каталога: имя должно быть ровно
     хешем и расширением. Никаких `..`, слэшей и юникода сюда не пролезет. */
  if (!/^[a-f0-9]{32}\.(webp|jpg|png)$/.test(fileName)) return null;
  return join(MEDIA_DIR, fileName);
}

export function readMediaFile(fileName: string): Buffer | null {
  const path = mediaPath(fileName);
  if (!path || !existsSync(path)) return null;
  return readFileSync(path);
}

/**
 * Удаляет картинки, на которые никто не ссылается.
 *
 * Вызывается после удаления кейса: снимки сами по себе не нужны, а держать
 * их вечно — это раздутый каталог, который однажды придётся разбирать
 * вручную, гадая, что ещё используется.
 */
export function purgeUnusedMedia(): number {
  const orphans = all<{ id: number; hash: string; ext: string }>(
    `SELECT id, hash, ext FROM media
     WHERE id NOT IN (SELECT cover_id FROM case_study WHERE cover_id IS NOT NULL)`,
  );

  for (const item of orphans) {
    const path = mediaPath(`${item.hash}.${item.ext}`);
    try {
      if (path && existsSync(path)) unlinkSync(path);
    } catch {
      /* Файл мог быть удалён вручную — запись из базы всё равно убираем. */
    }
    run("DELETE FROM media WHERE id = ?", [item.id]);
  }

  if (orphans.length) bumpContentVersion();
  return orphans.length;
}
