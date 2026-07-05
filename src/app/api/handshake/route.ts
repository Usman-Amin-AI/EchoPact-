import { NextResponse } from 'next/server';
import { createCapabilityToken, verifyCapabilityToken } from '@/lib/handshake';

export async function POST(req: Request) {
  try {
    const { mode, agentId, agentType, token, expectedAgentId, roomId, capabilities } = await req.json();

    if (mode !== 'enable-gibber-link') {
      return NextResponse.json({ ok: false, error: 'Unsupported handshake mode' }, { status: 400 });
    }

    const secret = process.env.ECHO_PACT_HANDSHAKE_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: 'Handshake secret not configured' }, { status: 500 });
    }

    if (!agentId || !agentType) {
      return NextResponse.json({ ok: false, error: 'Missing handshake fields' }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({
        ok: true,
        token: createCapabilityToken(
          {
            agentId,
            agentType,
            roomId,
            capabilities: capabilities || { audio: true, webrtc: false, relay: true },
            scope: 'gibber-link',
          },
          secret,
          30_000,
        ),
      });
    }

    const verified = verifyCapabilityToken(token, secret);
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Invalid handshake token' }, { status: 401 });
    }

    if (verified.agentId !== agentId || verified.agentType !== agentType) {
      return NextResponse.json({ ok: false, error: 'Token does not match agent identity' }, { status: 401 });
    }

    if (expectedAgentId && verified.agentId !== expectedAgentId) {
      return NextResponse.json({ ok: false, error: 'Unexpected peer agent id' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      payload: {
        agentId: verified.agentId,
        agentType: verified.agentType,
        roomId: verified.roomId || roomId,
        capabilities: verified.capabilities || capabilities || { audio: true, webrtc: false, relay: true },
        scope: 'gibber-link',
      },
      token: createCapabilityToken(
        {
          agentId: verified.agentId,
          agentType: verified.agentType,
          roomId: verified.roomId || roomId,
          capabilities: verified.capabilities || capabilities || { audio: true, webrtc: false, relay: true },
          scope: 'gibber-link',
        },
        secret,
        30_000,
      ),
    });
  } catch (error) {
    console.error('Handshake error:', error);
    return NextResponse.json({ ok: false, error: 'Handshake failed' }, { status: 500 });
  }
}
