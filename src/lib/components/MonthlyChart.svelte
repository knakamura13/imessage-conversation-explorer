<script lang="ts">
  import type { MonthSeries } from '$lib/month-series.js';

  let {
    series,
    senders,
    onJump
  }: {
    series: MonthSeries;
    senders: string[];
    onJump: (month: string) => void;
  } = $props();

  // --- sender ordering ------------------------------------------------------
  // Conversation-wide senders come first (stable), then any keys that
  // appeared in series but weren't in the conversation list (e.g. 'Unknown').
  const chartSenders = $derived.by<string[]>(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const s of senders) {
      if (!seen.has(s)) {
        seen.add(s);
        ordered.push(s);
      }
    }
    for (const bucket of series) {
      for (const k of Object.keys(bucket.perSender)) {
        if (!seen.has(k)) {
          seen.add(k);
          ordered.push(k);
        }
      }
    }
    return ordered;
  });

  // --- geometry -------------------------------------------------------------
  const VB_W = 1000;          // viewBox width (scales to container width)
  const VB_H = 100;           // viewBox bar area height
  const GUTTER = 1;           // gap between bars in viewBox units

  const maxTotal = $derived(series.reduce((m, b) => (b.total > m ? b.total : m), 0));
  const slotWidth = $derived(series.length > 0 ? VB_W / series.length : 0);
  const barWidth = $derived(Math.max(0, slotWidth - GUTTER));

  // --- hover state ----------------------------------------------------------
  let hoveredIndex = $state<number | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  let containerEl = $state<HTMLElement | null>(null);

  function colorFor(senderIdx: number): string {
    return `var(--chart-c${(senderIdx % 6) + 1})`;
  }

  function formatMonth(key: string): string {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7));
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString([], { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function ariaLabelFor(bucket: MonthSeries[number]): string {
    if (bucket.total === 0) return `${formatMonth(bucket.month)}, no messages`;
    const parts = chartSenders
      .filter((s) => (bucket.perSender[s] ?? 0) > 0)
      .map((s) => `${s} ${bucket.perSender[s]}`);
    return `${formatMonth(bucket.month)}, ${bucket.total} messages (${parts.join(', ')}). Click to jump.`;
  }

  function handleEnter(i: number, evt: MouseEvent | FocusEvent): void {
    hoveredIndex = i;
    positionTooltipFromEvent(evt);
  }

  function handleLeave(): void {
    hoveredIndex = null;
  }

  function positionTooltipFromEvent(evt: MouseEvent | FocusEvent): void {
    if (!containerEl) return;
    const target = evt.currentTarget as Element | null;
    if (!target) return;
    const targetBox = target.getBoundingClientRect();
    const containerBox = containerEl.getBoundingClientRect();
    // Center horizontally on the bar, anchor to its top.
    tooltipX = targetBox.left - containerBox.left + targetBox.width / 2;
    tooltipY = targetBox.top - containerBox.top;
  }

  // X-axis: first / middle / last month labels
  const labelTicks = $derived.by<Array<{ x: number; text: string }>>(() => {
    if (series.length === 0) return [];
    if (series.length === 1) {
      return [{ x: slotWidth / 2, text: formatMonth(series[0].month) }];
    }
    const midIdx = Math.floor((series.length - 1) / 2);
    return [
      { x: slotWidth / 2, text: formatMonth(series[0].month) },
      { x: midIdx * slotWidth + slotWidth / 2, text: formatMonth(series[midIdx].month) },
      {
        x: (series.length - 1) * slotWidth + slotWidth / 2,
        text: formatMonth(series[series.length - 1].month)
      }
    ];
  });

  // --- per-bar segment layout (precomputed for clarity in the template) ----
  type Segment = { y: number; height: number; color: string; sender: string };
  function segmentsFor(bucketIdx: number): Segment[] {
    const bucket = series[bucketIdx];
    if (!bucket || bucket.total === 0 || maxTotal === 0) return [];
    const barHeight = (bucket.total / maxTotal) * VB_H;
    let yCursor = VB_H - barHeight;
    const out: Segment[] = [];
    chartSenders.forEach((sender, idx) => {
      const count = bucket.perSender[sender] ?? 0;
      if (count === 0) return;
      const segH = (count / bucket.total) * barHeight;
      out.push({ y: yCursor, height: segH, color: colorFor(idx), sender });
      yCursor += segH;
    });
    return out;
  }
</script>

<div class="chart" bind:this={containerEl}>
  {#if series.length === 0}
    <div class="empty">No messages match the current filter.</div>
  {:else}
    <svg
      class="bars"
      viewBox={`0 0 ${VB_W} ${VB_H + 16}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Messages per month, stacked by sender"
    >
      {#each series as bucket, i (bucket.month)}
        {@const segs = segmentsFor(i)}
        {@const slotX = i * slotWidth}
        <!-- Hit target: full slot width, full chart height, transparent -->
        <g
          class="slot"
          class:has-data={bucket.total > 0}
          onmouseenter={(e) => handleEnter(i, e)}
          onmouseleave={handleLeave}
          onfocus={(e) => handleEnter(i, e)}
          onblur={handleLeave}
          onclick={() => onJump(bucket.month)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onJump(bucket.month);
            }
          }}
          tabindex={bucket.total > 0 ? 0 : -1}
          role="button"
          aria-label={ariaLabelFor(bucket)}
        >
          <rect x={slotX} y="0" width={slotWidth} height={VB_H} class="hit" />
          {#each segs as s, j (j)}
            <rect
              x={slotX + GUTTER / 2}
              y={s.y}
              width={barWidth}
              height={s.height}
              fill={s.color}
              class="seg"
            />
          {/each}
        </g>
      {/each}

      {#each labelTicks as tick, i (i)}
        <text
          x={tick.x}
          y={VB_H + 12}
          class="tick"
          text-anchor={i === 0 ? 'start' : i === labelTicks.length - 1 ? 'end' : 'middle'}
        >{tick.text}</text>
      {/each}
    </svg>

    {#if hoveredIndex !== null}
      {@const b = series[hoveredIndex]}
      <div
        class="tooltip"
        style="left: {tooltipX}px; top: {tooltipY}px;"
        role="tooltip"
      >
        <div class="t-month">{formatMonth(b.month)}</div>
        {#if b.total === 0}
          <div class="t-zero">No messages</div>
        {:else}
          {#each chartSenders as sender, idx (sender)}
            {#if (b.perSender[sender] ?? 0) > 0}
              <div class="t-row">
                <span class="swatch" style="background: {colorFor(idx)}"></span>
                <span class="t-name">{sender}</span>
                <span class="t-count">{b.perSender[sender]}</span>
              </div>
            {/if}
          {/each}
          <div class="t-total">
            <span class="t-name">Total</span>
            <span class="t-count">{b.total}</span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart {
    --chart-c1: var(--accent);
    --chart-c2: #d97757;
    --chart-c3: #6a8e23;
    --chart-c4: #c45a8b;
    --chart-c5: #6f5e9e;
    --chart-c6: #d4a73c;

    position: relative;
    width: 100%;
    height: 100%;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 12px;
  }

  .bars {
    width: 100%;
    height: 100%;
    display: block;
  }

  .slot .hit {
    fill: transparent;
    cursor: default;
  }
  .slot.has-data .hit {
    cursor: pointer;
  }
  .slot:focus {
    outline: none;
  }
  .slot:focus-visible .hit {
    fill: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .slot.has-data:hover .hit {
    fill: color-mix(in srgb, var(--text) 6%, transparent);
  }

  .seg {
    pointer-events: none;
  }

  .tick {
    font-size: 9px;
    fill: var(--text-muted);
    font-family: inherit;
  }

  .tooltip {
    position: absolute;
    transform: translate(-50%, calc(-100% - 8px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
    color: var(--text);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    pointer-events: none;
    white-space: nowrap;
    z-index: 5;
  }

  .t-month {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .t-row,
  .t-total {
    display: grid;
    grid-template-columns: 12px 1fr auto;
    align-items: center;
    gap: 6px;
    line-height: 1.4;
  }
  .t-total {
    grid-template-columns: 1fr auto;
    border-top: 1px solid var(--border);
    margin-top: 3px;
    padding-top: 3px;
    color: var(--text-muted);
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  .t-count {
    font-variant-numeric: tabular-nums;
  }
  .t-zero {
    color: var(--text-muted);
    font-size: 10px;
  }
</style>
