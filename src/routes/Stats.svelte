<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { stats, dayStreak } from '../stores/stats';
  import type { RoundError } from '../core/round';

  const ERROR_KEYS: RoundError[] = [
    'sum-wrong', 'change-wrong', 'shortage-missed', 'parse-wrong', 'timeout',
  ];

  const avgSeconds = $derived(
    $stats.rounds === 0 ? 0 : Math.round($stats.totalMs / $stats.rounds / 100) / 10,
  );
  const streak = $derived(dayStreak($stats, new Date()));
  const worst = $derived.by(() => {
    const entries = ERROR_KEYS.map((k) => [k, $stats.errors[k]] as const);
    const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return max[1] > 0 ? max[0] : null;
  });
  const maxCount = $derived(Math.max(1, ...ERROR_KEYS.map((k) => $stats.errors[k])));
</script>

<main class="stats">
  <h2><button class="back" onclick={() => go('home')}>←</button> {$t('stats.title')}</h2>

  <dl>
    <div><dt>{$t('stats.rounds')}</dt><dd>{$stats.rounds}</dd></div>
    <div><dt>{$t('stats.avg')}</dt><dd>{avgSeconds}</dd></div>
    <div><dt>{$t('stats.streak')}</dt><dd>{streak} 🔥</dd></div>
    <div><dt>{$t('stats.rush-high')}</dt><dd>{$stats.rushHigh}</dd></div>
  </dl>

  <h3>{$t('stats.errors')}</h3>
  <ul>
    {#each ERROR_KEYS as k (k)}
      <li>
        <span>{$t(`stats.err.${k}`)}</span>
        <div class="bar"><div style="width: {($stats.errors[k] / maxCount) * 100}%"></div></div>
        <span class="count">{$stats.errors[k]}</span>
      </li>
    {/each}
  </ul>

  {#if worst}
    <p class="hint">{$t('stats.hint')}: <strong>{$t(`stats.err.${worst}`)}</strong></p>
  {/if}
</main>

<style>
  .stats { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  dl div { background: var(--wood-light); border-radius: var(--radius); padding: 0.6rem; }
  dt { font-size: 0.8rem; opacity: 0.8; }
  dd { font-size: 1.4rem; font-weight: bold; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li { display: grid; grid-template-columns: 8rem 1fr 2rem; gap: 0.5rem; align-items: center; }
  .bar { height: 10px; background: rgb(0 0 0 / 0.35); border-radius: 5px; overflow: hidden; }
  .bar div { height: 100%; background: var(--danger); }
  .count { text-align: right; font-variant-numeric: tabular-nums; }
  .hint { color: var(--accent); }
</style>
