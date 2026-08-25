<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { customMenu } from '../stores/menu';
  import { settings } from '../stores/settings';
  import { validateItem } from '../core/menu';
  import { formatEuro, parseEuro } from '../core/money';

  let newName = $state('');
  let newPrice = $state('');
  let newCategory = $state<'drink' | 'food'>('drink');
  let error = $state<string | null>(null);

  function add() {
    const cents = parseEuro(newPrice);
    const err = validateItem(newName, cents ?? -1);
    if (err) {
      error = err;
      return;
    }
    customMenu.update((m) => [
      ...m,
      { id: `custom-${Date.now()}`, name: newName.trim(), priceCents: cents!, category: newCategory },
    ]);
    newName = '';
    newPrice = '';
    error = null;
  }

  function remove(id: string) {
    customMenu.update((m) => m.filter((x) => x.id !== id));
  }

  function toggleCategory(id: string) {
    customMenu.update((m) => m.map((x) =>
      x.id === id ? { ...x, category: x.category === 'food' ? 'drink' : 'food' } : x,
    ));
  }
</script>

<main class="editor">
  <h2><button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button> {$t('menu.title')}</h2>

  <label class="toggle">
    <input type="checkbox" bind:checked={$settings.useCustomMenu} />
    {$t('menu.use-custom')}
  </label>

  <ul>
    {#each $customMenu as item (item.id)}
      <li>
        <span>{item.name}</span>
        <span class="price">{formatEuro(item.priceCents, $settings.symbolFirst)}</span>
        <button
          class="cat"
          onclick={() => toggleCategory(item.id)}
          aria-label={item.category === 'food' ? $t('menu.cat-food') : $t('menu.cat-drink')}
        >
          {item.category === 'food' ? '🍽' : '🍺'}
        </button>
        <button class="del" onclick={() => remove(item.id)}>✕</button>
      </li>
    {/each}
  </ul>

  <div class="add">
    <input placeholder={$t('menu.name')} bind:value={newName} />
    <input placeholder="4,50" inputmode="decimal" bind:value={newPrice} />
    <button
      class="cat"
      onclick={() => (newCategory = newCategory === 'food' ? 'drink' : 'food')}
      aria-label={newCategory === 'food' ? $t('menu.cat-food') : $t('menu.cat-drink')}
    >
      {newCategory === 'food' ? '🍽' : '🍺'}
    </button>
    <button onclick={add}>{$t('menu.add')}</button>
  </div>
  {#if error}<p class="error">{$t(error)}</p>{/if}
</main>

<style>
  .editor { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .toggle { display: flex; gap: 0.5rem; align-items: center; }
  input[type='checkbox'] { width: 24px; height: 24px; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li {
    display: flex; align-items: center; gap: 0.5rem;
    background: var(--wood-light); border-radius: var(--radius); padding: 0.4rem 0.6rem;
  }
  li span:first-child { flex: 1; }
  .price { font-variant-numeric: tabular-nums; }
  .del { background: var(--danger); color: var(--cream); min-width: 40px; min-height: 40px; }
  .cat { background: var(--wood-light); min-width: 44px; min-height: 40px; }
  .add { display: flex; gap: 0.4rem; }
  .add input {
    flex: 1; min-width: 0; padding: 0.6rem; border-radius: var(--radius);
    border: none; font: inherit; background: var(--cream); color: var(--ink);
  }
  .add button { background: var(--ok); color: var(--cream); }
  .error { color: var(--danger); }
</style>
