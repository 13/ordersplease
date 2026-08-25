<!-- src/lib/MenuCard.svelte -->
<script lang="ts">
  import { formatEuro } from '../core/money';
  import type { MenuItem } from '../core/menu';

  let { menu, pricesHidden, symbolFirst = false }:
    { menu: MenuItem[]; pricesHidden: boolean; symbolFirst?: boolean } = $props();

  let collapsed = $state(false);
</script>

<section class="card" class:collapsed>
  <button class="head" aria-expanded={!collapsed} onclick={() => (collapsed = !collapsed)}>
    Menu {collapsed ? '▾' : '▴'}
  </button>
  {#if !collapsed}
    <ul>
      {#each menu as item (item.id)}
        <li>
          <span>{item.name}</span>
          <span class="dots"></span>
          <span class="price">{pricesHidden ? '?,?? €' : formatEuro(item.priceCents, symbolFirst)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .card {
    background: var(--cream); color: var(--ink);
    border-radius: var(--radius); padding: 0.5rem 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .head {
    background: none; color: inherit; width: 100%; text-align: left;
    font: inherit; font-weight: bold; min-height: 32px;
  }
  ul { list-style: none; padding: 0; }
  li { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.15rem 0; }
  .dots { flex: 1; border-bottom: 1px dotted var(--ink); }
  .price { font-variant-numeric: tabular-nums; }
</style>
