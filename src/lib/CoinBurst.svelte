<!-- src/lib/CoinBurst.svelte -->
<script lang="ts">
  let { burstKey }: { burstKey: number } = $props();

  const reduced = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  interface Particle { id: number; dx: number; dy: number; rot: number; delay: number; }
  let parts = $state<Particle[]>([]);

  $effect(() => {
    if (burstKey === 0 || reduced) {
      parts = [];
      return;
    }
    const n = 8 + Math.floor(Math.random() * 5);
    parts = Array.from({ length: n }, (_, i) => ({
      id: burstKey * 100 + i,
      dx: (Math.random() - 0.5) * 240,
      dy: -60 - Math.random() * 140,
      rot: (Math.random() - 0.5) * 540,
      delay: Math.random() * 0.1,
    }));
    const t = setTimeout(() => (parts = []), 1000);
    return () => clearTimeout(t);
  });
</script>

{#each parts as p (p.id)}
  <span class="coin-part"
    style="--dx:{p.dx}px; --dy:{p.dy}px; --rot:{p.rot}deg; animation-delay:{p.delay}s"></span>
{/each}

<style>
  .coin-part {
    position: fixed; left: 50%; top: 24%;
    width: 22px; height: 22px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #f0c96a, #c9962e);
    border: 2px solid rgb(0 0 0 / 0.25);
    pointer-events: none;
    animation: coin-burst 0.9s cubic-bezier(0.2, 0.6, 0.3, 1) both;
  }
  @keyframes coin-burst {
    from { transform: translate(0, 0) rotate(0); opacity: 1; }
    70% { opacity: 1; }
    to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
  }
</style>
