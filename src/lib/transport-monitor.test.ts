import { createTransportMonitor } from './transport-monitor';

describe('transport monitor', () => {
  it('falls back when enough drops accumulate', () => {
    const monitor = createTransportMonitor();
    monitor.recordDrop('first');
    monitor.recordDrop('second');
    monitor.recordDrop('third');

    const snapshot = monitor.getSnapshot();
    expect(snapshot.mode).toBe('relay');
    expect(snapshot.fallbackCount).toBe(1);
  });

  it('tracks delay and recovery', () => {
    const monitor = createTransportMonitor();
    monitor.recordDelay(2000);
    monitor.recordRecovery('recovered');

    const snapshot = monitor.getSnapshot();
    expect(snapshot.averageDelayMs).toBeGreaterThan(0);
    expect(snapshot.score).toBeGreaterThan(0);
  });
});
