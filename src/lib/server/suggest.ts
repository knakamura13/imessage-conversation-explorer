import type { EnrichedRow } from '../types.js';

const FAMILY_TERMS = [
  'mom',
  'dad',
  'mother',
  'father',
  'family',
  'sister',
  'brother',
  'parents',
  'wedding',
  'marriage',
  'love you',
  'i love',
  'miss you',
  'anniversary'
];

export interface Suggestion {
  rowid: number;
  guid: string;
  reasons: string[];
}

export function suggestRows(rows: EnrichedRow[], cap = 500): Suggestion[] {
  const out: Suggestion[] = [];
  for (const row of rows) {
    const reasons: string[] = [];
    if (row.body && row.body.length > 200) reasons.push('long_message');
    if (row.attachments.length > 0) reasons.push('has_attachment');
    if (row.body) {
      const lc = row.body.toLowerCase();
      if (FAMILY_TERMS.some((t) => lc.includes(t))) reasons.push('family_term');
    }
    if (reasons.length > 0) {
      out.push({ rowid: row.rowid, guid: row.guid, reasons });
      if (out.length >= cap) break;
    }
  }
  return out;
}
