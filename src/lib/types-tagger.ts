import type { EnrichedRow } from './types.js';

// Server-decorated row: the enriched row plus the tag/note metadata merged in
// from tags.json (so the client doesn't need a second lookup).
export interface TaggedRow extends EnrichedRow {
  tags: string[];
  note: string;
}

export interface MessagesPayload {
  offset: number;
  limit: number;
  total: number;
  tag_schema: readonly string[];
  messages: TaggedRow[];
}

export interface Suggestion {
  rowid: number;
  guid: string;
  reasons: string[];
}
