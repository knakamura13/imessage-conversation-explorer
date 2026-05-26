import { describe, expect, it } from 'vitest';
import { buildMonthSeries, type MonthSeries } from '../src/lib/month-series.js';
import type { TaggedRow } from '../src/lib/types-tagger.js';

function msg(date_utc: string | null, sender_display: string, is_from_me = false): TaggedRow {
  return {
    rowid: 0,
    guid: `g-${Math.random()}`,
    date_utc,
    is_from_me,
    handle_address: null,
    service: null,
    body: null,
    raw_text_present: false,
    raw_attributed_body_present: false,
    associated_message_guid: null,
    associated_message_type: null,
    has_summary_info: false,
    attachments: [],
    msg_type: 'text',
    sender_display,
    reactions: [],
    reply_to_guid: null,
    has_edit: false,
    tags: [],
    note: ''
  };
}

describe('buildMonthSeries', () => {
  it('returns [] when no message has a valid date_utc', () => {
    expect(buildMonthSeries([])).toEqual([]);
    expect(buildMonthSeries([msg(null, 'Kyle'), msg(null, 'Sally')])).toEqual([]);
  });

  it('produces a single bucket for a single message', () => {
    const out = buildMonthSeries([msg('2024-05-12T10:00:00Z', 'Kyle')]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Kyle: 1 } }
    ]);
  });

  it('groups multiple senders in the same month', () => {
    const out = buildMonthSeries([
      msg('2024-05-12T10:00:00Z', 'Kyle'),
      msg('2024-05-15T10:00:00Z', 'Sally'),
      msg('2024-05-20T10:00:00Z', 'Kyle')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 3, perSender: { Kyle: 2, Sally: 1 } }
    ]);
  });

  it('fills gap months with zero buckets between min and max', () => {
    const out = buildMonthSeries([
      msg('2024-01-10T10:00:00Z', 'Kyle'),
      msg('2024-03-10T10:00:00Z', 'Sally')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-01', total: 1, perSender: { Kyle: 1 } },
      { month: '2024-02', total: 0, perSender: {} },
      { month: '2024-03', total: 1, perSender: { Sally: 1 } }
    ]);
  });

  it('wraps year boundaries when computing the month range', () => {
    const out = buildMonthSeries([
      msg('2023-12-31T23:59:00Z', 'Kyle'),
      msg('2024-02-01T00:01:00Z', 'Kyle')
    ]);
    expect(out.map((b) => b.month)).toEqual(['2023-12', '2024-01', '2024-02']);
  });

  it('skips messages with null date_utc but still emits the range from valid ones', () => {
    const out = buildMonthSeries([
      msg(null, 'Kyle'),
      msg('2024-05-15T10:00:00Z', 'Kyle'),
      msg(null, 'Sally')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Kyle: 1 } }
    ]);
  });

  it('buckets empty sender_display as "Unknown"', () => {
    const out = buildMonthSeries([msg('2024-05-15T10:00:00Z', '')]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Unknown: 1 } }
    ]);
  });

  it('skips messages whose date_utc.slice(0,7) is not 7 chars (malformed dates)', () => {
    const out = buildMonthSeries([
      msg('bad', 'Kyle'),
      msg('2024-05-15T10:00:00Z', 'Kyle')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Kyle: 1 } }
    ]);
  });
});
