import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runSetup } from '../src/lib/stages/stage0-setup.js';
import { runExtract } from '../src/lib/stages/stage1-extract.js';
import { buildSyntheticChatDb } from './fixtures/synthetic-chat-db.js';
import { mkTmpDir } from './helpers.js';
import type { MessageRow } from '../src/lib/types.js';

const configPath = join(import.meta.dirname, 'fixtures', 'participants.toml');

async function setupAndExtract(): Promise<{
  workdir: string;
  rows: MessageRow[];
  attachmentSrc: string;
}> {
  const srcDir = mkTmpDir();
  const workdir = mkTmpDir();
  const { dbPath, attachmentSrc } = buildSyntheticChatDb(srcDir);
  await runSetup({ sourceDb: dbPath, workdir });
  const result = await runExtract({ workdir, config: configPath });
  expect(result.spouseHandles.sort((a, b) => a - b)).toEqual([1, 2]);
  expect(result.oneToOneChats).toEqual([10]);
  const raw = readFileSync(join(workdir, 'messages.jsonl'), 'utf-8').trim();
  const rows = raw.split('\n').map((line) => JSON.parse(line) as MessageRow);
  return { workdir, rows, attachmentSrc };
}

describe('stage 1 extract', () => {
  it('resolves spouse handles via union of phone and email ROWIDs', async () => {
    const { rows } = await setupAndExtract();
    // Group chat (id 11) message must NOT be in the output.
    expect(rows.some((r) => r.guid === 'guid-200')).toBe(false);
  });

  it('emits 6 rows from the 1:1 chat (chat 10), excluding the group chat', async () => {
    const { rows } = await setupAndExtract();
    expect(rows.length).toBe(6);
    expect(rows.map((r) => r.guid)).toEqual([
      'guid-100',
      'guid-101',
      'guid-102',
      'guid-103',
      'guid-104',
      'guid-105'
    ]);
  });

  it('falls back to attributedBody when text is null', async () => {
    const { rows } = await setupAndExtract();
    const m3 = rows.find((r) => r.guid === 'guid-102');
    expect(m3).toBeTruthy();
    expect(m3?.body).toBe('via attributedBody');
    expect(m3?.raw_text_present).toBe(false);
    expect(m3?.raw_attributed_body_present).toBe(true);
  });

  it('copies attachments into workdir/attachments and records local_path', async () => {
    const { workdir, rows } = await setupAndExtract();
    const m6 = rows.find((r) => r.guid === 'guid-105');
    expect(m6).toBeTruthy();
    expect(m6?.attachments.length).toBe(1);
    const att = m6!.attachments[0];
    expect(att.missing).toBe(false);
    expect(att.transfer_name).toBe('IMG_001.jpg');
    expect(att.mime_type).toBe('image/jpeg');
    expect(att.local_path).toBe(join(workdir, 'attachments', '6_IMG_001.jpg'));
    expect(existsSync(att.local_path!)).toBe(true);
  });

  it('records missing=true with a reason when source attachment is gone', async () => {
    const srcDir = mkTmpDir();
    const workdir = mkTmpDir();
    const { dbPath, attachmentSrc } = buildSyntheticChatDb(srcDir);
    rmSync(attachmentSrc);
    await runSetup({ sourceDb: dbPath, workdir });
    await runExtract({ workdir, config: configPath });
    const rows = readFileSync(join(workdir, 'messages.jsonl'), 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as MessageRow);
    const m6 = rows.find((r) => r.guid === 'guid-105');
    expect(m6?.attachments[0].missing).toBe(true);
    expect(m6?.attachments[0].reason).toMatch(/source missing/);
    expect(m6?.attachments[0].local_path).toBe(null);
  });

  it('marks reactions and replies via associated_message_type', async () => {
    const { rows } = await setupAndExtract();
    const m4 = rows.find((r) => r.guid === 'guid-103');
    expect(m4?.associated_message_type).toBe(2000);
    expect(m4?.associated_message_guid).toBe('p:0/guid-100');
    const m5 = rows.find((r) => r.guid === 'guid-104');
    expect(m5?.associated_message_type).toBe(0);
    expect(m5?.associated_message_guid).toBe('p:0/guid-101');
  });
});
