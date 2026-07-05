import { createRoomService } from './room-service';

describe('room service', () => {
  it('creates a room and adds a host participant', () => {
    const service = createRoomService();
    const room = service.createRoom({ name: 'Demo room', hostId: 'host-1', hostName: 'Host' });

    expect(room.status).toBe('active');
    expect(room.participants).toHaveLength(1);
    expect(room.participants[0].role).toBe('host');
  });

  it('allows participants to join and leave', () => {
    const service = createRoomService();
    const room = service.createRoom({ name: 'Demo room', hostId: 'host-1' });
    service.joinRoom({ roomId: room.id, participantId: 'p-1', participantName: 'Peer' });
    const updated = service.leaveRoom(room.id, 'p-1');

    expect(updated.participants.find((participant) => participant.id === 'p-1')?.status).toBe('left');
  });
});
