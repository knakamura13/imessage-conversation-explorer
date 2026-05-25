import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

export type ChatDb = DB;

export function openSnapshotDb(path: string): ChatDb {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  // message.date is nanoseconds on modern macOS — past Number.MAX_SAFE_INTEGER.
  // Returning bigints from the driver preserves precision; apple-epoch.ts handles
  // both bigint and number inputs.
  db.defaultSafeIntegers(true);
  return db;
}

export interface CountRow {
  c: number | bigint;
}

export interface HandleRow {
  ROWID: number | bigint;
}

export interface ChatHandleRow {
  chat_id: number | bigint;
  handle_id: number | bigint;
}

export interface RawMessageRow {
  ROWID: number | bigint;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  handle_id: number | bigint | null;
  service: string | null;
  date: number | bigint | null;
  is_from_me: number | bigint;
  associated_message_guid: string | null;
  associated_message_type: number | bigint | null;
  message_summary_info: Buffer | string | null;
  handle_address: string | null;
}

export interface RawAttachmentRow {
  ROWID: number | bigint;
  filename: string | null;
  mime_type: string | null;
  transfer_name: string | null;
  total_bytes: number | bigint | null;
}

export function countRows(db: ChatDb, table: 'message' | 'handle' | 'chat'): number {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as CountRow;
  return Number(row.c);
}

export function resolveHandleIds(db: ChatDb, identifiers: string[]): number[] {
  if (identifiers.length === 0) return [];
  const placeholders = identifiers.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT ROWID FROM handle WHERE id IN (${placeholders})`)
    .all(...identifiers) as HandleRow[];
  return rows.map((r) => Number(r.ROWID));
}

export function* iterateChatHandleJoin(db: ChatDb): IterableIterator<ChatHandleRow> {
  const stmt = db.prepare('SELECT chat_id, handle_id FROM chat_handle_join');
  // .iterate yields rows lazily
  yield* stmt.iterate() as IterableIterator<ChatHandleRow>;
}

export function iterateMessagesForChats(
  db: ChatDb,
  chatIds: number[]
): IterableIterator<RawMessageRow> {
  if (chatIds.length === 0) return [].values() as IterableIterator<RawMessageRow>;
  const placeholders = chatIds.map(() => '?').join(', ');
  const stmt = db.prepare(`
    SELECT m.ROWID, m.guid, m.text, m.attributedBody, m.handle_id,
           m.service, m.date, m.is_from_me,
           m.associated_message_guid, m.associated_message_type,
           m.message_summary_info, h.id AS handle_address
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    WHERE cmj.chat_id IN (${placeholders})
    ORDER BY m.date ASC, m.ROWID ASC
  `);
  return stmt.iterate(...chatIds) as IterableIterator<RawMessageRow>;
}

export function getAttachmentsForMessage(db: ChatDb, messageRowid: number): RawAttachmentRow[] {
  const stmt = db.prepare(`
    SELECT a.ROWID, a.filename, a.mime_type, a.transfer_name, a.total_bytes
    FROM attachment a
    JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
    WHERE maj.message_id = ?
  `);
  return stmt.all(messageRowid) as RawAttachmentRow[];
}
