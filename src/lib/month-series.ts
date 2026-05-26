import type { TaggedRow } from './types-tagger.js';

export interface MonthBucket {
  month: string;
  total: number;
  perSender: Record<string, number>;
}

export type MonthSeries = MonthBucket[];

export function buildMonthSeries(messages: TaggedRow[]): MonthSeries {
  const counts = new Map<string, { total: number; perSender: Record<string, number> }>();
  let minMonth: string | null = null;
  let maxMonth: string | null = null;

  for (const row of messages) {
    if (!row.date_utc) continue;
    const ym = row.date_utc.slice(0, 7);
    if (ym.length !== 7) continue;
    const sender = row.sender_display || 'Unknown';
    let bucket = counts.get(ym);
    if (!bucket) {
      bucket = { total: 0, perSender: {} };
      counts.set(ym, bucket);
    }
    bucket.total += 1;
    bucket.perSender[sender] = (bucket.perSender[sender] ?? 0) + 1;
    if (minMonth === null || ym < minMonth) minMonth = ym;
    if (maxMonth === null || ym > maxMonth) maxMonth = ym;
  }

  if (minMonth === null || maxMonth === null) return [];

  const out: MonthSeries = [];
  let cur = minMonth;
  while (cur <= maxMonth) {
    const bucket = counts.get(cur);
    out.push({
      month: cur,
      total: bucket?.total ?? 0,
      perSender: bucket?.perSender ?? {}
    });
    cur = nextMonth(cur);
  }
  return out;
}

function nextMonth(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
