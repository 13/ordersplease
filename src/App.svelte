<script lang="ts">
  import { route } from './lib/router';
  import Home from './routes/Home.svelte';
  import Levels from './routes/Levels.svelte';
  import Game from './routes/Game.svelte';
  import Stats from './routes/Stats.svelte';
  import MenuEditor from './routes/MenuEditor.svelte';
  import Settings from './routes/Settings.svelte';

  const gameLevel = $derived.by(() => {
    const m = $route.match(/^game\/(\d+)$/);
    return m ? Number(m[1]) : null;
  });
</script>

{#key $route}
  {#if gameLevel !== null}
    <Game mode="level" level={gameLevel} />
  {:else if $route === 'rush'}
    <Game mode="rush" />
  {:else if $route === 'levels'}
    <Levels />
  {:else if $route === 'stats'}
    <Stats />
  {:else if $route === 'menu'}
    <MenuEditor />
  {:else if $route === 'settings'}
    <Settings />
  {:else}
    <Home />
  {/if}
{/key}
