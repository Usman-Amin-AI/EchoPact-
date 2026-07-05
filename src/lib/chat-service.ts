export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  agentType: 'inbound' | 'outbound';
  sessionId: string;
  context?: Record<string, unknown>;
};

export type ChatProviderResponse = {
  content: string;
  provider: string;
  model?: string;
};

export type ChatServiceResponse = ChatProviderResponse & {
  usedFallback: boolean;
  error?: string;
};

export interface ChatProvider {
  generate(request: ChatRequest): Promise<ChatProviderResponse>;
}

export type ChatServiceOptions = {
  providers?: ChatProvider[];
  fallbackEnabled?: boolean;
  fallbackMessage?: string;
};

export function createChatService(options: ChatServiceOptions = {}) {
  const providers = options.providers ?? [];
  const fallbackEnabled = options.fallbackEnabled ?? true;
  const fallbackMessage = options.fallbackMessage ?? 'ECHOPACT fallback response: I am currently unavailable, but I am ready to continue once the service is restored.';

  return {
    async generate(request: ChatRequest): Promise<ChatServiceResponse> {
      const trimmedMessages = request.messages.map((message) => ({
        ...message,
        content: message.content.trim(),
      }));

      if (providers.length === 0) {
        return {
          content: fallbackMessage,
          provider: 'fallback',
          usedFallback: true,
          error: 'No chat providers configured',
        };
      }

      for (const provider of providers) {
        try {
          const result = await provider.generate({
            ...request,
            messages: trimmedMessages,
          });

          return {
            ...result,
            usedFallback: false,
          };
        } catch (error) {
          console.error('Chat provider failed:', error);
        }
      }

      if (!fallbackEnabled) {
        return {
          content: '',
          provider: 'none',
          usedFallback: false,
          error: 'All chat providers failed',
        };
      }

      return {
        content: fallbackMessage,
        provider: 'fallback',
        usedFallback: true,
        error: 'All chat providers failed; using fallback response',
      };
    },
  };
}
