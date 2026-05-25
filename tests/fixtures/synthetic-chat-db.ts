import Database from 'better-sqlite3';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export interface SyntheticChatDb {
  dbPath: string;
  attachmentSrc: string;
}

const COCOA_EPOCH_UNIX_S = 978_307_200;

/**
 * Build a minimal chat.db at <dir>/chat.db with seed data mirroring the Python
 * conftest fixture so the JSONL outputs from both implementations align.
 */
export function buildSyntheticChatDb(dir: string): SyntheticChatDb {
  const dbPath = join(dir, 'chat.db');
  const attachmentSrc = join(dir, 'IMG_001.jpg');

  // Idempotent: start from a clean slate so re-runs against the same dir work.
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    rmSync(f, { force: true });
  }

  // Write a small fake JPEG (correct magic bytes + filler) so the attachment exists.
  writeFileSync(
    attachmentSrc,
    Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 0)])
  );

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE handle (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL,
      service TEXT
    );

    CREATE TABLE chat (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT,
      style INTEGER,
      display_name TEXT
    );

    CREATE TABLE chat_handle_join (
      chat_id INTEGER,
      handle_id INTEGER,
      PRIMARY KEY (chat_id, handle_id)
    );

    CREATE TABLE message (
      ROWID INTEGER PRIMARY KEY,
      guid TEXT NOT NULL,
      text TEXT,
      attributedBody BLOB,
      handle_id INTEGER,
      service TEXT,
      date INTEGER,
      is_from_me INTEGER,
      associated_message_guid TEXT,
      associated_message_type INTEGER,
      message_summary_info BLOB
    );

    CREATE TABLE chat_message_join (
      chat_id INTEGER,
      message_id INTEGER,
      PRIMARY KEY (chat_id, message_id)
    );

    CREATE TABLE attachment (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      mime_type TEXT,
      transfer_name TEXT,
      total_bytes INTEGER
    );

    CREATE TABLE message_attachment_join (
      message_id INTEGER,
      attachment_id INTEGER,
      PRIMARY KEY (message_id, attachment_id)
    );
  `);

  const insertHandle = db.prepare('INSERT INTO handle (ROWID, id, service) VALUES (?, ?, ?)');
  insertHandle.run(1, '+15553334444', 'iMessage');
  insertHandle.run(2, 'spouse@example.com', 'iMessage');
  insertHandle.run(3, '+15559999999', 'iMessage');

  const insertChat = db.prepare(
    'INSERT INTO chat (ROWID, guid, style, display_name) VALUES (?, ?, ?, ?)'
  );
  insertChat.run(10, 'chat-10', 45, null);
  insertChat.run(11, 'chat-11', 43, 'Group chat');

  const insertChatHandle = db.prepare(
    'INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (?, ?)'
  );
  insertChatHandle.run(10, 1);
  insertChatHandle.run(10, 2);
  insertChatHandle.run(11, 1);
  insertChatHandle.run(11, 3);

  const t0 = Date.UTC(2024, 0, 1, 12, 0, 0); // 2024-01-01T12:00:00Z
  const cocoaNs = (ms: number): bigint =>
    BigInt(Math.round(ms / 1000 - COCOA_EPOCH_UNIX_S)) * 1_000_000_000n;

  const insertMsg = db.prepare(
    `INSERT INTO message
       (ROWID, guid, text, attributedBody, handle_id, service, date,
        is_from_me, associated_message_guid, associated_message_type, message_summary_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // m1: text from spouse (handle 1)
  insertMsg.run(1, 'guid-100', 'Hi from spouse', null, 1, 'iMessage', cocoaNs(t0), 0, null, null, null);
  // m2: text from me (handle null, is_from_me=1)
  insertMsg.run(2, 'guid-101', 'Hi from me', null, null, 'iMessage', cocoaNs(t0 + 60_000), 1, null, null, null);
  // m3: attributedBody only (no text)
  const attrib = makeAttributedBody('via attributedBody');
  insertMsg.run(3, 'guid-102', null, attrib, 1, 'iMessage', cocoaNs(t0 + 120_000), 0, null, null, null);
  // m4: reaction (love/2000) to m1
  insertMsg.run(4, 'guid-103', null, null, 1, 'iMessage', cocoaNs(t0 + 150_000), 0, 'p:0/guid-100', 2000, null);
  // m5: reply to m2
  insertMsg.run(5, 'guid-104', 'ok cool', null, 1, 'iMessage', cocoaNs(t0 + 200_000), 0, 'p:0/guid-101', 0, null);
  // m6: image attachment, no body
  insertMsg.run(6, 'guid-105', null, null, 1, 'iMessage', cocoaNs(t0 + 300_000), 0, null, null, null);
  // m7: in group chat 11 — must NOT appear in extract output
  insertMsg.run(7, 'guid-200', 'group msg', null, 1, 'iMessage', cocoaNs(t0 + 400_000), 0, null, null, null);

  const insertCMJ = db.prepare(
    'INSERT INTO chat_message_join (chat_id, message_id) VALUES (?, ?)'
  );
  for (const rowid of [1, 2, 3, 4, 5, 6]) insertCMJ.run(10, rowid);
  insertCMJ.run(11, 7);

  const insertAttachment = db.prepare(
    'INSERT INTO attachment (ROWID, filename, mime_type, transfer_name, total_bytes) VALUES (?, ?, ?, ?, ?)'
  );
  insertAttachment.run(200, attachmentSrc, 'image/jpeg', 'IMG_001.jpg', 124);

  const insertMAJ = db.prepare(
    'INSERT INTO message_attachment_join (message_id, attachment_id) VALUES (?, ?)'
  );
  insertMAJ.run(6, 200);

  db.close();
  return { dbPath, attachmentSrc };
}

/**
 * Build a minimal attributedBody blob that the decoder will accept.
 * Layout: NSString <pad> 0x84 0x01 0x2B <directLen> <utf-8 text> 0x86 0x84
 */
export function makeAttributedBody(text: string): Buffer {
  const utf8 = Buffer.from(text, 'utf-8');
  if (utf8.length >= 0x80) {
    throw new Error(
      `makeAttributedBody only emits direct-length form; use a string < 128 bytes`
    );
  }
  return Buffer.concat([
    // streamtyped-like preamble + NSString class name (any leading bytes are tolerated)
    Buffer.from([0x04, 0x0b]),
    Buffer.from('NSString', 'utf-8'),
    // class-table metadata — opaque, just needs to be < SCAN_AHEAD (32) bytes before the marker
    Buffer.from([0x01, 0x95, 0x84, 0x01, 0x40]),
    // instance marker + direct length + payload
    Buffer.from([0x84, 0x01, 0x2b, utf8.length]),
    utf8,
    Buffer.from([0x86, 0x84])
  ]);
}
