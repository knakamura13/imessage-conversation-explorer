import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  openSnapshotDb,
  resolveHandleIds,
  iterateChatHandleJoin,
  iterateMessagesForChats,
  getAttachmentsForMessage,
  type RawAttachmentRow,
  type RawMessageRow
} from '../chat-db.js';
import { workdirLayout, expandHome } from '../paths.js';
import { loadParticipants, identifiers } from '../config.js';
import { decodeAttributedBody } from '../attributed-body.js';
import { cocoaToIso } from '../apple-epoch.js';
import { writeJsonl } from '../jsonl.js';
import type { Attachment, MessageRow, ParticipantsConfig } from '../types.js';

export interface ExtractOptions {
  workdir: string;
  config: string;
}

export interface ExtractResult {
  spouseHandles: number[];
  oneToOneChats: number[];
  messagesWritten: number;
  attachmentsCopied: number;
  attachmentsMissing: number;
}

export async function runExtract({ workdir, config }: ExtractOptions): Promise<ExtractResult> {
  const layout = workdirLayout(workdir);
  const cfg = loadParticipants(config);

  await mkdir(layout.attachments, { recursive: true });

  const db = openSnapshotDb(layout.snapshotDb);
  try {
    const spouseHandles = resolveHandleIds(db, identifiers(cfg.spouse)).sort((a, b) => a - b);
    const spouseSet = new Set(spouseHandles);
    const oneToOneChats = findOneToOneChats(db, spouseSet).sort((a, b) => a - b);

    const result: ExtractResult = {
      spouseHandles,
      oneToOneChats,
      messagesWritten: 0,
      attachmentsCopied: 0,
      attachmentsMissing: 0
    };

    const rows = buildMessageRows(db, oneToOneChats, cfg, layout.attachments, result);
    result.messagesWritten = await writeJsonl(layout.messagesJsonl, rows);
    return result;
  } finally {
    db.close();
  }
}

export function findOneToOneChats(
  db: ReturnType<typeof openSnapshotDb>,
  spouseHandles: Set<number>
): number[] {
  const byChat = new Map<number, Set<number>>();
  for (const row of iterateChatHandleJoin(db)) {
    const cid = Number(row.chat_id);
    const hid = Number(row.handle_id);
    let set = byChat.get(cid);
    if (!set) {
      set = new Set();
      byChat.set(cid, set);
    }
    set.add(hid);
  }
  const out: number[] = [];
  for (const [chatId, set] of byChat) {
    if (set.size === 0) continue;
    let allInSpouse = true;
    for (const h of set) {
      if (!spouseHandles.has(h)) {
        allInSpouse = false;
        break;
      }
    }
    if (allInSpouse) out.push(chatId);
  }
  return out;
}

async function* buildMessageRows(
  db: ReturnType<typeof openSnapshotDb>,
  chatIds: number[],
  _cfg: ParticipantsConfig,
  attachmentsDir: string,
  result: ExtractResult
): AsyncIterable<MessageRow> {
  for (const raw of iterateMessagesForChats(db, chatIds)) {
    const rowid = Number(raw.ROWID);
    const rawTextPresent = raw.text != null;
    const rawAttribPresent = raw.attributedBody != null && raw.attributedBody.length > 0;

    let body: string | null = raw.text;
    if (!rawTextPresent && rawAttribPresent) {
      body = decodeAttributedBody(raw.attributedBody);
    }

    const attachments: Attachment[] = [];
    const rawAttachs = getAttachmentsForMessage(db, rowid);
    for (const a of rawAttachs) {
      const copied = await resolveAttachment(a, rowid, attachmentsDir);
      attachments.push(copied);
      if (copied.missing) {
        result.attachmentsMissing++;
      } else {
        result.attachmentsCopied++;
      }
    }

    const row: MessageRow = {
      rowid,
      guid: raw.guid,
      date_utc: cocoaToIso(raw.date),
      is_from_me: Number(raw.is_from_me) === 1,
      handle_address: raw.handle_address,
      service: raw.service,
      body,
      raw_text_present: rawTextPresent,
      raw_attributed_body_present: rawAttribPresent,
      associated_message_guid: raw.associated_message_guid,
      associated_message_type:
        raw.associated_message_type == null ? null : Number(raw.associated_message_type),
      has_summary_info: raw.message_summary_info != null,
      attachments
    };
    yield row;
  }
}

async function resolveAttachment(
  a: RawAttachmentRow,
  messageRowid: number,
  attachmentsDir: string
): Promise<Attachment> {
  const rowid = Number(a.ROWID);
  const transfer_name = a.transfer_name ?? null;
  const mime_type = a.mime_type ?? null;
  const total_bytes = a.total_bytes == null ? null : Number(a.total_bytes);

  const base: Omit<Attachment, 'local_path' | 'missing' | 'reason'> = {
    rowid,
    transfer_name,
    mime_type,
    total_bytes
  };

  if (!a.filename) {
    return { ...base, local_path: null, missing: true, reason: 'no filename' };
  }
  const src = expandHome(a.filename);
  if (!existsSync(src)) {
    return { ...base, local_path: null, missing: true, reason: `source missing: ${src}` };
  }
  const fallbackName = a.filename.split('/').pop() ?? `attachment_${rowid}`;
  const safe = safeName(transfer_name || fallbackName);
  const dstName = `${messageRowid}_${safe}`;
  const dst = join(attachmentsDir, dstName);
  try {
    await copyFile(src, dst);
    return { ...base, local_path: dst, missing: false, reason: null };
  } catch (err) {
    return {
      ...base,
      local_path: null,
      missing: true,
      reason: `copy failed: ${(err as Error).message}`
    };
  }
}

function safeName(name: string): string {
  // Replace path separators, whitespace, and control characters.
  return (
    name
      .replace(/[\\/]/g, '_')
      .replace(/\s+/g, '_')
      // strip control chars (0x00-0x1f and 0x7f) without a regex-control-char range literal
      .split('')
      .filter((c) => {
        const code = c.charCodeAt(0);
        return code > 0x1f && code !== 0x7f;
      })
      .join('') || 'file'
  );
}
