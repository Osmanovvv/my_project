/** Разбор недоверенного Telegram JSON. Здесь нет SQL, сети или побочных действий. */
import { z } from "zod";

export const TELEGRAM_ALLOWED_UPDATES = ["message", "callback_query"] as const;
const telegramId = z.number().int().positive().safe();
const user = z.object({
  id: telegramId,
  is_bot: z.literal(false),
  first_name: z.string().max(500),
  last_name: z.string().max(500).optional(),
  username: z.string().max(255).optional(),
});
const privateChat = z.object({ id: telegramId, type: z.literal("private") });
const file = z.object({
  file_id: z.string().min(1).max(255),
  file_unique_id: z.string().min(1).max(255),
  file_size: z.number().int().nonnegative().safe().optional(),
});
const photo = file.extend({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const document = file.extend({
  mime_type: z.string().max(255).optional(),
  file_name: z.string().max(500).optional(),
});
const voice = file.extend({
  duration: z.number().int().nonnegative(),
  mime_type: z.string().max(255).optional(),
});
const message = z.object({
  message_id: z.number().int().positive().safe(),
  date: z.number().int().nonnegative().safe(),
  from: user,
  chat: privateChat,
  text: z.string().max(100_000).optional(),
  caption: z.string().max(100_000).optional(),
  photo: z.array(photo).min(1).max(20).optional(),
  document: document.optional(),
  voice: voice.optional(),
  media_group_id: z.string().max(100).optional(),
});
const callback = z.object({
  id: z.string().min(1).max(255),
  from: user,
  message: z.object({
    message_id: z.number().int().positive().safe(),
    chat: privateChat,
  }),
  data: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value) <= 64),
});

export type TelegramInbound = {
  updateId: number;
  userId: string;
  chatId: string;
  kind: "text" | "photo" | "file" | "voice" | "callback";
  messageId: number;
  displayName: string;
  username: string;
  text: string;
  sentAt?: number;
  media?: {
    fileId: string;
    uniqueId: string;
    bytes?: number;
    mime?: string;
    name?: string;
    width?: number;
    height?: number;
    duration?: number;
    groupId?: string;
  };
  callbackQueryId?: string;
  callbackData?: string;
};

export type TelegramParseResult =
  | { ok: true; inbound: TelegramInbound }
  | { ok: false; error: "bad_update"; status: 400 }
  | { ok: false; ignored: string };

export function parseTelegramInbound(payload: Record<string, unknown>): TelegramParseResult {
  const updateId = payload.update_id;
  if (typeof updateId !== "number" || !Number.isSafeInteger(updateId) || updateId < 0) {
    return { ok: false, error: "bad_update", status: 400 };
  }
  // Telegram передаёт ровно один вид update. Смешанные envelopes отклоняем.
  const fields = Object.keys(payload).filter((key) => key !== "update_id");
  const known = fields.filter((key) => TELEGRAM_ALLOWED_UPDATES.includes(key as "message"));
  if (known.length === 0) return { ok: false, ignored: "unsupported_update" };
  if (
    known.length !== 1 ||
    fields.some((key) => !TELEGRAM_ALLOWED_UPDATES.includes(key as "message"))
  ) {
    return { ok: false, error: "bad_update", status: 400 };
  }
  const source = payload[known[0]];
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ok: false, error: "bad_update", status: 400 };
  }
  const sourceChat =
    known[0] === "callback_query"
      ? (source as { message?: { chat?: unknown } }).message?.chat
      : (source as { chat?: unknown }).chat;
  if (
    sourceChat &&
    typeof sourceChat === "object" &&
    (sourceChat as { type?: unknown }).type !== "private"
  ) {
    return { ok: false, ignored: "private_chat_required" };
  }
  if (known[0] === "callback_query") {
    const parsed = callback.safeParse(source);
    if (!parsed.success) return { ok: false, error: "bad_update", status: 400 };
    const value = parsed.data;
    if (value.from.id !== value.message.chat.id)
      return { ok: false, ignored: "private_chat_mismatch" };
    return {
      ok: true,
      inbound: {
        updateId,
        userId: String(value.from.id),
        chatId: String(value.message.chat.id),
        messageId: value.message.message_id,
        kind: "callback",
        displayName: [value.from.first_name, value.from.last_name].filter(Boolean).join(" "),
        username: value.from.username ?? "",
        text: "",
        callbackQueryId: value.id,
        callbackData: value.data,
      },
    };
  }
  const parsed = message.safeParse(source);
  if (!parsed.success) return { ok: false, error: "bad_update", status: 400 };
  const value = parsed.data;
  if (value.from.id !== value.chat.id) return { ok: false, ignored: "private_chat_mismatch" };
  const kinds = [
    value.text != null,
    value.photo != null,
    value.document != null,
    value.voice != null,
  ].filter(Boolean);
  if (kinds.length === 0) return { ok: false, ignored: "unsupported_message" };
  if (kinds.length !== 1) return { ok: false, error: "bad_update", status: 400 };
  const base: TelegramInbound = {
    updateId,
    userId: String(value.from.id),
    chatId: String(value.chat.id),
    messageId: value.message_id,
    kind: "text",
    displayName: [value.from.first_name, value.from.last_name].filter(Boolean).join(" "),
    username: value.from.username ?? "",
    text: value.text ?? value.caption ?? "",
    sentAt: value.date * 1000,
  };
  if (value.photo) {
    // Берём наибольший размер независимо от порядка Telegram PhotoSize.
    const largest = value.photo.reduce((best, next) =>
      next.width * next.height > best.width * best.height ? next : best,
    );
    return {
      ok: true,
      inbound: {
        ...base,
        kind: "photo",
        media: {
          fileId: largest.file_id,
          uniqueId: largest.file_unique_id,
          bytes: largest.file_size,
          width: largest.width,
          height: largest.height,
          mime: "image/jpeg",
          groupId: value.media_group_id,
        },
      },
    };
  }
  if (value.document) {
    const item = value.document;
    return {
      ok: true,
      inbound: {
        ...base,
        kind: "file",
        media: {
          fileId: item.file_id,
          uniqueId: item.file_unique_id,
          bytes: item.file_size,
          mime: item.mime_type,
          name: item.file_name,
        },
      },
    };
  }
  if (value.voice) {
    const item = value.voice;
    return {
      ok: true,
      inbound: {
        ...base,
        kind: "voice",
        media: {
          fileId: item.file_id,
          uniqueId: item.file_unique_id,
          bytes: item.file_size,
          mime: item.mime_type,
          duration: item.duration,
        },
      },
    };
  }
  return { ok: true, inbound: base };
}
