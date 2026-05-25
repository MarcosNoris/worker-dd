import { AiProviderRequestError } from '../providers/ai-provider-request.error';

const JSON_CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export function parseJsonObject<TResponse extends object>(
  rawText: string,
): TResponse {
  const parsedValue = parseJsonValue(rawText);

  if (isJsonObject(parsedValue)) {
    return parsedValue as TResponse;
  }

  throw AiProviderRequestError.retryable('invalid_json');
}

export function parseJsonObjectWithRootArrayFallback<TResponse extends object>(
  rawText: string,
  rootArrayProperty: keyof TResponse & string,
): TResponse {
  const parsedValue = parseJsonValue(rawText);

  if (isJsonObject(parsedValue)) {
    return parsedValue as TResponse;
  }

  if (Array.isArray(parsedValue)) {
    return { [rootArrayProperty]: parsedValue } as TResponse;
  }

  throw AiProviderRequestError.retryable('invalid_json');
}

function parseJsonValue(rawText: string): unknown {
  const jsonText = extractJsonText(rawText);

  try {
    return JSON.parse(jsonText);
  } catch {
    return parseEscapedJsonValue(jsonText);
  }
}

function parseEscapedJsonValue(jsonText: string): unknown {
  try {
    return JSON.parse(decodeEscapedJsonText(jsonText));
  } catch {
    throw AiProviderRequestError.retryable('invalid_json');
  }
}

function decodeEscapedJsonText(jsonText: string): string {
  return jsonText
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"');
}

function extractJsonText(rawText: string): string {
  const trimmedText = rawText.trim();
  const fencedJson = trimmedText.match(JSON_CODE_FENCE_PATTERN)?.[1];
  const candidate = fencedJson ?? trimmedText;
  const jsonStart = findJsonStart(candidate);

  if (jsonStart < 0) {
    return candidate;
  }

  const jsonEnd = findJsonEnd(candidate, jsonStart);

  return jsonEnd < 0 ? candidate : candidate.slice(jsonStart, jsonEnd + 1);
}

function findJsonStart(text: string): number {
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');

  if (objectStart < 0) {
    return arrayStart;
  }

  if (arrayStart < 0) {
    return objectStart;
  }

  return Math.min(objectStart, arrayStart);
}

function findJsonEnd(text: string, jsonStart: number): number {
  const jsonStartCharacter = text[jsonStart];

  return jsonStartCharacter === '['
    ? text.lastIndexOf(']')
    : text.lastIndexOf('}');
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
