<!-- src/routes/Tutorial.svelte -->
<script lang="ts">
  import { get } from 'svelte/store';
  import { t, locale } from '../i18n';
  import { go } from '../lib/router';
  import { settings } from '../stores/settings';
  import { markSeen } from '../stores/seen';
  import { TUTORIAL_STEPS, tutorialTill } from '../core/tutorial';
  import { localizedDefaultMenu } from '../core/menu';
  import { createRound, submitSum, submitChange, askCustomer, type RoundState } from '../core/round';
  import { orderTotal, piecesTotal, type OrderLine } from '../core/order';
  import { renderOrder } from '../core/text-order';
  import { formatEuro, parseEntry } from '../core/money';
  import { DENOMS, type Denom } from '../core/till';
  import { chaChing, coinClink, errorBuzz } from '../lib/sound';
  import MenuCard from '../lib/MenuCard.svelte';
  import SumPhase from '../lib/SumPhase.svelte';
  import ChangePhase from '../lib/ChangePhase.svelte';
  import type { NumpadApi } from '../lib/Numpad.svelte';

  const menu = $derived(localizedDefaultMenu($locale));
  let step = $state(0);
  let round = $state<RoundState | null>(null);
  let pile = $state<Denom[]>([]);
  let askOpen = $state(false);
  let coach = $state('');
  let finished = $state(false);
  let asked = $state(false);

  const tillView = $derived.by(() => {
    if (!round) return tutorialTill(step);
    const view = { ...round.till };
    for (const p of pile) view[p] -= 1;
    return view;
  });

  function linesFor(stepIdx: number): OrderLine[] {
    return TUTORIAL_STEPS[stepIdx].lines.map((l) => ({
      item: menu.find((m) => m.id === l.id)!, qty: l.qty,
    }));
  }
  const orderText = $derived.by(() => {
    if (!round) return '';
    return renderOrder(round.order, $locale);
  });

  function startStep(i: number) {
    step = i;
    typed = '';
    const s = TUTORIAL_STEPS[i];
    const lines = linesFor(i);
    round = createRound(
      { lines, totalCents: orderTotal(lines) }, s.paymentPieces, tutorialTill(i),
    );
    pile = [];
    askOpen = false;
    asked = false;
    coach = get(t)(`tutorial.s${i + 1}.sum`);
  }

  function onSum(cents: number) {
    if (!round) return;
    if (cents !== round.order.totalCents) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.wrong-sum').replace(
        '{total}', formatEuro(round.order.totalCents, $settings.symbolFirst));
      return;
    }
    round = submitSum(round, cents);
    coach = get(t)(`tutorial.s${step + 1}.change`);
  }

  function take(d: Denom) {
    if ((tillView[d] ?? 0) > 0) { pile = [...pile, d]; coinClink($settings.sound); }
  }
  function ret(i: number) { pile = pile.toSpliced(i, 1); }

  function confirm() {
    if (!round) return;
    if (TUTORIAL_STEPS[step].needsAsk && !asked) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.need-ask');
      pile = [];
      return;
    }
    if (piecesTotal(pile) !== round.changeDue) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.wrong-change').replace(
        '{change}', formatEuro(round.changeDue, $settings.symbolFirst));
      pile = [];
      return;
    }
    round = submitChange(round, pile);
    chaChing($settings.sound);
    if (step + 1 < TUTORIAL_STEPS.length) startStep(step + 1);
    else {
      finished = true;
      round = null;
      markSeen('tutorial');
    }
  }

  function onAsk(d: Denom) {
    if (!round) return;
    askOpen = false;
    const s = TUTORIAL_STEPS[step];
    if (!s.needsAsk || d !== s.askDenom) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.ask-hint');
      return;
    }
    round = askCustomer(round, d);
    asked = true;
    coach = get(t)('tutorial.s3.after-ask');
  }

  function onNotEnough() { /* hidden via showExtras */ }

  let numpadApi: NumpadApi | null = null;
  let typed = $state('');

  function typePiece(d: string) {
    if (d === ',') {
      if (typed.includes(',')) return;
      typed = typed === '' ? '0,' : typed + ',';
      return;
    }
    const [euros, cents] = typed.split(',');
    if (cents !== undefined) {
      if (cents.length >= 2) return;
    } else if (euros.length >= 4) return;
    typed += d;
  }

  function submitTypedPiece() {
    if (!round) return;
    if (typed === '') {
      confirm();
      return;
    }
    const amount = parseEntry(typed);
    typed = '';
    const d = amount as Denom;
    if (!(DENOMS as readonly number[]).includes(d) || (tillView[d] ?? 0) <= 0) {
      errorBuzz($settings.sound);
      return;
    }
    take(d);
  }

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (!round) return;
    if (round.phase === 'sum') {
      if (/^[0-9]$/.test(k)) { numpadApi?.press(k); e.preventDefault(); }
      else if (k === ',' || k === '.') { numpadApi?.press(','); e.preventDefault(); }
      else if (k === 'Backspace') { numpadApi?.press('Backspace'); e.preventDefault(); }
      else if (k === 'Enter') { numpadApi?.press('Enter'); e.preventDefault(); }
    } else if (round.phase === 'change') {
      if (/^[0-9]$/.test(k) || k === ',' || k === '.') {
        if (round.changeDue === 0) return; // exact payment: nothing to give
        typePiece(k === '.' ? ',' : k);
        e.preventDefault();
      } else if (k === 'Backspace') {
        typed = typed.slice(0, -1);
        e.preventDefault();
      } else if (k === 'Enter') { submitTypedPiece(); e.preventDefault(); }
    }
  }

  startStep(0);
</script>

<svelte:window onkeydown={onKey} />

<main class="tutorial">
  <header>
    <button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button>
    <span>0 · {$t('tutorial.name')}</span>
    <button class="skip" onclick={() => { markSeen('tutorial'); go('home'); }}>{$t('tutorial.skip')}</button>
  </header>

  <p class="coach">{coach}</p>

  {#if round}
    <p class="order">“{orderText}”</p>
    <MenuCard {menu} pricesHidden={false} symbolFirst={$settings.symbolFirst} />
    {#key round.phase}
      <div class="phase">
        {#if round.phase === 'sum'}
          <SumPhase
            locked={false} symbolFirst={$settings.symbolFirst}
            onsum={onSum} ontipp={() => {}} showTipp={false}
            bindApi={(api) => (numpadApi = api)}
          />
        {:else if round.phase === 'change'}
          <ChangePhase
            paymentPieces={round.paymentPieces}
            {tillView} {pile}
            showPileTotal={true} showKeys={false}
            finishMode={round.changeDue === 0}
            {askOpen} showExtras={false}
            typedDisplay={typed === '' ? '' : formatEuro(parseEntry(typed), $settings.symbolFirst)}
            typedHint={$t('game.typed-hint-piece')}
            ontake={take} onreturn={ret} onconfirm={submitTypedPiece}
            ontoggleask={() => (askOpen = !askOpen)}
            onask={onAsk} onnotenough={onNotEnough} ontipp={() => {}}
          />
        {/if}
      </div>
    {/key}
  {/if}

  {#if finished}
    <div class="done">
      <h2>{$t('tutorial.done-title')}</h2>
      <p>{$t('tutorial.done-body')}</p>
      <button class="go" onclick={() => go('game/1')}>{$t('tutorial.done-cta')}</button>
    </div>
  {/if}
</main>

<style>
  .tutorial {
    display: flex; flex-direction: column; gap: 0.75rem;
    max-width: 480px; margin: 0 auto; padding: 0.75rem; min-height: 100dvh;
  }
  header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .skip { background: var(--wood-light); color: var(--cream); font-size: 0.85rem; }
  .coach {
    background: var(--accent); color: var(--ink);
    border-radius: var(--radius); padding: 0.6rem 0.8rem; font-weight: bold;
    animation: op-slide-up 0.2s ease-out;
  }
  .order { font-size: 1.15rem; font-style: italic; }
  .phase { display: flex; flex-direction: column; gap: 0.75rem; }
  .done { display: flex; flex-direction: column; gap: 0.6rem; align-items: center; text-align: center; padding: 1.5rem 0; }
  .go { background: var(--ok); color: var(--cream); font-size: 1.1rem; padding: 0.6rem 1.4rem; }
</style>
