import { createHash } from 'node:crypto';

/** Compose a stable ETag string from arbitrary cache-key components. */
export function makeEtag(...parts: Array<string | number>): string {
  const h = createHash('sha1');
  for (const p of parts) h.update(String(p) + '\0');
  return `W/"${h.digest('hex').slice(0, 16)}"`;
}
