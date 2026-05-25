# Pipeline

Each stage reads the previous stage's artifacts from `workdir/` and writes its own.
Each is independently re-runnable. All artifacts after stage 0 are downstream of
the snapshot SHA-256 in `provenance.json` so provenance is traceable.

```
chat.db ─▶ Stage 0 setup    ─▶ snapshot/ + provenance.json
        ─▶ Stage 1 extract  ─▶ messages.jsonl + attachments/
        ─▶ Stage 2 enrich   ─▶ enriched.jsonl + stats.json
        ─▶ Stage 3 tag      ─▶ tags.json                (Phase 2)
        ─▶ Stage 4 select   ─▶ selected.jsonl + selection_manifest.json   (Phase 3)
        ─▶ Stage 5 render   ─▶ out/exhibit.pdf, out/appendix.pdf, out/archive/  (Phase 3)
        ─▶ Stage 6 verify   ─▶ out/manifest.json + out/README-for-attorney.md   (Phase 3)
```

## Stage 0 — setup

- Copy `chat.db` (+ `chat.db-wal`, `chat.db-shm` if present) into `workdir/snapshot/`.
- SHA-256 each file (streaming).
- Open snapshot DB, count rows in `message`, `handle`, `chat` (sanity).
- Write `workdir/provenance.json`.

## Stage 1 — extract

1. Resolve the spouse's handle ROWIDs by querying `handle.id IN (...)` for every
   phone/email in `participants.toml`. iMessage, SMS, and RCS each create
   separate handle rows — all are unioned.
2. Identify 1:1 chats by computing each chat's handle set via
   `chat_handle_join`; a chat is in-scope iff its non-empty handle set is a
   *subset* of the spouse's resolved handles. (`chat.style` is not trusted.)
3. JOIN `message ⋈ chat_message_join ⋈ handle (LEFT)` for those chats, ordered
   by `(message.date ASC, ROWID ASC)`.
4. Body extraction: prefer `text`. If null and `attributedBody` is non-null,
   decode the typedstream blob anchoring on the `\x84\x01\x2B` instance marker.
5. Resolve attachments via `message_attachment_join → attachment`, expand `~`,
   copy each to `workdir/attachments/<rowid>_<safeName>`. Missing files are
   recorded with `missing: true` instead of failing the run.
6. Cocoa epoch timestamps → ISO-8601 UTC. Magnitude > 1e12 ⇒ nanoseconds.

Output: one JSON object per line in `workdir/messages.jsonl`.

## Stage 2 — enrich

- Pass 1: scan messages, collect reactions (`associated_message_type` 2000–2005
  active, 3000–3005 removed) and thread them onto parents identified by
  `associated_message_guid` (formats: `p:0/<guid>`, `bp:<guid>`, bare `<guid>`).
- Pass 2: emit enriched rows (skipping reactions). Classify each row as
  `text` / `image` / `video` / `audio` / `reaction` / `reply` / `attachment` /
  `unknown`. Replies carry `reply_to_guid`. Edits flagged via `has_edit`.
- Concurrently accumulate `stats.json`: `total_visible`, `by_sender`,
  `by_month` (YYYY-MM UTC), `by_type`, `attachment_count`, `first_date`,
  `last_date`, `longest_gap_days`.

## Phase 2 — tagger UI (Stage 3)

SvelteKit routes + endpoints. Server caches parsed `enriched.jsonl` + `tags.json`
keyed by `(path, mtime, size)`. ETag honors `If-None-Match` for the messages
endpoint. UI is a chat-bubble layout with sticky month headers, chunked
rendering (first 400 immediately, rest in 1500-msg `requestAnimationFrame`
batches with a cancel token), and the `position: static` reflow trick for
scroll-to-month. **Do not** use `content-visibility: auto` on message rows.

## Phase 3 — select / render / verify (Stages 4–6)

Pure-TS selection (tagged + context + monthly slice + dedupe + cap). Render via
Svelte SSR → HTML string → Playwright Chromium `page.pdf`. Verify re-hashes the
snapshot, checks monotonic dates / duplicate guids / attachment presence, and
writes `manifest.json` + the attorney README.
