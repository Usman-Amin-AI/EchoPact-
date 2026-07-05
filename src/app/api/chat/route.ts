import { NextResponse } from 'next/server';
import { createChatService, type ChatRequest } from '@/lib/chat-service';
import { OpenAIChatProvider } from '@/lib/providers/openai-chat-provider';
import { GroqChatProvider } from '@/lib/providers/groq-chat-provider';
import OpenAI from 'openai';
import Groq from 'groq-sdk';

const providers = [] as Array<{ generate: (request: ChatRequest) => Promise<any> }>;

if (process.env.OPENAI_API_KEY) {
  providers.push(new OpenAIChatProvider(new OpenAI({ apiKey: process.env.OPENAI_API_KEY })));
}

if (process.env.GROQ_API_KEY) {
  providers.push(new GroqChatProvider(new Groq({ apiKey: process.env.GROQ_API_KEY })));
}

const chatService = createChatService({
  providers,
  fallbackEnabled: true,
});

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { messages, agentType, sessionId, context } = payload as ChatRequest & { context?: Record<string, unknown> };

    if (!Array.isArray(messages) || !agentType || !sessionId) {
      return NextResponse.json({ error: 'Invalid chat payload' }, { status: 400 });
    }

    const response = await chatService.generate({
      messages,
      agentType,
      sessionId,
      context,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'AI Service Unavailable', content: 'ECHOPACT fallback response: the chat service is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
