<!-- src/routes/Game.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settings } from '../stores/settings';
  import { activeMenu } from '../stores/menu';
  import { stats, recordRound, recordDay } from '../stores/stats';
  import { progress } from '../stores/progress';
  import { t } from '../i18n';
  import {
    createSession, tickSession, completeRound, spawnCustomer, MAX_LIVES,
  } from '../core/session';
  import {
    createRound, submitSum, submitChange, askCustomer, timeoutRound, challengePayment,
    type RoundState,
  } from '../core/round';
  import {
    generateOrder, generatePayment, generateUnderPayment, amendOrder, piecesTotal,
  } from '../core/order';
  import { maybeDispute, type Dispute } from '../core/dispute';
  import { renderOrder, renderAmendment } from '../core/text-order';
  import { starsFor } from '../core/scoring';
  import { formatEuro } from '../core/money';
  import { COIN_DENOMS, type Denom } from '../core/till';
  import { denomLabel } from '../lib/denom-view';
  import { chaChing, coinClink, errorBuzz } from '../lib/sound';
  import EndOverlay from '../lib/EndOverlay.svelte';
  import DisputeDialog from '../lib/DisputeDialog.svelte';
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
  let dispute = $state<Dispute | null>(null);
  let disputeOpts = $state<number[]>([]);           // fixed at dialog-open time; never roll rng in markup
  let disputeVerdict = $state<string | null>(null); // overrides the success flash once
  let finalized = $state(false);
  let wasNewHigh = $state(false);
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
    const payment = session.rng() < session.params.underpayProb
      ? generateUnderPayment(order.totalCents, session.rng)
      : generatePayment(order.totalCents, session.params.paymentStyle, session.rng);
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
    flash = disputeVerdict !== null
      ? disputeVerdict
      : !failed
        ? $t('game.correct')
        : done.errors.includes('change-wrong')
          ? `${$t('game.change-was')} ${formatEuro(done.changeDue, symbolFirst)}`
          : `${$t('game.wrong')} ${formatEuro(done.order.totalCents, symbolFirst)}`;
    disputeVerdict = null;
    if (failed) errorBuzz($settings.sound);
    else chaChing($settings.sound);
    session = completeRound(session, done, { orderText, ms });
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
    else if (round.sumTries > 0 && round.phase === 'sum') errorBuzz($settings.sound);
  }

  function take(d: Denom) {
    if ((tillView[d] ?? 0) > 0) {
      pile = [...pile, d];
      coinClink($settings.sound);
    }
  }
  function ret(index: number) {
    pile = pile.toSpliced(index, 1);
  }
  function confirmChange() {
    if (!round) return;
    round = submitChange(round, pile);
    if (round.phase === 'done') {
      if (round.success === true) {
        const d = maybeDispute(round.paymentPieces, session.params.disputeProb, session.rng);
        if (d) {
          dispute = d;
          disputeOpts = session.rng() < 0.5
            ? [d.actualNote, d.claimedNote]
            : [d.claimedNote, d.actualNote];
          return; // finishRound happens after the dispute is answered
        }
      }
      finishRound();
    } else {
      pile = [];
      errorBuzz($settings.sound);
    }
  }
  function onAsk(d: Denom) {
    if (!round) return;
    askOpen = false;
    round = askCustomer(round, d);
    if (round.phase === 'done') finishRound();
  }
  function onNotEnough() {
    if (!round) return;
    const wasTrapCall = round.usedTrapCall;
    round = challengePayment(round);
    if (round.phase === 'done') {
      finishRound();
    } else if (!wasTrapCall && round.usedTrapCall) {
      flash = $t('game.trap-good');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash = null;
        startRound(); // no-op while this round is live — timer just clears the flash
      }, 1000);
    } else {
      errorBuzz($settings.sound);
    }
  }
  function resolveDispute(chosen: number) {
    if (!dispute || !round) return;
    const d = dispute;
    dispute = null;
    const correct = chosen === d.actualNote;
    if (correct) {
      disputeVerdict = $t('game.dispute-right');
      session = { ...session, score: session.score + 25 };
    } else {
      round = { ...round, errors: [...round.errors, 'dispute-wrong'] };
      disputeVerdict = `${$t('game.dispute-wrong-msg').replace('{note}', denomLabel(d.actualNote))}`;
    }
    finishRound();
    if (!correct) {
      // penalty: −50, floored at what the round just earned
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = { ...session, score: session.score - Math.min(50, gained) };
    }
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
    dispute = null;
    disputeVerdict = null;
    finalized = false;
    wasNewHigh = false;
    pile = [];
    startRound();
  }

  function finalize() {
    if (finalized) return;
    finalized = true;
    stats.update((s) => {
      let next = recordDay(s, new Date());
      if (session.mode === 'rush' && session.score > next.rushHigh) {
        wasNewHigh = true;
        next = { ...next, rushHigh: session.score };
      }
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
      if (!dispute && round && session.queue[0] && session.queue[0].patienceMs <= dt) {
        round = timeoutRound(round);
        finishRound();
      }
      session = tickSession(session, dt);
      if (!flash && session.lastWalkouts > 0) {
        flash = $t('game.walkout');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          flash = null;
          startRound();
        }, 1000);
      }
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
        <button class="ask" onclick={onNotEnough}>{$t('game.not-enough')}</button>
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
    <EndOverlay {session} {level} {stars} {wasNewHigh} onretry={restart} />
  {/if}

  {#if dispute}
    <DisputeDialog
      claimText={$t('game.dispute-claim').replace('{note}', denomLabel(dispute.claimedNote))}
      question={$t('game.dispute-question')}
      options={disputeOpts.map((v) => ({ label: denomLabel(v), value: v }))}
      onanswer={resolveDispute}
    />
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
</style>
