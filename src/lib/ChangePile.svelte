<script lang="ts">
  import type { Denom } from '../core/till';
  import { piecesTotal } from '../core/order';
  import { formatEuro } from '../core/money';
  import Money from './Money.svelte';

  let { pile, showTotal, onreturn }:
    { pile: Denom[]; showTotal: boolean; onreturn: (index: number) => void } = $props();
</script>

<div class="pile" class:empty={pile.length === 0}>
  {#each pile as d, i}
    <Money denom={d} onclick={() => onreturn(i)} />
  {/each}
  {#if showTotal && pile.length > 0}
    <span class="total">{formatEuro(piecesTotal(pile))}</span>
  {/if}
</div>

<style>
  .pile {
    min-height: 60px; display: flex; flex-wrap: wrap; gap: 0.4rem;
    align-items: center; padding: 0.4rem;
    border: 2px dashed rgb(245 236 215 / 0.4); border-radius: var(--radius);
  }
  .empty::after { content: '·'; opacity: 0.4; margin: auto; }
  .total { margin-left: auto; font-size: 1.2rem; font-variant-numeric: tabular-nums; }
</style>
