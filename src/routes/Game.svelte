<!-- src/routes/Game.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settings } from '../stores/settings';
  import { activeMenu } from '../stores/menu';
  import { stats, recordRound, recordDay } from '../stores/stats';
  import { progress } from '../stores/progress';
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import {
    createSession, tickSession, completeRound, spawnCustomer, MAX_LIVES,
  } from '../core/session';
  import {
    createRound, submitSum, submitChange, askCustomer, timeoutRound, type RoundState,
  } from '../core/round';
  import { generateOrder, generatePayment, amendOrder, piecesTotal } from '../core/order';
  import { renderOrder, renderAmendment } from '../core/text-order';
  import { starsFor } from '../core/scoring';
  import { formatEuro } from '../core/money';
  import { COIN_DENOMS, type Denom } from '../core/till';
  import { MAX_LEVEL } from '../core/difficulty';
  import { denomLabel } from '../lib/denom-view';
  import { beep } from '../lib/sound';
  import Numpad from '../lib/Numpad.svelte';
  import MenuCard from '../lib/MenuCard.svelte';
  import PatienceBar from '../lib/PatienceBar.svelte';
  import TillGrid from '../lib/TillGrid.svelte';
  import ChangePile from '../lib/ChangePile.svelte';

  let { mode, level = 1 }: { mode: 'level' | 'rush'; level?: number } = $props();

  let session = $state(createSession(
    mode, level, get(activeMenu), get(settings).useCustomMenu, Date.now() % 2 ** 31,
  ));
  let round = $state<RoundState | null>(null);
  let orderText = $state('');
  let amendText = $state<string | null>(null);
  let pile = $state<Denom[]>([]);
  let menuHidden = $state(false);
  let askOpen = $state(false);
  let flash = $state<string | null>(null);
  let finalized = $state(false);
  let roundStartedAt = 0;
  let amendTimer: ReturnType<typeof setTimeout> | undefined;
  let menuTimer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const symbolFirst = $derived($settings.symbolFirst);
  const tillView = $derived.by(() => {
    if (!round) return session.till;
    const view = { ...round.till };
    for (const p of pile) view[p] -= 1;
    return view;
  });
  const stars = $derived(
    session.finished === 'won' ? starsFor(session.score, session.params.ordersPerLevel) : 0,
  );

  function startRound() {
    clearTimeout(amendTimer);
    if (session.finished || round || flash) return;
    if (session.queue.length === 0) {
      if (session.mode === 'rush') return; // rush waits for the spawn timer
      session = spawnCustomer(session);
    }
    const order = generateOrder(session.menu, session.params, session.rng);
    const payment = generatePayment(order.totalCents, session.params.paymentStyle, session.rng);
    round = createRound(order, payment, session.till);
    orderText = renderOrder(order, $settings.locale);
    amendText = null;
    pile = [];
    askOpen = false;
    roundStartedAt = performance.now();

    if (session.rng() < session.params.midOrderChangeProb) {
      const amended = amendOrder(order, session.rng);
      amendTimer = setTimeout(() => {
        if (round && round.phase === 'sum') {
          const pieces = generatePayment(
            amended.order.totalCents, session.params.paymentStyle, session.rng,
          );
          round = {
            ...round, order: amended.order,
            paymentPieces: pieces, paymentCents: piecesTotal(pieces),
          };
          amendText = renderAmendment(amended.amendedLine, $settings.locale);
        }
      }, 2500);
    }

    const vis = session.params.menuVisibleSeconds;
    clearTimeout(menuTimer);
    menuHidden = vis === 0;
    if (vis !== null && vis > 0) {
      menuTimer = setTimeout(() => (menuHidden = true), vis * 1000);
    }
  }

  function finishRound() {
    if (!round) return;
    const done = round;
    const ms = performance.now() - roundStartedAt;
    const failed = done.success !== true;
    stats.update((s) => recordRound(s, done.errors, ms, failed));
    flash = failed
      ? `${$t('game.wrong')} ${formatEuro(done.order.totalCents, symbolFirst)}`
      : $t('game.correct');
    beep(!failed, $settings.sound);
    session = completeRound(session, done);
    round = null;
    pile = [];
    clearTimeout(amendTimer);
    clearTimeout(menuTimer);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flash = null;
      startRound();
    }, 1400);
  }

  function onSum(cents: number) {
    if (!round) return;
    round = submitSum(round, cents);
    if (round.phase === 'done') finishRound();
    else if (round.sumTries > 0 && round.phase === 'sum') beep(false, $settings.sound);
  }

  function take(d: Denom) {
    if ((tillView[d] ?? 0) > 0) pile = [...pile, d];
  }
  function ret(index: number) {
    pile = pile.toSpliced(index, 1);
  }
  function confirmChange() {
    if (!round) return;
    round = submitChange(round, pile);
    if (round.phase === 'done') finishRound();
    else {
      pile = [];
      beep(false, $settings.sound);
    }
  }
  function onAsk(d: Denom) {
    if (!round) return;
    askOpen = false;
    round = askCustomer(round, d);
    if (round.phase === 'done') finishRound();
  }

  // retry keeps the same hash, so {#key $route} never remounts — reset in place
  function restart() {
    clearTimeout(amendTimer);
    clearTimeout(menuTimer);
    clearTimeout(flashTimer);
    session = createSession(
      mode, level, get(activeMenu), get(settings).useCustomMenu, Date.now() % 2 ** 31,
    );
    round = null;
    flash = null;
    finalized = false;
    pile = [];
    startRound();
  }

  function finalize() {
    if (finalized) return;
    finalized = true;
    stats.update((s) => {
      let next = recordDay(s, new Date());
      if (session.mode === 'rush' && session.score > next.rushHigh)
        next = { ...next, rushHigh: session.score };
      return next;
    });
    if (session.mode === 'level' && session.finished === 'won') {
      progress.update((p) => ({
        stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
      }));
    }
  }

  onMount(() => {
    startRound();
    const iv = setInterval(() => {
      const dt = 200;
      if (session.finished) {
        if (!flash) finalize();
        return;
      }
      // head walking out during a live round = that round times out (see rules above)
      if (round && session.queue[0] && session.queue[0].patienceMs <= dt) {
        round = timeoutRound(round);
        finishRound();
      }
      session = tickSession(session, dt);
      if (session.finished) {
        if (!flash) finalize();
      } else if (!round && !flash && session.queue.length > 0) startRound();
    }, 200);
    return () => {
      clearInterval(iv);
      clearTimeout(amendTimer);
      clearTimeout(menuTimer);
      clearTimeout(flashTimer);
    };
  });
</script>

<main class="game">
  <header>
    <span class="lives">{'♥'.repeat(Math.max(0, MAX_LIVES - session.livesLost))}</span>
    <span>{mode === 'level' ? `${$t('game.level')} ${level}` : `${$t('game.rush')} · ${session.level}`}</span>
    <span>{$t('game.score')}: {session.score}</span>
  </header>

  <div class="queue">
    {#each session.queue as c, i (c.id)}
      <div class="customer" class:active={i === 0}>
        <span class="face">👤</span>
        <PatienceBar frac={c.patienceMs / c.maxPatienceMs} />
      </div>
    {/each}
  </div>

  {#if round}
    <p class="order">“{orderText}”</p>
    {#if amendText}<p class="order amend">“{amendText}”</p>{/if}

    <MenuCard menu={session.menu} pricesHidden={menuHidden} {symbolFirst} />

    {#if round.phase === 'sum'}
      <p class="prompt">{$t('game.sum-prompt')}</p>
      <Numpad onsubmit={onSum} {symbolFirst} />
    {:else if round.phase === 'change'}
      <p class="prompt">
        {$t('game.pays')}:
        {#each [...round.paymentPieces].sort((a, b) => b - a) as p}
          <span class="paid">{denomLabel(p)}</span>
        {/each}
      </p>
      <TillGrid till={tillView} ontake={take} />
      <ChangePile {pile} showTotal={session.params.showPileTotal} onreturn={ret} />
      <div class="actions">
        <button class="confirm" onclick={confirmChange}>{$t('game.confirm')}</button>
        <button class="ask" onclick={() => (askOpen = !askOpen)}>{$t('game.ask')}</button>
      </div>
      {#if askOpen}
        <div class="ask-row">
          {#each COIN_DENOMS as d (d)}
            <button onclick={() => onAsk(d)}>{$t('game.ask-for')} {denomLabel(d)}?</button>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  {#if flash}<div class="flash">{flash}</div>{/if}

  {#if session.finished && finalized}
    <div class="overlay">
      <h2>{session.finished === 'won' ? $t('result.won') : $t('result.lost')}</h2>
      {#if session.finished === 'won'}
        <p class="stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</p>
      {/if}
      <p>{$t('game.score')}: {session.score}</p>
      {#if mode === 'rush' && session.score >= $stats.rushHigh && session.score > 0}
        <p>{$t('result.highscore')}</p>
      {/if}
      <div class="overlay-actions">
        {#if mode === 'level' && session.finished === 'won' && level < MAX_LEVEL}
          <button onclick={() => go(`game/${level + 1}`)}>{$t('result.next')}</button>
        {/if}
        <button onclick={restart}>{$t('result.retry')}</button>
        <button onclick={() => go('home')}>{$t('result.home')}</button>
      </div>
    </div>
  {/if}
</main>

<style>
  .game {
    display: flex; flex-direction: column; gap: 0.75rem;
    max-width: 480px; margin: 0 auto; padding: 0.75rem; min-height: 100dvh;
  }
  header { display: flex; justify-content: space-between; align-items: center; }
  .lives { color: var(--danger); }
  .queue { display: flex; gap: 0.75rem; min-height: 40px; }
  .customer { width: 64px; opacity: 0.5; }
  .customer.active { opacity: 1; }
  .face { font-size: 1.4rem; }
  .order { font-size: 1.15rem; font-style: italic; }
  .amend { color: var(--accent); }
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .paid {
    background: var(--cream); color: var(--ink);
    padding: 0.1rem 0.5rem; border-radius: 6px; font-weight: bold;
  }
  .actions { display: flex; gap: 0.5rem; }
  .confirm { flex: 1; background: var(--ok); color: var(--cream); font-size: 1.1rem; }
  .ask { background: var(--accent); color: var(--ink); }
  .ask-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .ask-row button { background: var(--wood-light); color: var(--cream); }
  .flash {
    position: fixed; inset: auto 0 30% 0; margin: 0 auto; width: fit-content;
    background: var(--cream); color: var(--ink);
    padding: 0.75rem 1.5rem; border-radius: var(--radius);
    font-size: 1.3rem; font-weight: bold;
  }
  .overlay {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; text-align: center;
  }
  .stars { font-size: 2.2rem; color: var(--accent); }
  .overlay-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .overlay-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
</style>
