<script lang="ts">
  import { tagColor } from '$lib/tag-schema.js';

  let {
    schema,
    applied,
    onToggle
  }: {
    schema: readonly string[];
    applied: string[];
    onToggle: (tag: string) => void;
  } = $props();

  const appliedSet = $derived(new Set(applied));
</script>

<div class="strip" role="group" aria-label="tag chips">
  {#each schema as tag, i (tag)}
    <button
      type="button"
      class="chip"
      class:on={appliedSet.has(tag)}
      style:--c={tagColor(tag)}
      onclick={(e) => {
        e.stopPropagation();
        onToggle(tag);
      }}
      title={`Toggle ${tag} (${i + 1})`}
    >
      <span class="num">{i + 1}</span>
      <span class="label">{tag}</span>
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--c);
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    line-height: 1.3;
    transition: background-color 60ms ease;
  }
  .chip:hover {
    background: color-mix(in srgb, var(--c) 18%, transparent);
  }
  .chip.on {
    background: var(--c);
    color: white;
    border-color: var(--c);
  }
  .num {
    font-variant-numeric: tabular-nums;
    opacity: 0.65;
    font-size: 10px;
  }
  .chip.on .num {
    opacity: 0.85;
  }
</style>
