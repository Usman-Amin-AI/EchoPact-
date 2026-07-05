import type { VoiceAgentProvider, VoiceProviderConfig, VoiceSessionHandle } from '@/lib/voice-provider';

export class OpenAIRealtimeProvider implements VoiceAgentProvider {
  async connect(config: VoiceProviderConfig, handlers: {
    onConnect: () => void;
    onDisconnect: () => void;
    onMessage: (event: { message: string; source: 'ai' | 'user' }) => void;
    onError: (error: Error) => void;
    onModeChange?: (mode: string) => void;
  }): Promise<VoiceSessionHandle> {
    if (!config.endpoint || !config.apiKey) {
      throw new Error('OpenAI Realtime endpoint and api key are required');
    }

    handlers.onConnect();

    return {
      id: `openai-realtime-${config.agentId}`,
      end: async () => {
        handlers.onDisconnect();
      },
    };
  }
}
