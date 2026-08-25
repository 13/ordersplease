<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { progress, unlockedLevel } from '../stores/progress';
  import { MAX_LEVEL } from '../core/difficulty';
  import { keynav } from '../lib/keynav';

  const unlocked = $derived(unlockedLevel($progress));
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
</script>

<main class="levels">
  <h2><button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button> {$t('levels.title')}</h2>
  <div class="grid" use:keynav style="--keynav-cols: 5">
    {#each levels as l (l)}
      <button class="level" disabled={l > unlocked} onclick={() => go(`game/${l}`)}>
        <span class="num">{l}</span>
        <span class="stars">{'★'.repeat($progress.stars[l] ?? 0)}</span>
      </button>
    {/each}
  </div>
</main>

<style>
  .levels { max-width: 480px; margin: 0 auto; padding: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
  .level {
    aspect-ratio: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: var(--wood-light); color: var(--cream);
  }
  .level:disabled { opacity: 0.35; }
  .num { font-size: 1.2rem; font-weight: bold; }
  .stars { color: var(--accent); font-size: 0.8rem; min-height: 1em; }
</style>
