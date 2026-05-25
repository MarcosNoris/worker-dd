import { AiProviderRegistry } from '../providers/ai-provider-registry.service';
import { OpenAiCompatibleProviderRoute } from '../providers/ai-provider.types';
import { OpenAiCompatibleClient } from './open-ai-compatible-client.service';

describe('OpenAiCompatibleClient', () => {
  const originalFetch = global.fetch;
  const route: OpenAiCompatibleProviderRoute = {
    provider: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia-model',
    apiKey: 'secret-api-key',
    transport: 'openai-compatible',
  };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends an OpenAI-compatible chat completion request', async () => {
    const fetchMock = mockFetch(
      createResponse(200, {
        choices: [{ message: { content: '{"title":"Caso externo"}' } }],
      }),
    );
    const client = createClient();

    await expect(
      client.createChatCompletion(route, {
        messages: [{ role: 'user', content: 'Genera JSON' }],
        maxTokens: 128,
        temperature: 0.7,
      }),
    ).resolves.toBe('{"title":"Caso externo"}');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret-api-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(readRequestBody(fetchMock)).toEqual({
      model: 'nvidia-model',
      messages: [{ role: 'user', content: 'Genera JSON' }],
      max_tokens: 128,
      temperature: 0.7,
      response_format: {
        type: 'json_object',
      },
    });
  });

  it('does not expose API keys in provider errors', async () => {
    mockFetch(createResponse(429, { error: 'secret-api-key should not leak' }));
    const client = createClient();

    await expect(
      client.createChatCompletion(route, {
        messages: [{ role: 'user', content: 'Genera JSON' }],
        maxTokens: 128,
        temperature: 0.7,
      }),
    ).rejects.toThrow('AI provider failed with http_error (429)');

    await client
      .createChatCompletion(route, {
        messages: [{ role: 'user', content: 'Genera JSON' }],
        maxTokens: 128,
        temperature: 0.7,
      })
      .catch((error: Error) => {
        expect(error.message).not.toContain('secret-api-key');
      });
  });

  function createClient(): OpenAiCompatibleClient {
    return new OpenAiCompatibleClient({
      getRequestTimeoutInMs: jest.fn().mockReturnValue(30000),
    } as unknown as AiProviderRegistry);
  }

  function createResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    } as unknown as Response;
  }

  function mockFetch(response: Response): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue(response);
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  function readRequestBody(fetchMock: jest.Mock): object {
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    return JSON.parse(requestInit.body as string) as object;
  }
});
