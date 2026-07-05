export type GroupSessionParticipant = {
  agentId: string;
  agentType: string;
  confirmed: boolean;
  capabilities?: { audio: boolean; webrtc: boolean; relay: boolean };
};

export type GroupSessionState = {
  roomId: string;
  participants: GroupSessionParticipant[];
  coordinatorAgentId: string | null;
  protocolEnabled: boolean;
  confirmedCount: number;
};

export function createGroupSession(roomId: string, coordinatorAgentId: string) {
  return {
    roomId,
    participants: [],
    coordinatorAgentId,
    protocolEnabled: false,
    confirmedCount: 0,
  } as GroupSessionState;
}

export function addParticipant(session: GroupSessionState, participant: GroupSessionParticipant) {
  if (!session.participants.some((entry) => entry.agentId === participant.agentId)) {
    session.participants.push(participant);
  }
}

export function confirmParticipant(session: GroupSessionState, agentId: string) {
  const participant = session.participants.find((entry) => entry.agentId === agentId);
  if (!participant) return false;
  participant.confirmed = true;
  session.confirmedCount = session.participants.filter((entry) => entry.confirmed).length;
  return true;
}

export function canEnableProtocol(session: GroupSessionState) {
  return session.participants.length >= 2 && session.confirmedCount === session.participants.length;
}

export function enableProtocol(session: GroupSessionState) {
  if (!canEnableProtocol(session)) return false;
  session.protocolEnabled = true;
  return true;
}
