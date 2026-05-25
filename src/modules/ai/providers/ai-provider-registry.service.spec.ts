import { ConfigService } from '@nestjs/config';
import { AiProviderRegistry } from './ai-provider-registry.service';

describe('AiProviderRegistry', () => {
  it('returns routes by default provider order when no order is configured', () => {
    const registry = createRegistry({
      CEREBRAS_AI_BASE_URL: 'https://api.cerebras.ai/v1',
      CEREBRAS_AI_MODELS: 'llama3.1-8b',
      CEREBRAS_API_KEY: 'cerebras-key',
      COHERE_AI_BASE_URL: 'https://api.cohere.ai/compatibility/v1',
      COHERE_AI_MODELS: 'command-a',
      COHERE_API_KEY: 'cohere-key',
      GOOGLE_GENAI_API_KEY: 'google-key',
      GOOGLE_GENAI_MODELS: 'gemini-2.5-flash',
      NVIDIA_AI_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_AI_MODELS: 'nvidia-model',
      NVIDIA_API_KEY: 'nvidia-key',
      ZAI_AI_BASE_URL: 'https://api.z.ai/api/paas/v4',
      ZAI_AI_MODELS: 'glm-5.1',
      ZAI_API_KEY: 'zai-key',
    });

    expect(registry.getProviderRoutes()).toEqual([
      {
        provider: 'google',
        model: 'gemini-2.5-flash',
        apiKey: 'google-key',
        transport: 'google-genai',
      },
      {
        provider: 'nvidia',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'nvidia-model',
        apiKey: 'nvidia-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'cerebras',
        baseUrl: 'https://api.cerebras.ai/v1',
        model: 'llama3.1-8b',
        apiKey: 'cerebras-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'cohere',
        baseUrl: 'https://api.cohere.ai/compatibility/v1',
        model: 'command-a',
        apiKey: 'cohere-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'zai',
        baseUrl: 'https://api.z.ai/api/paas/v4',
        model: 'glm-5.1',
        apiKey: 'zai-key',
        transport: 'openai-compatible',
      },
    ]);
  });

  it('returns routes by configured provider and model order', () => {
    const registry = createRegistry({
      AI_PROVIDER_ORDER: 'google,cerebras,cohere,zai,nvidia',
      CEREBRAS_AI_BASE_URL: 'https://api.cerebras.ai/v1',
      CEREBRAS_AI_MODELS: 'llama3.1-8b',
      CEREBRAS_API_KEY: 'cerebras-key',
      COHERE_AI_BASE_URL: 'https://api.cohere.ai/compatibility/v1',
      COHERE_AI_MODELS: 'command-a,command-r',
      COHERE_API_KEY: 'cohere-key',
      GOOGLE_GENAI_API_KEY: 'google-key',
      GOOGLE_GENAI_MODELS: 'gemini-2.5-flash,gemini-2.5-pro',
      NVIDIA_AI_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_AI_MODELS: 'nvidia-model',
      NVIDIA_API_KEY: 'nvidia-key',
      ZAI_AI_BASE_URL: 'https://api.z.ai/api/paas/v4',
      ZAI_AI_MODELS: 'glm-5.1,glm-4.6',
      ZAI_API_KEY: 'zai-key',
    });

    expect(registry.getProviderRoutes()).toEqual([
      {
        provider: 'google',
        model: 'gemini-2.5-flash',
        apiKey: 'google-key',
        transport: 'google-genai',
      },
      {
        provider: 'google',
        model: 'gemini-2.5-pro',
        apiKey: 'google-key',
        transport: 'google-genai',
      },
      {
        provider: 'cerebras',
        baseUrl: 'https://api.cerebras.ai/v1',
        model: 'llama3.1-8b',
        apiKey: 'cerebras-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'cohere',
        baseUrl: 'https://api.cohere.ai/compatibility/v1',
        model: 'command-a',
        apiKey: 'cohere-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'cohere',
        baseUrl: 'https://api.cohere.ai/compatibility/v1',
        model: 'command-r',
        apiKey: 'cohere-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'zai',
        baseUrl: 'https://api.z.ai/api/paas/v4',
        model: 'glm-5.1',
        apiKey: 'zai-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'zai',
        baseUrl: 'https://api.z.ai/api/paas/v4',
        model: 'glm-4.6',
        apiKey: 'zai-key',
        transport: 'openai-compatible',
      },
      {
        provider: 'nvidia',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'nvidia-model',
        apiKey: 'nvidia-key',
        transport: 'openai-compatible',
      },
    ]);
  });

  it('does not register a provider route when the API key is missing', () => {
    const registry = createRegistry({
      AI_PROVIDER_ORDER: 'nvidia,cerebras,cohere,zai',
      CEREBRAS_AI_BASE_URL: 'https://api.cerebras.ai/v1',
      CEREBRAS_AI_MODELS: 'llama3.1-8b',
      CEREBRAS_API_KEY: '',
      COHERE_AI_BASE_URL: 'https://api.cohere.ai/compatibility/v1',
      COHERE_AI_MODELS: 'command-a',
      COHERE_API_KEY: 'cohere-key',
      GOOGLE_GENAI_API_KEY: '',
      GOOGLE_GENAI_MODELS: 'gemini-2.5-flash',
      NVIDIA_AI_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_AI_MODELS: 'nvidia-model',
      NVIDIA_API_KEY: '',
      ZAI_AI_BASE_URL: 'https://api.z.ai/api/paas/v4',
      ZAI_AI_MODELS: 'glm-5.1',
      ZAI_API_KEY: '',
    });

    expect(registry.getProviderRoutes()).toEqual([
      {
        provider: 'cohere',
        baseUrl: 'https://api.cohere.ai/compatibility/v1',
        model: 'command-a',
        apiKey: 'cohere-key',
        transport: 'openai-compatible',
      },
    ]);
  });

  it('does not register a Google route when API key or models are missing', () => {
    const registry = createRegistry({
      AI_PROVIDER_ORDER: 'google',
      GOOGLE_GENAI_API_KEY: 'google-key',
      GOOGLE_GENAI_MODELS: '',
    });

    expect(registry.getProviderRoutes()).toEqual([]);
  });

  it('does not register a Z.ai route when base URL or models are missing', () => {
    const registry = createRegistry({
      AI_PROVIDER_ORDER: 'zai',
      ZAI_AI_BASE_URL: '',
      ZAI_AI_MODELS: '',
      ZAI_API_KEY: 'zai-key',
    });

    expect(registry.getProviderRoutes()).toEqual([]);
  });

  function createRegistry(
    config: Record<string, string | undefined>,
  ): AiProviderRegistry {
    return new AiProviderRegistry({
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService);
  }
});
