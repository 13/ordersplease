<script lang="ts">
  import { DENOMS, type Denom, type Till } from '../core/till';
  import Money from './Money.svelte';

  let { till, ontake, disabled = false }: {
    till: Till; ontake: (d: Denom) => void; disabled?: boolean;
  } = $props();
</script>

<div class="till" class:dimmed={disabled}>
  {#each DENOMS as d (d)}
    <Money denom={d} count={till[d] ?? 0}
      disabled={disabled || (till[d] ?? 0) === 0} onclick={() => ontake(d)} />
  {/each}
</div>

<style>
  .till {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem; justify-items: center;
    padding: 0.6rem; background: rgb(0 0 0 / 0.25); border-radius: var(--radius);
  }
  .dimmed { opacity: 0.45; }
</style>
