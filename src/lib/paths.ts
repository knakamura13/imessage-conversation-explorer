import { join } from 'node:path';

export interface WorkdirLayout {
  workdir: string;
  snapshot: string;
  snapshotDb: string;
  snapshotWal: string;
  snapshotShm: string;
  attachments: string;
  messagesJsonl: string;
  enrichedJsonl: string;
  statsJson: string;
  provenanceJson: string;
  tagsJson: string;
  selectedJsonl: string;
  selectionManifestJson: string;
}

export function workdirLayout(workdir: string): WorkdirLayout {
  return {
    workdir,
    snapshot: join(workdir, 'snapshot'),
    snapshotDb: join(workdir, 'snapshot', 'chat.db'),
    snapshotWal: join(workdir, 'snapshot', 'chat.db-wal'),
    snapshotShm: join(workdir, 'snapshot', 'chat.db-shm'),
    attachments: join(workdir, 'attachments'),
    messagesJsonl: join(workdir, 'messages.jsonl'),
    enrichedJsonl: join(workdir, 'enriched.jsonl'),
    statsJson: join(workdir, 'stats.json'),
    provenanceJson: join(workdir, 'provenance.json'),
    tagsJson: join(workdir, 'tags.json'),
    selectedJsonl: join(workdir, 'selected.jsonl'),
    selectionManifestJson: join(workdir, 'selection_manifest.json')
  };
}

export const DEFAULT_SOURCE_DB = '~/Library/Messages/chat.db';
export const DEFAULT_WORKDIR = 'workdir';
export const DEFAULT_CONFIG = 'participants.toml';

export function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    const home = process.env.HOME ?? '';
    return p === '~' ? home : join(home, p.slice(2));
  }
  return p;
}
