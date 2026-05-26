<script lang="ts">
  import { flushSync, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
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

  let { data }: { data: PageData } = $props();

  // ---- state ---------------------------------------------------------------

  let messages = $state<TaggedRow[]>([]);
  let renderedCount = $state(0);
  let totalForFilter = $state(0);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  let q = $state('');
  let regex = $state(false);
  let filter = $state('');
  let sender = $state('');

  let focusedRowid = $state<number | null>(null);
  let helpOpen = $state(false);
  let theme = $state<ThemeMode>('auto');
  let chartOpen = $state(true);

  let noteOpen = $state(false);
  let noteRowid = $state<number | null>(null);
  let noteInitial = $state('');
  let noteSender = $state('');
  let notePreview = $state('');

  // ---- derived -------------------------------------------------------------

  const byGuid = $derived.by(() => {
    const m = new Map<string, TaggedRow>();
    for (const r of messages) m.set(r.guid, r);
    return m;
  });

  const monthSeries = $derived.by(() => buildMonthSeries(messages));
  // Sidebar contract preserved: only months with ≥1 message in the Jump-to list.
  const monthCounts = $derived(
    monthSeries.filter((m) => m.total > 0).map((m) => ({ month: m.month, count: m.total }))
  );

  const taggedCount = $derived(messages.reduce((n, r) => n + (r.tags.length > 0 || r.note ? 1 : 0), 0));

  // ---- chunked rendering ---------------------------------------------------

  const FIRST_CHUNK = 400;
  const CHUNK = 1500;
  let renderToken = 0;

  function startRenderLoop(): void {
    renderToken++;
    const myToken = renderToken;
    renderedCount = Math.min(messages.length, FIRST_CHUNK);
    if (renderedCount >= messages.length) return;
    const step = () => {
      if (myToken !== renderToken) return;
      renderedCount = Math.min(messages.length, renderedCount + CHUNK);
      if (renderedCount < messages.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- data fetching -------------------------------------------------------

  async function fetchMessages(): Promise<void> {
    loading = true;
    errorMsg = null;
    const params = new URLSearchParams();
    params.set('offset', '0');
    params.set('limit', '200000');
    if (q) params.set('q', q);
    if (regex) params.set('regex', '1');
    if (filter) params.set('filter', filter);
    if (sender) params.set('sender', sender);
    try {
      const res = await fetch(`/api/messages?${params.toString()}`);
      if (!res.ok) throw new Error(`/api/messages → ${res.status}`);
      const payload = (await res.json()) as MessagesPayload;
      messages = payload.messages;
      totalForFilter = payload.total;
      renderToken++; // cancel any in-flight loop
      startRenderLoop();
    } catch (err) {
      errorMsg = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  // ---- interactions --------------------------------------------------------

  function setFilter(next: string): void {
    filter = next;
    void fetchMessages();
  }
  function setSender(next: string): void {
    sender = next;
    void fetchMessages();
  }

  function focusRow(rowid: number): void {
    focusedRowid = rowid;
  }

  function toggleTag(rowid: number, tag: string): void {
    const row = messages.find((r) => r.rowid === rowid);
    if (!row) return;
    const set = new Set(row.tags);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    const updated = Array.from(set).sort();
    row.tags = updated;
    // Re-assign to trigger reactivity for arrays
    messages = [...messages];
    void persistTags({ [String(rowid)]: { tags: updated, note: row.note } });
  }

  async function persistTags(payload: Record<string, { tags: string[]; note: string }>): Promise<void> {
    try {
      await fetch('/api/tags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('tag persist failed:', err);
    }
  }

  function openNoteEditor(rowid: number): void {
    const row = messages.find((r) => r.rowid === rowid);
    if (!row) return;
    noteRowid = rowid;
    noteInitial = row.note;
    noteSender = `${row.sender_display} · ${row.date_utc ?? ''}`;
    notePreview = row.body ?? '(no body)';
    noteOpen = true;
  }

  function saveNote(text: string): void {
    if (noteRowid == null) return;
    const row = messages.find((r) => r.rowid === noteRowid);
    if (!row) return;
    row.note = text;
    messages = [...messages];
    void persistTags({ [String(noteRowid)]: { tags: row.tags, note: text } });
    noteOpen = false;
  }

  // ---- scroll-to-month (sticky-aware) -------------------------------------

  let scroller = $state<HTMLElement | null>(null);
  function scrollToMonth(monthKey: string): void {
    if (!scroller) return;
    const target = document.getElementById(`month-${monthKey}`);
    if (!target) return;
    // Sticky dividers report their CURRENT visual position via offsetTop /
    // getBoundingClientRect, not their static layout position. Temporarily
    // un-stick all dividers, force a sync reflow, measure, restore — all
    // within one tick so the user never sees the change.
    const dividers = document.querySelectorAll<HTMLElement>('.month-divider');
    const originalPositions: string[] = [];
    dividers.forEach((d, i) => {
      originalPositions[i] = d.style.position;
      d.style.position = 'static';
    });
    void target.offsetHeight;
    let offset = 0;
    let el: HTMLElement | null = target;
    while (el && el !== scroller) {
      offset += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    dividers.forEach((d, i) => {
      d.style.position = originalPositions[i] || '';
    });
    scroller.scrollTo({ top: offset, behavior: 'smooth' });
  }

  function scrollToBottom(): void {
    if (!scroller) return;
    // Force the chunked render to finish so scrollHeight reflects the full
    // list, then flushSync so Svelte commits the 11k DOM nodes synchronously
    // (otherwise the rAF below races against an in-flight reactive update).
    if (renderedCount < messages.length) {
      renderedCount = messages.length;
      flushSync();
    }
    // Re-issue scrollTop a few times: the first lands the common case, the
    // later ones catch late layout settling (lazy images near the bottom
    // committing their final size, sub-pixel rounding, etc.). scrollTop =
    // scrollHeight is idempotent, so repeated calls don't cause jitter.
    const finish = () => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 100);
    setTimeout(finish, 400);
  }

  // ---- keyboard ------------------------------------------------------------

  function onKey(e: KeyboardEvent): void {
    const tgt = e.target as HTMLElement | null;
    const tag = tgt?.tagName?.toLowerCase();
    const inEditable = tag === 'input' || tag === 'textarea' || (tgt?.isContentEditable ?? false);

    if (e.key === '?' && !inEditable) {
      helpOpen = !helpOpen;
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      if (helpOpen) helpOpen = false;
      return;
    }
    if (inEditable) return;

    if (e.key === '/') {
      const el = document.querySelector<HTMLInputElement>('input[name=q]');
      el?.focus();
      e.preventDefault();
      return;
    }
    if (e.key === 'g') {
      const v = window.prompt('Jump to month (YYYY-MM):');
      if (v && /^\d{4}-\d{2}$/.test(v)) scrollToMonth(v);
      return;
    }
    if (e.key === 'j' || e.key === 'ArrowDown') {
      moveFocus(1);
      e.preventDefault();
      return;
    }
    if (e.key === 'k' || e.key === 'ArrowUp') {
      moveFocus(-1);
      e.preventDefault();
      return;
    }
    if (/^[1-8]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      const t = data.tag_schema[idx];
      if (!t || focusedRowid == null) return;
      toggleTag(focusedRowid, t);
      e.preventDefault();
      return;
    }
    if (e.key === 'n' && focusedRowid != null) {
      openNoteEditor(focusedRowid);
      e.preventDefault();
    }
  }

  function moveFocus(delta: number): void {
    if (messages.length === 0) return;
    let i = focusedRowid == null ? 0 : messages.findIndex((r) => r.rowid === focusedRowid);
    if (i === -1) i = 0;
    i = Math.max(0, Math.min(messages.length - 1, i + delta));
    focusedRowid = messages[i].rowid;
    const el = document.querySelector<HTMLElement>(`[data-rowid="${focusedRowid}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  // ---- mount ---------------------------------------------------------------

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

  function cycleTheme(): void {
    theme = nextTheme(theme);
    applyTheme(theme);
    saveTheme(theme);
  }

  function themeGlyph(t: ThemeMode): string {
    return t === 'dark' ? '☾' : t === 'light' ? '☀' : '◐';
  }

  // ---- list with month dividers --------------------------------------------

  type Item = { kind: 'divider'; month: string; count: number } | { kind: 'msg'; row: TaggedRow };
  const items = $derived.by<Item[]>(() => {
    const out: Item[] = [];
    let lastMonth = '';
    const monthCountMap = new Map<string, number>();
    for (const r of messages) {
      if (!r.date_utc) continue;
      const m = r.date_utc.slice(0, 7);
      monthCountMap.set(m, (monthCountMap.get(m) ?? 0) + 1);
    }
    let i = 0;
    for (const r of messages) {
      if (i >= renderedCount) break;
      const m = r.date_utc?.slice(0, 7) ?? '';
      if (m && m !== lastMonth) {
        out.push({ kind: 'divider', month: m, count: monthCountMap.get(m) ?? 0 });
        lastMonth = m;
      }
      out.push({ kind: 'msg', row: r });
      i++;
    }
    return out;
  });
</script>

<div class="app">
  <header>
    <div class="title">iMessage Conversation Explorer</div>
    <div class="search">
      <input
        type="search"
        name="q"
        placeholder="search (/ to focus)"
        bind:value={q}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
            void fetchMessages();
          }
        }}
      />
      <label class="regex-toggle">
        <input type="checkbox" bind:checked={regex} onchange={() => fetchMessages()} />
        <span>.*</span>
      </label>
    </div>
    <div class="pills">
      <span class="pill">{taggedCount} / {totalForFilter} tagged</span>
      <button class="theme" onclick={cycleTheme} title={`theme: ${theme}`}>{themeGlyph(theme)}</button>
      <button class="theme" onclick={() => (helpOpen = true)} title="help (?)">?</button>
    </div>
  </header>

  {#if !data.ready}
    <div class="empty">
      <h2>No enriched data found</h2>
      <p>{data.reason}</p>
    </div>
  {:else}
    <section class="chart-strip">
      <button class="chart-toggle" onclick={toggleChart} aria-expanded={chartOpen}>
        <span class="chevron" aria-hidden="true">{chartOpen ? '▾' : '▸'}</span>
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
        monthCounts={monthCounts}
        senders={data.senders}
        schema={data.tag_schema}
        {filter}
        {sender}
        onJump={(m) => scrollToMonth(m)}
        onJumpToToday={scrollToBottom}
        onFilter={setFilter}
        onSender={setSender}
      />
      <main bind:this={scroller}>
        {#if errorMsg}
          <div class="error">{errorMsg}</div>
        {/if}
        {#if loading && messages.length === 0}
          <div class="loading">Loading {data.total_messages.toLocaleString()} messages…</div>
        {/if}
        <ol class="thread" role="list">
          {#each items as item, idx (item.kind === 'divider' ? `d:${item.month}` : `m:${item.row.rowid}`)}
            {#if item.kind === 'divider'}
              <MonthDivider monthKey={item.month} count={item.count} />
            {:else}
              <MessageBubble
                row={item.row}
                parentBody={item.row.reply_to_guid ? byGuid.get(item.row.reply_to_guid)?.body ?? null : null}
                schema={data.tag_schema}
                focused={focusedRowid === item.row.rowid}
                onToggleTag={toggleTag}
                onFocus={focusRow}
              />
            {/if}
          {/each}
        </ol>
      </main>
    </div>
  {/if}

  <footer>
    <span class="hint">j/k navigate · 1–8 tag · n note · / search · g jump · ? help</span>
  </footer>
</div>

<KeyboardOverlay open={helpOpen} onClose={() => (helpOpen = false)} />

<NoteEditor
  open={noteOpen}
  rowid={noteRowid}
  sender={noteSender}
  bodyPreview={notePreview}
  initial={noteInitial}
  onSave={saveNote}
  onClose={() => (noteOpen = false)}
/>

<style>
  :global(:root) {
    --bg: #ffffff;
    --surface: #f6f7f9;
    --text: #0f1115;
    --text-muted: #5b6473;
    --border: #d8dde4;
    --accent: #2e6cdf;
  }
  :global(html.theme-dark),
  :global(html.theme-dark body) {
    --bg: #0f1115;
    --surface: #181b22;
    --text: #ebeef3;
    --text-muted: #8a95a5;
    --border: #2a2f37;
    --accent: #3b82f6;
  }
  @media (prefers-color-scheme: dark) {
    :global(html:not(.theme-light):not(.theme-dark)),
    :global(html:not(.theme-light):not(.theme-dark) body) {
      --bg: #0f1115;
      --surface: #181b22;
      --text: #ebeef3;
      --text-muted: #8a95a5;
      --border: #2a2f37;
      --accent: #3b82f6;
    }
  }
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', sans-serif;
  }

  .app {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    height: 100vh;
  }
  header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    z-index: 20;
  }
  .title {
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .search {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .search input[type='search'] {
    width: min(420px, 60vw);
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
  }
  .regex-toggle {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
  .pills {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pill {
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .theme {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

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

  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    overflow: hidden;
  }
  main {
    overflow-y: scroll;
    position: relative;
    contain: layout;
  }
  .thread {
    list-style: none;
    margin: 0;
    padding: 8px 0 80px;
    display: flex;
    flex-direction: column;
  }

  .loading,
  .error,
  .empty {
    padding: 24px;
    color: var(--text-muted);
  }
  .empty {
    grid-row: 2 / span 2;
  }
  .error {
    color: #ef4444;
  }
  .empty h2 {
    margin-top: 0;
  }

  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 16px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
