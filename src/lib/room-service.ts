export type RoomParticipantStatus = 'pending' | 'joined' | 'muted' | 'left';

export type RoomParticipant = {
  id: string;
  name: string;
  role: 'host' | 'coordinator' | 'participant';
  status: RoomParticipantStatus;
  joinedAt: string;
  metadata?: Record<string, unknown>;
};

export type RoomSession = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  hostId: string;
  status: 'active' | 'ended' | 'archived';
  participants: RoomParticipant[];
  metadata: Record<string, unknown>;
};

export type CreateRoomInput = {
  id?: string;
  name: string;
  hostId: string;
  hostName?: string;
  metadata?: Record<string, unknown>;
};

export type JoinRoomInput = {
  roomId: string;
  participantId: string;
  participantName: string;
  role?: RoomParticipant['role'];
  metadata?: Record<string, unknown>;
};

export type UpdateParticipantInput = {
  roomId: string;
  participantId: string;
  status?: RoomParticipantStatus;
  role?: RoomParticipant['role'];
  metadata?: Record<string, unknown>;
};

const rooms = new Map<string, RoomSession>();

function nowIso() {
  return new Date().toISOString();
}

export function createRoomService() {
  return {
    createRoom(input: CreateRoomInput): RoomSession {
      const roomId = input.id ?? `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const room: RoomSession = {
        id: roomId,
        name: input.name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        hostId: input.hostId,
        status: 'active',
        participants: [
          {
            id: input.hostId,
            name: input.hostName ?? 'Host',
            role: 'host',
            status: 'joined',
            joinedAt: nowIso(),
            metadata: input.metadata ?? {},
          },
        ],
        metadata: input.metadata ?? {},
      };

      rooms.set(room.id, room);
      return room;
    },

    getRoom(roomId: string): RoomSession | null {
      return rooms.get(roomId) ?? null;
    },

    listRooms(): RoomSession[] {
      return Array.from(rooms.values());
    },

    joinRoom(input: JoinRoomInput): RoomSession {
      const room = rooms.get(input.roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const existing = room.participants.find((participant) => participant.id === input.participantId);
      if (existing) {
        existing.status = 'joined';
        existing.name = input.participantName;
        existing.role = input.role ?? existing.role;
        existing.metadata = { ...(existing.metadata ?? {}), ...(input.metadata ?? {}) };
      } else {
        room.participants.push({
          id: input.participantId,
          name: input.participantName,
          role: input.role ?? 'participant',
          status: 'joined',
          joinedAt: nowIso(),
          metadata: input.metadata ?? {},
        });
      }

      room.updatedAt = nowIso();
      return room;
    },

    leaveRoom(roomId: string, participantId: string): RoomSession {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const participant = room.participants.find((entry) => entry.id === participantId);
      if (!participant) {
        throw new Error('Participant not found');
      }

      participant.status = 'left';
      room.updatedAt = nowIso();
      return room;
    },

    updateParticipant(input: UpdateParticipantInput): RoomSession {
      const room = rooms.get(input.roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const participant = room.participants.find((entry) => entry.id === input.participantId);
      if (!participant) {
        throw new Error('Participant not found');
      }

      if (input.status) participant.status = input.status;
      if (input.role) participant.role = input.role;
      if (input.metadata) participant.metadata = { ...(participant.metadata ?? {}), ...input.metadata };

      room.updatedAt = nowIso();
      return room;
    },

    endRoom(roomId: string): RoomSession {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      room.status = 'ended';
      room.updatedAt = nowIso();
      return room;
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
