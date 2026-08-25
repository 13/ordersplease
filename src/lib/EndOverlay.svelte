<!-- src/lib/EndOverlay.svelte -->
<script lang="ts">
  import type { SessionState } from '../core/session';
  import { t } from '../i18n';
  import { go } from './router';
  import { MAX_LEVEL } from '../core/difficulty';
  import RoundDetails from './RoundDetails.svelte';

  let { session, level, stars, wasNewHigh, onretry, onshare = null, shareLabel = '' }: {
    session: SessionState;
    level: number;
    stars: number;
    wasNewHigh: boolean;
    onretry: () => void;
    onshare?: (() => void) | null;
    shareLabel?: string;
  } = $props();

  const served = $derived(session.roundLog.filter((e) => e.success).length);
  const showAccuracy = $derived(session.mode === 'practice' || session.mode === 'daily');
</script>

<div class="overlay">
  <h2>{session.finished === 'won' ? $t('result.won') : $t('result.lost')}</h2>
  {#if session.mode === 'level' && session.finished === 'won'}
    <p class="stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</p>
  {/if}
  <p>{$t('game.score')}: {session.score}</p>
  {#if showAccuracy}
    <p>{$t('result.accuracy')}: {served}/{session.roundLog.length}</p>
  {/if}
  {#if session.mode === 'rush' && wasNewHigh}
    <p>{$t('result.highscore')}</p>
  {/if}

  <RoundDetails log={session.roundLog} />

  <div class="overlay-actions">
    {#if onshare}
      <button onclick={onshare}>{shareLabel}</button>
    {/if}
    {#if session.mode === 'level' && session.finished === 'won' && level < MAX_LEVEL}
      <button onclick={() => go(`game/${level + 1}`)}>{$t('result.next')}</button>
    {/if}
    <button onclick={onretry}>{$t('result.retry')}</button>
    <button onclick={() => go('home')}>{$t('result.home')}</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; text-align: center; padding: 1rem;
  }
  .stars { font-size: 2.2rem; color: var(--accent); }
  .overlay-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .overlay-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
</style>
