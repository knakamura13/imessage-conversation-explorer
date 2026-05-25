// Standalone driver to build the synthetic chat.db into a target dir.
// Usage: pnpm tsx scripts/build-synthetic.ts <dir>
import { mkdirSync } from 'node:fs';
import { buildSyntheticChatDb } from '../tests/fixtures/synthetic-chat-db.js';

const dir = process.argv[2];
if (!dir) {
  process.stderr.write('usage: tsx scripts/build-synthetic.ts <dir>\n');
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const { dbPath, attachmentSrc } = buildSyntheticChatDb(dir);
process.stdout.write(`db: ${dbPath}\nattachment: ${attachmentSrc}\n`);
