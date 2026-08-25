<!-- src/lib/EndOverlay.svelte -->
<script lang="ts">
  import type { SessionState } from '../core/session';
  import { t } from '../i18n';
  import { go } from './router';
  import { MAX_LEVEL } from '../core/difficulty';
  import RoundDetails from './RoundDetails.svelte';

  let {
    session, level, stars, wasNewHigh, onretry, onshare = null, shareLabel = '', note = null, levelName = null,
  }: {
    session: SessionState;
    level: number;
    stars: number;
    wasNewHigh: boolean;
    onretry: () => void;
    onshare?: (() => void) | null;
    shareLabel?: string;
    note?: string | null;
    levelName?: string | null;
  } = $props();

  const fullRounds = $derived(session.roundLog.filter((e) => !e.sub));
  const served = $derived(fullRounds.filter((e) => e.success).length);
  const showAccuracy = $derived(session.mode === 'practice' || session.mode === 'daily');

  let displayScore = $state(0);
  $effect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayScore = session.score;
      return;
    }
    const target = session.score;
    const steps = 20;
    let i = 0;
    displayScore = 0;
    const iv = setInterval(() => {
      i += 1;
      displayScore = Math.round((target * i) / steps);
      if (i >= steps) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  });
</script>

<div class="overlay">
  <h2>{session.finished === 'won' ? $t('result.won') : $t('result.lost')}</h2>
  {#if levelName && session.finished === 'won'}<p class="lvlname">{levelName}</p>{/if}
  {#if session.mode === 'level' && session.finished === 'won'}
    <p class="stars">
      {#each [0, 1, 2] as i (i)}
        <span class="star" class:earned={i < stars} style="animation-delay: {i * 0.25}s">
          {i < stars ? '★' : '☆'}
        </span>
      {/each}
    </p>
  {/if}
  <p>{$t('game.score')}: {displayScore}</p>
  {#if showAccuracy}
    <p>{$t('result.accuracy')}: {served}/{fullRounds.length}</p>
  {/if}
  {#if note}<p class="note">{note}</p>{/if}
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
  .star { display: inline-block; animation: op-pop 0.3s ease-out both; }
  .star.earned { color: var(--accent); }
  .note { color: var(--accent); font-size: 0.9rem; }
  .lvlname { opacity: 0.8; font-style: italic; }
  .overlay-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .overlay-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
</style>
