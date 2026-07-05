export type DashboardStatus = 'connected' | 'pending' | 'degraded' | 'failed';

export type DashboardSnapshot = {
  transportMode: string;
  handshakeState: DashboardStatus;
  connectionState: DashboardStatus;
  protocolState: DashboardStatus;
  participantCount: number;
  confirmedParticipants: number;
  latencyMs: number;
  warnings: string[];
  recentEvents: string[];
};

export function createDashboardSnapshot(params: Partial<DashboardSnapshot> & { transportMode?: string; participantCount?: number; confirmedParticipants?: number }): DashboardSnapshot {
  const transportMode = params.transportMode ?? 'audio';
  const participantCount = params.participantCount ?? 0;
  const confirmedParticipants = params.confirmedParticipants ?? 0;
  const warnings = params.warnings ?? [];
  const recentEvents = params.recentEvents ?? [];

  const handshakeState: DashboardStatus = params.handshakeState ?? (warnings.length > 0 ? 'degraded' : 'pending');
  const connectionState: DashboardStatus = params.connectionState ?? (participantCount > 1 ? 'connected' : 'pending');
  const protocolState: DashboardStatus = params.protocolState ?? (confirmedParticipants >= participantCount && participantCount > 1 ? 'connected' : 'pending');

  return {
    transportMode,
    handshakeState,
    connectionState,
    protocolState,
    participantCount,
    confirmedParticipants,
    latencyMs: params.latencyMs ?? 0,
    warnings,
    recentEvents,
  };
}

export function getStatusClass(status: DashboardStatus): string {
  switch (status) {
    case 'connected':
      return 'text-emerald-300';
    case 'degraded':
      return 'text-amber-300';
    case 'failed':
      return 'text-rose-300';
    default:
      return 'text-slate-300';
  }
}
