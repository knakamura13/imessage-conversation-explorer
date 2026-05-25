import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeJsonLine, readJsonl, writeJsonl } from '../src/lib/jsonl.js';
import { mkTmpDir } from './helpers.js';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe('jsonl encoding', () => {
  it('escapes U+2028 and U+2029 so readline cannot split mid-row', () => {
    const row = { body: `line one${LS}line two${PS}line three` };
    const encoded = encodeJsonLine(row);
    expect(encoded.includes(LS)).toBe(false);
    expect(encoded.includes(PS)).toBe(false);
    expect(encoded).toContain('\\u2028');
    expect(encoded).toContain('\\u2029');
    const back = JSON.parse(encoded) as { body: string };
    expect(back.body).toBe(`line one${LS}line two${PS}line three`);
  });

  it('round-trips writeJsonl + readJsonl with embedded line-separator chars', async () => {
    const dir = mkTmpDir();
    const path = join(dir, 'sample.jsonl');
    const rows = [
      { id: 1, body: 'plain' },
      { id: 2, body: `has${LS}line-sep then continuation` },
      { id: 3, body: `has${PS}para-sep then continuation` },
      { id: 4, body: 'control\nchars\tare also\rfine' }
    ];
    await writeJsonl(path, rows);

    const collected: Array<{ id: number; body: string }> = [];
    for await (const r of readJsonl<{ id: number; body: string }>(path)) collected.push(r);
    expect(collected).toEqual(rows);

    // Sanity: file must contain exactly N+1 LF breaks (one per row + trailing).
    const raw = readFileSync(path, 'utf-8');
    expect(raw.split('\n').length - 1).toBe(rows.length);
  });
});
