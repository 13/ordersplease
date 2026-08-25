import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PausableTimer } from '../../src/lib/pausable';

describe('PausableTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay', () => {
    const t = new PausableTimer();
    const fn = vi.fn();
    t.start(fn, 1000);
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(t.pending).toBe(false);
  });
  it('pause preserves the remainder, resume completes it', () => {
    const t = new PausableTimer();
    const fn = vi.fn();
    t.start(fn, 1000);
    vi.advanceTimersByTime(600);
    t.pause();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    t.resume();
    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });
  it('clear cancels and forgets', () => {
    const t = new PausableTimer();
    const fn = vi.fn();
    t.start(fn, 1000);
    t.clear();
    t.resume();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    expect(t.pending).toBe(false);
  });
  it('start replaces a pending run', () => {
    const t = new PausableTimer();
    const a = vi.fn();
    const b = vi.fn();
    t.start(a, 1000);
    t.start(b, 1000);
    vi.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
