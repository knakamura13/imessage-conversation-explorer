<script lang="ts">
  let { monthKey, count }: { monthKey: string; count: number } = $props();
  // monthKey: "YYYY-MM"
  const label = $derived(formatMonth(monthKey));

  function formatMonth(key: string): string {
    const [y, m] = key.split('-').map((s) => Number.parseInt(s, 10));
    if (!y || !m) return key;
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString([], { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
</script>

<div class="month-divider" id={`month-${monthKey}`} data-month={monthKey}>
  <span class="label">{label}</span>
  <span class="count">{count}</span>
</div>

<style>
  .month-divider {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    padding: 8px 16px 6px;
    margin-top: 16px;
    display: flex;
    align-items: baseline;
    gap: 10px;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    color: var(--text);
  }
  .label {
    font-size: 13px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .count {
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
