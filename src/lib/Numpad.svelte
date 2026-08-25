<!-- src/lib/Numpad.svelte -->
<script lang="ts" module>
  export interface NumpadApi { press: (k: string) => void }
</script>

<script lang="ts">
  import { formatEuro, parseEntry } from '../core/money';

  let { onsubmit, symbolFirst = false, bindApi }: {
    onsubmit: (cents: number) => void;
    symbolFirst?: boolean;
    bindApi?: (api: NumpadApi) => void;
  } = $props();

  let digits = $state('');
  const display = $derived(formatEuro(parseEntry(digits), symbolFirst));

  function tap(d: string) {
    if (d === ',') {
      if (digits.includes(',')) return;
      digits = digits === '' ? '0,' : digits + ',';
      return;
    }
    const [euros, cents] = digits.split(',');
    if (cents !== undefined) {
      if (cents.length >= 2) return;
    } else if (euros.length >= 4) return;
    digits += d;
  }
  function backspace() {
    digits = digits.slice(0, -1);
  }
  function submit() {
    if (digits === '') return;
    onsubmit(parseEntry(digits));
    digits = '';
  }

  $effect(() => {
    bindApi?.({
      press: (k) => {
        if (k === 'Backspace') backspace();
        else if (k === 'Enter') submit();
        else tap(k);
      },
    });
  });
</script>

<div class="numpad">
  <output>{display}</output>
  <div class="keys">
    {#each ['1','2','3','4','5','6','7','8','9'] as k}
      <button type="button" onclick={() => tap(k)}>{k}</button>
    {/each}
    <button type="button" class="comma" onclick={() => tap(',')}>,</button>
    <button type="button" onclick={() => tap('0')}>0</button>
    <button type="button" class="ok" disabled={digits === ''} onclick={submit}>OK</button>
  </div>
  <button type="button" class="fn" onclick={() => (digits = '')}>C</button>
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
  .comma { background: var(--accent) !important; color: var(--ink) !important; }
  .ok { background: var(--ok) !important; }
  .ok:disabled { opacity: 0.4; }
  .fn { background: var(--danger); color: var(--cream); }
</style>
