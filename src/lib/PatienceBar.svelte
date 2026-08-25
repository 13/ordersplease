<!-- src/lib/PatienceBar.svelte -->
<script lang="ts">
  let { frac }: { frac: number } = $props();
  const clamped = $derived(Math.min(Math.max(frac, 0), 1));
  const color = $derived(clamped > 0.5 ? 'var(--ok)' : clamped > 0.25 ? 'var(--accent)' : 'var(--danger)');
</script>

<div class="track" role="progressbar" aria-valuenow={Math.round(clamped * 100)}>
  <div class="fill" style="width: {clamped * 100}%; background: {color}"></div>
</div>

<style>
  .track {
    height: 8px; border-radius: 4px; background: rgb(0 0 0 / 0.35); overflow: hidden;
  }
  .fill { height: 100%; transition: width 0.2s linear; }
</style>
