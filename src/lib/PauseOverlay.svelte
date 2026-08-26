<!-- src/lib/PauseOverlay.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from './router';
  import { focusFirst } from './focus';
  import { keynav } from './keynav';
  import { settings } from '../stores/settings';

  let { menu, soundOn, onresume, onrestart, ontogglesound, allowRestart = true }: {
    menu: boolean;
    soundOn: boolean;
    onresume: () => void;
    onrestart: () => void;
    ontogglesound: () => void;
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
    <div class="menu-actions" use:keynav>
      <button onclick={onresume}>{$t('menu.resume')}</button>
      {#if allowRestart}
        <button onclick={onrestart}>{$t('menu.restart')}</button>
      {/if}
      <button onclick={ontogglesound}>{$t('menu.sound')}: {soundOn ? '🔊' : '🔇'}</button>
      <button onclick={() => go('home')}>{$t('result.home')}</button>
    </div>
    <div class="quick">
      <h3>{$t('pause.settings')}</h3>
      {#if soundOn}
        <label>{$t('settings.volume')}
          <input type="range" min="0" max="1" step="0.1" bind:value={$settings.volume} />
        </label>
      {/if}
      <label><input type="checkbox" bind:checked={$settings.alwaysShowPrices} /> {$t('settings.show-prices')}</label>
      <label><input type="checkbox" bind:checked={$settings.amountEntry} /> {$t('settings.amount-entry')}</label>
      <label><input type="checkbox" bind:checked={$settings.haptics} /> {$t('settings.haptics-label')}</label>
    </div>
  {:else}
    <button class="tapzone" onclick={onresume}>{$t('pause.tap')}</button>
  {/if}
</div>

<style>
  .pause {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.85);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; text-align: center;
  }
  .menu-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .menu-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
  .quick {
    display: flex; flex-direction: column; gap: 0.5rem; width: 240px;
    text-align: left; font-size: 0.9rem; margin-top: 0.5rem;
    background: rgb(255 255 255 / 0.06); border-radius: var(--radius); padding: 0.75rem;
  }
  .quick h3 { font-size: 0.8rem; opacity: 0.7; text-transform: uppercase; }
  .quick label { display: flex; align-items: center; gap: 0.5rem; }
  .quick input[type='range'] { flex: 1; }
  .quick input[type='checkbox'] { width: 20px; height: 20px; }
  .tapzone {
    position: absolute; inset: 0; width: 100%;
    background: none; color: var(--cream); opacity: 0.7;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 20dvh; font-size: 1rem;
  }
</style>
