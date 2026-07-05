export type TransportMode = 'audio' | 'webrtc' | 'relay';

export type TransportCapability = {
  audio: boolean;
  webrtc: boolean;
  relay: boolean;
};

export type TransportPlan = {
  mode: TransportMode;
  reason: string;
};

export type TransportMonitorConfig = {
  preferRelay?: boolean;
  preferWebRTC?: boolean;
};

export function negotiateTransport(capabilities: TransportCapability, config: TransportMonitorConfig = {}): TransportPlan {
  if (config.preferWebRTC && capabilities.webrtc) {
    return { mode: 'webrtc', reason: 'WebRTC data channel preferred' };
  }

  if (config.preferRelay && capabilities.relay) {
    return { mode: 'relay', reason: 'Relay preferred for resilience' };
  }

  if (capabilities.webrtc) {
    return { mode: 'webrtc', reason: 'WebRTC data channel available' };
  }

  if (capabilities.relay) {
    return { mode: 'relay', reason: 'Audio transport degraded; relay fallback enabled' };
  }

  return { mode: 'audio', reason: 'Using audio transport' };
}

export function buildTransportMessage(payload: string, mode: TransportMode, agentId: string): string {
  return JSON.stringify({ mode, agentId, payload });
}

export function parseTransportMessage(raw: string): { mode: TransportMode; agentId: string; payload: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.payload !== 'string' || typeof parsed.agentId !== 'string') {
      return null;
    }
    return {
      mode: parsed.mode === 'webrtc' || parsed.mode === 'relay' ? parsed.mode : 'audio',
      agentId: parsed.agentId,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
}
