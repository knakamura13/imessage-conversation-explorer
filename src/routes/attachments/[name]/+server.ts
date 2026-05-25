import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { Readable } from 'node:stream';
import { layout } from '$lib/server/workdir.js';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.caf': 'audio/x-caf',
  '.pdf': 'application/pdf'
};

export const GET: RequestHandler = async ({ params }) => {
  // basename guards against path traversal — only a leaf filename is honored.
  const name = basename(params.name ?? '');
  if (!name) throw error(400, 'bad name');
  const path = join(layout().attachments, name);
  let st;
  try {
    st = await stat(path);
  } catch {
    throw error(404, 'not found');
  }
  if (!st.isFile()) throw error(404, 'not a file');

  const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  const type = MIME[ext] ?? 'application/octet-stream';

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'content-type': type,
      'content-length': String(st.size),
      'cache-control': 'private, max-age=300'
    }
  });
};
