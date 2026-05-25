import { existsSync } from 'node:fs';
import type { PageServerLoad } from './$types.js';
import { loadEnriched, loadStats, loadTags } from '$lib/server/data.js';
import { layout } from '$lib/server/workdir.js';
import { DEFAULT_TAG_SCHEMA } from '$lib/tag-schema.js';
import type { EnrichedRow, Stats } from '$lib/types.js';

export interface InitialPayload {
  ready: boolean;
  reason?: string;
  workdir: string;
  stats: Stats | null;
  tag_schema: readonly string[];
  senders: string[];
  total_messages: number;
}

export const load: PageServerLoad = async (): Promise<InitialPayload> => {
  const l = layout();
  if (!existsSync(l.enrichedJsonl)) {
    return {
      ready: false,
      reason: `workdir/enriched.jsonl not found at ${l.enrichedJsonl}. Run \`pnpm imessage-explorer enrich\` first.`,
      workdir: l.workdir,
      stats: null,
      tag_schema: DEFAULT_TAG_SCHEMA,
      senders: [],
      total_messages: 0
    };
  }
  const [enriched, stats] = await Promise.all([loadEnriched(), loadStats().catch(() => null)]);
  // Make sure tags load doesn't throw on a fresh workdir
  await loadTags().catch(() => null);

  const senderSet = new Set<string>();
  for (const row of enriched.value) if (row.sender_display) senderSet.add(row.sender_display);

  return {
    ready: true,
    workdir: l.workdir,
    stats: stats?.value ?? null,
    tag_schema: DEFAULT_TAG_SCHEMA,
    senders: Array.from(senderSet),
    total_messages: enriched.value.length
  };
};

// Make typed `EnrichedRow` available to client without re-importing from server.
export type { EnrichedRow };
