import assert from "node:assert/strict";
import { test } from "node:test";

import { LEAD_LIMITS, LEAD_SOURCES, normalizeLead, resolveLeadSource, validateLead } from "../src/lib/lead";
import { parseTelegramInbound } from "../src/server/telegram-inbound.server";
import { TELEGRAM_MEDIA_LIMITS, validateTelegramMedia } from "../src/server/telegram-media.server";
import { telegramBotReplySchema } from "../src/lib/telegram-bot-message";
import { CLIENT_A, messageUpdate } from "./helpers/telegram";

const validLead = () => normalizeLead({ name: "Тест", contact: "test@example.invalid", consent: true });

test("9.1: normalization collapses line whitespace and preserves task paragraphs", () => {
  const lead = normalizeLead({ name: "  Тест\n Клиент  ", contact: "  @test_user\t", task: "  Один\r\n\r\n\r\n  два\t слова  ", consent: true });
  assert.equal(lead.name, "Тест Клиент");
  assert.equal(lead.contact, "@test_user");
  assert.equal(lead.task, "Один\n\n два слова");
  assert.deepEqual(validateLead(lead), {});
});

test("9.1: arbitrary JSON and non-string fields cannot bypass validation", () => {
  for (const input of [null, undefined, 1, false, "text", [], { name: {}, contact: 123, task: true }]) {
    const lead = normalizeLead(input);
    assert.equal(lead.name, "");
    assert.equal(lead.contact, "");
    assert.ok(validateLead(lead).name);
    assert.ok(validateLead(lead).contact);
  }
});

test("9.1: consent accepts only boolean true", () => {
  for (const consent of [false, "true", "false", 1, {}, null, undefined]) {
    assert.ok(validateLead(normalizeLead({ ...validLead(), consent })).consent);
  }
  assert.equal(validateLead(validLead()).consent, undefined);
});

test("9.1: name and task limits reject overflow without silently truncating input", () => {
  for (const [length, valid] of [[1, false], [2, true], [80, true], [81, false]] as const) {
    assert.equal(Boolean(validateLead({ ...validLead(), name: "А".repeat(length) }).name), !valid);
  }
  assert.equal(validateLead({ ...validLead(), task: "x".repeat(1000) }).task, undefined);
  const tooLong = normalizeLead({ ...validLead(), task: "x".repeat(1001) });
  assert.equal(tooLong.task.length, 1001);
  assert.ok(validateLead(tooLong).task);
});

test("9.1: contact types and size boundaries", () => {
  for (const contact of ["+7 (900) 123-45-67", "+123456789012345", "@test_user", "test_user", "test@example.invalid"]) {
    assert.equal(validateLead({ ...validLead(), contact }).contact, undefined, contact);
  }
  for (const contact of ["", "ab", "bad address", "a@b", "@bad-name", "x".repeat(121), "123!"]) {
    assert.ok(validateLead({ ...validLead(), contact }).contact, contact);
  }
  assert.equal(validateLead({ ...validLead(), contact: `${"a".repeat(104)}@example.invalid` }).contact, undefined);
});

test("9.1: source is canonical; legacy attribution is separated and bounded", () => {
  for (const source of LEAD_SOURCES) assert.equal(normalizeLead({ source }).source, source);
  const lead = normalizeLead({ page: "x".repeat(400), source: "utm_source=fixture", source_detail: "x".repeat(600) });
  assert.equal(lead.source, "website");
  assert.equal(lead.sourceDetail.length, LEAD_LIMITS.sourceDetail.max);
  assert.equal(lead.page.length, LEAD_LIMITS.page.max);
  assert.equal(normalizeLead({ source: "utm_source=fixture" }).sourceDetail, "utm_source=fixture");
  assert.equal(resolveLeadSource("forged", "telegram_bot"), "telegram_bot");
});

test("9.1: inbound requires safe numeric IDs and exactly one update/message kind", () => {
  const update = messageUpdate(CLIENT_A, "hello");
  const parsed = parseTelegramInbound(update);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.inbound.userId, CLIENT_A);
    assert.equal(parsed.inbound.sentAt, update.message.date * 1000);
  }
  for (const updateId of [-1, 0.5, "1", Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(parseTelegramInbound({ ...update, update_id: updateId }), { ok: false, error: "bad_update", status: 400 });
  }
  assert.equal(parseTelegramInbound({ ...update, edited_message: update.message }).ok, false);
  assert.equal(parseTelegramInbound(messageUpdate(CLIENT_A, "text", { voice: { file_id: "f", file_unique_id: "u", duration: 1 } })).ok, false);
  assert.equal(parseTelegramInbound(messageUpdate(CLIENT_A, "text", { from: { ...update.message.from, is_bot: true } })).ok, false);
});

test("9.1: group messages and mismatched private user/chat are ignored", () => {
  assert.deepEqual(parseTelegramInbound(messageUpdate(CLIENT_A, "text", { chat: { id: -100, type: "supergroup" } })), { ok: false, ignored: "private_chat_required" });
  assert.deepEqual(parseTelegramInbound(messageUpdate(CLIENT_A, "text", { chat: { id: 910000002, type: "private" } })), { ok: false, ignored: "private_chat_mismatch" });
});

test("9.1: parser chooses the largest photo and preserves normalized metadata", () => {
  const parsed = parseTelegramInbound(messageUpdate(CLIENT_A, "", {
    text: undefined,
    caption: "Caption",
    photo: [{ file_id: "large", file_unique_id: "u1", width: 100, height: 100 }, { file_id: "small", file_unique_id: "u2", width: 10, height: 10 }],
    media_group_id: "group-1",
  }));
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.inbound.kind, "photo");
    assert.equal(parsed.inbound.text, "Caption");
    assert.equal(parsed.inbound.media?.fileId, "large");
    assert.equal(parsed.inbound.media?.groupId, "group-1");
  }
});

test("9.1: media validation checks exact size boundary, metadata and type", () => {
  for (const kind of ["photo", "file", "voice"] as const) {
    const metadata = { bytes: TELEGRAM_MEDIA_LIMITS[kind], mime: kind === "voice" ? "audio/ogg" : "application/pdf" };
    assert.deepEqual(validateTelegramMedia(kind, metadata), { ok: true });
    assert.equal(validateTelegramMedia(kind, { ...metadata, bytes: metadata.bytes + 1 }).ok, false);
    for (const bytes of [-1, 1.5, NaN, "100"]) assert.equal(validateTelegramMedia(kind, { ...metadata, bytes }).ok, false);
    assert.equal(validateTelegramMedia(kind, undefined).ok, false);
  }
  assert.equal(validateTelegramMedia("file", { mime: "application/x-msdownload", name: "file.pdf" }).ok, false);
  assert.deepEqual(validateTelegramMedia("file", { name: "fixture.PDF" }), { ok: true });
  assert.equal(validateTelegramMedia("voice", { mime: "text/plain" }).ok, false);
});

test("9.1: outgoing buttons require HTTPS and callback size is measured in bytes", () => {
  const reply = (button: unknown) => ({ text: "test", replyMarkup: { inline_keyboard: [[button]] } });
  assert.ok(telegramBotReplySchema.safeParse(reply({ text: "test", callback_data: "я".repeat(32) })).success);
  assert.equal(telegramBotReplySchema.safeParse(reply({ text: "test", callback_data: "я".repeat(33) })).success, false);
  assert.equal(telegramBotReplySchema.safeParse(reply({ text: "test", web_app: { url: "http://localhost/miniapp" } })).success, false);
  assert.ok(telegramBotReplySchema.safeParse(reply({ text: "test", web_app: { url: "https://example.invalid/miniapp" } })).success);
  assert.equal(telegramBotReplySchema.safeParse({ text: " " }).success, false);
});
