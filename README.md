# imessage-uscis-exporter-sveltekit

Local, offline macOS tool that exports the iMessage conversation between two people
from `~/Library/Messages/chat.db` and produces USCIS-suitable PDF exhibits plus a
browsable HTML archive.

SvelteKit + TypeScript rewrite of the original Python `imessage-uscis-exporter`.

## Status

Phase 1 only: scaffolding, stages 0–2 (snapshot → extract → enrich), CLI, and the
test fixture. The tagger UI (Phase 2) and the render pipeline (Phase 3) are not
yet implemented.

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
pnpm imxport inspect            # read-only dry-run
pnpm imxport setup              # copy + hash chat.db into workdir/snapshot/
pnpm imxport extract            # build messages.jsonl + workdir/attachments/
pnpm imxport enrich             # classify + thread reactions → enriched.jsonl + stats.json
pnpm imxport tag                # (Phase 2) tagger UI
pnpm imxport select             # (Phase 3)
pnpm imxport render             # (Phase 3)
pnpm imxport verify             # (Phase 3)
```

Defaults: `--source-db ~/Library/Messages/chat.db`, `--workdir workdir`, `--config participants.toml`.

## Tests

```sh
pnpm test
```

Tests run against an in-memory / tmp-dir synthetic chat.db built in
`tests/fixtures/synthetic-chat-db.ts`.

## Privacy

- `participants.toml` is gitignored — it carries real phone numbers and emails.
- `workdir/`, `out/`, `*.jsonl`, and `*.db*` are gitignored — they contain every
  message in plaintext.
