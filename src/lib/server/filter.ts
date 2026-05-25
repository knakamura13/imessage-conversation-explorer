import type { EnrichedRow } from '../types.js';
import type { TagsMap } from './data.js';

export interface MessageQuery {
  offset: number;
  limit: number;
  q: string;
  regex: boolean;
  filter: string;
  sender: string;
}

const LINK_RE = /https?:\/\//i;

export function parseQuery(url: URL): MessageQuery {
  return {
    offset: clampInt(url.searchParams.get('offset'), 0, 0, 10_000_000),
    limit: clampInt(url.searchParams.get('limit'), 100, 1, 200_000),
    q: url.searchParams.get('q') ?? '',
    regex: url.searchParams.get('regex') === '1' || url.searchParams.get('regex') === 'true',
    filter: url.searchParams.get('filter') ?? '',
    sender: url.searchParams.get('sender') ?? ''
  };
}

function clampInt(raw: string | null, dflt: number, min: number, max: number): number {
  if (raw == null) return dflt;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

export function applyFilter(
  rows: EnrichedRow[],
  tags: TagsMap,
  query: MessageQuery
): { total: number; page: EnrichedRow[] } {
  let re: RegExp | null = null;
  if (query.q.length > 0) {
    try {
      re = new RegExp(query.regex ? query.q : escapeRegex(query.q), 'i');
    } catch {
      re = null;
    }
  }

  const senderFilter = query.sender;
  const f = query.filter;
  const tagFilter = f.startsWith('tag:') ? f.slice(4) : '';

  const matches: EnrichedRow[] = [];
  for (const row of rows) {
    if (senderFilter && row.sender_display !== senderFilter) continue;
    if (re && !rowMatchesText(row, re)) continue;

    const meta = tags[String(row.rowid)];
    const hasTags = (meta?.tags?.length ?? 0) > 0;
    const hasNote = (meta?.note?.length ?? 0) > 0;

    if (f === 'untagged' && (hasTags || hasNote)) continue;
    if (f === 'tagged' && !hasTags && !hasNote) continue;
    if (f === 'has_attachment' && row.attachments.length === 0) continue;
    if (f === 'has_link' && !(row.body && LINK_RE.test(row.body))) continue;
    if (tagFilter && !(meta?.tags ?? []).includes(tagFilter)) continue;

    matches.push(row);
  }

  const page = matches.slice(query.offset, query.offset + query.limit);
  return { total: matches.length, page };
}

function rowMatchesText(row: EnrichedRow, re: RegExp): boolean {
  if (row.body && re.test(row.body)) return true;
  if (row.sender_display && re.test(row.sender_display)) return true;
  if (row.handle_address && re.test(row.handle_address)) return true;
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
