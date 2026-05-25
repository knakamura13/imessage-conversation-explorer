<script lang="ts">
  let { open, onClose }: { open: boolean; onClose: () => void } = $props();

  const SHORTCUTS: Array<{ keys: string; what: string }> = [
    { keys: 'j / ↓', what: 'next message' },
    { keys: 'k / ↑', what: 'previous message' },
    { keys: '1 – 8', what: 'apply tag #N to focused message' },
    { keys: 'n', what: 'open note editor on focused message' },
    { keys: '/', what: 'focus search' },
    { keys: 'g', what: 'jump to YYYY-MM' },
    { keys: '?', what: 'help' },
    { keys: 'esc', what: 'close overlay' }
  ];
</script>

{#if open}
  <div class="scrim" onclick={onClose} role="presentation"></div>
  <div class="overlay" role="dialog" aria-label="Keyboard shortcuts">
    <header>
      <h2>Keyboard shortcuts</h2>
      <button class="close" onclick={onClose} aria-label="close">×</button>
    </header>
    <dl>
      {#each SHORTCUTS as s (s.keys)}
        <dt>{s.keys}</dt>
        <dd>{s.what}</dd>
      {/each}
    </dl>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
  }
  .overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px 24px;
    min-width: 360px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    z-index: 101;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-size: 14px;
  }
  .close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 16px;
    row-gap: 4px;
    margin: 0;
    font-size: 13px;
  }
  dt {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent);
  }
  dd {
    margin: 0;
    color: var(--text);
  }
</style>
