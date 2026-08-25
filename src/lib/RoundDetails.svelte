<!-- src/lib/RoundDetails.svelte -->
<script lang="ts">
  import type { RoundLogEntry } from '../core/session';
  import { t } from '../i18n';

  let { log }: { log: RoundLogEntry[] } = $props();
  let open = $state(false);
</script>

<div class="details">
  <button class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
    {$t('result.details')} {open ? '▴' : '▾'}
  </button>
  {#if open}
    <ol>
      {#each log as e, i (i)}
        <li class:failed={!e.success}>
          <span class="mark">{e.success ? '✓' : '✗'}</span>
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
  .toggle { background: var(--wood-light); color: var(--cream); width: 100%; }
  ol {
    list-style: none; padding: 0.5rem; margin: 0.5rem 0 0;
    max-height: 40dvh; overflow-y: auto;
    background: rgb(0 0 0 / 0.35); border-radius: var(--radius);
    text-align: left; font-size: 0.85rem;
  }
  li {
    display: grid; grid-template-columns: 1.2rem 1fr auto auto;
    gap: 0.4rem; padding: 0.25rem 0; align-items: baseline;
  }
  li.failed .mark { color: var(--danger); }
  .mark { color: var(--ok); font-weight: bold; }
  .time, .pts { font-variant-numeric: tabular-nums; opacity: 0.85; }
  .errs { grid-column: 2 / -1; color: var(--danger); font-size: 0.8rem; }
</style>
