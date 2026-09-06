/**
 * Runs a task once on the next animation frame, no matter how often it was
 * scheduled meanwhile. Layout measurement belongs here: reading widths inside
 * an update callback forces a synchronous re-layout of the whole table, and a
 * frame later the browser has laid out once anyway.
 */
export class FrameScheduler {
  private handle: number | null = null;

  schedule(task: () => void): void {
    if (this.handle !== null) return;
    this.handle = requestAnimationFrame(() => {
      this.handle = null;
      task();
    });
  }

  cancel(): void {
    if (this.handle === null) return;
    cancelAnimationFrame(this.handle);
    this.handle = null;
  }
}
