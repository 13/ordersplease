<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { settings } from '../stores/settings';
  import { progress } from '../stores/progress';
  import { stats, EMPTY } from '../stores/stats';
  import { customMenu } from '../stores/menu';
  import { history } from '../stores/history';
  import { DEFAULT_MENU } from '../core/menu';

  if ($settings.volume === undefined) settings.update((s) => ({ ...s, volume: 1, haptics: s.haptics ?? true, amountEntry: s.amountEntry ?? false }));

  function resetAll() {
    if (!confirm($t('settings.reset-confirm'))) return;
    progress.set({ stars: {} });
    stats.set(structuredClone(EMPTY));
    customMenu.set(DEFAULT_MENU.map((m) => ({ ...m })));
    history.set({});
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
  <label><input type="checkbox" bind:checked={$settings.amountEntry} /> {$t('settings.amount-entry')}</label>
  <label><input type="checkbox" bind:checked={$settings.haptics} /> {$t('settings.haptics-label')}</label>
  {#if $settings.sound}
    <label class="vol">{$t('settings.volume')}
      <input type="range" min="0" max="1" step="0.1" bind:value={$settings.volume} />
    </label>
  {/if}

  <button class="replay" onclick={() => go('tutorial')}>{$t('settings.replay-tutorial')}</button>
  <button class="danger" onclick={resetAll}>{$t('settings.reset')}</button>

  <div class="about">
    <img src="{import.meta.env.BASE_URL}icon.svg" alt="" width="48" height="48" />
    <div class="meta">
      <strong>Orders, Please</strong>
      <span>{$t('settings.version')} {__APP_VERSION__}</span>
      <a href="https://github.com/13/ordersplease" target="_blank" rel="noreferrer">GitHub</a>
    </div>
  </div>
</main>

<style>
  .settings { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 1rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  label { display: flex; align-items: center; gap: 0.6rem; }
  select { font: inherit; padding: 0.4rem; border-radius: var(--radius); }
  input[type='checkbox'] { width: 24px; height: 24px; }
  .vol input { flex: 1; }
  .replay { background: var(--wood-light); color: var(--cream); }
  .danger { background: var(--danger); color: var(--cream); margin-top: 1.5rem; }
  .about {
    display: flex; align-items: center; gap: 0.75rem;
    margin-top: 1.5rem; padding: 0.75rem;
    background: var(--wood-light); border-radius: var(--radius);
  }
  .about img { border-radius: 10px; }
  .meta { display: flex; flex-direction: column; font-size: 0.85rem; }
  .meta span { opacity: 0.75; }
  .meta a { color: var(--accent); }
</style>
