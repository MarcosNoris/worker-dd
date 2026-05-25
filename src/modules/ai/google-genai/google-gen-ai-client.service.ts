import {
  ApiError,
  type Content,
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';
import { Injectable } from '@nestjs/common';
import { AiProviderRegistry } from '../providers/ai-provider-registry.service';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import { GoogleGenAiProviderRoute } from '../providers/ai-provider.types';
import {
  AiChatMessage,
  AiTextGenerationCommand,
} from '../providers/ai-text-generation.types';

const JSON_CONTENT_TYPE = 'application/json';
const RETRYABLE_STATUS_CODES = new Set([402, 408, 429]);

export interface GoogleGenAiClientAdapter {
  readonly models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<GenerateContentResponse>;
  };
}

@Injectable()
export class GoogleGenAiClientFactory {
  create(apiKey: string): GoogleGenAiClientAdapter {
    return new GoogleGenAI({ apiKey });
  }
}

@Injectable()
export class GoogleGenAiClient {
  constructor(
    private readonly providerRegistry: AiProviderRegistry,
    private readonly clientFactory: GoogleGenAiClientFactory,
  ) {}

  async createTextCompletion(
    route: GoogleGenAiProviderRoute,
    command: AiTextGenerationCommand,
  ): Promise<string> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.providerRegistry.getRequestTimeoutInMs(),
    );
    timeout.unref?.();

    try {
      const response = await this.clientFactory
        .create(route.apiKey)
        .models.generateContent(
          this.createGenerateContentParams(route, command, abortController),
        );

      return this.readResponseText(response);
    } catch (error: unknown) {
      throw this.createRequestError(error, route);
    } finally {
      clearTimeout(timeout);
    }
  }

  private createGenerateContentParams(
    route: GoogleGenAiProviderRoute,
    command: AiTextGenerationCommand,
    abortController: AbortController,
  ): GenerateContentParameters {
    return {
      model: route.model,
      contents: this.createContents(command.messages),
      config: this.createConfig(command, abortController),
    };
  }

  private createConfig(
    command: AiTextGenerationCommand,
    abortController: AbortController,
  ): GenerateContentParameters['config'] {
    return {
      abortSignal: abortController.signal,
      maxOutputTokens: command.maxTokens,
      responseMimeType: JSON_CONTENT_TYPE,
      systemInstruction: this.createSystemInstruction(command.messages),
      temperature: command.temperature,
    };
  }

  private createContents(messages: readonly AiChatMessage[]): Content[] {
    return messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: this.createGoogleRole(message),
        parts: [{ text: message.content }],
      }));
  }

  private createSystemInstruction(
    messages: readonly AiChatMessage[],
  ): Content | undefined {
    const systemPrompt = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter((content) => content.length > 0)
      .join('\n\n');

    return systemPrompt
      ? {
          parts: [{ text: systemPrompt }],
        }
      : undefined;
  }

  private createGoogleRole(message: AiChatMessage): 'model' | 'user' {
    return message.role === 'assistant' ? 'model' : 'user';
  }

  private readResponseText(response: GenerateContentResponse): string {
    const responseText = response.text?.trim();

    if (!responseText) {
      throw AiProviderRequestError.retryable('empty_response');
    }

    return responseText;
  }

  private createRequestError(
    error: unknown,
    route: GoogleGenAiProviderRoute,
  ): AiProviderRequestError {
    if (error instanceof AiProviderRequestError) {
      return error;
    }

    if (this.isAbortError(error)) {
      return AiProviderRequestError.retryable('timeout');
    }

    if (error instanceof ApiError) {
      return this.createApiError(error, route);
    }

    return AiProviderRequestError.retryable('network_error');
  }

  private createApiError(
    error: ApiError,
    route: GoogleGenAiProviderRoute,
  ): AiProviderRequestError {
    const detail = this.sanitizeErrorMessage(error.message, route);

    return this.isRetryableStatus(error.status)
      ? AiProviderRequestError.retryable('http_error', error.status, detail)
      : AiProviderRequestError.nonRetryable('http_error', error.status, detail);
  }

  private sanitizeErrorMessage(
    message: string,
    route: GoogleGenAiProviderRoute,
  ): string {
    return message
      .replaceAll(route.apiKey, '[redacted-api-key]')
      .slice(0, 1000);
  }

  private isRetryableStatus(statusCode: number): boolean {
    return RETRYABLE_STATUS_CODES.has(statusCode) || statusCode >= 500;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }
}
