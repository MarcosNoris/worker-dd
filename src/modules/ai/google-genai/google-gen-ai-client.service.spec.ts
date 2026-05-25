import { ApiError, type GenerateContentResponse } from '@google/genai';
import { AiProviderRegistry } from '../providers/ai-provider-registry.service';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import { GoogleGenAiProviderRoute } from '../providers/ai-provider.types';
import {
  GoogleGenAiClient,
  GoogleGenAiClientFactory,
} from './google-gen-ai-client.service';

describe('GoogleGenAiClient', () => {
  const route: GoogleGenAiProviderRoute = {
    provider: 'google',
    model: 'gemini-2.5-flash',
    apiKey: 'secret-google-key',
    transport: 'google-genai',
  };

  it('sends a Google GenAI JSON generation request', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      createResponse({
        text: ' {"title":"Caso Google"} ',
      }),
    );
    const factory = createFactory(generateContent);
    const client = createClient(factory);

    await expect(
      client.createTextCompletion(route, {
        messages: [
          { role: 'system', content: 'Sistema narrativo' },
          { role: 'user', content: 'Genera JSON' },
          { role: 'assistant', content: '{"draft":true}' },
        ],
        maxTokens: 128,
        temperature: 0.7,
      }),
    ).resolves.toBe('{"title":"Caso Google"}');

    expect(factory.create).toHaveBeenCalledWith('secret-google-key');
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Genera JSON' }],
        },
        {
          role: 'model',
          parts: [{ text: '{"draft":true}' }],
        },
      ],
      config: expect.objectContaining({
        abortSignal: expect.any(AbortSignal),
        maxOutputTokens: 128,
        responseMimeType: 'application/json',
        systemInstruction: {
          parts: [{ text: 'Sistema narrativo' }],
        },
        temperature: 0.7,
      }),
    });
  });

  it('throws a retryable error when the response is empty', async () => {
    const client = createClient(createFactory(jest.fn().mockResolvedValue({})));

    await expect(
      client.createTextCompletion(route, createCommand()),
    ).rejects.toMatchObject({
      reason: 'empty_response',
      retryable: true,
    });
  });

  it('converts abort errors into retryable timeout errors', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    const client = createClient(
      createFactory(jest.fn().mockRejectedValue(abortError)),
    );

    await expect(
      client.createTextCompletion(route, createCommand()),
    ).rejects.toMatchObject({
      reason: 'timeout',
      retryable: true,
    });
  });

  it('converts retryable API errors into provider request errors', async () => {
    const client = createClient(
      createFactory(
        jest.fn().mockRejectedValue(
          new ApiError({
            message: 'secret-google-key rate limit',
            status: 429,
          }),
        ),
      ),
    );

    await client
      .createTextCompletion(route, createCommand())
      .catch((error: AiProviderRequestError) => {
        expect(error.reason).toBe('http_error');
        expect(error.retryable).toBe(true);
        expect(error.statusCode).toBe(429);
        expect(error.message).not.toContain('secret-google-key');
      });
  });

  it('converts non-retryable API errors into provider request errors', async () => {
    const client = createClient(
      createFactory(
        jest.fn().mockRejectedValue(
          new ApiError({
            message: 'bad request',
            status: 400,
          }),
        ),
      ),
    );

    await expect(
      client.createTextCompletion(route, createCommand()),
    ).rejects.toMatchObject({
      reason: 'http_error',
      retryable: false,
      statusCode: 400,
    });
  });

  function createClient(
    factory: jest.Mocked<GoogleGenAiClientFactory>,
  ): GoogleGenAiClient {
    return new GoogleGenAiClient(
      {
        getRequestTimeoutInMs: jest.fn().mockReturnValue(30000),
      } as unknown as AiProviderRegistry,
      factory,
    );
  }

  function createFactory(
    generateContent: jest.Mock,
  ): jest.Mocked<GoogleGenAiClientFactory> {
    return {
      create: jest.fn().mockReturnValue({
        models: {
          generateContent,
        },
      }),
    } as unknown as jest.Mocked<GoogleGenAiClientFactory>;
  }

  function createCommand() {
    return {
      messages: [{ role: 'user' as const, content: 'Genera JSON' }],
      maxTokens: 128,
      temperature: 0.7,
    };
  }

  function createResponse(
    response: Partial<GenerateContentResponse>,
  ): GenerateContentResponse {
    return response as GenerateContentResponse;
  }
});
