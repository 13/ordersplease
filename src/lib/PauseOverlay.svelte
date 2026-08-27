<!-- src/lib/PauseOverlay.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from './router';
  import { focusFirst } from './focus';
  import { keynav } from './keynav';
  import { settings } from '../stores/settings';

  let { menu, onresume, onrestart, allowRestart = true }: {
    menu: boolean;
    onresume: () => void;
    onrestart: () => void;
    allowRestart?: boolean;
  } = $props();

  let rootEl = $state<HTMLElement | null>(null);
  $effect(() => {
    focusFirst(rootEl);
  });
</script>

<div class="pause" role="dialog" aria-label={$t('pause.title')} bind:this={rootEl}>
  <h2>{$t('pause.title')}</h2>
  {#if menu}
    <div class="card">
      <div class="menu-actions" use:keynav>
        <button onclick={onresume}><span class="ico">▶️</span> {$t('menu.resume')}</button>
        {#if allowRestart}
          <button onclick={onrestart}><span class="ico">🔄</span> {$t('menu.restart')}</button>
        {/if}
        <button onclick={() => go('home')}><span class="ico">🏠</span> {$t('result.home')}</button>
      </div>
      <div class="quick">
        <h3>{$t('pause.settings')}</h3>
        <label><span class="ico">🔊</span> <span class="label-text">{$t('settings.sound')}</span> <input type="checkbox" bind:checked={$settings.sound} /></label>
        {#if $settings.sound}
          <label><span class="ico">🎚</span> <span class="label-text">{$t('settings.volume')}</span>
            <input type="range" min="0" max="1" step="0.1" bind:value={$settings.volume} />
          </label>
        {/if}
        <label><span class="ico">💶</span> <span class="label-text">{$t('settings.show-prices')}</span> <input type="checkbox" bind:checked={$settings.alwaysShowPrices} /></label>
        <label><span class="ico">🖍️</span> <span class="label-text">{$t('settings.highlight-ordered')}</span> <input type="checkbox" bind:checked={$settings.highlightOrdered} /></label>
        <label><span class="ico">⌨️</span> <span class="label-text">{$t('settings.amount-entry')}</span> <input type="checkbox" bind:checked={$settings.amountEntry} /></label>
        <label><span class="ico">📳</span> <span class="label-text">{$t('settings.haptics-label')}</span> <input type="checkbox" bind:checked={$settings.haptics} /></label>
        <label>
          <span class="ico">☀️</span> <span class="label-text">{$t('settings.theme-label')}</span>
          <input
            type="checkbox"
            checked={$settings.theme === 'light'}
            onchange={(e) => settings.update((s) => ({ ...s, theme: e.currentTarget.checked ? 'light' : 'dark' }))}
          />
        </label>
      </div>
    </div>
  {:else}
    <button class="tapzone" onclick={onresume}>{$t('pause.tap')}</button>
  {/if}
</div>

<style>
  .pause {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.7);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; text-align: center;
  }
  .pause > h2 { color: #f5ecd7; }
  .card {
    background: var(--wood-light); border-radius: 16px; padding: 1rem;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.5); width: min(320px, 92vw);
    display: flex; flex-direction: column; gap: 0.5rem;
  }
  .ico { width: 1.6rem; text-align: center; flex-shrink: 0; }
  .menu-actions { display: flex; flex-direction: column; gap: 0.5rem; }
  .menu-actions button {
    display: flex; align-items: center; gap: 0.6rem; text-align: left;
    background: var(--accent); color: var(--ink); font-size: 1.1rem;
    box-shadow: 0 3px 0 rgb(0 0 0 / 0.3);
  }
  .menu-actions button:active { transform: translateY(1px); box-shadow: 0 2px 0 rgb(0 0 0 / 0.3); }
  .quick {
    display: flex; flex-direction: column; gap: 0.5rem;
    text-align: left; font-size: 0.9rem; margin-top: 0.5rem;
    background: rgb(255 255 255 / 0.06); border-radius: var(--radius); padding: 0.75rem;
  }
  .quick h3 { font-size: 0.8rem; opacity: 0.7; text-transform: uppercase; }
  .quick label { display: flex; align-items: center; gap: 0.5rem; }
  .quick .label-text { flex: 1; }
  .quick input[type='range'] { flex: 1; }
  .quick input[type='checkbox'] { width: 20px; height: 20px; margin-left: auto; }
  .tapzone {
    position: absolute; inset: 0; width: 100%;
    background: none; color: #f5ecd7; opacity: 0.7;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 20dvh; font-size: 1rem;
  }
</style>
