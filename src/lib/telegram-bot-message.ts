import { z } from "zod";

const button = z.union([
  z
    .object({
      text: z.string().min(1).max(100),
      callback_data: z
        .string()
        .min(1)
        .refine((value) => Buffer.byteLength(value) <= 64),
    })
    .strict(),
  z
    .object({ text: z.string().min(1).max(100), url: z.string().url().startsWith("https://") })
    .strict(),
  z
    .object({
      text: z.string().min(1).max(100),
      web_app: z.object({ url: z.string().url().startsWith("https://") }).strict(),
    })
    .strict(),
]);

/** Payload очереди разрешает только sendMessage и ограниченную inline-клавиатуру. */
export const telegramBotReplySchema = z.object({
  text: z
    .string()
    .min(1)
    .max(4096)
    .refine((value) => value.trim().length > 0),
  replyMarkup: z
    .object({ inline_keyboard: z.array(z.array(button).min(1).max(8)).max(20) })
    .optional(),
});

export type TelegramBotReply = z.infer<typeof telegramBotReplySchema>;
export type TelegramInlineButton = z.infer<typeof button>;
