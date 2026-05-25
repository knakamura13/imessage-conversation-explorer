<script lang="ts">
  let {
    open,
    rowid,
    sender,
    bodyPreview,
    initial,
    onSave,
    onClose
  }: {
    open: boolean;
    rowid: number | null;
    sender: string;
    bodyPreview: string;
    initial: string;
    onSave: (note: string) => void;
    onClose: () => void;
  } = $props();

  let draft = $state('');
  let textarea = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    if (open) {
      draft = initial;
      // focus after the DOM settles
      queueMicrotask(() => textarea?.focus());
    }
  });

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave(draft);
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={onClose}></div>
  <div class="dialog" role="dialog" aria-label="Edit note">
    <header>
      <div>
        <span class="rowid">#{rowid ?? '-'}</span>
        <span class="sender">{sender}</span>
      </div>
      <button class="close" onclick={onClose} aria-label="close">×</button>
    </header>
    <div class="preview">{bodyPreview}</div>
    <textarea
      bind:this={textarea}
      bind:value={draft}
      onkeydown={onKey}
      rows="6"
      placeholder="Notes for this message (saved to tags.json under this rowid)…"
    ></textarea>
    <footer>
      <span class="hint">Cmd/Ctrl+Enter to save · Esc to cancel</span>
      <div>
        <button onclick={onClose}>Cancel</button>
        <button class="primary" onclick={() => onSave(draft)}>Save</button>
      </div>
    </footer>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
  }
  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, 90vw);
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 18px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    z-index: 101;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .rowid {
    color: var(--text-muted);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    margin-right: 8px;
  }
  .sender {
    font-weight: 600;
    font-size: 13px;
  }
  .preview {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    color: var(--text-muted);
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    padding: 8px 10px;
    font: inherit;
    resize: vertical;
    min-height: 96px;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .hint {
    font-size: 11px;
    color: var(--text-muted);
  }
  button {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
  }
  button.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    margin-left: 6px;
  }
  .close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    line-height: 1;
    padding: 0 4px;
  }
</style>
