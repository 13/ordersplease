<!-- src/lib/Numpad.svelte -->
<script lang="ts">
  import { formatEuro } from '../core/money';

  let { onsubmit, symbolFirst = false }:
    { onsubmit: (cents: number) => void; symbolFirst?: boolean } = $props();

  let digits = $state('');
  const display = $derived(formatEuro(Number(digits || '0'), symbolFirst));

  function tap(d: string) {
    if (digits.length < 6) digits += d;
  }
  function submit() {
    onsubmit(Number(digits || '0'));
    digits = '';
  }
</script>

<div class="numpad">
  <output>{display}</output>
  <div class="keys">
    {#each ['1','2','3','4','5','6','7','8','9'] as k}
      <button onclick={() => tap(k)}>{k}</button>
    {/each}
    <button class="fn" onclick={() => (digits = '')}>C</button>
    <button onclick={() => tap('0')}>0</button>
    <button class="ok" onclick={submit}>OK</button>
  </div>
</div>

<style>
  .numpad { display: flex; flex-direction: column; gap: 0.5rem; }
  output {
    font-size: 2rem; text-align: right; padding: 0.25rem 0.75rem;
    background: var(--cream); color: var(--ink); border-radius: var(--radius);
    font-variant-numeric: tabular-nums;
  }
  .keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  .keys button {
    font-size: 1.5rem; padding: 0.75rem 0;
    background: var(--wood-light); color: var(--cream);
  }
  .fn { background: var(--danger) !important; }
  .ok { background: var(--ok) !important; }
</style>
