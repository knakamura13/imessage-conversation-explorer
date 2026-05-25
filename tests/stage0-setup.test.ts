import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSetup } from '../src/lib/stages/stage0-setup.js';
import { buildSyntheticChatDb } from './fixtures/synthetic-chat-db.js';
import { mkTmpDir } from './helpers.js';
import type { Provenance } from '../src/lib/types.js';

describe('stage 0 setup', () => {
  it('copies the source DB, hashes it, and writes provenance.json with row counts', async () => {
    const srcDir = mkTmpDir();
    const wdDir = mkTmpDir();
    const { dbPath } = buildSyntheticChatDb(srcDir);
    // Write a sidecar so we can verify it's picked up
    writeFileSync(join(srcDir, 'chat.db-wal'), Buffer.from([0xde, 0xad, 0xbe, 0xef]));

    await runSetup({ sourceDb: dbPath, workdir: wdDir });

    expect(existsSync(join(wdDir, 'snapshot', 'chat.db'))).toBe(true);
    expect(existsSync(join(wdDir, 'snapshot', 'chat.db-wal'))).toBe(true);

    const prov = JSON.parse(readFileSync(join(wdDir, 'provenance.json'), 'utf-8')) as Provenance;
    expect(prov.files['chat.db'].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(prov.files['chat.db'].bytes).toBeGreaterThan(0);
    expect(prov.files['chat.db-wal'].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(prov.counts.message).toBe(7);
    expect(prov.counts.handle).toBe(3);
    expect(prov.counts.chat).toBe(2);
    expect(prov.tool_version).toMatch(/^\d/);
  });

  it('produces stable hashes across re-runs', async () => {
    const srcDir = mkTmpDir();
    const { dbPath } = buildSyntheticChatDb(srcDir);

    const wd1 = mkTmpDir();
    await runSetup({ sourceDb: dbPath, workdir: wd1 });
    const wd2 = mkTmpDir();
    await runSetup({ sourceDb: dbPath, workdir: wd2 });

    const p1 = JSON.parse(readFileSync(join(wd1, 'provenance.json'), 'utf-8')) as Provenance;
    const p2 = JSON.parse(readFileSync(join(wd2, 'provenance.json'), 'utf-8')) as Provenance;
    expect(p1.files['chat.db'].sha256).toBe(p2.files['chat.db'].sha256);
  });
});
