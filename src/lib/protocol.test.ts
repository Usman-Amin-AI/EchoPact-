import { createProtocolSession, buildDataFrame, buildAckFrame, receiveFrame, shouldRetry, nextRetryFrame, encodeFrame, decodeFrame } from './protocol';

describe('protocol reliability', () => {
  it('suppresses duplicate frames and returns an ack', () => {
    const session = createProtocolSession('sid-1');
    const frame = buildDataFrame(session, 'hello');
    const first = receiveFrame(session, frame);
    const second = receiveFrame(session, frame);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(first.ackFrame?.type).toBe('ack');
  });

  it('allows retrying a frame up to the configured limit', () => {
    const frame = buildAckFrame(createProtocolSession('sid-2'), 1);
    expect(shouldRetry(frame, 3)).toBe(true);
    const retried = nextRetryFrame(frame);
    expect(retried.retry).toBe(1);
  });

  it('round-trips frames through encode and decode', () => {
    const session = createProtocolSession('sid-3');
    const frame = buildDataFrame(session, 'payload');
    const encoded = encodeFrame(frame);
    const decoded = decodeFrame(encoded);

    expect(decoded?.payload).toBe('payload');
    expect(decoded?.seq).toBe(1);
  });
});
