import { stat } from 'node:fs/promises';

export interface CachedFile<T> {
  value: T;
  /** Composite key including mtime + size of the underlying file. */
  key: string;
  mtimeMs: number;
  size: number;
}

/**
 * Caches the most recent parsed value for a single file path, keyed on
 * (mtime, size). If the file is replaced or rewritten, the next get() call
 * re-runs the loader. No explicit invalidation needed — POSTs that rewrite
 * the file naturally bump mtime, and the next read re-parses.
 */
export class FileCache<T> {
  private current: CachedFile<T> | null = null;
  private inflight: Promise<CachedFile<T>> | null = null;

  constructor(private readonly loader: (path: string) => Promise<T>) {}

  async get(path: string): Promise<CachedFile<T>> {
    const s = await stat(path);
    const key = `${s.mtimeMs}:${s.size}`;
    if (this.current?.key === key) return this.current;
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const value = await this.loader(path);
      const entry: CachedFile<T> = { value, key, mtimeMs: s.mtimeMs, size: s.size };
      this.current = entry;
      this.inflight = null;
      return entry;
    })();
    return this.inflight;
  }
}
