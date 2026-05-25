# iMessage Conversation Explorer

Local, offline macOS tool for searching and tagging your iMessage history with a
specific person — extracted from `~/Library/Messages/chat.db` and served as a
chat-bubble timeline you can search, filter, jump through by month, and tag.

SvelteKit + TypeScript. No network calls; everything runs locally.

## Requirements

- macOS (only place `chat.db` lives)
- Node.js ≥ 20
- pnpm

## Setup

```sh
pnpm install
cp participants.toml.example participants.toml
# edit participants.toml with real phone numbers / emails (it is gitignored)
```

## CLI

```sh
pnpm imessage-explorer inspect    # read-only dry-run: confirm participants.toml matches the DB
pnpm imessage-explorer setup      # copy + hash chat.db into workdir/snapshot/
pnpm imessage-explorer extract    # build messages.jsonl + copy attachments
pnpm imessage-explorer enrich     # classify + thread reactions → enriched.jsonl + stats.json
pnpm imessage-explorer tag        # launch the tagger UI on http://127.0.0.1:5555
```

Defaults: `--source-db ~/Library/Messages/chat.db`, `--workdir workdir`,
`--config participants.toml`.

## Tagger UI

- Chat-bubble timeline with sticky month headers and a jump-to-month sidebar.
- Search bar (substring or regex) — server-side filter, then chunked rendering.
- Filter chips: untagged / tagged / has-attachment / has-link / by-tag / by-sender.
- 8-tag schema (`milestone`, `daily_life`, `family`, `planning`, `finances`,
  `travel`, `affection`, `conflict_resolution`) plus per-message free-form notes.
- Keyboard: `j`/`k` navigate, `1`–`8` tag the focused message, `n` open note
  editor, `/` focus search, `g` jump to YYYY-MM, `?` help, `esc` close overlay.
- Tags + notes persist to `workdir/tags.json` (atomic write).
- Theme follows `prefers-color-scheme`; the header button cycles auto/light/dark.

## Tests

```sh
pnpm test
```

Tests run against a synthetic chat.db built in
[tests/fixtures/synthetic-chat-db.ts](tests/fixtures/synthetic-chat-db.ts).

## Privacy

- `participants.toml` is gitignored — it carries real phone numbers and emails.
- `workdir/`, `*.jsonl`, and `*.db*` are gitignored — they contain every
  message in plaintext.
