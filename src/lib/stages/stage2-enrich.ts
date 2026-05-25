import { writeFile } from 'node:fs/promises';
import { readJsonl, writeJsonl } from '../jsonl.js';
import { workdirLayout } from '../paths.js';
import { loadParticipants } from '../config.js';
import type {
  EnrichedRow,
  MessageRow,
  MsgType,
  ParticipantsConfig,
  Reaction,
  ReactionKind,
  Stats
} from '../types.js';

export interface EnrichOptions {
  workdir: string;
  config: string;
}

export interface EnrichResult {
  enrichedWritten: number;
  reactionsThreaded: number;
}

const REACTION_TYPES: Record<number, ReactionKind> = {
  2000: 'love',
  2001: 'like',
  2002: 'dislike',
  2003: 'laugh',
  2004: 'emphasis',
  2005: 'question',
  3000: 'love',
  3001: 'like',
  3002: 'dislike',
  3003: 'laugh',
  3004: 'emphasis',
  3005: 'question'
};

export function parseAssociatedGuid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('p:0/')) return raw.slice(4);
  if (raw.startsWith('bp:')) return raw.slice(3);
  return raw;
}

export async function runEnrich({ workdir, config }: EnrichOptions): Promise<EnrichResult> {
  const layout = workdirLayout(workdir);
  const cfg = loadParticipants(config);

  // Pass 1: collect reactions keyed by parent guid.
  const reactionsByGuid = new Map<string, Reaction[]>();
  for await (const row of readJsonl<MessageRow>(layout.messagesJsonl)) {
    const type = row.associated_message_type;
    if (type == null) continue;
    if (!(type in REACTION_TYPES)) continue;
    const parent = parseAssociatedGuid(row.associated_message_guid);
    if (!parent) continue;
    const reaction: Reaction = {
      rowid: row.rowid,
      guid: row.guid,
      kind: REACTION_TYPES[type],
      from_me: row.is_from_me,
      date_utc: row.date_utc,
      removed: type >= 3000
    };
    const arr = reactionsByGuid.get(parent);
    if (arr) arr.push(reaction);
    else reactionsByGuid.set(parent, [reaction]);
  }

  // Pass 2: emit enriched rows and accumulate stats.
  const stats: Stats = {
    total_visible: 0,
    by_sender: {},
    by_month: {},
    by_type: {},
    attachment_count: 0,
    first_date: null,
    last_date: null,
    longest_gap_days: 0
  };

  let prevMs: number | null = null;
  let reactionsThreaded = 0;

  async function* enrichedStream(): AsyncIterable<EnrichedRow> {
    for await (const row of readJsonl<MessageRow>(layout.messagesJsonl)) {
      const type = row.associated_message_type;
      if (type != null && type in REACTION_TYPES) {
        // Reaction — folded onto parent, not emitted standalone.
        continue;
      }
      const enriched = enrichOne(row, cfg, reactionsByGuid);
      reactionsThreaded += enriched.reactions.length;
      accumulateStats(stats, enriched);
      const ms = enriched.date_utc ? Date.parse(enriched.date_utc) : null;
      if (ms != null) {
        if (prevMs != null) {
          const gap = (ms - prevMs) / 86_400_000;
          if (gap > stats.longest_gap_days) stats.longest_gap_days = gap;
        }
        prevMs = ms;
      }
      yield enriched;
    }
  }

  const enrichedWritten = await writeJsonl(layout.enrichedJsonl, enrichedStream());
  stats.longest_gap_days = Math.floor(stats.longest_gap_days);
  await writeFile(layout.statsJson, JSON.stringify(stats, null, 2) + '\n', 'utf-8');

  return { enrichedWritten, reactionsThreaded };
}

function enrichOne(
  row: MessageRow,
  cfg: ParticipantsConfig,
  reactionsByGuid: Map<string, Reaction[]>
): EnrichedRow {
  const msg_type = classify(row);
  const sender_display = row.is_from_me ? cfg.me.display_name : cfg.spouse.display_name;
  const reactions = reactionsByGuid.get(row.guid) ?? [];
  const reply_to_guid =
    msg_type === 'reply' ? parseAssociatedGuid(row.associated_message_guid) : null;
  const has_edit = row.has_summary_info;
  return { ...row, msg_type, sender_display, reactions, reply_to_guid, has_edit };
}

function classify(row: MessageRow): MsgType {
  const t = row.associated_message_type;
  if (t != null && t in REACTION_TYPES) return 'reaction';
  if (row.associated_message_guid != null && t === 0) return 'reply';
  if (row.attachments.length > 0) {
    const mime = row.attachments[0].mime_type ?? '';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'attachment';
  }
  if (row.body != null) return 'text';
  return 'unknown';
}

function accumulateStats(stats: Stats, row: EnrichedRow): void {
  stats.total_visible++;
  stats.by_sender[row.sender_display] = (stats.by_sender[row.sender_display] ?? 0) + 1;
  stats.by_type[row.msg_type] = (stats.by_type[row.msg_type] ?? 0) + 1;
  if (row.attachments.length > 0) stats.attachment_count += row.attachments.length;
  if (row.date_utc) {
    const ym = row.date_utc.slice(0, 7); // YYYY-MM
    stats.by_month[ym] = (stats.by_month[ym] ?? 0) + 1;
    if (stats.first_date == null || row.date_utc < stats.first_date) stats.first_date = row.date_utc;
    if (stats.last_date == null || row.date_utc > stats.last_date) stats.last_date = row.date_utc;
  }
}
