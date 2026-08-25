/** setTimeout wrapper whose remaining time survives pause/resume. */
export class PausableTimer {
  private id: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;
  private fn: (() => void) | null = null;

  start(fn: () => void, ms: number): void {
    this.clear();
    this.fn = fn;
    this.remaining = ms;
    this.arm();
  }

  private arm(): void {
    this.startedAt = Date.now();
    this.id = setTimeout(() => {
      this.id = undefined;
      const f = this.fn;
      this.fn = null;
      f?.();
    }, this.remaining);
  }

  pause(): void {
    if (this.id === undefined) return;
    clearTimeout(this.id);
    this.id = undefined;
    this.remaining -= Date.now() - this.startedAt;
  }

  resume(): void {
    if (this.id !== undefined || this.fn === null) return;
    this.remaining = Math.max(this.remaining, 0);
    this.arm();
  }

  clear(): void {
    if (this.id !== undefined) clearTimeout(this.id);
    this.id = undefined;
    this.fn = null;
  }

  get pending(): boolean {
    return this.id !== undefined || this.fn !== null;
  }
}
