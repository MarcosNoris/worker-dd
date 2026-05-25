import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_PROVIDER_NAMES,
  AiProviderName,
  AiProviderRoute,
} from './ai-provider.types';

const DEFAULT_PROVIDER_ORDER: readonly AiProviderName[] = [
  'google',
  'nvidia',
  'cerebras',
  'cohere',
  'zai',
];
const DEFAULT_COOLDOWN_SECONDS = 300;
const DEFAULT_TIMEOUT_IN_MS = 30000;
const LIST_SEPARATOR = ',';
const MILLISECONDS_PER_SECOND = 1000;

interface OpenAiCompatibleProviderConfigKeys {
  readonly transport: 'openai-compatible';
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly models: string;
}

interface GoogleGenAiProviderConfigKeys {
  readonly transport: 'google-genai';
  readonly apiKey: string;
  readonly models: string;
}

type AiProviderConfigKeys =
  | GoogleGenAiProviderConfigKeys
  | OpenAiCompatibleProviderConfigKeys;

const CONFIG_KEYS_BY_PROVIDER: Record<AiProviderName, AiProviderConfigKeys> = {
  google: {
    transport: 'google-genai',
    apiKey: 'GOOGLE_GENAI_API_KEY',
    models: 'GOOGLE_GENAI_MODELS',
  },
  nvidia: {
    transport: 'openai-compatible',
    apiKey: 'NVIDIA_API_KEY',
    baseUrl: 'NVIDIA_AI_BASE_URL',
    models: 'NVIDIA_AI_MODELS',
  },
  cerebras: {
    transport: 'openai-compatible',
    apiKey: 'CEREBRAS_API_KEY',
    baseUrl: 'CEREBRAS_AI_BASE_URL',
    models: 'CEREBRAS_AI_MODELS',
  },
  cohere: {
    transport: 'openai-compatible',
    apiKey: 'COHERE_API_KEY',
    baseUrl: 'COHERE_AI_BASE_URL',
    models: 'COHERE_AI_MODELS',
  },
  zai: {
    transport: 'openai-compatible',
    apiKey: 'ZAI_API_KEY',
    baseUrl: 'ZAI_AI_BASE_URL',
    models: 'ZAI_AI_MODELS',
  },
};

type AiProviderConfig =
  | {
      readonly apiKey: string;
      readonly models: readonly string[];
      readonly transport: 'google-genai';
    }
  | {
      readonly apiKey: string;
      readonly baseUrl: string;
      readonly models: readonly string[];
      readonly transport: 'openai-compatible';
    };

@Injectable()
export class AiProviderRegistry {
  constructor(private readonly configService: ConfigService) {}

  getProviderRoutes(): AiProviderRoute[] {
    return this.getProviderOrder().flatMap((provider) =>
      this.createRoutesForProvider(provider),
    );
  }

  getCooldownDurationInMs(): number {
    return (
      this.readPositiveInteger(
        'AI_PROVIDER_COOLDOWN_SECONDS',
        DEFAULT_COOLDOWN_SECONDS,
      ) * MILLISECONDS_PER_SECOND
    );
  }

  getRequestTimeoutInMs(): number {
    return this.readPositiveInteger(
      'AI_PROVIDER_TIMEOUT_MS',
      DEFAULT_TIMEOUT_IN_MS,
    );
  }

  private getProviderOrder(): AiProviderName[] {
    const configuredProviders = this.readList('AI_PROVIDER_ORDER')
      .map((provider) => provider.toLowerCase())
      .filter(this.isSupportedProvider);

    return configuredProviders.length > 0
      ? this.removeDuplicatedProviders(configuredProviders)
      : [...DEFAULT_PROVIDER_ORDER];
  }

  private createRoutesForProvider(provider: AiProviderName): AiProviderRoute[] {
    const config = this.readProviderConfig(provider);

    if (!config) {
      return [];
    }

    return config.models.map((model) =>
      this.createRoute(provider, config, model),
    );
  }

  private readProviderConfig(
    provider: AiProviderName,
  ): AiProviderConfig | undefined {
    const keys = CONFIG_KEYS_BY_PROVIDER[provider];
    const apiKey = this.readOptionalConfig(keys.apiKey);
    const models = this.readList(keys.models);

    if (!apiKey || models.length === 0) {
      return undefined;
    }

    if (keys.transport === 'google-genai') {
      return { apiKey, models, transport: keys.transport };
    }

    const baseUrl = this.readOptionalConfig(keys.baseUrl);

    return baseUrl
      ? { apiKey, baseUrl, models, transport: keys.transport }
      : undefined;
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.readOptionalConfig(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private readOptionalConfig(key: string): string {
    return this.configService.get<string>(key)?.trim() ?? '';
  }

  private readList(key: string): string[] {
    return this.readOptionalConfig(key)
      .split(LIST_SEPARATOR)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private removeDuplicatedProviders(
    providers: readonly AiProviderName[],
  ): AiProviderName[] {
    return [...new Set(providers)];
  }

  private isSupportedProvider(value: string): value is AiProviderName {
    return AI_PROVIDER_NAMES.includes(value as AiProviderName);
  }

  private createRoute(
    provider: AiProviderName,
    config: AiProviderConfig,
    model: string,
  ): AiProviderRoute {
    if (config.transport === 'google-genai') {
      return {
        provider: 'google',
        model,
        apiKey: config.apiKey,
        transport: 'google-genai',
      };
    }

    return {
      provider,
      baseUrl: config.baseUrl,
      model,
      apiKey: config.apiKey,
      transport: 'openai-compatible',
    };
  }
}
