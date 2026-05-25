<script lang="ts">
  import { tagColor } from '$lib/tag-schema.js';
  let { tag }: { tag: string } = $props();
</script>

<span class="badge" style:background-color={tagColor(tag)} title={tag}>{tag}</span>

<style>
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    color: white;
    line-height: 1.4;
    letter-spacing: 0.01em;
    text-transform: lowercase;
    white-space: nowrap;
  }
</style>
