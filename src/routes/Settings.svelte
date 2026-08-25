<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { settings } from '../stores/settings';
  import { progress } from '../stores/progress';
  import { stats, EMPTY } from '../stores/stats';
  import { customMenu } from '../stores/menu';
  import { DEFAULT_MENU } from '../core/menu';

  function resetAll() {
    if (!confirm($t('settings.reset-confirm'))) return;
    progress.set({ stars: {} });
    stats.set(structuredClone(EMPTY));
    customMenu.set(DEFAULT_MENU.map((m) => ({ ...m })));
  }
</script>

<main class="settings">
  <h2><button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button> {$t('settings.title')}</h2>

  <label>
    {$t('settings.language')}
    <select bind:value={$settings.locale}>
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  </label>
  <label><input type="checkbox" bind:checked={$settings.sound} /> {$t('settings.sound')}</label>
  <label><input type="checkbox" bind:checked={$settings.symbolFirst} /> {$t('settings.symbol-first')}</label>
  <label><input type="checkbox" bind:checked={$settings.alwaysShowPrices} /> {$t('settings.show-prices')}</label>

  <button class="danger" onclick={resetAll}>{$t('settings.reset')}</button>
</main>

<style>
  .settings { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 1rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  label { display: flex; align-items: center; gap: 0.6rem; }
  select { font: inherit; padding: 0.4rem; border-radius: var(--radius); }
  input[type='checkbox'] { width: 24px; height: 24px; }
  .danger { background: var(--danger); color: var(--cream); margin-top: 1.5rem; }
</style>
