<script lang="ts">
  import type { Denom } from '../core/till';
  import { denomColor, denomLabel, isNote } from './denom-view';

  let { denom, disabled = false, count = null, onclick }:
    { denom: Denom; disabled?: boolean; count?: number | null; onclick?: () => void } = $props();

  const label = $derived(
    count === null ? denomLabel(denom) : `${denomLabel(denom)} (${count})`,
  );
</script>

<button
  type="button"
  class:note={isNote(denom)} class:coin={!isNote(denom)}
  style="--money-color: {denomColor(denom)}"
  aria-label={label}
  {disabled} onclick={onclick}
>
  {denomLabel(denom)}
  {#if count !== null}<span class="badge">{count}</span>{/if}
</button>

<style>
  button {
    position: relative; background: var(--money-color); color: var(--ink);
    font-weight: bold; font-size: 0.9rem;
    display: grid; place-items: center;
  }
  button:disabled { opacity: 0.3; }
  .coin { width: 52px; height: 52px; border-radius: 50%; border: 3px solid rgb(0 0 0 / 0.25); }
  .note { width: 72px; height: 48px; border-radius: 6px; border: 2px solid rgb(0 0 0 / 0.25); }
  .badge {
    position: absolute; top: -6px; right: -6px;
    background: var(--ink); color: var(--cream);
    border-radius: 999px; font-size: 0.7rem; padding: 1px 6px;
  }
</style>
