export type VoiceAgentRole = 'inbound' | 'outbound';

export type VoiceSessionHandle = {
  id: string;
  end: () => Promise<void>;
};

export type VoiceProviderMessage = {
  message: string;
  source: 'ai' | 'user';
};

export type VoiceProviderConfig = {
  agentId: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
};

export interface VoiceAgentProvider {
  connect(config: VoiceProviderConfig, handlers: {
    onConnect: () => void;
    onDisconnect: () => void;
    onMessage: (event: VoiceProviderMessage) => void;
    onError: (error: Error) => void;
    onModeChange?: (mode: string) => void;
  }): Promise<VoiceSessionHandle>;
}
