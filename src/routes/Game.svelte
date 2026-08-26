<!-- src/routes/Game.svelte -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { settings } from '../stores/settings';
  import { activeMenu } from '../stores/menu';
  import { localizedDefaultMenu, menuForLevel } from '../core/menu';
  import { stats, recordRound, recordDay, recordTips } from '../stores/stats';
  import { progress, improveBest } from '../stores/progress';
  import { t } from '../i18n';
  import {
    createSession, tickSession, completeRound, completeSubRound, spawnCustomer, MAX_LIVES,
    effectiveLevel, patienceFrac,
  } from '../core/session';
  import type { SessionMode } from '../core/session';
  import { practiceParams, paramsForLevel, type Skill, MAX_LEVEL } from '../core/difficulty';
  import {
    dailySeed, dailyLevelFor, DAILY_ORDERS, isRanked, nextDailyRecord, shareText,
  } from '../core/daily';
  import { daily } from '../stores/daily';
  import { weeklySeed, weeklyLevelFor, WEEKLY_ORDERS, nextWeeklyRecord, weeklyShareText, weekKey } from '../core/weekly';
  import { weekly } from '../stores/weekly';
  import { badges } from '../stores/badges';
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
  import { newBadges } from '../core/badges';
  import { renderOrder, renderAmendment, renderWave, renderPayer } from '../core/text-order';
  import { starsFor } from '../core/scoring';
  import { formatEuro, parseEntry } from '../core/money';
  import { happyHourActive, discountMenu } from '../core/happy-hour';
  import { tipFor, tipEligible } from '../core/tips';
  import { history, recordDayEntry, pruneHistory, localDayKey } from '../stores/history';
  import { weeklyHistory } from '../stores/weekly-history';
  import { encodeResult } from '../core/compare';
  import { careerTitle, applyUpgrades, boostTip, freeFirstHint } from '../core/career';
  import { career } from '../stores/career';
  import type { DifficultyParams } from '../core/difficulty';
  import { COIN_DENOMS, DENOMS, type Denom } from '../core/till';
  import { denomLabel } from '../lib/denom-view';
  import { focusFirst } from '../lib/focus';
  import { chaChing, coinClink, errorBuzz, fanfare, tickTock } from '../lib/sound';
  import { vibrate } from '../lib/haptics';
  import { PausableTimer } from '../lib/pausable';
  import { canMakeChange, makeChange } from '../core/change';
  import { markSeen } from '../stores/seen';
  import EndOverlay from '../lib/EndOverlay.svelte';
  import GameToasts from '../lib/GameToasts.svelte';
  import CoinBurst from '../lib/CoinBurst.svelte';
  import DisputeDialog from '../lib/DisputeDialog.svelte';
  import PauseOverlay from '../lib/PauseOverlay.svelte';
  import ExplainerCard from '../lib/ExplainerCard.svelte';
  import type { NumpadApi } from '../lib/Numpad.svelte';
  import GameHeader from '../lib/GameHeader.svelte';
  import MenuCard from '../lib/MenuCard.svelte';
  import PatienceBar from '../lib/PatienceBar.svelte';
  import SumPhase from '../lib/SumPhase.svelte';
  import ChangePhase from '../lib/ChangePhase.svelte';

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
        : mode === 'weekly'
          ? { ...paramsForLevel(weeklyLevelFor(0)), ordersPerLevel: WEEKLY_ORDERS }
          : undefined;
    const seed = mode === 'daily' ? dailySeed(new Date())
      : mode === 'weekly' ? weeklySeed(new Date())
      : Date.now() % 2 ** 31;
    rankedRun = mode === 'daily' ? isRanked(get(daily), new Date()) : false;
    const isDaily = mode === 'daily' || mode === 'weekly';
    const upgraded = (p: DifficultyParams) => applyUpgrades(p, get(career).upgrades, mode);
    return createSession(
      mode, level,
      isDaily ? localizedDefaultMenu(get(settings).locale) : get(activeMenu),
      isDaily ? false : get(settings).useCustomMenu,
      seed,
      override ? upgraded(override) : mode === 'level' ? upgraded(paramsForLevel(level)) : undefined,
    );
  }
  let session = $state(newSession());
  let round = $state<RoundState | null>(null);
  let orderText = $state('');
  let amendText = $state<string | null>(null);
  let pile = $state<Denom[]>([]);
  let menuHidden = $state(false);
  let askOpen = $state(false);
  let typedChange = $state('');
  let flash = $state<string | null>(null);
  let errorFlash = $state<string | null>(null);
  let heartPulse = $state(false);
  let dispute = $state<Dispute | null>(null);
  let disputeOpts = $state<number[]>([]);           // fixed at dialog-open time; never roll rng in markup
  let disputeVerdict = $state<string | null>(null); // overrides the success flash once
  let finalized = $state(false);
  let wasNewHigh = $state(false);
  let burstKey = $state(0);
  let bigWin = $state(false);
  let roundStartedAt = 0;
  const amendT = new PausableTimer();
  const menuT = new PausableTimer();
  const flashT = new PausableTimer();
  const errT = new PausableTimer();
  const waveT = new PausableTimer();
  let paused = $state(false);
  let pauseMenu = $state(false);
  let explaining = $state<string | null>(null);
  let numpadLocked = $state(false);
  let numpadApi: NumpadApi | null = null;
  let splitGroups = $state<import('../core/order').OrderLine[][] | null>(null);
  let payerIndex = $state(0);
  let mainEl = $state<HTMLElement | null>(null);
  let groupBaseText = $state('');
  let disputeRoll = $state(1); // pre-rolled at payment creation; 1 = never fires
  let disputeOptRoll = $state(0);
  let hintText = $state<string | null>(null);
  let hintIndex = $state(0);
  let hintDebt = 0; // 25 per Tipp press, settled against the round's gained score
  let maxStreak = 0;
  let trapCaught = false;
  let disputeWon = false;
  let tabServed = false;
  let splitServed = false;
  let badgeToast = $state<string | null>(null);
  let rowdy = $state(false);
  let tipJar = $state(0);
  let tipsEarnedSession = 0;
  let hintsUsedSession = 0;

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
  const visibleMenu = $derived(
    mode === 'practice'
      ? menuForLevel(session.menu, skill === 'sums' || skill === 'parsing' ? 10 : 1)
      : menuForLevel(session.menu, effectiveLevel(session)),
  );
  const happyHour = $derived(happyHourActive(session));
  const pricedMenu = $derived(happyHour ? discountMenu(visibleMenu) : visibleMenu);

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
    typedChange = '';
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
      const tab = generateTab(pricedMenu, session.params, session.rng);
      round = createRound(tab.merged, makePayment(tab.merged.totalCents), session.till, 'tab');
      orderText = renderOrder(tab.waves[0], $settings.locale);
      numpadLocked = true;
      maybeExplain('tab');
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
      const order = generateOrder(pricedMenu, session.params, session.rng);
      const groups = roll < session.params.tabProb + session.params.splitProb
        ? splitOrder(order, session.rng)
        : null;
      if (groups && groups.length >= 2) {
        // split bill: full order shown, first payer starts
        splitGroups = groups;
        const sub = { lines: groups[0], totalCents: orderTotal(groups[0]) };
        round = createRound(sub, makePayment(sub.totalCents), session.till, 'split');
        groupBaseText = renderOrder(order, $settings.locale);
        maybeExplain('split');
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
    const rowdyRoll = session.rng();
    rowdy = round !== null
      && rowdyRoll < session.params.rowdyProb
      && round.kind === 'normal'
      && round.paymentCents >= round.order.totalCents
      && !splitGroups;
    if (rowdy && session.queue[0]) {
      const head = session.queue[0];
      const capped = Math.max(5000, Math.floor(head.maxPatienceMs * 0.5));
      session = {
        ...session,
        queue: [
          { ...head, patienceMs: Math.min(head.patienceMs, capped), maxPatienceMs: capped },
          ...session.queue.slice(1),
        ],
      };
    }
    roundStartedAt = performance.now();

    const vis = session.params.menuVisibleSeconds;
    menuT.clear();
    if (get(settings).alwaysShowPrices) {
      menuHidden = false;
    } else {
      menuHidden = vis === 0;
      if (vis !== null && vis > 0) {
        menuT.start(() => (menuHidden = true), vis * 1000);
      }
    }
    if (round && !explaining) maybeExplain('tipp');
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
    typedChange = '';
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
      vibrate(60, $settings.haptics ?? true);
      pulseHearts();
    } else {
      chaChing($settings.sound);
      vibrate(20, $settings.haptics ?? true);
    }
    const frac = patienceFrac(session);
    const groupTotal = splitGroups
      ? splitGroups.reduce((s, g) => s + orderTotal(g), 0)
      : done.order.totalCents;
    const earnsTip = (mode === 'level' || mode === 'rush' || mode === 'daily' || mode === 'weekly')
      && tipEligible({
        success: done.success === true,
        firstTry: done.sumTries === 0 && done.changeTries === 0,
        usedHint: done.usedHint,
        patienceFrac: frac,
      });
    session = completeRound(session, done, { orderText, ms });
    maxStreak = Math.max(maxStreak, session.streak);
    if (rowdy && done.success === true) {
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = {
        ...session,
        score: session.score + gained,
        roundLog: session.roundLog.map((e, i, arr) =>
          i === arr.length - 1 ? { ...e, scoreGained: e.scoreGained * 2 } : e),
      };
    }
    rowdy = false;
    if (earnsTip) {
      const tip = boostTip(tipFor(groupTotal), get(career).upgrades, mode);
      tipJar += tip;
      tipsEarnedSession += tip;
      stats.update((s) => recordTips(s, tip));
      career.update((c) => ({ ...c, walletCents: c.walletCents + tip }));
    }
    if (hintDebt > 0) {
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = { ...session, score: session.score - Math.min(hintDebt, gained) };
      hintDebt = 0;
    }
    if (!failed && done.sumTries === 0 && done.changeTries === 0
        && !done.usedHint && frac > 0.5) {
      burstKey += 1;
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
    askOpen = false; // don't let a stale ask row eat the next Escape during the flash
    typedChange = '';
    if (done.success === true && done.usedTrapCall) trapCaught = true;
    if (done.success === true && done.kind === 'tab') tabServed = true;
    if (done.success === true && splitGroups) splitServed = true;
    splitGroups = null;
    hintText = null;
    amendT.clear();
    waveT.clear();
    menuT.clear();
    flashT.clear();
    errorFlash = null;
    errT.clear();
    flashT.start(() => {
      flash = null;
      startRound();
    }, 1400);
  }

  function onSum(cents: number) {
    if (!round) return;
    round = submitSum(round, cents);
    if (round.phase === 'change') {
      if (round.paymentCents < round.order.totalCents) maybeExplain('trap');
      else if (round.changeDue > 0 && !canMakeChange(round.till, round.changeDue)) maybeExplain('shortage');
    }
    if (round.phase === 'done') finishRound();
    else if (round.sumTries > 0 && round.phase === 'sum') {
      errorBuzz($settings.sound);
      showError('err.sum');
    }
  }

  function take(d: Denom) {
    if (get(settings).amountEntry) typedChange = '';
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
        const d = rowdy ? null : maybeDispute(round.paymentPieces, session.params.disputeProb, () => disputeRoll);
        if (d) {
          dispute = d;
          disputeOpts = disputeOptRoll < 0.5
            ? [d.actualNote, d.claimedNote]
            : [d.claimedNote, d.actualNote];
          maybeExplain('dispute');
          return; // finishRound happens after the dispute is answered
        }
      }
      finishRound();
    } else {
      pile = [];
      errorBuzz($settings.sound);
      showError('err.change');
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
    const free = hintsUsedSession === 0 && freeFirstHint(get(career).upgrades, mode);
    hintsUsedSession += 1;
    if (free) {
      // first hint of the shift: no jar deduction, no debt
    } else if (tipJar >= 50) tipJar -= 50;
    else hintDebt += 25;
  }

  function typeChange(d: string) {
    if (typedChange === '' && get(settings).amountEntry) pile = []; // typing replaces the clicked pile
    if (d === ',') {
      if (typedChange.includes(',')) return;
      typedChange = typedChange === '' ? '0,' : typedChange + ',';
      return;
    }
    const [euros, cents] = typedChange.split(',');
    if (cents !== undefined) {
      if (cents.length >= 2) return;
    } else if (euros.length >= 4) return;
    typedChange += d;
  }

  function submitTyped() {
    if (!round) return;
    if (typedChange === '') {
      confirmChange();
      return;
    }
    const amount = parseEntry(typedChange);
    typedChange = '';
    if (!get(settings).amountEntry) {
      // pieces mode: the entry names one denomination
      const d = amount as Denom;
      if (!(DENOMS as readonly number[]).includes(d) || (tillView[d] ?? 0) <= 0) {
        errorBuzz($settings.sound);
        showError('err.denom');
        return;
      }
      pile = [...pile, d];
      coinClink($settings.sound);
      return;
    }
    // classic amount mode (round 7)
    const pieces = makeChange(round.till, amount);
    if (pieces === null && amount === round.changeDue) {
      // computed correctly but the till cannot pay — steer into the ask flow
      errorBuzz($settings.sound);
      askOpen = true;
      return;
    }
    pile = pieces ?? [];
    confirmChange();
  }

  function resolveDispute(chosen: number) {
    if (!dispute || !round) return;
    const d = dispute;
    dispute = null;
    const correct = chosen === d.actualNote;
    if (correct) {
      disputeVerdict = $t('game.dispute-right');
      session = { ...session, score: session.score + 25 };
      disputeWon = true;
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
    tick().then(() => focusFirst(mainEl));
  }

  // retry keeps the same hash, so {#key $route} never remounts — reset in place
  function restart() {
    amendT.clear();
    waveT.clear();
    menuT.clear();
    flashT.clear();
    errT.clear();
    session = newSession();
    round = null;
    flash = null;
    errorFlash = null;
    dispute = null;
    disputeVerdict = null;
    finalized = false;
    wasNewHigh = false;
    burstKey = 0;
    bigWin = false;
    shareCopied = false;
    pile = [];
    splitGroups = null;
    paused = false;
    pauseMenu = false;
    explaining = null;
    maxStreak = 0;
    trapCaught = false;
    disputeWon = false;
    tabServed = false;
    splitServed = false;
    badgeToast = null;
    rowdy = false;
    tipJar = 0;
    tipsEarnedSession = 0;
    hintsUsedSession = 0;
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
      const levelMs = session.roundLog.filter((e) => !e.sub).reduce((s, e) => s + e.ms, 0);
      progress.update((p) => ({
        stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
        best: improveBest(p.best, level, session.score, levelMs),
      }));
    }
    const fullRounds = session.roundLog.filter((e) => !e.sub);
    if (session.mode === 'daily') {
      const perfect = fullRounds.length >= DAILY_ORDERS && fullRounds.every((e) => e.success);
      daily.update((prev) => nextDailyRecord(prev, new Date(), session.score, perfect));
    }
    if (session.mode === 'weekly') {
      weekly.update((prev) => nextWeeklyRecord(prev, new Date(), session.score));
      // Update weekly history archive with this week's best score (used by the
      // Stats calendar's weekly archive list and friend-compare lookup).
      const week = weekKey(new Date());
      weeklyHistory.update((h) => ({ ...h, [week]: Math.max(h[week] ?? 0, session.score) }));
    }
    bigWin = (session.mode === 'level' && session.finished === 'won' && stars === 3)
      || (session.mode === 'rush' && wasNewHigh)
      || (session.mode === 'daily'
          && fullRounds.length >= DAILY_ORDERS && fullRounds.every((e) => e.success));
    if (bigWin) fanfare($settings.sound);

    // Calculate career progress for badge checking
    const progressData = get(progress);
    const threeStarLevels = Object.values(progressData.stars).filter((s) => s === 3).length;
    const totalStars = Object.values(progressData.stars).reduce((a, b) => a + b, 0);
    const maxLevelWon = Object.keys(progressData.stars).length > 0 ? Math.max(...Object.keys(progressData.stars).map(Number)) : 0;
    const statsData = get(stats);
    const titleRankValue = careerTitle(totalStars, maxLevelWon);
    const titleRankMap: Record<string, number> = { aushilfe: 0, barkeeper: 1, schichtleiter: 2, wirt: 3, legende: 4 };
    const titleRank = titleRankMap[titleRankValue];
    const weeklyWeeks = Object.keys(get(weeklyHistory)).length;

    const got = newBadges({
      mode: session.mode, finished: session.finished, stars, level,
      maxStreak, trapCaught, disputeWon, tabServed, splitServed,
      elapsedMs: session.elapsedMs,
      dailyStreak: get(daily)?.streak ?? 0,
      weeklyWeeks,
      lifetimeTips: statsData.tipsEarnedCents ?? 0, // cents — badge thresholds are in cents
      lifetimeRounds: statsData.rounds,
      threeStarLevels,
      titleRank,
    }, get(badges));
    if (got.length > 0) {
      badges.update((b) => [...b, ...got]);
      badgeToast = got.map((id) => `🏅 ${get(t)(`badge.${id}`)}`).join('  ');
      setTimeout(() => (badgeToast = null), 3000);
    }

    const key = localDayKey(new Date());
    history.update((h) => pruneHistory(
      recordDayEntry(h, key, {
        rounds: fullRounds.length,
        correct: fullRounds.filter((e) => e.success).length,
        ms: fullRounds.reduce((s, e) => s + e.ms, 0),
        tips: tipsEarnedSession,
      }),
      key,
    ));
  }

  function doShare() {
    const served = session.roundLog.filter((e) => !e.sub && e.success).length;
    const text = session.mode === 'weekly'
      ? weeklyShareText(new Date(), session.score, served, WEEKLY_ORDERS)
      : shareText(new Date(), session.score, served, DAILY_ORDERS, get(daily)?.streak ?? 1);
    navigator.clipboard?.writeText(text).then(() => (shareCopied = true)).catch(() => {});
  }

  function pulseHearts() {
    heartPulse = false;
    requestAnimationFrame(() => (heartPulse = true));
    setTimeout(() => (heartPulse = false), 600);
  }

  function showError(key: string) {
    errorFlash = $t(key);
    errT.clear();
    errT.start(() => (errorFlash = null), 1100);
  }

  function setPaused(on: boolean, menu = false) {
    if (session.finished) return;
    if (explaining) return; // explainer owns the freeze — no pause stacking (mirrors onKey)
    if (on) { askOpen = false; typedChange = ''; } // a stale open ask row would swallow the resume Escape
    paused = on;
    pauseMenu = on && menu;
    const timers = [amendT, menuT, flashT, errT, waveT];
    for (const t of timers) on ? t.pause() : t.resume();
    if (!on) tick().then(() => focusFirst(mainEl));
  }

  function maybeExplain(id: string) {
    if (!markSeen(id)) return;
    explaining = id;
    for (const tm of [amendT, menuT, flashT, errT, waveT]) tm.pause();
  }
  function dismissExplain() {
    explaining = null;
    for (const tm of [amendT, menuT, flashT, errT, waveT]) tm.resume();
    focusFirst(mainEl);
  }

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (explaining) {
      if (k === 'Enter' || k === ' ' || k === 'Escape') {
        dismissExplain();
        e.preventDefault();
      }
      return;
    }
    if (k === 'Escape') {
      if (typedChange !== '') {
        typedChange = '';
        e.preventDefault();
        return;
      }
      if (askOpen) {
        askOpen = false;
        e.preventDefault();
        return;
      }
      if (paused) setPaused(false);
      else setPaused(true, true);
      e.preventDefault();
      return;
    }
    if (k === ' ') {
      if (session.finished) return; // let Space activate focused overlay buttons
      setPaused(!paused);
      e.preventDefault();
      return;
    }
    if (paused) return; // overlay blocks taps; keys must freeze too
    if (session.finished) return;
    if (dispute) {
      if (k === '1' || k === '2') {
        const v = disputeOpts[Number(k) - 1];
        if (v !== undefined) resolveDispute(v);
        e.preventDefault();
      }
      return;
    }
    if (!round) return;
    if (round.phase === 'sum' && !numpadLocked) {
      if (/^[0-9]$/.test(k)) { numpadApi?.press(k); e.preventDefault(); }
      else if (k === ',' || k === '.') { numpadApi?.press(','); e.preventDefault(); }
      else if (k === 'Backspace') { numpadApi?.press('Backspace'); e.preventDefault(); }
      else if (k === 'Enter') { numpadApi?.press('Enter'); e.preventDefault(); }
      else if (k === 't' || k === 'T') { onTipp(); e.preventDefault(); }
    } else if (round.phase === 'change') {
      if (askOpen && /^[1-5]$/.test(k)) {
        onAsk(COIN_DENOMS[Number(k) - 1]);
        e.preventDefault();
        return;
      }
      if (/^[0-9]$/.test(k) || k === ',' || k === '.') {
        if (round.changeDue === 0) return; // Finish rounds: nothing to type
        typeChange(k === '.' ? ',' : k);
        e.preventDefault();
      } else if (k === 'Backspace') {
        typedChange = typedChange.slice(0, -1);
        e.preventDefault();
      } else if (k === 'Enter') { submitTyped(); e.preventDefault(); }
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
      if (explaining) return;
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
        vibrate(60, $settings.haptics ?? true);
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
      errT.clear();
    };
  });
</script>

<svelte:window onkeydown={onKey} />
<main class="game" bind:this={mainEl}>
  <GameHeader
    lives={MAX_LIVES - session.livesLost} {heartPulse}
    title={mode === 'level' ? `${level} · ${$t(`level.name.${level}`)}`
      : mode === 'rush' ? `${$t('game.rush')} · ${session.level >= MAX_LEVEL ? '40+' : session.level}`
      : mode === 'practice' ? $t('practice.title')
      : mode === 'weekly' ? $t('weekly.title')
      : $t('daily.title')}
    streak={session.streak}
    {tipJar} tipJarText={formatEuro(tipJar, symbolFirst)}
    score={session.score} scoreLabel={$t('game.score')}
    menuLabel={$t('game.menu')} onmenu={() => setPaused(true, true)}
  />

  {#if happyHour || rowdy}
    <div class="chips">
      {#if happyHour}<span class="chip">🍻 {$t('game.happy-hour')}</span>{/if}
      {#if rowdy}<span class="chip">⏱ {$t('game.rowdy')}</span>{/if}
    </div>
  {/if}

  {#if mode !== 'rush'}
    <div class="orders-bar" title="{session.roundsDone}/{session.params.ordersPerLevel}">
      <div class="orders-fill" style="width: {(session.roundsDone / session.params.ordersPerLevel) * 100}%"></div>
    </div>
  {/if}

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

    <MenuCard menu={pricedMenu} pricesHidden={menuHidden} {symbolFirst} />

    {#key round.phase}
      <div class="phase">
        {#if round.phase === 'sum'}
          <SumPhase
            locked={numpadLocked} {symbolFirst}
            onsum={onSum} ontipp={onTipp}
            bindApi={(api) => (numpadApi = api)}
            tippHint={tipJar >= 50 ? ` (${formatEuro(50, symbolFirst)})` : ' (−25)'}
          />
        {:else if round.phase === 'change'}
          <ChangePhase
            paymentPieces={round.paymentPieces}
            {tillView} {pile}
            showPileTotal={session.params.showPileTotal}
            showKeys={false}
            finishMode={round.changeDue === 0}
            {askOpen}
            ontake={take} onreturn={ret} onconfirm={submitTyped}
            ontoggleask={() => (askOpen = !askOpen)}
            onask={onAsk} onnotenough={onNotEnough} ontipp={onTipp}
            tippHint={tipJar >= 50 ? ` (${formatEuro(50, symbolFirst)})` : ' (−25)'}
            typedDisplay={typedChange === '' ? '' : formatEuro(parseEntry(typedChange), symbolFirst)}
            typedHint={$settings.amountEntry ? $t('game.typed-hint') : $t('game.typed-hint-piece')}
            leftHand={$settings.leftHand ?? false}
          />
        {/if}
      </div>
    {/key}
  {/if}

  <CoinBurst {burstKey} />

  <GameToasts {flash} {errorFlash} />

  {#if session.finished && finalized}
    <EndOverlay
      {session} {level} {stars} {wasNewHigh} onretry={restart}
      onshare={mode === 'daily' || mode === 'weekly' ? doShare : null}
      shareLabel={shareCopied ? $t('daily.copied') : $t('daily.share')}
      note={mode === 'daily' && !rankedRun ? $t('daily.unranked') : null}
      levelName={mode === 'level' ? $t(`level.name.${level}`) : null}
      celebrate={bigWin}
      compareCode={mode === 'weekly' ? encodeResult({ week: weekKey(new Date()), score: session.score }) : null}
    />
  {/if}

  {#if badgeToast}<div class="badge-toast">{badgeToast}</div>{/if}

  {#if explaining}
    <ExplainerCard
      title={$t(`explain.${explaining}.title`)}
      body={$t(`explain.${explaining}.body`)}
      ondismiss={dismissExplain}
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

  {#if dispute && !paused && !explaining}
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
  .chips { display: flex; gap: 0.4rem; }
  .chip {
    background: var(--accent); color: var(--ink);
    border-radius: 999px; padding: 0.1rem 0.6rem;
    font-size: 0.8rem; font-weight: bold;
    animation: op-slide-up 0.2s ease-out;
  }
  .queue { display: flex; gap: 0.75rem; min-height: 40px; }
  .customer { width: 64px; opacity: 0.5; }
  .customer.active { opacity: 1; }
  .face { font-size: 1.4rem; }
  .order { font-size: 1.15rem; font-style: italic; }
  .amend { color: var(--accent); animation: op-slide-up 0.3s ease-out; }
  .hint-line { color: var(--accent); animation: op-slide-up 0.2s ease-out; }
  .phase { display: flex; flex-direction: column; gap: 0.75rem; animation: op-slide-up 0.15s ease-out; }
  .badge-toast {
    position: fixed; inset: auto 0 12% 0; margin: 0 auto; width: fit-content;
    background: var(--accent); color: var(--ink); animation: op-slide-up 0.2s ease-out;
    padding: 0.75rem 1.5rem; border-radius: 14px;
    font-size: 1.15rem; font-weight: bold;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.6);
    border: 1px solid rgb(0 0 0 / 0.15);
  }
  .orders-bar {
    height: 6px; border-radius: 3px; background: rgb(0 0 0 / 0.35); overflow: hidden;
  }
  .orders-fill {
    height: 100%; background: var(--accent); border-radius: 3px;
    transition: width 0.4s ease;
  }
</style>
