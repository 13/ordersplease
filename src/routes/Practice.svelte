<!-- src/routes/Practice.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { stats } from '../stores/stats';
  import { SKILL_ERROR, type Skill } from '../core/difficulty';
  import { keynav } from '../lib/keynav';

  const SKILLS = Object.keys(SKILL_ERROR) as Skill[];
  const worst = $derived.by(() => {
    let best: Skill | null = null;
    let max = 0;
    for (const s of SKILLS) {
      const c = $stats.errors[SKILL_ERROR[s]] ?? 0;
      if (c > max) { max = c; best = s; }
    }
    return best;
  });
</script>

<main class="practice">
  <h2>
    <button class="back" aria-label={$t('nav.back')} onclick={() => go('home')}>←</button>
    {$t('practice.title')}
  </h2>
  <div class="grid" use:keynav style="--keynav-cols: 2">
    {#each SKILLS as s (s)}
      <button class="tile" class:worst={s === worst} onclick={() => go(`practice/${s}`)}>
        <span>{$t(`stats.err.${SKILL_ERROR[s]}`)}</span>
        {#if s === worst}<span class="badge">{$t('practice.weakest')}</span>{/if}
      </button>
    {/each}
  </div>
</main>

<style>
  .practice { max-width: 480px; margin: 0 auto; padding: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
  .tile {
    display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem 0.5rem;
    background: var(--wood-light); color: var(--cream);
  }
  .tile.worst { outline: 2px solid var(--accent); }
  .badge { color: var(--accent); font-size: 0.75rem; }
</style>
