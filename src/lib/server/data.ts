import { existsSync, readFileSync } from 'node:fs';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FileCache } from './cache.js';
import { layout } from './workdir.js';
import { readJsonl } from '../jsonl.js';
import type { EnrichedRow, Stats } from '../types.js';

export interface TagEntry {
  tags: string[];
  note: string;
}
export type TagsMap = Record<string, TagEntry>;

const enrichedCache = new FileCache<EnrichedRow[]>(async (path) => {
  const out: EnrichedRow[] = [];
  for await (const row of readJsonl<EnrichedRow>(path)) out.push(row);
  return out;
});

const tagsCache = new FileCache<TagsMap>(async (path) => {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8');
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw) as TagsMap;
});

const statsCache = new FileCache<Stats>(async (path) => {
  return JSON.parse(readFileSync(path, 'utf-8')) as Stats;
});

export async function loadEnriched() {
  return enrichedCache.get(layout().enrichedJsonl);
}

export async function loadTags() {
  const l = layout();
  if (!existsSync(l.tagsJson)) {
    // First read with no file — synthesize an "empty" entry without touching disk.
    return { value: {} as TagsMap, key: 'empty', mtimeMs: 0, size: 0 };
  }
  return tagsCache.get(l.tagsJson);
}

export async function loadStats() {
  return statsCache.get(layout().statsJson);
}

/**
 * Merge incoming tag updates into the on-disk tags.json atomically (write to
 * tmp then rename). Returns the new tags map.
 */
export async function saveTags(updates: TagsMap): Promise<TagsMap> {
  const path = layout().tagsJson;
  await mkdir(dirname(path), { recursive: true });
  const current = (await loadTags()).value;
  const next: TagsMap = { ...current };
  for (const [rowid, entry] of Object.entries(updates)) {
    const tags = Array.isArray(entry.tags) ? Array.from(new Set(entry.tags)).sort() : [];
    const note = typeof entry.note === 'string' ? entry.note : '';
    if (tags.length === 0 && note.length === 0) {
      delete next[rowid];
    } else {
      next[rowid] = { tags, note };
    }
  }
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, JSON.stringify(next, null, 2) + '\n', 'utf-8');
  await rename(tmp, path);
  return next;
}
