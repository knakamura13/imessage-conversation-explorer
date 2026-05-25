<script lang="ts">
  import type { Suggestion } from '$lib/types-tagger.js';

  let {
    open,
    loading,
    suggestions,
    schema,
    onApply,
    onClose
  }: {
    open: boolean;
    loading: boolean;
    suggestions: Suggestion[];
    schema: readonly string[];
    onApply: (rowids: number[], tag: string) => void;
    onClose: () => void;
  } = $props();

  let chosenTag = $state<string>('milestone');
  let selected = $state<Set<number>>(new Set());

  $effect(() => {
    if (open) selected = new Set(suggestions.map((s) => s.rowid));
  });

  function toggle(rowid: number): void {
    const n = new Set(selected);
    if (n.has(rowid)) n.delete(rowid);
    else n.add(rowid);
    selected = n;
  }

  function selectAll(): void {
    selected = new Set(suggestions.map((s) => s.rowid));
  }
  function selectNone(): void {
    selected = new Set();
  }

  function apply(): void {
    onApply(Array.from(selected), chosenTag);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={onClose}></div>
  <div class="dialog" role="dialog" aria-label="Suggested candidates">
    <header>
      <h2>Suggested candidates</h2>
      <button class="close" onclick={onClose} aria-label="close">×</button>
    </header>

    {#if loading}
      <div class="status">Loading suggestions…</div>
    {:else if suggestions.length === 0}
      <div class="status">No candidates matched the heuristics.</div>
    {:else}
      <div class="meta">
        <span>{selected.size} of {suggestions.length} selected</span>
        <button onclick={selectAll}>All</button>
        <button onclick={selectNone}>None</button>
        <label>
          tag:
          <select bind:value={chosenTag}>
            {#each schema as t (t)}<option value={t}>{t}</option>{/each}
          </select>
        </label>
        <button class="primary" disabled={selected.size === 0} onclick={apply}>
          Apply to {selected.size}
        </button>
      </div>
      <ul class="list">
        {#each suggestions as s (s.rowid)}
          <li class:on={selected.has(s.rowid)}>
            <label>
              <input type="checkbox" checked={selected.has(s.rowid)} onchange={() => toggle(s.rowid)} />
              <span class="rowid">#{s.rowid}</span>
              <span class="reasons">{s.reasons.join(', ')}</span>
            </label>
          </li>
        {/each}
      </ul>
    {/if}
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
    width: min(640px, 92vw);
    max-height: 80vh;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 18px;
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
  .status {
    color: var(--text-muted);
    padding: 12px 0;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }
  .meta button,
  .meta select {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    cursor: pointer;
  }
  .meta button.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .meta button.primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    max-height: 50vh;
  }
  .list li {
    border-bottom: 1px solid var(--border-soft, var(--border));
  }
  .list label {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 0;
    font-size: 12px;
    cursor: pointer;
  }
  .rowid {
    color: var(--text-muted);
    font-family: ui-monospace, monospace;
  }
  .reasons {
    color: var(--accent);
  }
</style>
