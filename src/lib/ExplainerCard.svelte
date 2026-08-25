<!-- src/lib/ExplainerCard.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { focusFirst } from './focus';

  let { title, body, ondismiss }: {
    title: string; body: string; ondismiss: () => void;
  } = $props();

  let rootEl = $state<HTMLElement | null>(null);
  $effect(() => focusFirst(rootEl));
</script>

<div class="explain" role="dialog" aria-label={title} bind:this={rootEl}>
  <div class="card">
    <h3>💡 {title}</h3>
    <p>{body}</p>
    <button onclick={ondismiss}>{$t('explain.dismiss')}</button>
  </div>
</div>

<style>
  .explain {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.8);
    display: flex; align-items: center; justify-content: center; padding: var(--space-4);
  }
  .card {
    background: var(--cream); color: var(--ink);
    border-radius: var(--radius); padding: var(--space-5);
    max-width: 340px; display: flex; flex-direction: column; gap: var(--space-3);
    box-shadow: var(--shadow); animation: op-pop 0.2s ease-out;
  }
  .card button { background: var(--accent); color: var(--ink); font-size: 1.05rem; }
</style>
