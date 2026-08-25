<script lang="ts">
  import { tick } from 'svelte';
  import { route, go } from './lib/router';
  import Home from './routes/Home.svelte';
  import Levels from './routes/Levels.svelte';
  import Game from './routes/Game.svelte';
  import Stats from './routes/Stats.svelte';
  import MenuEditor from './routes/MenuEditor.svelte';
  import Settings from './routes/Settings.svelte';
  import Practice from './routes/Practice.svelte';
  import Tutorial from './routes/Tutorial.svelte';
  import { SKILL_ERROR, type Skill } from './core/difficulty';
  import { settings } from './stores/settings';
  import { progress, unlockedLevel } from './stores/progress';
  import { focusFirst } from './lib/focus';

  const gameLevel = $derived.by(() => {
    const m = $route.match(/^game\/(\d+)$/);
    return m ? Number(m[1]) : null;
  });

  const practiceSkill = $derived.by(() => {
    const m = $route.match(/^practice\/([a-z]+)$/);
    return m && m[1] in SKILL_ERROR ? (m[1] as Skill) : null;
  });

  const onGameRoute = $derived(
    gameLevel !== null || $route === 'rush' || $route === 'daily' || practiceSkill !== null,
  );

  function onEsc(e: KeyboardEvent) {
    if (e.key !== 'Escape' || onGameRoute) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    if ($route !== 'home') go('home');
  }

  $effect(() => {
    document.documentElement.lang = $settings.locale;
  });

  $effect(() => {
    $route; // track
    tick().then(() => focusFirst(document.querySelector('main')));
  });
</script>

<svelte:window onkeydown={onEsc} />

{#key $route}
  {#if gameLevel !== null && gameLevel <= unlockedLevel($progress)}
    <Game mode="level" level={gameLevel} />
  {:else if gameLevel !== null}
    <Levels />
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
  {:else if practiceSkill !== null}
    <Game mode="practice" skill={practiceSkill} />
  {:else if $route === 'practice'}
    <Practice />
  {:else if $route === 'daily'}
    <Game mode="daily" />
  {:else if $route === 'tutorial'}
    <Tutorial />
  {:else}
    <Home />
  {/if}
{/key}
