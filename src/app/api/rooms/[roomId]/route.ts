import { NextResponse } from 'next/server';
import { createRoomService } from '@/lib/room-service';

const roomService = createRoomService();

export async function GET(_req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = roomService.getRoom(roomId);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({ room });
}

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const payload = await req.json();

  try {
    if (payload.action === 'join') {
      return NextResponse.json({ room: roomService.joinRoom({ roomId, ...payload }) });
    }

    if (payload.action === 'leave') {
      return NextResponse.json({ room: roomService.leaveRoom(roomId, payload.participantId) });
    }

    if (payload.action === 'update') {
      return NextResponse.json({ room: roomService.updateParticipant({ roomId, ...payload }) });
    }

    if (payload.action === 'end') {
      return NextResponse.json({ room: roomService.endRoom(roomId) });
    }

    return NextResponse.json({ error: 'Unsupported room action' }, { status: 400 });
  } catch (error) {
    console.error('Room action error:', error);
    return NextResponse.json({ error: 'Unable to process room action' }, { status: 400 });
  }
}
