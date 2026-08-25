<!-- src/lib/PauseOverlay.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from './router';

  let { menu, soundOn, onresume, onrestart, ontogglesound, allowRestart = true }: {
    menu: boolean;
    soundOn: boolean;
    onresume: () => void;
    onrestart: () => void;
    ontogglesound: () => void;
    allowRestart?: boolean;
  } = $props();
</script>

<div class="pause" role="dialog" aria-label={$t('pause.title')}>
  <h2>{$t('pause.title')}</h2>
  {#if menu}
    <div class="menu-actions">
      <button onclick={onresume}>{$t('menu.resume')}</button>
      {#if allowRestart}
        <button onclick={onrestart}>{$t('menu.restart')}</button>
      {/if}
      <button onclick={ontogglesound}>{$t('menu.sound')}: {soundOn ? '🔊' : '🔇'}</button>
      <button onclick={() => go('home')}>{$t('result.home')}</button>
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
  .tapzone {
    position: absolute; inset: 0; width: 100%;
    background: none; color: var(--cream); opacity: 0.7;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 20dvh; font-size: 1rem;
  }
</style>
