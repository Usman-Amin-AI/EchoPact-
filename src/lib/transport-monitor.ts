export type TransportMonitorEvent = {
  type: 'drop' | 'delay' | 'recovery' | 'fallback';
  message: string;
  timestamp: string;
};

export type TransportQualitySnapshot = {
  mode: 'audio' | 'relay' | 'webrtc';
  score: number;
  droppedMessages: number;
  averageDelayMs: number;
  lastEvent?: TransportMonitorEvent;
  fallbackCount: number;
};

export type TransportMonitorOptions = {
  initialMode?: 'audio' | 'relay' | 'webrtc';
  delayThresholdMs?: number;
  dropThreshold?: number;
};

export function createTransportMonitor(options: TransportMonitorOptions = {}) {
  const delayThresholdMs = options.delayThresholdMs ?? 1500;
  const dropThreshold = options.dropThreshold ?? 3;

  let snapshot: TransportQualitySnapshot = {
    mode: options.initialMode ?? 'audio',
    score: 100,
    droppedMessages: 0,
    averageDelayMs: 0,
    fallbackCount: 0,
  };

  const events: TransportMonitorEvent[] = [];

  function addEvent(event: TransportMonitorEvent) {
    events.push(event);
    snapshot = { ...snapshot, lastEvent: event };
  }

  return {
    getSnapshot() {
      return { ...snapshot, lastEvent: snapshot.lastEvent ? { ...snapshot.lastEvent } : undefined };
    },
    recordDrop(message?: string) {
      snapshot = { ...snapshot, droppedMessages: snapshot.droppedMessages + 1 };
      const event: TransportMonitorEvent = {
        type: 'drop',
        message: message ?? 'Dropped message detected',
        timestamp: new Date().toISOString(),
      };
      addEvent(event);
      if (snapshot.droppedMessages >= dropThreshold) {
        const nextMode = snapshot.mode === 'audio' ? 'relay' : snapshot.mode;
        snapshot = { ...snapshot, mode: nextMode, fallbackCount: snapshot.fallbackCount + 1, score: Math.max(20, snapshot.score - 20) };
        addEvent({ type: 'fallback', message: `Fallback to ${nextMode}`, timestamp: new Date().toISOString() });
      }
    },
    recordDelay(delayMs: number) {
      const averageDelayMs = snapshot.averageDelayMs === 0 ? delayMs : (snapshot.averageDelayMs + delayMs) / 2;
      snapshot = { ...snapshot, averageDelayMs };
      if (delayMs > delayThresholdMs) {
        snapshot = { ...snapshot, score: Math.max(20, snapshot.score - 10) };
        addEvent({ type: 'delay', message: `Delay exceeded threshold: ${delayMs}ms`, timestamp: new Date().toISOString() });
      }
    },
    recordRecovery(message?: string) {
      snapshot = { ...snapshot, score: Math.min(100, snapshot.score + 15) };
      addEvent({ type: 'recovery', message: message ?? 'Transport recovered', timestamp: new Date().toISOString() });
    },
    setMode(mode: 'audio' | 'relay' | 'webrtc') {
      snapshot = { ...snapshot, mode };
    },
    getEvents() {
      return [...events];
    },
  };
}
