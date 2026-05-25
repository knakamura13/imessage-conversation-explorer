import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function mkTmpDir(prefix = 'imxport-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export async function withTmpDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkTmpDir();
  try {
    return await fn(dir);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
