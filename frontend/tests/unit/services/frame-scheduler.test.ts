import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FrameScheduler } from '../../../src/services/frame-scheduler';

let frames: Array<() => void> = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    frames[handle - 1] = () => undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function runFrames(): void {
  const pending = frames;
  frames = [];
  for (const frame of pending) frame();
}

describe('FrameScheduler', () => {
  it('runs the scheduled task on the next frame', () => {
    const scheduler = new FrameScheduler();
    const task = vi.fn();

    scheduler.schedule(task);
    expect(task).not.toHaveBeenCalled();
    runFrames();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated scheduling into a single frame', () => {
    const scheduler = new FrameScheduler();
    const task = vi.fn();

    scheduler.schedule(task);
    scheduler.schedule(task);
    scheduler.schedule(task);
    runFrames();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('schedules again after the frame has run', () => {
    const scheduler = new FrameScheduler();
    const task = vi.fn();

    scheduler.schedule(task);
    runFrames();
    scheduler.schedule(task);
    runFrames();

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('cancel keeps a pending task from running', () => {
    const scheduler = new FrameScheduler();
    const task = vi.fn();

    scheduler.schedule(task);
    scheduler.cancel();
    runFrames();

    expect(task).not.toHaveBeenCalled();
  });
});
