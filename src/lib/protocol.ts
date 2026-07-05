export type ProtocolVersion = 1;
export type ProtocolFrameType = 'data' | 'ack' | 'error' | 'handshake';

export type ProtocolFrame = {
  v: ProtocolVersion;
  type: ProtocolFrameType;
  sid: string;
  seq: number;
  ack: number;
  ackRequired: boolean;
  retry: number;
  payload: string;
  fragmentIndex?: number;
  fragmentCount?: number;
};

export type ProtocolSessionState = {
  sid: string;
  nextSeq: number;
  lastAck: number;
  seenSeqs: Set<number>;
  pending: Map<number, ProtocolFrame>;
  lastReceivedSeq: number;
  metrics: {
    sentFrames: number;
    receivedFrames: number;
    acksSent: number;
    acksReceived: number;
    retries: number;
    duplicates: number;
  };
};

export function createProtocolSession(sid: string): ProtocolSessionState {
  return {
    sid,
    nextSeq: 1,
    lastAck: 0,
    seenSeqs: new Set<number>(),
    pending: new Map<number, ProtocolFrame>(),
    lastReceivedSeq: 0,
    metrics: {
      sentFrames: 0,
      receivedFrames: 0,
      acksSent: 0,
      acksReceived: 0,
      retries: 0,
      duplicates: 0,
    },
  };
}

export function encodeFrame(frame: ProtocolFrame): string {
  return JSON.stringify(frame);
}

export function decodeFrame(raw: string): ProtocolFrame | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ProtocolFrame>;
    if (!parsed || parsed.v !== 1 || typeof parsed.type !== 'string' || typeof parsed.sid !== 'string') {
      return null;
    }
    return {
      v: 1,
      type: parsed.type as ProtocolFrameType,
      sid: parsed.sid,
      seq: typeof parsed.seq === 'number' ? parsed.seq : 0,
      ack: typeof parsed.ack === 'number' ? parsed.ack : 0,
      ackRequired: Boolean(parsed.ackRequired),
      retry: typeof parsed.retry === 'number' ? parsed.retry : 0,
      payload: typeof parsed.payload === 'string' ? parsed.payload : '',
      fragmentIndex: typeof parsed.fragmentIndex === 'number' ? parsed.fragmentIndex : undefined,
      fragmentCount: typeof parsed.fragmentCount === 'number' ? parsed.fragmentCount : undefined,
    };
  } catch {
    return null;
  }
}

export function buildDataFrame(session: ProtocolSessionState, payload: string, ackRequired = true, fragmentIndex?: number, fragmentCount?: number): ProtocolFrame {
  const frame: ProtocolFrame = {
    v: 1,
    type: 'data',
    sid: session.sid,
    seq: session.nextSeq,
    ack: session.lastAck,
    ackRequired,
    retry: 0,
    payload,
    fragmentIndex,
    fragmentCount,
  };
  session.nextSeq += 1;
  session.metrics.sentFrames += 1;
  return frame;
}

export function buildAckFrame(session: ProtocolSessionState, seq: number): ProtocolFrame {
  session.metrics.acksSent += 1;
  return {
    v: 1,
    type: 'ack',
    sid: session.sid,
    seq: session.nextSeq,
    ack: seq,
    ackRequired: false,
    retry: 0,
    payload: '',
  };
}

export function receiveFrame(session: ProtocolSessionState, frame: ProtocolFrame): { accepted: boolean; ackFrame?: ProtocolFrame; duplicate: boolean } {
  session.metrics.receivedFrames += 1;

  if (session.seenSeqs.has(frame.seq)) {
    session.metrics.duplicates += 1;
    return { accepted: false, duplicate: true };
  }

  session.seenSeqs.add(frame.seq);
  session.lastAck = Math.max(session.lastAck, frame.seq);
  session.lastReceivedSeq = Math.max(session.lastReceivedSeq, frame.seq);

  if (frame.type === 'ack') {
    session.metrics.acksReceived += 1;
    return { accepted: true, duplicate: false };
  }

  if (frame.ackRequired) {
    return {
      accepted: true,
      ackFrame: buildAckFrame(session, frame.seq),
      duplicate: false,
    };
  }

  return { accepted: true, duplicate: false };
}

export function shouldRetry(frame: ProtocolFrame, maxRetries = 3): boolean {
  return frame.retry < maxRetries;
}

export function nextRetryFrame(frame: ProtocolFrame): ProtocolFrame {
  return { ...frame, retry: frame.retry + 1 };
}

export function fragmentPayload(payload: string, chunkSize = 120): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < payload.length; index += chunkSize) {
    chunks.push(payload.slice(index, index + chunkSize));
  }
  return chunks;
}

export function buildFragmentedFrames(session: ProtocolSessionState, payload: string, chunkSize = 120): ProtocolFrame[] {
  const chunks = fragmentPayload(payload, chunkSize);
  return chunks.map((chunk, index) => buildDataFrame(session, chunk, true, index, chunks.length));
}
