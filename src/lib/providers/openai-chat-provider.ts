import OpenAI from 'openai';
import type { ChatProvider, ChatRequest, ChatProviderResponse } from '@/lib/chat-service';

export class OpenAIChatProvider implements ChatProvider {
  constructor(private readonly client: OpenAI) {}

  async generate(request: ChatRequest): Promise<ChatProviderResponse> {
    const completion = await this.client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: request.messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
        content: message.content,
      })),
      temperature: 0.7,
      max_tokens: 180,
    });

    return {
      content: completion.choices[0]?.message?.content?.trim() || '',
      provider: 'openai',
      model: completion.model,
    };
  }
}
