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
</script>

<main class="home" use:keynav>
  <img class="logo" src="{import.meta.env.BASE_URL}icon.svg" alt="" width="96" height="96" />
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
      📅<strong>{$t('home.daily')}{doneToday ? ' ✓' : ''}</strong><span>{$t('home.daily-sub')}</span>
    </button>
    <button onclick={() => go('practice')}>
      🎯<strong>{$t('home.practice')}</strong><span>{$t('home.practice-sub')}</span>
    </button>
    <button onclick={() => go('weekly')}>
      🗓<strong>{$t('home.weekly')}{doneThisWeek ? ' ✓' : ''}</strong><span>{$t('home.weekly-sub')}</span>
    </button>
  </div>

  <div class="row">
    <button class="minor" onclick={() => go('levels')}>{$t('levels.title')}</button>
    <button class="minor" onclick={() => go('stats')}>{$t('home.stats')}</button>
    <button class="minor" onclick={() => go('menu')}>{$t('home.menu')}</button>
    <button class="minor" onclick={() => go('settings')}>{$t('home.settings')}</button>
    <button class="minor" onclick={() => go('bar')}>{$t('bar.title')}</button>
  </div>
</main>

<style>
  .home {
    min-height: 100dvh; display: flex; flex-direction: column;
    justify-content: center; align-items: stretch; gap: var(--space-4);
    max-width: 360px; margin: 0 auto; padding: var(--space-5);
    padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom));
  }
  .logo { align-self: center; border-radius: 20px; box-shadow: var(--shadow); }
  h1 { text-align: center; font-family: Georgia, serif; margin-bottom: var(--space-2); }
  .career { text-align: center; color: var(--accent); font-size: 0.9rem; margin-top: calc(var(--space-2) * -1); }
  .play {
    display: flex; flex-direction: column; gap: var(--space-1);
    background: var(--accent); color: var(--ink);
    font-size: 1.2rem; padding: var(--space-4); box-shadow: var(--shadow);
  }
  .play span { font-size: 0.85rem; opacity: 0.8; }
  .tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); }
  .tiles button {
    display: flex; flex-direction: column; gap: var(--space-1); align-items: center;
    background: var(--wood-light); color: var(--cream);
    padding: var(--space-3) var(--space-1); font-size: 1.2rem;
  }
  .tiles strong { font-size: 0.9rem; }
  .tiles span { font-size: 0.7rem; opacity: 0.7; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); gap: var(--space-2); }
  .row .minor {
    min-width: 0; min-height: 52px; background: none; color: var(--cream);
    border: 1px solid var(--wood-light); border-radius: 10px; font-size: 0.78rem;
    line-height: 1.2; padding: var(--space-2) var(--space-1);
    word-break: normal; overflow-wrap: anywhere;
  }
</style>
