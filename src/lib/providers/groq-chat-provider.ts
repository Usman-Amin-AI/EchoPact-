import Groq from 'groq-sdk';
import type { ChatProvider, ChatRequest, ChatProviderResponse } from '@/lib/chat-service';

export class GroqChatProvider implements ChatProvider {
  constructor(private readonly client: Groq) {}

  async generate(request: ChatRequest): Promise<ChatProviderResponse> {
    const completion = await this.client.chat.completions.create({
      model: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
      messages: request.messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
        content: message.content,
      })),
      temperature: 0.7,
      max_tokens: 180,
    });

    return {
      content: completion.choices[0]?.message?.content?.trim() || '',
      provider: 'groq',
      model: completion.model,
    };
  }
}
