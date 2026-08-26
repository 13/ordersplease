<!-- src/lib/ChangePhase.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { COIN_DENOMS, type Denom, type Till } from '../core/till';
  import { denomLabel } from './denom-view';
  import Money from './Money.svelte';
  import TillGrid from './TillGrid.svelte';
  import ChangePile from './ChangePile.svelte';

  let {
    paymentPieces, tillView, pile, showPileTotal, showKeys, finishMode, askOpen,
    ontake, onreturn, onconfirm, ontoggleask, onask, onnotenough, ontipp, tippHint = '',
    showExtras = true, typedDisplay = '', typedHint = '',
  }: {
    paymentPieces: Denom[]; tillView: Till; pile: Denom[];
    showPileTotal: boolean; showKeys: boolean; finishMode: boolean; askOpen: boolean;
    ontake: (d: Denom) => void; onreturn: (index: number) => void;
    onconfirm: () => void; ontoggleask: () => void; onask: (d: Denom) => void;
    onnotenough: () => void; ontipp: () => void; tippHint?: string; showExtras?: boolean;
    typedDisplay?: string; typedHint?: string;
  } = $props();
</script>

<p class="prompt">
  {$t('game.pays')}:
  {#each [...paymentPieces].sort((a, b) => b - a) as p, i (i)}
    <Money denom={p} interactive={false} />
  {/each}
</p>
<TillGrid till={tillView} {ontake} disabled={finishMode} {showKeys} />
<ChangePile {pile} showTotal={showPileTotal} {onreturn} />
{#if askOpen}
  <div class="ask-row">
    {#each COIN_DENOMS as d, i (d)}
      <button onclick={() => onask(d)}>
        <kbd>{i + 1}</kbd> {$t('game.ask-for')} {denomLabel(d)}?
      </button>
    {/each}
  </div>
{/if}
{#if typedDisplay !== ''}
  <div class="typed">⌨ {typedDisplay} <small>{typedHint}</small></div>
{/if}
<div class="actions">
  <button class="confirm" onclick={onconfirm}>
    <kbd>⏎</kbd> {finishMode ? $t('game.finish') : $t('game.confirm')}
  </button>
  <button class="ask" onclick={ontoggleask}><kbd>A</kbd> {$t('game.ask')}</button>
  {#if showExtras}
    <button class="ask" onclick={onnotenough}><kbd>N</kbd> {$t('game.not-enough')}</button>
    <button class="tipp" onclick={ontipp}><kbd>T</kbd> {$t('game.tipp')}{tippHint}</button>
  {/if}
</div>

<style>
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .typed {
    background: var(--cream); color: var(--ink);
    border-radius: var(--radius); padding: 0.4rem 0.8rem;
    font-size: 1.2rem; font-weight: bold; font-variant-numeric: tabular-nums;
    display: flex; align-items: baseline; gap: 0.6rem;
    animation: op-slide-up 0.15s ease-out;
  }
  .typed small { font-weight: normal; font-size: 0.7rem; opacity: 0.7; }
  .actions {
    display: flex; gap: 0.5rem;
    position: sticky; bottom: 0;
    padding: var(--space-2) 0 calc(var(--space-2) + env(safe-area-inset-bottom));
    background: var(--wood);
  }
  .confirm { flex: 1; background: var(--ok); color: var(--cream); font-size: 1.1rem; }
  .ask { background: var(--accent); color: var(--ink); }
  .ask-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .ask-row button { background: var(--wood-light); color: var(--cream); }
  .ask-row kbd { background: var(--cream); color: var(--ink); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; margin-right: 2px; }
  .tipp { background: var(--wood-light); color: var(--cream); }
  .confirm kbd, .ask kbd, .tipp kbd { background: var(--cream); color: var(--ink); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; margin-right: 2px; }
  .confirm kbd { background: rgb(255 255 255 / 0.85); }
</style>
