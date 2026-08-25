<!-- src/routes/Tutorial.svelte -->
<script lang="ts">
  import { get } from 'svelte/store';
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { settings } from '../stores/settings';
  import { markSeen } from '../stores/seen';
  import { TUTORIAL_STEPS, tutorialTill } from '../core/tutorial';
  import { localizedDefaultMenu } from '../core/menu';
  import { createRound, submitSum, submitChange, askCustomer, type RoundState } from '../core/round';
  import { orderTotal, piecesTotal, type OrderLine } from '../core/order';
  import { renderOrder } from '../core/text-order';
  import { formatEuro } from '../core/money';
  import type { Denom } from '../core/till';
  import { chaChing, coinClink, errorBuzz } from '../lib/sound';
  import MenuCard from '../lib/MenuCard.svelte';
  import SumPhase from '../lib/SumPhase.svelte';
  import ChangePhase from '../lib/ChangePhase.svelte';

  const menu = $derived(localizedDefaultMenu($settings.locale));
  let step = $state(0);
  let round = $state<RoundState | null>(null);
  let pile = $state<Denom[]>([]);
  let askOpen = $state(false);
  let coach = $state('');
  let finished = $state(false);

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
    return renderOrder(round.order, $settings.locale);
  });

  function startStep(i: number) {
    step = i;
    const s = TUTORIAL_STEPS[i];
    const lines = linesFor(i);
    round = createRound(
      { lines, totalCents: orderTotal(lines) }, s.paymentPieces, tutorialTill(i),
    );
    pile = [];
    askOpen = false;
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
    coach = get(t)('tutorial.s3.after-ask');
  }

  function onNotEnough() { /* hidden via showExtras */ }

  startStep(0);
</script>

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
            bindApi={() => {}}
          />
        {:else if round.phase === 'change'}
          <ChangePhase
            paymentPieces={round.paymentPieces}
            {tillView} {pile}
            showPileTotal={true} showKeys={true}
            finishMode={round.changeDue === 0}
            {askOpen} showExtras={false}
            ontake={take} onreturn={ret} onconfirm={confirm}
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
