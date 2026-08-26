<!-- src/routes/Bar.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { keynav } from '../lib/keynav';
  import { go } from '../lib/router';
  import { career } from '../stores/career';
  import { settings } from '../stores/settings';
  import { UPGRADES } from '../core/career';
  import { formatEuro } from '../core/money';

  const gameplay = UPGRADES.filter((u) => u.kind === 'gameplay');
  const cosmetics = UPGRADES.filter((u) => u.kind === 'cosmetic');

  const ACCENTS: { id: string; upgradeId: string | null }[] = [
    { id: 'default', upgradeId: null },
    { id: 'copper', upgradeId: 'accent-copper' },
    { id: 'forest', upgradeId: 'accent-forest' },
  ];

  function owned(id: string): boolean {
    return $career.upgrades.includes(id);
  }

  function buy(id: string, costCents: number) {
    if (owned(id)) return; // guard double-buy
    if ($career.walletCents < costCents) return; // guard insufficient funds
    career.update((c) => ({
      ...c,
      walletCents: c.walletCents - costCents,
      upgrades: [...c.upgrades, id],
    }));
  }

  function setAccent(id: string) {
    settings.update((s) => ({ ...s, accent: id }));
  }
</script>

<main class="bar" use:keynav>
  <h2><button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button> {$t('bar.title')}</h2>

  <div class="wallet">
    <span class="wallet-label">{$t('bar.wallet')}</span>
    <span class="wallet-amount">{formatEuro($career.walletCents, $settings.symbolFirst)}</span>
  </div>

  <div class="cards">
    {#each gameplay as u (u.id)}
      {@const isOwned = owned(u.id)}
      {@const affordable = $career.walletCents >= u.costCents}
      <div class="card" class:owned={isOwned} class:locked={!isOwned && !affordable}>
        <div class="card-head">
          <strong>{$t(`bar.${u.id}.name`)}</strong>
          <span class="cost">{formatEuro(u.costCents, $settings.symbolFirst)}</span>
        </div>
        <p class="desc">{$t(`bar.${u.id}.desc`)}</p>
        {#if isOwned}
          <span class="badge">{$t('bar.owned')}</span>
        {:else}
          <button class="buy" disabled={!affordable} onclick={() => buy(u.id, u.costCents)}>
            {$t('bar.buy')}
          </button>
        {/if}
      </div>
    {/each}
  </div>
  <p class="note">{$t('bar.ranked-note')}</p>

  <div class="cards">
    {#each cosmetics as u (u.id)}
      {@const isOwned = owned(u.id)}
      {@const affordable = $career.walletCents >= u.costCents}
      <div class="card" class:owned={isOwned} class:locked={!isOwned && !affordable}>
        <div class="card-head">
          <strong>{$t(`bar.${u.id}.name`)}</strong>
          <span class="cost">{formatEuro(u.costCents, $settings.symbolFirst)}</span>
        </div>
        <p class="desc">{$t(`bar.${u.id}.desc`)}</p>
        {#if isOwned}
          <span class="badge">{$t('bar.owned')}</span>
        {:else}
          <button class="buy" disabled={!affordable} onclick={() => buy(u.id, u.costCents)}>
            {$t('bar.buy')}
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <h3>{$t('bar.accent')}</h3>
  <div class="accents">
    {#each ACCENTS as a (a.id)}
      {#if a.upgradeId === null || owned(a.upgradeId)}
        <label class="accent-opt">
          <input
            type="radio" name="accent" value={a.id}
            checked={($settings.accent ?? 'default') === a.id}
            onchange={() => setAccent(a.id)}
          />
          {a.id === 'default' ? $t('bar.accent-default') : $t(`bar.${a.upgradeId}.name`)}
        </label>
      {/if}
    {/each}
  </div>
</main>

<style>
  .bar { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  h3 { margin: 0.25rem 0 0; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .wallet {
    display: flex; flex-direction: column; gap: 0.2rem;
    background: var(--wood-light); border-radius: var(--radius); padding: 0.75rem;
  }
  .wallet-label { font-size: 0.8rem; opacity: 0.8; }
  .wallet-amount { font-size: 1.8rem; font-weight: bold; font-variant-numeric: tabular-nums; }
  .cards { display: flex; flex-direction: column; gap: 0.5rem; }
  .card {
    display: flex; flex-direction: column; gap: 0.35rem;
    background: var(--wood-light); border-radius: var(--radius); padding: 0.6rem 0.75rem;
  }
  .card.owned { opacity: 0.85; }
  .card.locked { opacity: 0.55; }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .cost { font-variant-numeric: tabular-nums; opacity: 0.85; }
  .desc { font-size: 0.85rem; opacity: 0.8; margin: 0; }
  .badge {
    align-self: flex-start; background: var(--accent); color: var(--ink);
    border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.8rem; font-weight: bold;
  }
  .buy { background: var(--accent); color: var(--ink); align-self: flex-start; min-height: 36px; padding: 0.3rem 1rem; }
  .buy:disabled { opacity: 0.5; }
  .note { font-size: 0.8rem; opacity: 0.7; margin: -0.25rem 0 0; }
  .accents { display: flex; flex-direction: column; gap: 0.4rem; }
  .accent-opt { display: flex; align-items: center; gap: 0.6rem; }
  .accent-opt input { width: 20px; height: 20px; }
</style>
