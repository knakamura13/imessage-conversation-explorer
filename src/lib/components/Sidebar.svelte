<script lang="ts">
  let {
    monthCounts,
    senders,
    schema,
    filter,
    sender,
    onJump,
    onJumpToToday,
    onFilter,
    onSender
  }: {
    monthCounts: Array<{ month: string; count: number }>;
    senders: string[];
    schema: readonly string[];
    filter: string;
    sender: string;
    onJump: (month: string) => void;
    onJumpToToday: () => void;
    onFilter: (filter: string) => void;
    onSender: (sender: string) => void;
  } = $props();

  const FILTER_CHIPS: Array<{ value: string; label: string }> = [
    { value: '', label: 'all' },
    { value: 'untagged', label: 'untagged' },
    { value: 'tagged', label: 'tagged' },
    { value: 'has_attachment', label: 'attachment' },
    { value: 'has_link', label: 'has link' }
  ];

  function formatMonth(key: string): string {
    const [y, m] = key.split('-').map((s) => Number.parseInt(s, 10));
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString([], { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
</script>

<aside class="sidebar">
  <section>
    <h3>Filter</h3>
    <div class="chips">
      {#each FILTER_CHIPS as f (f.value)}
        <button
          class="chip"
          class:on={filter === f.value || (f.value === '' && !filter.startsWith('tag:'))}
          onclick={() => onFilter(f.value)}
        >
          {f.label}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>By tag</h3>
    <div class="chips">
      {#each schema as t (t)}
        <button
          class="chip"
          class:on={filter === `tag:${t}`}
          onclick={() => onFilter(filter === `tag:${t}` ? '' : `tag:${t}`)}
        >
          {t}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>Sender</h3>
    <div class="chips">
      <button class="chip" class:on={sender === ''} onclick={() => onSender('')}>any</button>
      {#each senders as s (s)}
        <button class="chip" class:on={sender === s} onclick={() => onSender(sender === s ? '' : s)}
          >{s}</button
        >
      {/each}
    </div>
  </section>

  <section class="months">
    <h3>Jump to month</h3>
    <ol>
      {#each monthCounts as m (m.month)}
        <li>
          <button onclick={() => onJump(m.month)}>
            <span>{formatMonth(m.month)}</span>
            <span class="count">{m.count}</span>
          </button>
        </li>
      {/each}
      <li>
        <button class="today" onclick={onJumpToToday}>
          <span>Today</span>
        </button>
      </li>
    </ol>
  </section>
</aside>

<style>
  .sidebar {
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 16px 12px;
    background: var(--surface);
  }
  section {
    margin-bottom: 18px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    border: 1px solid var(--border);
    background: transparent;
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 11px;
    color: var(--text);
    cursor: pointer;
    line-height: 1.3;
  }
  .chip:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .chip.on {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .months ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .months button {
    display: flex;
    width: 100%;
    align-items: baseline;
    justify-content: space-between;
    border: none;
    background: transparent;
    color: var(--text);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  .months button:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .months .count {
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    font-size: 11px;
  }
</style>
