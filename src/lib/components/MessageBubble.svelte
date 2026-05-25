<script lang="ts">
  import type { TaggedRow } from '$lib/types-tagger.js';
  import AppliedTagBadge from './AppliedTagBadge.svelte';
  import TagChipStrip from './TagChipStrip.svelte';

  let {
    row,
    parentBody,
    schema,
    focused,
    onToggleTag,
    onFocus
  }: {
    row: TaggedRow;
    parentBody: string | null;
    schema: readonly string[];
    focused: boolean;
    onToggleTag: (rowid: number, tag: string) => void;
    onFocus: (rowid: number) => void;
  } = $props();

  const time = $derived(formatTime(row.date_utc));
  const images = $derived(
    row.attachments.filter((a) => !a.missing && (a.mime_type ?? '').startsWith('image/'))
  );
  // Missing image attachments still surface as file badges so the bubble isn't empty.
  const otherFiles = $derived(
    row.attachments.filter((a) => a.missing || !((a.mime_type ?? '').startsWith('image/')))
  );

  function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function attachmentName(p: string | null): string {
    if (!p) return '';
    const i = p.lastIndexOf('/');
    return i === -1 ? p : p.slice(i + 1);
  }

  const REACTION_GLYPH: Record<string, string> = {
    love: '❤',
    like: '👍',
    dislike: '👎',
    laugh: '😂',
    emphasis: '‼',
    question: '?'
  };
  function reactionGlyph(kind: string): string {
    return REACTION_GLYPH[kind] ?? kind;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="msg"
  class:from-me={row.is_from_me}
  class:from-other={!row.is_from_me}
  class:focused
  data-rowid={row.rowid}
  data-guid={row.guid}
  role="listitem"
  tabindex="-1"
  onmouseenter={() => onFocus(row.rowid)}
>
  <div class="meta">
    <span class="sender">{row.sender_display}</span>
    <span class="time">{time}</span>
<!-- has_edit suppressed: message_summary_info is set for many non-edit reasons.
       Decoding the typedstream to confirm a real edit is Phase 3 work. -->
  </div>

  {#if parentBody}
    <div class="reply-quote" title="replying to">↳ {parentBody}</div>
  {/if}

  <div class="bubble">
    {#if row.body}
      <div class="body">{row.body}</div>
    {:else if row.msg_type === 'unknown'}
      <div class="body muted">[empty message]</div>
    {/if}

    {#if images.length > 0}
      <div class="images" class:single={images.length === 1}>
        {#each images as a (a.rowid)}
          <img
            src={`/attachments/${attachmentName(a.local_path)}`}
            alt={a.transfer_name ?? 'attachment'}
            loading="lazy"
            decoding="async"
            width="240"
            height="240"
          />
        {/each}
      </div>
    {/if}

    {#if otherFiles.length > 0}
      <div class="files">
        {#each otherFiles as a (a.rowid)}
          <span class="file" class:missing={a.missing}>
            📎 {a.transfer_name ?? '(unnamed)'}
            {#if a.missing}<span class="muted">(missing)</span>{/if}
          </span>
        {/each}
      </div>
    {/if}

    {#if row.reactions.length > 0}
      <div class="reactions">
        {#each row.reactions as r (r.rowid)}
          <span class="reaction" class:removed={r.removed} title={r.removed ? `removed ${r.kind}` : r.kind}>
            {reactionGlyph(r.kind)}
          </span>
        {/each}
      </div>
    {/if}
  </div>

  {#if row.tags.length > 0 || row.note}
    <div class="applied">
      {#each row.tags as t (t)}<AppliedTagBadge tag={t} />{/each}
      {#if row.note}<span class="note-indicator" title={row.note}>📝</span>{/if}
    </div>
  {/if}

  <div class="chip-strip">
    <TagChipStrip {schema} applied={row.tags} onToggle={(t) => onToggleTag(row.rowid, t)} />
  </div>
</div>


<style>
  .msg {
    --bubble-bg-me: #2e6cdf;
    --bubble-bg-other: #2a2f37;
    --bubble-fg-me: #ffffff;
    --bubble-fg-other: #f3f4f6;

    display: grid;
    grid-template-columns: 1fr;
    padding: 4px 16px 4px;
    cursor: pointer;
    position: relative;
  }
  .msg.from-me {
    justify-items: end;
  }
  .msg.from-other {
    justify-items: start;
  }
  .msg.focused {
    background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent);
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    margin: 2px 6px 1px;
  }
  .sender {
    font-weight: 600;
  }
  .reply-quote {
    max-width: min(560px, 70%);
    padding: 4px 10px;
    border-left: 3px solid var(--text-muted);
    background: color-mix(in srgb, var(--text-muted) 14%, transparent);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bubble {
    max-width: min(560px, 75%);
    padding: 8px 12px;
    border-radius: 18px;
    line-height: 1.35;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    position: relative;
  }
  .from-me .bubble {
    background: var(--bubble-bg-me);
    color: var(--bubble-fg-me);
    border-bottom-right-radius: 4px;
  }
  .from-other .bubble {
    background: var(--bubble-bg-other);
    color: var(--bubble-fg-other);
    border-bottom-left-radius: 4px;
  }
  .body {
    white-space: pre-wrap;
  }
  .body.muted {
    opacity: 0.55;
    font-style: italic;
  }

  .images {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    margin-top: 6px;
    max-width: 480px;
  }
  .images.single {
    grid-template-columns: minmax(0, 1fr);
    max-width: 320px;
  }
  .images img {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.08);
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 6px;
    font-size: 12px;
  }
  .file.missing {
    opacity: 0.6;
    text-decoration: line-through;
  }
  .muted {
    color: var(--text-muted);
    font-size: 11px;
    margin-left: 4px;
  }

  .reactions {
    position: absolute;
    top: -10px;
    display: flex;
    gap: 2px;
  }
  .from-me .reactions {
    left: -8px;
  }
  .from-other .reactions {
    right: -8px;
  }
  .reaction {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 6px;
    font-size: 10px;
    line-height: 1.2;
    color: var(--text);
  }
  .reaction.removed {
    opacity: 0.5;
    text-decoration: line-through;
  }

  .applied {
    display: flex;
    gap: 4px;
    margin-top: 3px;
    align-items: center;
  }
  .from-me .applied {
    justify-content: flex-end;
  }
  .note-indicator {
    font-size: 12px;
  }

  /* Tag-chip strip: hidden by default; revealed on hover/focus/selected. */
  .chip-strip {
    display: none;
    max-width: min(560px, 75%);
  }
  .msg:hover .chip-strip,
  .msg.focused .chip-strip {
    display: block;
  }
  /* Right-align the chip strip's contents under from-me bubbles. */
  .from-me .chip-strip :global(.strip) {
    justify-content: flex-end;
  }
</style>
