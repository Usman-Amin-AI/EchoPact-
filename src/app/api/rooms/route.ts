import { NextResponse } from 'next/server';
import { createRoomService } from '@/lib/room-service';

const roomService = createRoomService();

export async function GET() {
  return NextResponse.json({ rooms: roomService.listRooms() });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const room = roomService.createRoom(payload);
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json({ error: 'Unable to create room' }, { status: 400 });
  }
}
