import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';

export async function writeJsonl<T>(
  path: string,
  rows: AsyncIterable<T> | Iterable<T>
): Promise<number> {
  const stream = createWriteStream(path, { encoding: 'utf-8' });
  let count = 0;
  try {
    for await (const row of rows as AsyncIterable<T>) {
      const ok = stream.write(encodeJsonLine(row) + '\n');
      count++;
      if (!ok) {
        await new Promise<void>((resolve) => stream.once('drain', () => resolve()));
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
  return count;
}

// JSON.stringify does not escape U+2028 (LINE SEPARATOR) or U+2029 (PARAGRAPH
// SEPARATOR), but Node's readline treats them as line terminators. Without
// escaping, a single message body containing one of these (e.g. text pasted
// from Word/Pages) silently splits the JSONL row in two. Construct the chars
// at runtime so the source file is plain ASCII and esbuild/tooling don't
// mis-parse it.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

export function encodeJsonLine<T>(row: T): string {
  return JSON.stringify(row)
    .replaceAll(LINE_SEP, '\\u2028')
    .replaceAll(PARA_SEP, '\\u2029');
}

export async function* readJsonl<T>(path: string): AsyncIterable<T> {
  const stream = createReadStream(path, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length === 0) continue;
    yield JSON.parse(line) as T;
  }
}
