<!-- src/lib/GameToasts.svelte -->
<script lang="ts">
  let { flash, errorFlash }: {
    flash: string | null;
    errorFlash: string | null;
  } = $props();
</script>

{#if flash}<div class="flash">{flash}</div>{/if}
{#if errorFlash}<div class="flash err-flash">{errorFlash}</div>{/if}

<style>
  .flash { animation: op-slide-up 0.2s ease-out; }
  .flash {
    position: fixed; inset: 20% 0 auto 0; margin: 0 auto; width: fit-content;
    background: linear-gradient(180deg, var(--cream), var(--cream-2));
    color: var(--ink);
    padding: 0.75rem 1.5rem; border-radius: 14px;
    font-size: 1.15rem; font-weight: bold;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.6);
    border: 1px solid rgb(0 0 0 / 0.15);
  }
  .err-flash { inset: 28% 0 auto 0; background: var(--danger); color: var(--cream); font-size: 1rem; }
</style>
