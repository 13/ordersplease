<!-- src/lib/RoundDetails.svelte -->
<script lang="ts">
  import type { RoundLogEntry } from '../core/session';
  import { t } from '../i18n';

  let { log }: { log: RoundLogEntry[] } = $props();

  const served = $derived(log.filter((e) => e.success).length);
  const bestStreak = $derived.by(() => {
    let cur = 0;
    let best = 0;
    for (const e of log) {
      cur = e.success ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return best;
  });
  const avgS = $derived(
    log.length === 0 ? 0 : log.reduce((s, e) => s + e.ms, 0) / log.length / 1000,
  );
  const acc = $derived(log.length === 0 ? 0 : served / log.length);
  const verdictKey = $derived(
    acc >= 0.9 ? 'result.verdict.great' : acc >= 0.6 ? 'result.verdict.good' : 'result.verdict.train',
  );
</script>

<div class="details">
  {#if log.length > 0}
    <div class="summary">
      <span class="ok-n">✓ {served}/{log.length}</span>
      {#if bestStreak >= 2}<span>🔥 {bestStreak}</span>{/if}
      <span>Ø {avgS.toFixed(1)}s</span>
    </div>
    <p class="verdict">{$t(verdictKey)}</p>
    <ol>
      {#each log as e, i (i)}
        <li class:failed={!e.success}>
          <span class="mark">{e.success ? '✓' : '✗'}{#if e.success && e.errors.length === 0}<span class="star">⭐</span>{/if}</span>
          <span class="text">{e.orderText}</span>
          <span class="time">{(e.ms / 1000).toFixed(1)}s</span>
          <span class="pts">+{e.scoreGained}</span>
          {#if e.errors.length}
            <span class="errs">{e.errors.map((err) => $t(`stats.err.${err}`)).join(', ')}</span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .details { width: 100%; max-width: 360px; }
  .summary {
    display: flex; justify-content: center; gap: 1rem;
    font-weight: bold; font-size: 1.05rem;
  }
  .ok-n { color: var(--ok); }
  .verdict { color: var(--accent); font-size: 0.9rem; margin: 0.25rem 0 0; }
  ol {
    list-style: none; padding: 0.5rem; margin: 0.5rem 0 0;
    max-height: 32dvh; overflow-y: auto;
    background: rgb(0 0 0 / 0.35); border-radius: var(--radius);
    text-align: left; font-size: 0.85rem;
  }
  li {
    display: grid; grid-template-columns: 2rem 1fr auto auto;
    gap: 0.4rem; padding: 0.25rem 0; align-items: baseline;
  }
  li.failed .mark { color: var(--danger); }
  .mark { color: var(--ok); font-weight: bold; }
  .star { font-size: 0.7rem; margin-left: 0.1rem; }
  .time { font-variant-numeric: tabular-nums; opacity: 0.85; }
  .pts { font-variant-numeric: tabular-nums; color: var(--accent); font-weight: bold; }
  .errs { grid-column: 2 / -1; color: var(--danger); font-size: 0.8rem; }
</style>
