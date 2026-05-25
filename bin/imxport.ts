#!/usr/bin/env -S npx tsx
import { Command } from 'commander';
import { runSetup } from '../src/lib/stages/stage0-setup.js';
import { runExtract } from '../src/lib/stages/stage1-extract.js';
import { runEnrich } from '../src/lib/stages/stage2-enrich.js';
import { openSnapshotDb, resolveHandleIds, iterateMessagesForChats } from '../src/lib/chat-db.js';
import { findOneToOneChats } from '../src/lib/stages/stage1-extract.js';
import { loadParticipants, identifiers } from '../src/lib/config.js';
import { workdirLayout, DEFAULT_SOURCE_DB, DEFAULT_WORKDIR, DEFAULT_CONFIG } from '../src/lib/paths.js';
import { TOOL_VERSION } from '../src/lib/version.js';
import { existsSync } from 'node:fs';

const program = new Command();
program
  .name('imxport')
  .description('Export the iMessage conversation between two people for USCIS evidence.')
  .version(TOOL_VERSION);

program
  .command('inspect')
  .description('Read-only dry run: resolve spouse handles, list 1:1 chats, count messages in scope.')
  .option('--source-db <path>', 'path to chat.db', DEFAULT_SOURCE_DB)
  .option('--workdir <path>', 'work directory (used only to locate snapshot if present)', DEFAULT_WORKDIR)
  .option('--config <path>', 'participants.toml', DEFAULT_CONFIG)
  .action(async (opts) => {
    await wrap(async () => {
      const cfg = loadParticipants(opts.config);
      const layout = workdirLayout(opts.workdir);
      const dbPath = existsSync(layout.snapshotDb) ? layout.snapshotDb : opts.sourceDb;
      const db = openSnapshotDb(dbPath.startsWith('~') ? expandTilde(dbPath) : dbPath);
      try {
        const spouseHandles = resolveHandleIds(db, identifiers(cfg.spouse)).sort((a, b) => a - b);
        const spouseSet = new Set(spouseHandles);
        const oneToOneChats = findOneToOneChats(db, spouseSet).sort((a, b) => a - b);
        let msgCount = 0;
        for (const _row of iterateMessagesForChats(db, oneToOneChats)) msgCount++;
        process.stdout.write(
          `db: ${dbPath}\n` +
            `spouse identifiers: ${identifiers(cfg.spouse).join(', ')}\n` +
            `spouse handles (ROWIDs): [${spouseHandles.join(', ')}]\n` +
            `1:1 chats: [${oneToOneChats.join(', ')}]\n` +
            `messages in scope: ${msgCount}\n`
        );
      } finally {
        db.close();
      }
    });
  });

program
  .command('setup')
  .description('Stage 0: copy chat.db (and sidecars) into workdir/snapshot/, hash, write provenance.')
  .option('--source-db <path>', 'path to chat.db', DEFAULT_SOURCE_DB)
  .option('--workdir <path>', 'work directory', DEFAULT_WORKDIR)
  .action(async (opts) => {
    await wrap(async () => {
      const res = await runSetup({ sourceDb: opts.sourceDb, workdir: opts.workdir });
      process.stdout.write(
        `snapshot written to ${opts.workdir}/snapshot/\n` +
          `chat.db sha256: ${res.files['chat.db']?.sha256 ?? '(missing)'}\n` +
          `counts: messages=${res.counts.message} handles=${res.counts.handle} chats=${res.counts.chat}\n`
      );
    });
  });

program
  .command('extract')
  .description('Stage 1: extract 1:1 messages + attachments to workdir/messages.jsonl.')
  .option('--workdir <path>', 'work directory', DEFAULT_WORKDIR)
  .option('--config <path>', 'participants.toml', DEFAULT_CONFIG)
  .action(async (opts) => {
    await wrap(async () => {
      const res = await runExtract({ workdir: opts.workdir, config: opts.config });
      process.stdout.write(
        `spouse handles: [${res.spouseHandles.join(', ')}]\n` +
          `1:1 chats: [${res.oneToOneChats.join(', ')}]\n` +
          `messages written: ${res.messagesWritten}\n` +
          `attachments copied: ${res.attachmentsCopied} (missing: ${res.attachmentsMissing})\n`
      );
    });
  });

program
  .command('enrich')
  .description('Stage 2: classify, thread reactions, compute stats.')
  .option('--workdir <path>', 'work directory', DEFAULT_WORKDIR)
  .option('--config <path>', 'participants.toml', DEFAULT_CONFIG)
  .action(async (opts) => {
    await wrap(async () => {
      const res = await runEnrich({ workdir: opts.workdir, config: opts.config });
      process.stdout.write(
        `enriched rows: ${res.enrichedWritten}\n` +
          `reactions threaded onto parents: ${res.reactionsThreaded}\n`
      );
    });
  });

program
  .command('tag')
  .description('Stage 3: launch the SvelteKit tagger UI on 127.0.0.1:<port>.')
  .option('--workdir <path>', 'work directory', DEFAULT_WORKDIR)
  .option('--host <host>', 'bind host', '127.0.0.1')
  .option('--port <port>', 'bind port', '5555')
  .action((opts) => {
    const env = { ...process.env, IMXPORT_WORKDIR: opts.workdir };
    const args = ['exec', 'vite', '--host', opts.host, '--port', String(opts.port)];
    process.stdout.write(`starting tagger on http://${opts.host}:${opts.port}\n`);
    process.stdout.write(`workdir: ${opts.workdir}\n`);
    // spawn pnpm exec vite; inherit stdio so the user sees vite's log
    const { spawn } = require('node:child_process') as typeof import('node:child_process');
    const child = spawn('pnpm', args, { env, stdio: 'inherit' });
    child.on('exit', (code: number | null) => process.exit(code ?? 0));
  });

async function wrap(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    const home = process.env.HOME ?? '';
    return p === '~' ? home : `${home}/${p.slice(2)}`;
  }
  return p;
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
