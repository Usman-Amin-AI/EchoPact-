import { Conversation } from '@11labs/client';
import type { VoiceAgentProvider, VoiceProviderConfig, VoiceSessionHandle } from '@/lib/voice-provider';

export class ElevenLabsProvider implements VoiceAgentProvider {
  async connect(config: VoiceProviderConfig, handlers: {
    onConnect: () => void;
    onDisconnect: () => void;
    onMessage: (event: { message: string; source: 'ai' | 'user' }) => void;
    onError: (error: Error) => void;
    onModeChange?: (mode: string) => void;
  }): Promise<VoiceSessionHandle> {
    if (!config.agentId) {
      throw new Error('ElevenLabs agent id is required');
    }

    const signedUrl = await fetch(`/api/signed-url?agentId=${config.agentId}`).then(async (response) => {
      if (!response.ok) {
        throw new Error('Failed to get signed url');
      }
      const data = await response.json();
      return data.signedUrl as string;
    });

    const conversation = await Conversation.startSession({
      signedUrl,
      onConnect: handlers.onConnect,
      onDisconnect: handlers.onDisconnect,
      onMessage: ({ message, source }) => handlers.onMessage({ message, source: source === 'ai' ? 'ai' : 'user' }),
      onError: (error) => handlers.onError(error && typeof error === 'object' && 'message' in error ? error as Error : new Error(String(error))),
      onModeChange: ({ mode }) => handlers.onModeChange?.(mode),
    });

    return {
      id: `elevenlabs-${config.agentId}`,
      end: async () => {
        await conversation.endSession();
      },
    };
  }
}
