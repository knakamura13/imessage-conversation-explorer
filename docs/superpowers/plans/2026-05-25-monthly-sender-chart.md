# Monthly Messages-by-Sender Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive stacked-bar chart above the message thread that shows messages-per-month-per-sender for the current filter view, with a hover tooltip and click-to-jump-month interaction.

**Architecture:** Pure-function aggregation (`buildMonthSeries`) extracted to a separate module for unit testing. A single Svelte 5 component (`MonthlyChart.svelte`) renders SVG bars + tooltip and emits an `onJump(month)` callback. The page (`+page.svelte`) derives the series from its existing `messages` state and owns the collapsible-strip UI (open/closed state in `localStorage`). No server changes, no new dependencies.

**Tech Stack:** TypeScript, Svelte 5 (runes mode), Vitest, SvelteKit. Existing CSS-variable theme system (`--accent`, `--surface`, `--text`, `--border`, `--text-muted`).

**Spec:** [docs/superpowers/specs/2026-05-25-monthly-sender-chart-design.md](../specs/2026-05-25-monthly-sender-chart-design.md)

---

## File Structure

| File | Role | Status |
|------|------|--------|
| `src/lib/month-series.ts` | Pure aggregation: `buildMonthSeries(messages) → MonthSeries`. Types live here too (`MonthBucket`, `MonthSeries`). | Create |
| `tests/month-series.test.ts` | Unit tests for the aggregation. | Create |
| `src/lib/components/MonthlyChart.svelte` | The chart: SVG bars, x-axis labels, hover/focus tooltip, click handler, empty state. Receives `series` + `senders` + `onJump`. | Create |
| `src/routes/+page.svelte` | Refactor `monthCounts` derivation, add `monthSeries`, add `chartOpen` state with `localStorage` persistence, insert the chart strip between `<header>` and `.layout`. | Modify |

---

## Task 1: Aggregation utility with unit tests (TDD)

**Files:**
- Create: `src/lib/month-series.ts`
- Create: `tests/month-series.test.ts`

- [ ] **Step 1: Create the aggregation module with types and a not-yet-implemented function signature**

Create `src/lib/month-series.ts` with the following exact contents:

```ts
import type { TaggedRow } from './types-tagger.js';

export interface MonthBucket {
  month: string;
  total: number;
  perSender: Record<string, number>;
}

export type MonthSeries = MonthBucket[];

export function buildMonthSeries(_messages: TaggedRow[]): MonthSeries {
  throw new Error('not implemented');
}
```

This step intentionally throws so the tests we write next will fail for the right reason.

- [ ] **Step 2: Write the failing tests**

Create `tests/month-series.test.ts` with the following exact contents:

```ts
import { describe, expect, it } from 'vitest';
import { buildMonthSeries, type MonthSeries } from '../src/lib/month-series.js';
import type { TaggedRow } from '../src/lib/types-tagger.js';

function msg(date_utc: string | null, sender_display: string, is_from_me = false): TaggedRow {
  return {
    rowid: 0,
    guid: `g-${Math.random()}`,
    date_utc,
    is_from_me,
    handle_address: null,
    service: null,
    body: null,
    raw_text_present: false,
    raw_attributed_body_present: false,
    associated_message_guid: null,
    associated_message_type: null,
    has_summary_info: false,
    attachments: [],
    msg_type: 'text',
    sender_display,
    reactions: [],
    reply_to_guid: null,
    has_edit: false,
    tags: [],
    note: ''
  };
}

describe('buildMonthSeries', () => {
  it('returns [] when no message has a valid date_utc', () => {
    expect(buildMonthSeries([])).toEqual([]);
    expect(buildMonthSeries([msg(null, 'Kyle'), msg(null, 'Sally')])).toEqual([]);
  });

  it('produces a single bucket for a single message', () => {
    const out = buildMonthSeries([msg('2024-05-12T10:00:00Z', 'Kyle')]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Kyle: 1 } }
    ]);
  });

  it('groups multiple senders in the same month', () => {
    const out = buildMonthSeries([
      msg('2024-05-12T10:00:00Z', 'Kyle'),
      msg('2024-05-15T10:00:00Z', 'Sally'),
      msg('2024-05-20T10:00:00Z', 'Kyle')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 3, perSender: { Kyle: 2, Sally: 1 } }
    ]);
  });

  it('fills gap months with zero buckets between min and max', () => {
    const out = buildMonthSeries([
      msg('2024-01-10T10:00:00Z', 'Kyle'),
      msg('2024-03-10T10:00:00Z', 'Sally')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-01', total: 1, perSender: { Kyle: 1 } },
      { month: '2024-02', total: 0, perSender: {} },
      { month: '2024-03', total: 1, perSender: { Sally: 1 } }
    ]);
  });

  it('wraps year boundaries when computing the month range', () => {
    const out = buildMonthSeries([
      msg('2023-12-31T23:59:00Z', 'Kyle'),
      msg('2024-02-01T00:01:00Z', 'Kyle')
    ]);
    expect(out.map((b) => b.month)).toEqual(['2023-12', '2024-01', '2024-02']);
  });

  it('skips messages with null date_utc but still emits the range from valid ones', () => {
    const out = buildMonthSeries([
      msg(null, 'Kyle'),
      msg('2024-05-15T10:00:00Z', 'Kyle'),
      msg(null, 'Sally')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Kyle: 1 } }
    ]);
  });

  it('buckets empty sender_display as "Unknown"', () => {
    const out = buildMonthSeries([msg('2024-05-15T10:00:00Z', '')]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Unknown: 1 } }
    ]);
  });

  it('skips messages whose date_utc.slice(0,7) is not 7 chars (malformed dates)', () => {
    const out = buildMonthSeries([
      msg('bad', 'Kyle'),
      msg('2024-05-15T10:00:00Z', 'Kyle')
    ]);
    expect(out).toEqual<MonthSeries>([
      { month: '2024-05', total: 1, perSender: { Kyle: 1 } }
    ]);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run:

```bash
pnpm test -- tests/month-series.test.ts
```

Expected: all 8 tests fail with `Error: not implemented` (thrown by the stub).

- [ ] **Step 4: Implement `buildMonthSeries`**

Replace the entire contents of `src/lib/month-series.ts` with:

```ts
import type { TaggedRow } from './types-tagger.js';

export interface MonthBucket {
  month: string;
  total: number;
  perSender: Record<string, number>;
}

export type MonthSeries = MonthBucket[];

export function buildMonthSeries(messages: TaggedRow[]): MonthSeries {
  const counts = new Map<string, { total: number; perSender: Record<string, number> }>();
  let minMonth: string | null = null;
  let maxMonth: string | null = null;

  for (const row of messages) {
    if (!row.date_utc) continue;
    const ym = row.date_utc.slice(0, 7);
    if (ym.length !== 7) continue;
    const sender = row.sender_display || 'Unknown';
    let bucket = counts.get(ym);
    if (!bucket) {
      bucket = { total: 0, perSender: {} };
      counts.set(ym, bucket);
    }
    bucket.total += 1;
    bucket.perSender[sender] = (bucket.perSender[sender] ?? 0) + 1;
    if (minMonth === null || ym < minMonth) minMonth = ym;
    if (maxMonth === null || ym > maxMonth) maxMonth = ym;
  }

  if (minMonth === null || maxMonth === null) return [];

  const out: MonthSeries = [];
  let cur = minMonth;
  while (cur <= maxMonth) {
    const bucket = counts.get(cur);
    out.push({
      month: cur,
      total: bucket?.total ?? 0,
      perSender: bucket?.perSender ?? {}
    });
    cur = nextMonth(cur);
  }
  return out;
}

function nextMonth(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run:

```bash
pnpm test -- tests/month-series.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 6: Run the full test suite to confirm nothing else broke**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/month-series.ts tests/month-series.test.ts
git commit -m "feat: add buildMonthSeries aggregation utility"
```

---

## Task 2: MonthlyChart.svelte component

**Files:**
- Create: `src/lib/components/MonthlyChart.svelte`

This task builds the chart component in a single focused file. Because Svelte components don't lend themselves to TDD the way pure functions do (rendering tests need a DOM runner the project doesn't currently install), we build the file in one pass and verify visually in Task 4.

- [ ] **Step 1: Create the component file**

Create `src/lib/components/MonthlyChart.svelte` with the following exact contents:

```svelte
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
```

- [ ] **Step 2: Run the type checker to catch any TS errors**

Run:

```bash
pnpm check
```

Expected: zero errors. (If the project has prior warnings unrelated to the new file, ignore them, but the new file must contribute no errors.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MonthlyChart.svelte
git commit -m "feat: add MonthlyChart svelte component"
```

---

## Task 3: Wire the chart into +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

This task changes three things in the page: (a) imports + the `monthSeries` derivation, (b) the `monthCounts` derivation now filters zero buckets to preserve the sidebar's current behavior, (c) a new `chartOpen` state with localStorage persistence and a collapsible strip in the markup that hosts `<MonthlyChart>`.

- [ ] **Step 1: Add the imports**

In `src/routes/+page.svelte`, find the existing import block (currently around lines 1–10) and add two new imports right after the existing `Sidebar` import. The existing top of the file:

```svelte
<script lang="ts">
  import { flushSync, onMount } from 'svelte';
  import MessageBubble from '$lib/components/MessageBubble.svelte';
  import MonthDivider from '$lib/components/MonthDivider.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import KeyboardOverlay from '$lib/components/KeyboardOverlay.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import { applyTheme, nextTheme, readSavedTheme, saveTheme, type ThemeMode } from '$lib/theme.js';
  import type { MessagesPayload, TaggedRow } from '$lib/types-tagger.js';
  import type { PageData } from './$types.js';
```

Insert the two new lines after the `Sidebar` import so the block becomes:

```svelte
<script lang="ts">
  import { flushSync, onMount } from 'svelte';
  import MessageBubble from '$lib/components/MessageBubble.svelte';
  import MonthDivider from '$lib/components/MonthDivider.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MonthlyChart from '$lib/components/MonthlyChart.svelte';
  import KeyboardOverlay from '$lib/components/KeyboardOverlay.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import { applyTheme, nextTheme, readSavedTheme, saveTheme, type ThemeMode } from '$lib/theme.js';
  import { buildMonthSeries } from '$lib/month-series.js';
  import type { MessagesPayload, TaggedRow } from '$lib/types-tagger.js';
  import type { PageData } from './$types.js';
```

- [ ] **Step 2: Replace the `monthCounts` derivation with `monthSeries` + a filtered `monthCounts`**

Find the existing derivation in the file (currently around lines 45–55):

```svelte
  const monthCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const r of messages) {
      if (!r.date_utc) continue;
      const key = r.date_utc.slice(0, 7);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, count]) => ({ month, count }));
  });
```

Replace that entire block with:

```svelte
  const monthSeries = $derived.by(() => buildMonthSeries(messages));
  // Sidebar contract preserved: only months with ≥1 message in the Jump-to list.
  const monthCounts = $derived(
    monthSeries.filter((m) => m.total > 0).map((m) => ({ month: m.month, count: m.total }))
  );
```

- [ ] **Step 3: Add `chartOpen` state and persistence**

In the same `<script>`, immediately after the existing line `let theme = $state<ThemeMode>('auto');` (currently around line 29), add:

```svelte
  let chartOpen = $state(true);
```

Then, find the existing `onMount` block (currently around lines 281–287):

```svelte
  onMount(() => {
    theme = readSavedTheme();
    applyTheme(theme);
    if (data.ready) void fetchMessages();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
```

Replace it with:

```svelte
  onMount(() => {
    theme = readSavedTheme();
    applyTheme(theme);
    const savedChart = localStorage.getItem('imc:chartOpen');
    if (savedChart === '0') chartOpen = false;
    if (data.ready) void fetchMessages();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function toggleChart(): void {
    chartOpen = !chartOpen;
    try {
      localStorage.setItem('imc:chartOpen', chartOpen ? '1' : '0');
    } catch {
      // localStorage can throw in private modes; ignore.
    }
  }
```

- [ ] **Step 4: Insert the chart strip into the markup**

In the template section of `+page.svelte`, find the `{:else}` branch of the `{#if !data.ready}` block (currently around line 359):

```svelte
  {:else}
    <div class="layout">
      <Sidebar
```

Insert the chart strip *between* `{:else}` and `<div class="layout">` so the structure becomes:

```svelte
  {:else}
    <section class="chart-strip" class:open={chartOpen}>
      <button class="chart-toggle" onclick={toggleChart} aria-expanded={chartOpen}>
        <span class="chevron">{chartOpen ? '▾' : '▸'}</span>
        <span>Messages per month</span>
      </button>
      {#if chartOpen}
        <div class="chart-host" transition:slide={{ duration: 150 }}>
          <MonthlyChart series={monthSeries} senders={data.senders} onJump={scrollToMonth} />
        </div>
      {/if}
    </section>
    <div class="layout">
      <Sidebar
```

This uses Svelte's built-in `slide` transition. Make sure to also add the import in the `<script>` block — find the existing `import { flushSync, onMount } from 'svelte';` line and add the following import immediately after it:

```svelte
  import { slide } from 'svelte/transition';
```

- [ ] **Step 5: Add CSS for the strip**

In the `<style>` block at the bottom of the file, find an appropriate spot (e.g. immediately after the `header` block, before the `.layout` rule) and add:

```css
  .chart-strip {
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
  }
  .chart-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 8px 16px;
    cursor: pointer;
    text-align: left;
  }
  .chart-toggle:hover {
    color: var(--text);
  }
  .chevron {
    font-size: 10px;
    width: 10px;
    display: inline-block;
  }
  .chart-host {
    height: 100px;
    padding: 0 16px 8px;
  }
```

- [ ] **Step 6: Type-check**

Run:

```bash
pnpm check
```

Expected: zero errors introduced by these changes.

- [ ] **Step 7: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: wire MonthlyChart into the page above the thread"
```

---

## Task 4: Manual verification with the dev server

This task is verification only — no code changes unless a bug is found. Use the Claude Preview tools (`preview_start`, `preview_snapshot`, `preview_eval`, `preview_screenshot`, `preview_click`) rather than `pnpm dev` directly.

**Pre-requisite:** The user must have already run `pnpm imessage-explorer enrich` so `workdir/enriched.jsonl` exists. If it doesn't, the page shows the "no enriched data found" state and the chart cannot be exercised — stop and ask the user.

- [ ] **Step 1: Start the preview server**

Use `preview_start` to launch the SvelteKit dev server on the project. The project's npm scripts already define `dev` → `vite dev`, so the preview tool picks it up automatically.

- [ ] **Step 2: Verify the chart appears on initial load**

Use `preview_snapshot` to confirm:
- A `.chart-strip` section is present between the header and the layout.
- An `<svg class="bars">` exists inside it.
- At least one `<rect class="seg">` is rendered.

If the page shows the "no enriched data found" empty state instead, stop here and report back to the user.

- [ ] **Step 3: Verify a hover tooltip appears**

Use `preview_eval` to simulate a mouseover on the first chart slot:

```js
const slot = document.querySelector('.chart-strip .slot.has-data');
const r = slot.getBoundingClientRect();
slot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
const tip = document.querySelector('.chart-strip .tooltip');
({ tipPresent: !!tip, tipText: tip?.textContent?.replace(/\s+/g, ' ').trim() });
```

Expected: `tipPresent: true`, and `tipText` includes a month name, at least one sender, and "Total".

- [ ] **Step 4: Verify click-to-jump**

Use `preview_eval` to read the first slot's month, then click it, then check that the thread scrolled:

```js
const firstSlot = document.querySelector('.chart-strip .slot.has-data');
const aria = firstSlot.getAttribute('aria-label');
firstSlot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
// give scroll animation a moment, then read scroller state
await new Promise(r => setTimeout(r, 500));
const scroller = document.querySelector('main');
({ aria, scrollTop: scroller.scrollTop });
```

Expected: `scrollTop` is nonzero (i.e. it scrolled, since the chart's first month is the oldest message at the top, the page likely scrolled up — or down if the scroll origin was elsewhere).

- [ ] **Step 5: Verify filter-awareness**

Use `preview_click` to click a filter chip (e.g. the "tagged" chip in the sidebar) and `preview_snapshot` again. Expected: the chart re-renders with new bar heights, and the snapshot reflects the new set of segments.

- [ ] **Step 6: Verify the collapse toggle persists**

Use `preview_click` to click the "Messages per month" header. Expected: the `.chart-host` div disappears (chevron flips to ▸).

Use `preview_eval` to read localStorage:

```js
localStorage.getItem('imc:chartOpen');
```

Expected: `"0"`.

Use `preview_eval` to reload:

```js
window.location.reload();
```

After reload, use `preview_snapshot` to confirm the chart starts collapsed.

- [ ] **Step 7: Verify light/dark theme legibility**

Use `preview_eval` to switch theme classes and snapshot the chart in each:

```js
document.documentElement.classList.remove('theme-light', 'theme-dark');
document.documentElement.classList.add('theme-dark');
({ bars: document.querySelectorAll('.chart-strip .seg').length });
```

Take a `preview_screenshot`. Then run:

```js
document.documentElement.classList.remove('theme-dark');
document.documentElement.classList.add('theme-light');
({ bars: document.querySelectorAll('.chart-strip .seg').length });
```

Take another screenshot. Expected: both screenshots show legible bars with sufficient contrast against the chart strip background. The accent color (sender 1) follows the theme accent because `--chart-c1: var(--accent)`.

- [ ] **Step 8: Capture a final screenshot for the record**

Use `preview_screenshot` to save a screenshot of the open chart with a tooltip visible (use `preview_eval` to dispatch a `mouseenter` on a slot first).

- [ ] **Step 9: Stop the preview server**

Use `preview_stop`.

- [ ] **Step 10: Final commit (only if any verification fixes were needed)**

If the verification steps surfaced a bug, fix it, then:

```bash
git add -p
git commit -m "fix: <specific bug found during verification>"
```

If no bugs were found, no further commit is needed — the implementation is complete.

---

## Done

After all four tasks pass, the user has:

- A new `buildMonthSeries` utility with 8 passing unit tests.
- A `MonthlyChart.svelte` component that renders stacked bars, supports hover and keyboard-focus tooltips, and emits a `onJump(month)` callback.
- A wired-up page where the chart appears above the thread, respects the active filter, persists its collapsed state, and reuses the page's existing `scrollToMonth` to navigate by clicking bars.
- Three new commits on `main` (one per code-changing task).
