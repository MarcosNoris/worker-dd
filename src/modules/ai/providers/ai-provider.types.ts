export const AI_PROVIDER_NAMES = [
  'google',
  'nvidia',
  'cerebras',
  'cohere',
  'zai',
] as const;

export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export type AiProviderTransport = 'google-genai' | 'openai-compatible';

interface BaseAiProviderRoute {
  readonly provider: AiProviderName;
  readonly model: string;
  readonly apiKey: string;
  readonly transport: AiProviderTransport;
}

export interface GoogleGenAiProviderRoute extends BaseAiProviderRoute {
  readonly provider: 'google';
  readonly transport: 'google-genai';
}

export interface OpenAiCompatibleProviderRoute extends BaseAiProviderRoute {
  readonly baseUrl: string;
  readonly transport: 'openai-compatible';
}

export type AiProviderRoute =
  | GoogleGenAiProviderRoute
  | OpenAiCompatibleProviderRoute;

export function createAiProviderRouteKey(route: AiProviderRoute): string {
  return isOpenAiCompatibleRoute(route)
    ? `${route.provider}:${route.transport}:${route.baseUrl}:${route.model}`
    : `${route.provider}:${route.transport}:${route.model}`;
}

export function isOpenAiCompatibleRoute(
  route: AiProviderRoute,
): route is OpenAiCompatibleProviderRoute {
  return route.transport === 'openai-compatible';
}
