# Monthly messages-by-sender chart

**Status:** Draft → ready for implementation planning
**Date:** 2026-05-25
**Topic:** Interactive chart showing how many messages each party sent in each month of the conversation.

## User story

> As a user, I'd like to be able to easily view an interactive chart portraying how many messages were sent by each party (myself, Kyle, and the recipient, Sally) in each month from today all the way to the oldest message in the conversation. Hovering over the chart should reveal a tooltip with more information about the highlighted datapoint (i.e., a breakdown of how many messages were sent that month in total and from each party).

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Chart scope | **Filter-aware** — recomputes whenever the active search / sender / tag filter changes |
| 2 | Placement | **Above the thread, collapsible** — full-width strip below the header, default open |
| 3 | Chart shape | **Stacked bars** — one bar per month, segmented by sender |
| 4 | Bar click | **Scrolls thread to that month** — reuses the existing `scrollToMonth` callback |
| 5 | Gap months | **Show empty slot for every month in range** — calendar-aligned, honest about quiet periods |
| 6 | Implementation | **DIY SVG component** — no new dependencies |

## Scope

### In scope
- A new collapsible strip between the page header and the existing layout that renders a stacked-bar chart of messages per month per sender.
- Hover (and keyboard-focus) tooltip showing month, per-sender breakdown, and total.
- Click-to-jump that calls the existing `scrollToMonth(month)` callback.
- Aggregation that respects the current filter set (search query, sender, tag) because it derives from the same `messages` array the rest of the page uses.
- Persisted collapsed/expanded state in `localStorage`.

### Out of scope
- Time granularity toggles (week / quarter / year). Monthly only.
- Drill-down beyond month-level (no week-of-month, day-of-week visualization).
- Exporting the chart as an image or CSV.
- Animations / transitions when filter changes (set static; no entry animations).
- Configurable color palette (uses theme-aware defaults).

## Architecture

### File changes

**New**
- `src/lib/month-series.ts` — pure function `buildMonthSeries(messages, senders)` that returns the aggregated series. Lives outside the component so it can be unit-tested without DOM.
- `src/lib/components/MonthlyChart.svelte` — the chart component. Renders SVG bars, axis labels, tooltip, and click/hover handlers.
- `tests/month-series.test.ts` — unit tests for the aggregation.

**Modified**
- `src/routes/+page.svelte` — instantiate `<MonthlyChart>` between `<header>` and `.layout`. Add `chartOpen` state. Refactor the existing `monthCounts` derivation so it shares a single pass with the new `monthSeries`, while preserving the sidebar's existing behavior of only listing months that have ≥1 message.

**Unchanged.** No server-side work. No new API routes. No changes to `src/lib/types.ts`, `Sidebar.svelte`, `MessageBubble.svelte`, or `participants.toml` schema.

### Component boundaries

```
+page.svelte
  ├─ derives `monthSeries` from `messages` (single pass)
  ├─ owns `chartOpen` UI state (persisted to localStorage)
  └─ <MonthlyChart series senders onJump />
         (pure render: SVG bars + tooltip + click handlers)
```

The page is the single source of truth for the data; the chart is dumb and stateless w.r.t. data.

## Data model

### `MonthSeries` (new type, lives in `month-series.ts`)

```ts
export interface MonthBucket {
  month: string;           // 'YYYY-MM'
  total: number;           // total messages in this month
  perSender: Record<string, number>;  // count per sender_display
}
export type MonthSeries = MonthBucket[];  // sorted ascending by month
```

### Aggregation contract

`buildMonthSeries(messages: TaggedRow[]): MonthSeries`

- Returns `[]` if no message in `messages` has a valid `date_utc`.
- Otherwise: finds the min/max month present in `messages`, and emits **every month in that range inclusive**, even months with zero messages (`total === 0`, `perSender === {}`).
- For each message with a non-null `date_utc`:
  - Computes `ym = date_utc.slice(0, 7)`.
  - If the resulting string is not 7 chars long it is skipped.
  - Increments `perSender[sender_display || 'Unknown']` and `total`.
- The function does not take a `senders` argument; sender ordering is the caller's responsibility (the chart component derives an ordered sender list by appending any keys present in the series that aren't in the conversation-wide `senders` prop).

### Page wiring (`+page.svelte`)

Replace the existing `monthCounts` derivation with a single derivation that feeds both the chart and the sidebar:

```ts
const monthSeries = $derived.by(() => buildMonthSeries(messages));
// Sidebar contract preserved: only months with ≥1 message appear in the Jump-to list.
const monthCounts = $derived(
  monthSeries.filter(m => m.total > 0).map(m => ({ month: m.month, count: m.total }))
);
```

The chart receives the full `monthSeries` (gap months included); the sidebar continues to receive only non-empty months — same behavior it had before this change.

## Visual design

### Layout (above the thread)

```
┌────────────────────────────────────────────────────┐
│ HEADER (title, search, pills)                      │
├────────────────────────────────────────────────────┤
│ Messages per month        ▾ collapse               │
│  ┌────────────────────────────────────────────┐   │
│  │  ░ ▒ ▓ ░ ░ ▓ ▓ ▒ ░ ░ ▒ ░  ← stacked bars   │   │
│  │  Jan '24       Jul '24       Dec '24        │   │
│  └────────────────────────────────────────────┘   │
├──────────┬─────────────────────────────────────────┤
│ Sidebar  │ Thread                                  │
└──────────┴─────────────────────────────────────────┘
```

- Strip height: ~120px when open, ~28px when collapsed (just the title bar with chevron).
- Strip background: same `--surface` as the sidebar; bottom border using `--border`.
- Chart area: full width minus 16px horizontal padding; bar area ~80px tall.

### Bar geometry

- One slot per month in `monthSeries`. Slot width = `(chartWidth / monthSeries.length)`; bar width = slot width − 1px gutter.
- Bar height = `(monthBucket.total / maxTotal) * barAreaHeight`. `maxTotal` is the max `total` across the whole series (shared y-axis).
- Each bar is composed of one `<rect>` per sender, stacked from bottom up. Segment height = `(perSender[s] / monthBucket.total) * barHeight`.
- Senders are stacked in the order they appear in the `senders` prop (deterministic).
- Gap months (`total === 0`) render an empty slot with no `<rect>`s, preserving x-position.

### X-axis labels

- To avoid clutter, render only **three labels** under the bar area: first month, middle month, last month.
- Format: `'MMM YYYY'` in the user's locale, e.g. `Jan 2024`.
- Labels are SVG `<text>` elements positioned by computing the slot center for each.

### Color palette

Define the chart palette as CSS custom properties scoped to the chart component, matching the existing pattern (`MessageBubble.svelte` defines `--bubble-bg-me` / `--bubble-bg-other` locally). Use the app's `--accent` for the "me" segment so the chart's primary color tracks the theme accent automatically; pick a stable secondary for the recipient, and four additional categorical colors for the rare group-chat case.

```css
.chart {
  --chart-c1: var(--accent);   /* sender 1 — typically "me", tracks theme accent */
  --chart-c2: #d97757;         /* sender 2 — recipient */
  --chart-c3: #6a8e23;
  --chart-c4: #c45a8b;
  --chart-c5: #6f5e9e;
  --chart-c6: #d4a73c;
}
```

No new global CSS variables. No changes to `theme.ts`, `MessageBubble.svelte`, or the `:root` declarations in `+page.svelte`.

**Sender → color mapping.** Compute an ordered list `chartSenders` inside the chart component:

1. Start with the keys of `senders[]` (the conversation-wide sender list passed from the page).
2. Append any keys present in `series[*].perSender` that aren't already in the list (e.g. an `'Unknown'` bucket that emerged from a message with empty `sender_display`).
3. Assign color `c{i+1}` to position `i`. After position 6, wrap (c7 → c1). For typical two-party conversations only c1/c2 are used.

### Tooltip

- Floating `<div>` absolutely positioned within the chart container.
- Anchored to the **top of the hovered bar's column**, centered horizontally on the bar; flips to the right of the bar when within 120px of the right edge of the chart, and below when within 80px of the top.
- Contents:

```
┌───────────────────┐
│ May 2024          │  ← bold, 12px
│ ■ Kyle    124     │  ← swatch + name + count, 11px
│ ■ Sally    89     │
│ ─────────────────  │
│ Total     213     │  ← muted color
└───────────────────┘
```

- Per-sender lines: rendered in `senders[]` order. Senders with zero messages in this month are **omitted** from the tooltip (avoids "Sally — 0" noise).
- Background: `var(--surface)` with a 1px `var(--border)` outline and a subtle drop shadow (`box-shadow: 0 4px 14px rgba(0,0,0,0.18)`). No new theme variables.
- Pointer-events: none, so the tooltip never blocks the bar underneath.

### Collapse behavior

- The strip header has a chevron button (▾ when open, ▸ when collapsed) and the title "Messages per month".
- Clicking the header (anywhere) toggles `chartOpen`.
- The chart area animates height (CSS transition, 150ms ease-out) between 0 and ~80px.
- Open/closed state is persisted: `localStorage.setItem('imc:chartOpen', '0'|'1')`, read on mount.

## Interactions

### Hover / focus
- Each bar is a `<button>` with `aria-label` like `"May 2024, 213 messages (Kyle 124, Sally 89). Click to jump."`.
- `mouseenter` on bar → set `hoveredIndex = i`. Compute tooltip position from the bar's `getBoundingClientRect`. Render tooltip.
- `mouseleave` on bar → `hoveredIndex = null`.
- `focus` on bar → same as `mouseenter`. `blur` → same as `mouseleave`.
- For very thin bars (long conversations), wrap each bar in a slightly wider invisible "hit target" `<rect>` (full slot width including the gutter) so hover/click are easy targets.

### Click
- Click on bar (mouse or `Enter`/`Space` on focused button) → `onJump(month)` → page calls `scrollToMonth(month)`.
- The page's `scrollToMonth` already handles the case where the target month is in a not-yet-rendered chunk (it calls `flushSync` and re-issues scrollTop), so chart clicks gain that behavior for free.

### Collapse toggle
- Click on strip header → toggle `chartOpen`; persist to localStorage.

## Edge cases

| Case | Behavior |
|------|----------|
| `messages.length === 0` (initial load not finished, or filter has no matches) | Render the strip header. In the chart area, show centered muted text: "No messages match the current filter." Bars area collapses to ~40px tall (just enough for the text). |
| All messages in one month | One full-height bar at left, slot width = full chart width. Tooltip works normally. |
| Single sender (no `is_from_me === false` rows) | One color across all bars; tooltip shows one line. |
| Sender with `sender_display` empty string | Bucketed as `"Unknown"`; appears in tooltip and gets the next free color slot. |
| Conversation spans >5 years (~60+ months) | Bars get thin but still legible. We accept this. We do not implement scrolling or zooming; that's out of scope. |
| Date strings malformed (`date_utc` not `YYYY-MM-DD…`) | `slice(0, 7)` still gives 7 chars; if they're not a valid `YYYY-MM`, they end up as their own bucket but still render. This matches the existing `monthCounts` behavior. |
| User toggles the chart closed during a long scroll | No effect on scroll; the chart strip animates out and the thread reflows. The scroll position in the thread is preserved by the browser. |

## Testing

### Unit tests — `tests/month-series.test.ts`

Tests against `buildMonthSeries`:

1. Empty input → empty array.
2. Single message → series of length 1 with the right month and `total: 1`.
3. Two messages in the same month, different senders → one bucket, `perSender` has both keys with count 1, `total: 2`.
4. Messages spanning Jan and Mar (skipping Feb) → series of length 3, Feb has `total: 0`.
5. Messages with `date_utc === null` → ignored; do not affect range or counts.
6. Sender deduplication: same sender across many months produces correct per-month counts.

### Manual / preview verification

After implementation, run `pnpm dev` and verify in the browser:

1. Chart appears below the header on first load with the conversation's full span of bars.
2. Hovering a bar shows the tooltip with month + per-sender + total.
3. Clicking a bar scrolls the thread to that month.
4. Activating a filter chip (e.g. `tagged`) recomputes the chart and tooltip values.
5. Activating a sender filter recomputes the chart (only the selected sender's segment remains).
6. Collapsing the strip persists across page reload.
7. Light/dark theme toggle leaves the chart legible in both modes.

No new e2e dependency is required.

## Open questions

None at design time. If during implementation the bar widths become unreadable for very long conversations, we'll revisit with a min-bar-width / horizontal-scroll affordance.

## Followups (deferred)

- Tag-color stacking (color bars by tag instead of by sender) — interesting but is a different feature.
- A "year" granularity toggle for very long conversations.
- Exporting the chart as PNG / CSV.
