import { describe, it, expect } from 'vitest';
import {
  UPGRADES, applyUpgrades, boostTip, freeFirstHint, careerTitle,
} from '../../src/core/career';
import { paramsForLevel } from '../../src/core/difficulty';

describe('UPGRADES', () => {
  it('has the five catalog entries with 10c-grid costs', () => {
    expect(UPGRADES.map((u) => u.id)).toEqual(
      ['jar-xl', 'coffee-machine', 'cheat-sheet', 'accent-copper', 'accent-forest']);
    for (const u of UPGRADES) expect(u.costCents % 10).toBe(0);
  });
});

describe('applyUpgrades', () => {
  const base = paramsForLevel(10);
  it('coffee machine adds a second of patience outside ranked modes', () => {
    expect(applyUpgrades(base, ['coffee-machine'], 'level').patienceSeconds)
      .toBe(base.patienceSeconds + 1);
    expect(applyUpgrades(base, ['coffee-machine'], 'practice').patienceSeconds)
      .toBe(base.patienceSeconds + 1);
  });
  it('is identity for daily and weekly regardless of upgrades', () => {
    expect(applyUpgrades(base, ['coffee-machine', 'jar-xl'], 'daily')).toEqual(base);
    expect(applyUpgrades(base, ['coffee-machine'], 'weekly')).toEqual(base);
  });
  it('is identity without the upgrade', () => {
    expect(applyUpgrades(base, ['jar-xl'], 'level')).toEqual(base);
  });
});

describe('boostTip', () => {
  it('jar-xl rounds the 10% boost up to the 10c grid outside ranked', () => {
    expect(boostTip(40, ['jar-xl'], 'level')).toBe(50);   // 44 → 50
    expect(boostTip(100, ['jar-xl'], 'rush')).toBe(110);
    expect(boostTip(40, ['jar-xl'], 'weekly')).toBe(40);
    expect(boostTip(40, [], 'level')).toBe(40);
  });
});

describe('freeFirstHint', () => {
  it('cheat sheet outside ranked only', () => {
    expect(freeFirstHint(['cheat-sheet'], 'level')).toBe(true);
    expect(freeFirstHint(['cheat-sheet'], 'daily')).toBe(false);
    expect(freeFirstHint([], 'level')).toBe(false);
  });
});

describe('careerTitle', () => {
  it('walks the ladder on stars and level', () => {
    expect(careerTitle(0, 0)).toBe('aushilfe');
    expect(careerTitle(10, 5)).toBe('barkeeper');
    expect(careerTitle(30, 15)).toBe('schichtleiter');
    expect(careerTitle(30, 14)).toBe('barkeeper');   // level gate not met
    expect(careerTitle(60, 25)).toBe('wirt');
    expect(careerTitle(90, 40)).toBe('legende');
    expect(careerTitle(90, 39)).toBe('wirt');
  });
});
