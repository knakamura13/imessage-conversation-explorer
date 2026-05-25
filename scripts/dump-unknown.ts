import { readJsonl } from '../src/lib/jsonl.js';
import type { EnrichedRow } from '../src/lib/types.js';

let n = 0;
for await (const r of readJsonl<EnrichedRow>('workdir/enriched.jsonl')) {
  if (r.msg_type === 'unknown' && n < 5) {
    console.log({
      rowid: r.rowid,
      guid: r.guid,
      date: r.date_utc,
      sender: r.sender_display,
      raw_text: r.raw_text_present,
      raw_attrib: r.raw_attributed_body_present,
      body: r.body,
      attachments: r.attachments.length,
      assoc_type: r.associated_message_type,
      assoc_guid: r.associated_message_guid,
      has_edit: r.has_edit
    });
    n++;
  }
  if (n >= 5) break;
}
