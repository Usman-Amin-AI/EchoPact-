import { NextResponse } from 'next/server';

type RelayPeer = {
  agentId: string;
  capabilities: { audio: boolean; relay: boolean };
  registeredAt: number;
};

type RelayMessage = {
  id: string;
  fromAgentId: string;
  toAgentId?: string;
  message: string;
  createdAt: number;
};

type RelayRoom = {
  peers: Map<string, RelayPeer>;
  queue: RelayMessage[];
};

declare global {
  var __echoPactRelayStore: Map<string, RelayRoom> | undefined;
}

function getRelayStore() {
  if (!globalThis.__echoPactRelayStore) {
    globalThis.__echoPactRelayStore = new Map<string, RelayRoom>();
  }
  return globalThis.__echoPactRelayStore;
}

function getOrCreateRoom(store: Map<string, RelayRoom>, roomId: string): RelayRoom {
  const existing = store.get(roomId);
  if (existing) {
    return existing;
  }

  const room: RelayRoom = { peers: new Map(), queue: [] };
  store.set(roomId, room);
  return room;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, roomId, agentId, capabilities, message, toAgentId } = body as {
      action?: string;
      roomId?: string;
      agentId?: string;
      capabilities?: { audio: boolean; relay: boolean };
      message?: string;
      toAgentId?: string;
    };

    if (!roomId || !agentId) {
      return NextResponse.json({ ok: false, error: 'roomId and agentId are required' }, { status: 400 });
    }

    const store = getRelayStore();
    const room = getOrCreateRoom(store, roomId);

    if (action === 'register') {
      room.peers.set(agentId, {
        agentId,
        capabilities: capabilities || { audio: true, relay: true },
        registeredAt: Date.now(),
      });

      const peers = Array.from(room.peers.values());
      const peer = peers.find((entry) => entry.agentId !== agentId);
      return NextResponse.json({
        ok: true,
        mode: peer && capabilities?.relay ? 'relay' : 'audio',
        peerConnected: Boolean(peer),
        peerAgentId: peer?.agentId || null,
      });
    }

    if (action === 'send') {
      if (!message) {
        return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 });
      }

      room.queue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        fromAgentId: agentId,
        toAgentId,
        message,
        createdAt: Date.now(),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Transport relay error:', error);
    return NextResponse.json({ ok: false, error: 'transport relay failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const roomId = url.searchParams.get('roomId');
    const agentId = url.searchParams.get('agentId');

    if (!roomId || !agentId) {
      return NextResponse.json({ ok: false, error: 'roomId and agentId are required' }, { status: 400 });
    }

    const store = getRelayStore();
    const room = store.get(roomId);
    if (!room) {
      return NextResponse.json({ ok: true, messages: [] });
    }

    const pending = room.queue.filter((entry) => !entry.toAgentId || entry.toAgentId === agentId);
    room.queue = room.queue.filter((entry) => entry.toAgentId && entry.toAgentId !== agentId);

    return NextResponse.json({
      ok: true,
      messages: pending.map((entry) => ({
        id: entry.id,
        fromAgentId: entry.fromAgentId,
        message: entry.message,
      })),
    });
  } catch (error) {
    console.error('Transport relay polling error:', error);
    return NextResponse.json({ ok: false, error: 'transport relay polling failed' }, { status: 500 });
  }
}
