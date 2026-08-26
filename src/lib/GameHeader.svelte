<!-- src/lib/GameHeader.svelte -->
<script lang="ts">
  let { lives, heartPulse, title, streak, tipJar, tipJarText, score, scoreLabel, menuLabel, onmenu }: {
    lives: number; heartPulse: boolean; title: string; streak: number;
    tipJar: number; tipJarText: string; score: number; scoreLabel: string;
    menuLabel: string; onmenu: () => void;
  } = $props();
</script>

<header>
  <span class="lives" class:pulse={heartPulse}>{'♥'.repeat(Math.max(0, lives))}</span>
  <span>{title}</span>
  {#if streak >= 3}<span class="flame">🔥{streak}</span>{/if}
  {#if tipJar > 0}<span class="jar">🫙 {tipJarText}</span>{/if}
  <span>{scoreLabel}: {score}</span>
  <button class="menu-btn" aria-label={menuLabel} onclick={onmenu}>☰</button>
</header>

<style>
  header { display: flex; justify-content: space-between; align-items: center; }
  .lives { color: var(--danger); }
  .lives.pulse { animation: op-pulse 0.5s ease-in-out; }
  .flame { color: var(--accent); font-weight: bold; animation: op-pop 0.3s ease-out; }
  .jar { font-size: 0.9rem; }
  .menu-btn { background: none; color: var(--cream); font-size: 1.2rem; padding: 0 0.3rem; min-height: 0; }
</style>
