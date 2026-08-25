<!-- src/routes/Game.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settings } from '../stores/settings';
  import { activeMenu } from '../stores/menu';
  import { localizedDefaultMenu } from '../core/menu';
  import { stats, recordRound, recordDay } from '../stores/stats';
  import { progress } from '../stores/progress';
  import { t } from '../i18n';
  import {
    createSession, tickSession, completeRound, completeSubRound, spawnCustomer, MAX_LIVES,
  } from '../core/session';
  import type { SessionMode } from '../core/session';
  import { practiceParams, paramsForLevel, type Skill, MAX_LEVEL } from '../core/difficulty';
  import {
    dailySeed, dailyLevelFor, DAILY_ORDERS, isRanked, nextDailyRecord, shareText,
  } from '../core/daily';
  import { daily } from '../stores/daily';
  import {
    createRound, submitSum, submitChange, askCustomer, timeoutRound, challengePayment, markHint,
    type RoundState,
  } from '../core/round';
  import { hintFor } from '../core/hints';
  import { praiseKey } from '../lib/praise';
  import {
    generateOrder, generatePayment, generateUnderPayment, amendOrder, piecesTotal,
    generateTab, splitOrder, orderTotal,
  } from '../core/order';
  import { maybeDispute, type Dispute } from '../core/dispute';
  import { renderOrder, renderAmendment, renderWave, renderPayer } from '../core/text-order';
  import { starsFor } from '../core/scoring';
  import { formatEuro } from '../core/money';
  import { COIN_DENOMS, DENOMS, type Denom } from '../core/till';
  import { denomLabel } from '../lib/denom-view';
  import { chaChing, coinClink, errorBuzz, tickTock } from '../lib/sound';
  import { PausableTimer } from '../lib/pausable';
  import Money from '../lib/Money.svelte';
  import EndOverlay from '../lib/EndOverlay.svelte';
  import DisputeDialog from '../lib/DisputeDialog.svelte';
  import PauseOverlay from '../lib/PauseOverlay.svelte';
  import Numpad from '../lib/Numpad.svelte';
  import type { NumpadApi } from '../lib/Numpad.svelte';
  import MenuCard from '../lib/MenuCard.svelte';
  import PatienceBar from '../lib/PatienceBar.svelte';
  import TillGrid from '../lib/TillGrid.svelte';
  import ChangePile from '../lib/ChangePile.svelte';

  let { mode, level = 1, skill = 'sums' }: {
    mode: SessionMode; level?: number; skill?: Skill;
  } = $props();

  let rankedRun = $state(false);
  let shareCopied = $state(false);
  function newSession() {
    const override = mode === 'practice'
      ? practiceParams(skill)
      : mode === 'daily'
        ? { ...paramsForLevel(dailyLevelFor(0)), ordersPerLevel: DAILY_ORDERS }
        : undefined;
    const seed = mode === 'daily' ? dailySeed(new Date()) : Date.now() % 2 ** 31;
    rankedRun = mode === 'daily' ? isRanked(get(daily), new Date()) : false;
    const isDaily = mode === 'daily';
    return createSession(
      mode, level,
      isDaily ? localizedDefaultMenu(get(settings).locale) : get(activeMenu),
      isDaily ? false : get(settings).useCustomMenu,
      seed, override,
    );
  }
  let session = $state(newSession());
  let round = $state<RoundState | null>(null);
  let orderText = $state('');
  let amendText = $state<string | null>(null);
  let pile = $state<Denom[]>([]);
  let menuHidden = $state(false);
  let askOpen = $state(false);
  let flash = $state<string | null>(null);
  let heartPulse = $state(false);
  let dispute = $state<Dispute | null>(null);
  let disputeOpts = $state<number[]>([]);           // fixed at dialog-open time; never roll rng in markup
  let disputeVerdict = $state<string | null>(null); // overrides the success flash once
  let finalized = $state(false);
  let wasNewHigh = $state(false);
  let roundStartedAt = 0;
  const amendT = new PausableTimer();
  const menuT = new PausableTimer();
  const flashT = new PausableTimer();
  const waveT = new PausableTimer();
  let paused = $state(false);
  let pauseMenu = $state(false);
  let numpadLocked = $state(false);
  let numpadApi: NumpadApi | null = null;
  let hasKeyboard = $state(false); // becomes true on first physical keydown → shows badges
  let splitGroups = $state<import('../core/order').OrderLine[][] | null>(null);
  let payerIndex = $state(0);
  let groupBaseText = $state('');
  let disputeRoll = $state(1); // pre-rolled at payment creation; 1 = never fires
  let disputeOptRoll = $state(0);
  let hintText = $state<string | null>(null);
  let hintIndex = $state(0);
  let hintDebt = 0; // 25 per Tipp press, settled against the round's gained score

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
    if (session.finished || round || flash) return;
    amendT.clear();
    waveT.clear();
    if (session.queue.length === 0) {
      if (session.mode === 'rush') return; // rush waits for the spawn timer
      session = spawnCustomer(session);
    }
    numpadLocked = false;
    splitGroups = null;
    payerIndex = 0;
    amendText = null;
    pile = [];
    askOpen = false;
    hintText = null;
    hintIndex = 0;
    hintDebt = 0;

    const roll = session.rng();
    const makePayment = (cents: number) =>
      session.rng() < session.params.underpayProb
        ? generateUnderPayment(cents, session.rng)
        : generatePayment(cents, session.params.paymentStyle, session.rng);

    if (roll < session.params.tabProb) {
      // running tab: merged order drives the round; waves reveal over time
      const tab = generateTab(session.menu, session.params, session.rng);
      round = createRound(tab.merged, makePayment(tab.merged.totalCents), session.till, 'tab');
      orderText = renderOrder(tab.waves[0], $settings.locale);
      numpadLocked = true;
      let waveIdx = 1;
      const revealNext = () => {
        if (!round || round.phase !== 'sum') return;
        orderText += ' ' + renderWave(tab.waves[waveIdx], $settings.locale);
        waveIdx += 1;
        if (waveIdx < tab.waves.length) waveT.start(revealNext, 3500);
        else numpadLocked = false;
      };
      waveT.start(revealNext, 3500);
    } else {
      const order = generateOrder(session.menu, session.params, session.rng);
      const groups = roll < session.params.tabProb + session.params.splitProb
        ? splitOrder(order, session.rng)
        : null;
      if (groups && groups.length >= 2) {
        // split bill: full order shown, first payer starts
        splitGroups = groups;
        const sub = { lines: groups[0], totalCents: orderTotal(groups[0]) };
        round = createRound(sub, makePayment(sub.totalCents), session.till, 'split');
        groupBaseText = renderOrder(order, $settings.locale);
        orderText = `${groupBaseText} ${renderPayer(groups[0], $settings.locale)}`;
      } else {
        round = createRound(order, makePayment(order.totalCents), session.till);
        orderText = renderOrder(order, $settings.locale);
        if (session.rng() < session.params.midOrderChangeProb) {
          const amended = amendOrder(order, session.rng);
          amendT.start(() => {
            if (round && round.phase === 'sum' && round.kind === 'normal') {
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
      }
    }
    disputeRoll = session.rng();
    disputeOptRoll = session.rng();
    roundStartedAt = performance.now();

    const vis = session.params.menuVisibleSeconds;
    menuT.clear();
    menuHidden = vis === 0;
    if (vis !== null && vis > 0) {
      menuT.start(() => (menuHidden = true), vis * 1000);
    }
  }

  function nextPayer() {
    if (!round || !splitGroups) return;
    const done = round;
    const ms = performance.now() - roundStartedAt;
    stats.update((s) => recordRound(s, done.errors, ms, false));
    session = completeSubRound(session, done, {
      orderText: renderPayer(splitGroups[payerIndex], $settings.locale), ms,
    });
    if (hintDebt > 0) {
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = { ...session, score: session.score - Math.min(hintDebt, gained) };
      hintDebt = 0;
    }
    chaChing($settings.sound);
    payerIndex += 1;
    const group = splitGroups[payerIndex];
    const sub = { lines: group, totalCents: orderTotal(group) };
    const payment = session.rng() < session.params.underpayProb
      ? generateUnderPayment(sub.totalCents, session.rng)
      : generatePayment(sub.totalCents, session.params.paymentStyle, session.rng);
    round = createRound(sub, payment, session.till, 'split');
    orderText = `${groupBaseText} ${renderPayer(group, $settings.locale)}`;
    disputeRoll = session.rng();
    disputeOptRoll = session.rng();
    pile = [];
    askOpen = false;
    hintText = null;
    hintIndex = 0;
    hintDebt = 0;
    roundStartedAt = performance.now();
  }

  function finishRound() {
    if (!round) return;
    if (splitGroups && round.success === true && payerIndex < splitGroups.length - 1) {
      disputeVerdict = null; // intermediate payers consume their verdict silently
      nextPayer();
      return;
    }
    const done = round;
    const ms = performance.now() - roundStartedAt;
    const failed = done.success !== true;
    stats.update((s) => recordDay(recordRound(s, done.errors, ms, failed), new Date()));
    if (failed) {
      errorBuzz($settings.sound);
      pulseHearts();
    } else chaChing($settings.sound);
    session = completeRound(session, done, { orderText, ms });
    if (hintDebt > 0) {
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = { ...session, score: session.score - Math.min(hintDebt, gained) };
      hintDebt = 0;
    }
    flash = disputeVerdict !== null
      ? disputeVerdict
      : failed
        ? done.errors.includes('change-wrong')
          ? `${$t('game.change-was')} ${formatEuro(done.changeDue, symbolFirst)}`
          : `${$t('game.wrong')} ${formatEuro(done.order.totalCents, symbolFirst)}`
        : $t(praiseKey(session.streak));
    disputeVerdict = null;
    round = null;
    pile = [];
    splitGroups = null;
    hintText = null;
    amendT.clear();
    waveT.clear();
    menuT.clear();
    flashT.clear();
    flashT.start(() => {
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
        const d = maybeDispute(round.paymentPieces, session.params.disputeProb, () => disputeRoll);
        if (d) {
          dispute = d;
          disputeOpts = disputeOptRoll < 0.5
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
      flashT.clear();
      flashT.start(() => {
        flash = null;
        startRound(); // no-op while this round is live — timer just clears the flash
      }, 1000);
    } else {
      errorBuzz($settings.sound);
    }
  }
  function onTipp() {
    if (!round || dispute || paused || round.phase === 'done') return;
    round = markHint(round);
    hintText = hintFor(round, hintIndex, $settings.locale);
    hintIndex += 1;
    hintDebt += 25;
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
    amendT.clear();
    waveT.clear();
    menuT.clear();
    flashT.clear();
    session = newSession();
    round = null;
    flash = null;
    dispute = null;
    disputeVerdict = null;
    finalized = false;
    wasNewHigh = false;
    shareCopied = false;
    pile = [];
    splitGroups = null;
    paused = false;
    pauseMenu = false;
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
    if (session.mode === 'daily') {
      const fullRounds = session.roundLog.filter((e) => !e.sub);
      const perfect = fullRounds.length >= DAILY_ORDERS && fullRounds.every((e) => e.success);
      daily.update((prev) => nextDailyRecord(prev, new Date(), session.score, perfect));
    }
  }

  function doShare() {
    const served = session.roundLog.filter((e) => !e.sub && e.success).length;
    const text = shareText(
      new Date(), session.score, served, DAILY_ORDERS, get(daily)?.streak ?? 1,
    );
    navigator.clipboard?.writeText(text).then(() => (shareCopied = true)).catch(() => {});
  }

  function pulseHearts() {
    heartPulse = false;
    requestAnimationFrame(() => (heartPulse = true));
    setTimeout(() => (heartPulse = false), 600);
  }

  function setPaused(on: boolean, menu = false) {
    if (session.finished) return;
    paused = on;
    pauseMenu = on && menu;
    const timers = [amendT, menuT, flashT, waveT];
    for (const t of timers) on ? t.pause() : t.resume();
  }

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (k === 'Escape') {
      if (paused) setPaused(false);
      else setPaused(true, true);
      e.preventDefault();
      return;
    }
    if (k === ' ') {
      setPaused(!paused);
      e.preventDefault();
      return;
    }
    if (paused) return; // overlay blocks taps; keys must freeze too
    if (session.finished || dispute) return;
    hasKeyboard = true;
    if (!round) return;
    if (round.phase === 'sum' && !numpadLocked) {
      if (/^[0-9]$/.test(k)) { numpadApi?.press(k); e.preventDefault(); }
      else if (k === ',' || k === '.') { numpadApi?.press(','); e.preventDefault(); }
      else if (k === 'Backspace') { numpadApi?.press('Backspace'); e.preventDefault(); }
      else if (k === 'Enter') { numpadApi?.press('Enter'); e.preventDefault(); }
      else if (k === 't' || k === 'T') { onTipp(); e.preventDefault(); }
    } else if (round.phase === 'change') {
      if (/^[0-9]$/.test(k)) {
        const idx = k === '0' ? 9 : Number(k) - 1;
        take(DENOMS[idx]);
        e.preventDefault();
      } else if (k === 'Enter') { confirmChange(); e.preventDefault(); }
      else if (k === 'a' || k === 'A') { askOpen = !askOpen; e.preventDefault(); }
      else if (k === 'n' || k === 'N') { onNotEnough(); e.preventDefault(); }
      else if (k === 't' || k === 'T') { onTipp(); e.preventDefault(); }
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
      if (dispute) return; // freeze the bar while the customer disputes
      if (paused) return;
      // head walking out during a live round = that round times out (see rules above)
      if (!dispute && round && session.queue[0] && session.queue[0].patienceMs <= dt) {
        round = timeoutRound(round);
        finishRound();
      }
      session = tickSession(session, dt);
      if (!flash && session.lastWalkouts > 0) {
        flash = $t('game.walkout');
        flashT.clear();
        flashT.start(() => {
          flash = null;
          startRound();
        }, 1000);
        pulseHearts();
      }
      if (round && session.queue[0]
          && session.queue[0].patienceMs < session.queue[0].maxPatienceMs * 0.25) {
        tickTock($settings.sound);
      }
      if (session.finished) {
        if (!flash) finalize();
      } else if (!round && !flash && session.queue.length > 0) startRound();
    }, 200);
    return () => {
      clearInterval(iv);
      amendT.clear();
      waveT.clear();
      menuT.clear();
      flashT.clear();
    };
  });
</script>

<svelte:window onkeydown={onKey} />
<main class="game">
  <header>
    <span class="lives" class:pulse={heartPulse}>{'♥'.repeat(Math.max(0, MAX_LIVES - session.livesLost))}</span>
    <span>{mode === 'level' ? `${$t('game.level')} ${level}`
      : mode === 'rush' ? `${$t('game.rush')} · ${session.level >= MAX_LEVEL ? '30+' : session.level}`
      : mode === 'practice' ? $t('practice.title')
      : $t('daily.title')}</span>
    <span>{$t('game.score')}: {session.score}</span>
  </header>

  <div class="queue">
    {#each session.queue as c, i (c.id)}
      {@const frac = c.patienceMs / c.maxPatienceMs}
      <div class="customer" class:active={i === 0}>
        <span class="face">{frac > 0.5 ? '😀' : frac > 0.25 ? '😐' : '😠'}</span>
        <PatienceBar {frac} />
      </div>
    {/each}
  </div>

  {#if round}
    <p class="order">“{paused ? '…' : orderText}”</p>
    {#if amendText}<p class="order amend">“{amendText}”</p>{/if}
    {#if hintText}<p class="hint-line">💡 {hintText}</p>{/if}

    <MenuCard menu={session.menu} pricesHidden={menuHidden} {symbolFirst} />

    {#key round.phase}
      <div class="phase">
        {#if round.phase === 'sum'}
          {#if numpadLocked}
            <p class="prompt">{$t('game.tab-wait')}</p>
          {:else}
            <p class="prompt">{$t('game.sum-prompt')}</p>
            <Numpad onsubmit={onSum} {symbolFirst} bindApi={(api) => (numpadApi = api)} />
            <button class="tipp" onclick={onTipp}>{$t('game.tipp')} (−25)</button>
          {/if}
        {:else if round.phase === 'change'}
          <p class="prompt">
            {$t('game.pays')}:
            {#each [...round.paymentPieces].sort((a, b) => b - a) as p, i (i)}
              <Money denom={p} />
            {/each}
          </p>
          <TillGrid till={tillView} ontake={take} disabled={round.changeDue === 0} showKeys={hasKeyboard} />
          <ChangePile {pile} showTotal={session.params.showPileTotal} onreturn={ret} />
          <div class="actions">
            <button class="confirm" onclick={confirmChange}>
              {round.changeDue === 0 ? $t('game.finish') : $t('game.confirm')}
            </button>
            <button class="ask" onclick={() => (askOpen = !askOpen)}>{$t('game.ask')}</button>
            <button class="ask" onclick={onNotEnough}>{$t('game.not-enough')}</button>
            <button class="tipp" onclick={onTipp}>{$t('game.tipp')}</button>
          </div>
          {#if askOpen}
            <div class="ask-row">
              {#each COIN_DENOMS as d (d)}
                <button onclick={() => onAsk(d)}>{$t('game.ask-for')} {denomLabel(d)}?</button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {/key}
  {/if}

  {#if flash}<div class="flash">{flash}</div>{/if}

  {#if session.finished && finalized}
    <EndOverlay
      {session} {level} {stars} {wasNewHigh} onretry={restart}
      onshare={mode === 'daily' ? doShare : null}
      shareLabel={shareCopied ? $t('daily.copied') : $t('daily.share')}
      note={mode === 'daily' && !rankedRun ? $t('daily.unranked') : null}
    />
  {/if}

  {#if paused}
    <PauseOverlay
      menu={pauseMenu}
      soundOn={$settings.sound}
      onresume={() => setPaused(false)}
      onrestart={() => { setPaused(false); restart(); }}
      ontogglesound={() => settings.update((s) => ({ ...s, sound: !s.sound }))}
      allowRestart={!dispute}
    />
  {/if}

  {#if dispute && !paused}
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
  .lives.pulse { animation: op-pulse 0.5s ease-in-out; }
  .queue { display: flex; gap: 0.75rem; min-height: 40px; }
  .customer { width: 64px; opacity: 0.5; }
  .customer.active { opacity: 1; }
  .face { font-size: 1.4rem; }
  .order { font-size: 1.15rem; font-style: italic; }
  .flash { animation: op-slide-up 0.2s ease-out; }
  .amend { color: var(--accent); animation: op-slide-up 0.3s ease-out; }
  .tipp { background: var(--wood-light); color: var(--cream); }
  .hint-line { color: var(--accent); animation: op-slide-up 0.2s ease-out; }
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .phase { display: flex; flex-direction: column; gap: 0.75rem; animation: op-slide-up 0.15s ease-out; }
  .actions {
    display: flex; gap: 0.5rem;
    position: sticky; bottom: 0;
    padding: var(--space-2) 0 calc(var(--space-2) + env(safe-area-inset-bottom));
    background: var(--wood);
  }
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
