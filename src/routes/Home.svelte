<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { daily } from '../stores/daily';
  import { dailyKey } from '../core/daily';

  const doneToday = $derived($daily?.date === dailyKey(new Date()));
</script>

<main class="home">
  <h1>{$t('home.title')}</h1>
  <button onclick={() => go('levels')}>{$t('home.play')}</button>
  <button onclick={() => go('rush')}>{$t('home.rush')}</button>
  <button onclick={() => go('practice')}>{$t('home.practice')}</button>
  <button onclick={() => go('daily')}>{$t('home.daily')}{doneToday ? ' ✓' : ''}</button>
  <button class="minor" onclick={() => go('stats')}>{$t('home.stats')}</button>
  <button class="minor" onclick={() => go('menu')}>{$t('home.menu')}</button>
  <button class="minor" onclick={() => go('settings')}>{$t('home.settings')}</button>
</main>

<style>
  .home {
    min-height: 100dvh; display: flex; flex-direction: column;
    justify-content: center; align-items: stretch; gap: 0.75rem;
    max-width: 320px; margin: 0 auto; padding: 1rem;
  }
  h1 { text-align: center; font-family: Georgia, serif; margin-bottom: 1.5rem; }
  button { background: var(--accent); color: var(--ink); font-size: 1.2rem; padding: 0.9rem; }
  .minor { background: var(--wood-light); color: var(--cream); font-size: 1rem; }
</style>
