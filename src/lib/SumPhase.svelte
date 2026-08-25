<!-- src/lib/SumPhase.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import Numpad from './Numpad.svelte';
  import type { NumpadApi } from './Numpad.svelte';

  let { locked, symbolFirst, onsum, ontipp, bindApi }: {
    locked: boolean; symbolFirst: boolean;
    onsum: (cents: number) => void; ontipp: () => void;
    bindApi: (api: NumpadApi) => void;
  } = $props();
</script>

{#if locked}
  <p class="prompt">{$t('game.tab-wait')}</p>
{:else}
  <p class="prompt">{$t('game.sum-prompt')}</p>
  <Numpad onsubmit={onsum} {symbolFirst} {bindApi} />
  <button class="tipp" onclick={ontipp}>{$t('game.tipp')}</button>
{/if}

<style>
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .tipp { background: var(--wood-light); color: var(--cream); }
</style>
