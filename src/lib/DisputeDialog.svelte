<!-- src/lib/DisputeDialog.svelte -->
<script lang="ts">
  import { focusFirst } from './focus';
  import { keynav } from './keynav';

  let { claimText, question, options, onanswer }: {
    claimText: string;
    question: string;
    options: { label: string; value: number }[];
    onanswer: (value: number) => void;
  } = $props();

  let rootEl = $state<HTMLElement | null>(null);
  $effect(() => {
    focusFirst(rootEl);
  });
</script>

<div class="dispute" role="alertdialog" aria-label={question} bind:this={rootEl}>
  <p class="claim">“{claimText}”</p>
  <p>{question}</p>
  <div class="choices" use:keynav>
    {#each options as o, i (o.value)}
      <button onclick={() => onanswer(o.value)}><kbd>{i + 1}</kbd> {o.label}</button>
    {/each}
  </div>
</div>

<style>
  .dispute {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; text-align: center; padding: 1rem;
  }
  .claim { font-size: 1.3rem; font-style: italic; color: var(--accent); }
  .choices { display: flex; gap: 0.75rem; }
  .choices button {
    background: var(--cream); color: var(--ink);
    font-size: 1.2rem; font-weight: bold; padding: 0.75rem 1.5rem;
  }
  .choices kbd { background: var(--wood); color: var(--cream); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; margin-right: 4px; }
</style>
