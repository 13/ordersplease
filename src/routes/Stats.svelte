<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { stats, dayStreak } from '../stores/stats';
  import type { RoundError } from '../core/round';
  import { BADGE_IDS } from '../core/badges';
  import { badges } from '../stores/badges';
  import { history, localDayKey, type DayEntry } from '../stores/history';
  import { formatEuro } from '../core/money';
  import { settings } from '../stores/settings';

  const ERROR_KEYS: RoundError[] = [
    'sum-wrong', 'change-wrong', 'shortage-missed', 'parse-wrong', 'timeout',
    'trap-missed', 'dispute-wrong', 'tab-wrong', 'split-wrong',
  ];

  const avgSeconds = $derived(
    $stats.rounds === 0 ? 0 : Math.round($stats.totalMs / $stats.rounds / 100) / 10,
  );
  const streak = $derived(dayStreak($stats, new Date()));
  const worst = $derived.by(() => {
    const entries = ERROR_KEYS.map((k) => [k, $stats.errors[k] ?? 0] as const);
    const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return max[1] > 0 ? max[0] : null;
  });
  const maxCount = $derived(Math.max(1, ...ERROR_KEYS.map((k) => $stats.errors[k] ?? 0)));

  const days = $derived.by(() => {
    const out: { key: string; entry: DayEntry | null }[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 13);
    for (let i = 0; i < 14; i++) {
      const key = localDayKey(d);
      out.push({ key, entry: $history[key] ?? null });
      d.setDate(d.getDate() + 1);
    }
    return out;
  });
  const maxRounds = $derived(Math.max(1, ...days.map((x) => x.entry?.rounds ?? 0)));
  const hasHistory = $derived(days.some((x) => x.entry));
  const accSegments = $derived.by(() => {
    const segs: string[] = [];
    let current: string[] = [];
    days.forEach(({ entry }, i) => {
      if (entry && entry.rounds > 0) {
        const acc = entry.correct / entry.rounds;
        current.push(`${i * 20 + 10},${70 - acc * 60}`);
      } else if (current.length) {
        segs.push(current.join(' '));
        current = [];
      }
    });
    if (current.length) segs.push(current.join(' '));
    return segs.filter((s) => s.includes(' ')); // only segments with ≥2 points
  });
</script>

<main class="stats">
  <h2><button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button> {$t('stats.title')}</h2>

  <dl>
    <div><dt>{$t('stats.rounds')}</dt><dd>{$stats.rounds}</dd></div>
    <div><dt>{$t('stats.avg')}</dt><dd>{avgSeconds}</dd></div>
    <div><dt>{$t('stats.streak')}</dt><dd>{streak} 🔥</dd></div>
    <div><dt>{$t('stats.rush-high')}</dt><dd>{$stats.rushHigh}</dd></div>
    <div><dt>{$t('stats.tips')}</dt><dd>{formatEuro($stats.tipsEarnedCents ?? 0, $settings.symbolFirst)}</dd></div>
  </dl>

  {#if hasHistory}
    <h3>{$t('stats.history')}</h3>
    <svg class="chart" viewBox="0 0 280 84" role="img" aria-label={$t('stats.history')}>
      {#each days as { key, entry }, i (key)}
        {#if entry}
          {@const h = (entry.rounds / maxRounds) * 60}
          <rect x={i * 20 + 3} y={70 - h} width="14" height={h} rx="2" class="bar-r" />
          {@const acc = entry.rounds > 0 ? entry.correct / entry.rounds : 0}
          <circle cx={i * 20 + 10} cy={70 - acc * 60} r="2.5" class="dot" />
        {/if}
        <text x={i * 20 + 10} y="80" class="lbl">{key.slice(8)}</text>
      {/each}
      {#each accSegments as pts (pts)}
        <polyline points={pts} class="acc-line" />
      {/each}
    </svg>
  {/if}

  <h3>{$t('stats.errors')}</h3>
  <ul>
    {#each ERROR_KEYS as k (k)}
      <li>
        <span>{$t(`stats.err.${k}`)}</span>
        <div class="bar"><div style="width: {(($stats.errors[k] ?? 0) / maxCount) * 100}%"></div></div>
        <span class="count">{$stats.errors[k] ?? 0}</span>
      </li>
    {/each}
  </ul>

  {#if worst}
    <p class="hint">
      {$t('stats.hint')}: <strong>{$t(`stats.err.${worst}`)}</strong>
      <button class="train" onclick={() => go('practice')}>{$t('stats.train')}</button>
    </p>
  {/if}

  <h3>{$t('stats.badges')}</h3>
  <div class="badges">
    {#each BADGE_IDS as id (id)}
      {@const owned = $badges.includes(id)}
      <div class="badge" class:locked={!owned}>
        <span class="icon">{owned ? '🏅' : '🔒'}</span>
        <span>{$t(`badge.${id}`)}</span>
      </div>
    {/each}
  </div>
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
  .train { background: var(--accent); color: var(--ink); margin-left: 0.5rem; min-height: 36px; }
  .badges { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; }
  .badge {
    display: flex; align-items: center; gap: 0.4rem;
    background: var(--wood-light); border-radius: var(--radius);
    padding: 0.4rem 0.6rem; font-size: 0.85rem;
  }
  .badge.locked { opacity: 0.45; }
  .icon { font-size: 1.1rem; }
  .chart { width: 100%; height: auto; background: var(--wood-light); border-radius: var(--radius); }
  .bar-r { fill: var(--accent); opacity: 0.55; }
  .dot { fill: var(--cream); }
  .lbl { fill: var(--cream); opacity: 0.6; font-size: 6px; text-anchor: middle; }
  .acc-line { fill: none; stroke: var(--cream); stroke-width: 1.5; opacity: 0.8; }
</style>
