import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { installTestDatabase, CLIENT_A } from "./helpers/telegram";

const db = await installTestDatabase();
const data = await import("../src/server/telegram-data.server");
const { normalizeLead } = await import("../src/lib/lead");
const { insertLeadWithIdempotency } = await import("../src/server/leads.server");

test("9.10: двойная отправка формы возвращает исходную заявку и не создаёт дубль", () => {
  const lead = normalizeLead({
    name: "Клиент двойной формы",
    contact: "double@example.com",
    task: "Проверка повторной отправки",
    page: "/services/websites",
    source: "website",
    consent: true,
  });
  const first = insertLeadWithIdempotency(lead, "quality-double-form-001");
  const second = insertLeadWithIdempotency(lead, "quality-double-form-001");

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.leadId, first.leadId);
  assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM lead")?.n, 1);
  assert.equal(
    db.get<{ idempotency_key: string }>("SELECT idempotency_key FROM lead")?.idempotency_key,
    "quality-double-form-001",
  );
});

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

test("9.11: VACUUM-снимок проходит integrity check и восстанавливает заявку и Telegram-историю", () => {
  const lead = normalizeLead({
    name: "Заявка для backup",
    contact: "backup@example.com",
    task: "Восстановление базы",
    page: "/backup",
    source: "website",
    source_detail: "quality-9-11",
    consent: true,
  });
  const inserted = insertLeadWithIdempotency(lead, "quality-backup-001");
  const contactId = data.upsertTelegramContact({
    environment: "test",
    telegramUserId: CLIENT_A,
    displayName: "Backup client",
  });
  const conversationId = data.createTelegramConversation({
    environment: "test",
    telegramContactId: contactId,
    clientChatId: CLIENT_A,
    leadId: inserted.leadId,
    isTest: true,
  });
  data.recordTelegramMessage({
    environment: "test",
    conversationId,
    direction: "client",
    messageType: "text",
    chatId: CLIENT_A,
    senderTelegramUserId: CLIENT_A,
    telegramMessageId: 900_911,
    updateId: 900_911,
    text: "Сообщение должно пережить восстановление",
  });

  const backupDir = mkdtempSync(join(tmpdir(), "itagent-quality-backup-"));
  const databasePath = join(db.DATA_DIR, "content.db");
  const backupPath = join(backupDir, "content.db");
  try {
    db.closeDb();
    const live = new DatabaseSync(databasePath);
    live.exec(`VACUUM INTO ${sqlString(backupPath)}`);
    live.close();

    assert.equal(existsSync(backupPath), true);
    const snapshot = new DatabaseSync(backupPath);
    assert.equal(
      (snapshot.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check,
      "ok",
    );
    assert.equal(
      (snapshot.prepare("SELECT COUNT(*) AS n FROM lead WHERE idempotency_key = 'quality-backup-001'").get() as { n: number }).n,
      1,
    );
    snapshot.close();

    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
    copyFileSync(backupPath, databasePath);
    assert.equal(db.get<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check, "ok");
    assert.equal(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM lead WHERE idempotency_key = 'quality-backup-001'")?.n, 1);
    assert.equal(data.getTelegramConversation("test", conversationId)?.lead_id, inserted.leadId);
    assert.equal(data.listTelegramMessages("test", conversationId)[0]?.text, "Сообщение должно пережить восстановление");
  } finally {
    db.closeDb();
    rmSync(backupDir, { recursive: true, force: true });
  }
});
