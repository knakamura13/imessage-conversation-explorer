import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSetup } from '../src/lib/stages/stage0-setup.js';
import { runExtract } from '../src/lib/stages/stage1-extract.js';
import { runEnrich, parseAssociatedGuid } from '../src/lib/stages/stage2-enrich.js';
import { buildSyntheticChatDb } from './fixtures/synthetic-chat-db.js';
import { mkTmpDir } from './helpers.js';
import type { EnrichedRow, Stats } from '../src/lib/types.js';

const configPath = join(import.meta.dirname, 'fixtures', 'participants.toml');

async function setupExtractEnrich(): Promise<{
  workdir: string;
  enriched: EnrichedRow[];
  stats: Stats;
}> {
  const srcDir = mkTmpDir();
  const workdir = mkTmpDir();
  const { dbPath } = buildSyntheticChatDb(srcDir);
  await runSetup({ sourceDb: dbPath, workdir });
  await runExtract({ workdir, config: configPath });
  await runEnrich({ workdir, config: configPath });
  const enriched = readFileSync(join(workdir, 'enriched.jsonl'), 'utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as EnrichedRow);
  const stats = JSON.parse(readFileSync(join(workdir, 'stats.json'), 'utf-8')) as Stats;
  return { workdir, enriched, stats };
}

describe('parseAssociatedGuid', () => {
  it('strips p:0/ prefix', () => {
    expect(parseAssociatedGuid('p:0/abc-123')).toBe('abc-123');
  });
  it('strips bp: prefix', () => {
    expect(parseAssociatedGuid('bp:xyz-456')).toBe('xyz-456');
  });
  it('returns bare guid unchanged', () => {
    expect(parseAssociatedGuid('plain-guid')).toBe('plain-guid');
  });
  it('returns null for null/empty input', () => {
    expect(parseAssociatedGuid(null)).toBe(null);
    expect(parseAssociatedGuid('')).toBe(null);
  });
});

describe('stage 2 enrich', () => {
  it('threads reactions onto parent and does NOT emit reactions standalone', async () => {
    const { enriched } = await setupExtractEnrich();
    // m4 (guid-103) is the reaction; must not appear as its own row
    expect(enriched.some((r) => r.guid === 'guid-103')).toBe(false);

    // Parent (m1 guid-100) carries the reaction
    const m1 = enriched.find((r) => r.guid === 'guid-100');
    expect(m1?.reactions.length).toBe(1);
    expect(m1?.reactions[0].kind).toBe('love');
    expect(m1?.reactions[0].removed).toBe(false);
  });

  it('records reply_to_guid and msg_type="reply" for replies', async () => {
    const { enriched } = await setupExtractEnrich();
    const m5 = enriched.find((r) => r.guid === 'guid-104');
    expect(m5?.msg_type).toBe('reply');
    expect(m5?.reply_to_guid).toBe('guid-101');
  });

  it('classifies text/image and assigns sender_display per config', async () => {
    const { enriched } = await setupExtractEnrich();
    const m1 = enriched.find((r) => r.guid === 'guid-100');
    const m2 = enriched.find((r) => r.guid === 'guid-101');
    const m6 = enriched.find((r) => r.guid === 'guid-105');
    expect(m1?.msg_type).toBe('text');
    expect(m2?.msg_type).toBe('text');
    expect(m6?.msg_type).toBe('image');
    expect(m1?.sender_display).toBe('Sally');
    expect(m2?.sender_display).toBe('Kyle');
  });

  it('writes stats.json with the expected shape and counts', async () => {
    const { stats } = await setupExtractEnrich();
    expect(stats.total_visible).toBe(5); // 6 extracted - 1 reaction
    expect(stats.attachment_count).toBe(1);
    expect(stats.by_sender.Sally).toBeGreaterThan(0);
    expect(stats.by_sender.Kyle).toBeGreaterThan(0);
    expect(stats.by_type.text).toBeGreaterThanOrEqual(2);
    expect(stats.by_type.image).toBe(1);
    expect(stats.by_type.reply).toBe(1);
    expect(stats.first_date).toMatch(/^2024-01-01/);
    expect(stats.last_date).toMatch(/^2024-01-01/);
    expect(Object.keys(stats.by_month)).toContain('2024-01');
    expect(stats.longest_gap_days).toBeGreaterThanOrEqual(0);
  });
});
