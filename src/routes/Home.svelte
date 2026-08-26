<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { keynav } from '../lib/keynav';
  import { daily } from '../stores/daily';
  import { dailyKey } from '../core/daily';
  import { weekly } from '../stores/weekly';
  import { weekKey } from '../core/weekly';
  import { progress, unlockedLevel } from '../stores/progress';
  import { seen } from '../stores/seen';
  import { careerTitle } from '../core/career';
  import { career } from '../stores/career';
  import { formatEuro } from '../core/money';

  const doneToday = $derived($daily?.date === dailyKey(new Date()));
  const doneThisWeek = $derived($weekly?.week === weekKey(new Date()));
  const level = $derived(unlockedLevel($progress));
  const suggestTutorial = $derived(level === 1 && !$seen.includes('tutorial'));
  const totalStars = $derived(Object.values($progress.stars ?? {}).reduce((a, b) => a + b, 0));
  const maxLevelWon = $derived(
    Object.keys($progress.stars ?? {}).length > 0
      ? Math.max(...Object.keys($progress.stars ?? {}).map((k) => parseInt(k, 10)))
      : 0,
  );
  const title = $derived(careerTitle(totalStars, maxLevelWon));
  const wallet = $derived($career.walletCents);
</script>

<main class="home" use:keynav>
  <div class="corners" style="--keynav-cols: 2">
    <button class="corner" aria-label={$t('home.stats')} onclick={() => go('stats')}>📊</button>
    <button class="corner" aria-label={$t('home.settings')} onclick={() => go('settings')}>⚙️</button>
  </div>

  <img class="logo" src="{import.meta.env.BASE_URL}icon.svg" alt="" width="72" height="72" />
  <h1>{$t('home.title')}</h1>
  <p class="career">{$t(`career.${title}`)}</p>

  <button class="play" onclick={() => go(suggestTutorial ? 'tutorial' : `game/${level}`)}>
    <strong>{suggestTutorial ? $t('tutorial.name') : $t('home.play')}</strong>
    <span>{suggestTutorial ? $t('home.tutorial-sub') : $t('home.continue').replace('{n}', String(level))}</span>
  </button>

  <div class="tiles" style="--keynav-cols: 2">
    <button onclick={() => go('rush')}>
      🌙<strong>{$t('home.rush')}</strong><span>{$t('home.rush-sub')}</span>
    </button>
    <button onclick={() => go('daily')}>
      {#if doneToday}<span class="done">✓</span>{/if}
      📅<strong>{$t('home.daily')}</strong><span>{$t('home.daily-sub')}</span>
    </button>
    <button onclick={() => go('practice')}>
      🎯<strong>{$t('home.practice')}</strong><span>{$t('home.practice-sub')}</span>
    </button>
    <button onclick={() => go('weekly')}>
      {#if doneThisWeek}<span class="done">✓</span>{/if}
      🗓<strong>{$t('home.weekly')}</strong><span>{$t('home.weekly-sub')}</span>
    </button>
  </div>

  <div class="meta" style="--keynav-cols: 3">
    <button onclick={() => go('levels')}>🗺<strong>{$t('levels.title')}</strong></button>
    <button onclick={() => go('menu')}>🍺<strong>{$t('home.menu')}</strong></button>
    <button onclick={() => go('bar')}>
      💰<strong>{$t('bar.title')}</strong>
      {#if wallet > 0}<span class="wallet">{formatEuro(wallet)}</span>{/if}
    </button>
  </div>
</main>

<style>
  .home {
    position: relative;
    min-height: 100dvh; display: flex; flex-direction: column;
    justify-content: center; align-items: stretch; gap: var(--space-4);
    max-width: 360px; margin: 0 auto; padding: var(--space-5);
    padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom));
  }
  .corners {
    position: absolute; left: 0; right: 0;
    top: calc(var(--space-3) + env(safe-area-inset-top));
    display: flex; justify-content: space-between; padding: 0 var(--space-3);
  }
  .corner {
    min-width: 44px; min-height: 44px; background: none;
    border: 1px solid var(--wood-light); border-radius: 12px;
    color: var(--cream); font-size: 1.25rem;
  }
  .logo { align-self: center; border-radius: 16px; box-shadow: var(--shadow); }
  h1 { text-align: center; font-family: Georgia, serif; font-size: 2rem; margin-bottom: 0; }
  .career {
    align-self: center; border: 1px solid var(--accent); color: var(--accent);
    border-radius: 999px; padding: 2px 14px; font-size: 0.85rem;
    margin-top: calc(var(--space-1) * -1);
  }
  .play {
    display: flex; flex-direction: column; gap: var(--space-1);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 90%, white), var(--accent));
    color: var(--ink); font-size: 1.2rem; padding: var(--space-4);
    border-radius: 16px;
    box-shadow: var(--shadow), inset 0 1px 0 rgb(255 255 255 / 0.25);
  }
  .play span { font-size: 0.85rem; opacity: 0.8; }
  .tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); }
  .tiles button, .meta button {
    position: relative; display: flex; flex-direction: column;
    gap: var(--space-1); align-items: center;
    background: linear-gradient(180deg, color-mix(in srgb, var(--wood-light) 90%, white), var(--wood-light));
    color: var(--cream); border-radius: 14px;
    box-shadow: var(--shadow), inset 0 1px 0 rgb(255 255 255 / 0.08);
  }
  .tiles button { padding: var(--space-3) var(--space-1); font-size: 1.2rem; }
  .tiles strong { font-size: 0.9rem; }
  .tiles span { font-size: 0.7rem; opacity: 0.7; }
  .done {
    position: absolute; top: 6px; right: 6px;
    background: var(--accent); color: var(--ink); border-radius: 999px;
    min-width: 18px; height: 18px; line-height: 18px;
    font-size: 0.7rem; padding: 0 4px;
  }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
  .meta button { min-height: 64px; padding: var(--space-2) var(--space-1); font-size: 1.1rem; }
  .meta strong { font-size: 0.75rem; }
  .wallet {
    position: absolute; top: 4px; right: 4px;
    background: var(--accent); color: var(--ink); border-radius: 999px;
    padding: 1px 6px; font-size: 0.6rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .home button { transition: transform 120ms ease; }
    .home button:active { transform: scale(0.97); }
  }
</style>
