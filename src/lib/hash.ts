import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FileHash } from './types.js';

export async function sha256File(path: string): Promise<FileHash> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  const { size } = await stat(path);
  return { sha256: hash.digest('hex'), bytes: size };
}
