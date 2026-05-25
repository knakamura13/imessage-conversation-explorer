import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { openSnapshotDb, countRows } from '../chat-db.js';
import { sha256File } from '../hash.js';
import { workdirLayout, expandHome } from '../paths.js';
import { TOOL_VERSION } from '../version.js';
import type { FileHash, Provenance } from '../types.js';

export interface SetupOptions {
  sourceDb: string;
  workdir: string;
}

export async function runSetup({ sourceDb, workdir }: SetupOptions): Promise<Provenance> {
  const layout = workdirLayout(workdir);
  await mkdir(layout.snapshot, { recursive: true });

  const expandedSource = expandHome(sourceDb);
  if (!existsSync(expandedSource)) {
    throw new Error(`source database not found at ${expandedSource}`);
  }

  const files: Record<string, FileHash> = {};
  const sourceDir = expandedSource.replace(/\/[^/]+$/, '');
  const mainName = basename(expandedSource);

  // Copy + hash main DB
  await copyFile(expandedSource, layout.snapshotDb);
  files[mainName] = await sha256File(layout.snapshotDb);

  // Copy + hash sidecars if present
  for (const side of ['chat.db-wal', 'chat.db-shm']) {
    const src = `${sourceDir}/${side}`;
    if (existsSync(src)) {
      const dst = `${layout.snapshot}/${side}`;
      await copyFile(src, dst);
      files[side] = await sha256File(dst);
    }
  }

  // Open snapshot, count rows
  const db = openSnapshotDb(layout.snapshotDb);
  const counts = {
    message: countRows(db, 'message'),
    handle: countRows(db, 'handle'),
    chat: countRows(db, 'chat')
  };
  db.close();

  const provenance: Provenance = {
    tool_version: TOOL_VERSION,
    snapshot_timestamp: new Date().toISOString(),
    source_path: expandedSource,
    files,
    counts
  };

  await writeFile(layout.provenanceJson, JSON.stringify(provenance, null, 2) + '\n', 'utf-8');
  return provenance;
}
