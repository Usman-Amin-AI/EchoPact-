import { createChatService, type ChatProvider } from './chat-service';

class FakeProvider implements ChatProvider {
  constructor(
    private readonly name: string,
    private readonly response: string,
    private readonly shouldFail = false,
  ) {}

  async generate() {
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }

    return {
      content: this.response,
      provider: this.name,
      model: 'fake-model',
    };
  }
}

describe('chat service', () => {
  it('uses the first working provider when available', async () => {
    const service = createChatService({
      providers: [new FakeProvider('fake', 'hello from provider')],
      fallbackEnabled: true,
    });

    const result = await service.generate({
      messages: [{ role: 'user', content: 'hello' }],
      agentType: 'inbound',
      sessionId: 'session-1',
    });

    expect(result.content).toBe('hello from provider');
    expect(result.provider).toBe('fake');
    expect(result.usedFallback).toBe(false);
  });

  it('falls back to a safe local response when providers fail', async () => {
    const service = createChatService({
      providers: [new FakeProvider('fake', '', true)],
      fallbackEnabled: true,
    });

    const result = await service.generate({
      messages: [{ role: 'user', content: 'hello' }],
      agentType: 'outbound',
      sessionId: 'session-2',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.content).toContain('ECHOPACT');
  });
});
