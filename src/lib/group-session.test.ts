import { createGroupSession, addParticipant, confirmParticipant, canEnableProtocol, enableProtocol } from './group-session';

describe('group session coordination', () => {
  it('enables protocol for 2 agents once both confirm', () => {
    const session = createGroupSession('room-2', 'agent-a');
    addParticipant(session, { agentId: 'agent-a', agentType: 'coordinator', confirmed: true });
    addParticipant(session, { agentId: 'agent-b', agentType: 'peer', confirmed: false });
    expect(canEnableProtocol(session)).toBe(false);
    confirmParticipant(session, 'agent-b');
    expect(canEnableProtocol(session)).toBe(true);
    expect(enableProtocol(session)).toBe(true);
  });

  it('enables protocol for 3 agents once all confirm', () => {
    const session = createGroupSession('room-3', 'agent-a');
    ['agent-a', 'agent-b', 'agent-c'].forEach((agentId) => {
      addParticipant(session, { agentId, agentType: 'peer', confirmed: agentId === 'agent-a' });
    });
    ['agent-b', 'agent-c'].forEach((agentId) => confirmParticipant(session, agentId));
    expect(canEnableProtocol(session)).toBe(true);
    expect(enableProtocol(session)).toBe(true);
  });

  it('enables protocol for 4 agents once all confirm', () => {
    const session = createGroupSession('room-4', 'agent-a');
    ['agent-a', 'agent-b', 'agent-c', 'agent-d'].forEach((agentId) => {
      addParticipant(session, { agentId, agentType: 'peer', confirmed: agentId === 'agent-a' });
    });
    ['agent-b', 'agent-c', 'agent-d'].forEach((agentId) => confirmParticipant(session, agentId));
    expect(canEnableProtocol(session)).toBe(true);
    expect(enableProtocol(session)).toBe(true);
  });
});
