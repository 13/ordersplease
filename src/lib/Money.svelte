<!-- src/lib/Money.svelte -->
<script lang="ts">
  import type { Denom } from '../core/till';
  import { denomColor, denomLabel, isNote } from './denom-view';

  let { denom, disabled = false, count = null, onclick, keyBadge = null, interactive = true }: {
    denom: Denom;
    disabled?: boolean;
    count?: number | null;
    onclick?: () => void;
    keyBadge?: string | null;
    interactive?: boolean;
  } = $props();

  const label = $derived(
    count === null ? denomLabel(denom) : `${denomLabel(denom)} (${count})`,
  );
</script>

<svelte:element
  this={interactive ? 'button' : 'span'}
  type={interactive ? 'button' : undefined}
  class="money"
  class:note={isNote(denom)} class:coin={!isNote(denom)}
  style="--money-color: {denomColor(denom)}"
  aria-label={label}
  role={interactive ? undefined : 'img'}
  disabled={interactive && disabled ? true : undefined}
  onclick={interactive ? onclick : undefined}
>
  {denomLabel(denom)}
  {#if count !== null}<span class="badge">{count}</span>{/if}
  {#if keyBadge}<kbd class="keybadge">{keyBadge}</kbd>{/if}
</svelte:element>

<style>
  .money {
    position: relative; background: var(--money-color); color: var(--ink);
    font-weight: bold; font-size: 0.9rem;
    display: grid; place-items: center;
    border: none; border-radius: var(--radius); cursor: pointer;
    animation: op-pop 0.15s ease-out;
    min-width: 0; min-height: 0; padding: 0; font-family: inherit;
  }
  .money:disabled { opacity: 0.3; }
  span.money { cursor: default; }
  .coin { width: 52px; height: 52px; border-radius: 50%; border: 3px solid rgb(0 0 0 / 0.25); }
  .note { width: 72px; height: 48px; border-radius: 6px; border: 2px solid rgb(0 0 0 / 0.25); }
  .badge {
    position: absolute; top: -6px; right: -6px;
    background: var(--ink); color: var(--cream);
    border-radius: 999px; font-size: 0.7rem; padding: 1px 6px;
  }
  .keybadge {
    position: absolute; bottom: -7px; left: -7px;
    min-width: 16px; height: 16px; line-height: 14px;
    background: var(--cream); color: var(--ink);
    border: 1px solid var(--ink); border-bottom-width: 2px;
    border-radius: 4px; font-size: 0.65rem; text-align: center;
    font-family: ui-monospace, 'Cascadia Mono', monospace; padding: 0 3px;
    box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.2);
  }
</style>
