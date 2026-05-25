import { Injectable } from '@nestjs/common';
import { AiProviderRegistry } from '../providers/ai-provider-registry.service';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import { OpenAiCompatibleProviderRoute } from '../providers/ai-provider.types';
import { AiTextGenerationCommand } from '../providers/ai-text-generation.types';

const CHAT_COMPLETIONS_PATH = '/chat/completions';
const JSON_CONTENT_TYPE = 'application/json';
const RETRYABLE_STATUS_CODES = new Set([402, 408, 429]);

interface OpenAiChatCompletionResponse {
  readonly choices?: readonly OpenAiChatChoice[];
}

interface OpenAiChatChoice {
  readonly message?: {
    readonly content?: string | null;
  };
}

@Injectable()
export class OpenAiCompatibleClient {
  constructor(private readonly providerRegistry: AiProviderRegistry) {}

  async createChatCompletion(
    route: OpenAiCompatibleProviderRoute,
    command: AiTextGenerationCommand,
  ): Promise<string> {
    const response = await this.sendRequest(route, command);
    return this.readResponseText(await this.readJsonResponse(response));
  }

  private async sendRequest(
    route: OpenAiCompatibleProviderRoute,
    command: AiTextGenerationCommand,
  ): Promise<Response> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.providerRegistry.getRequestTimeoutInMs(),
    );
    timeout.unref?.();

    try {
      const response = await fetch(this.createEndpoint(route), {
        body: JSON.stringify(this.createRequestBody(route, command)),
        headers: this.createHeaders(route),
        method: 'POST',
        signal: abortController.signal,
      });

      await this.ensureSuccessfulResponse(response, route);
      return response;
    } catch (error: unknown) {
      throw this.createRequestError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private createEndpoint(route: OpenAiCompatibleProviderRoute): string {
    const baseUrl = route.baseUrl.replace(/\/+$/, '');

    return baseUrl.endsWith(CHAT_COMPLETIONS_PATH)
      ? baseUrl
      : `${baseUrl}${CHAT_COMPLETIONS_PATH}`;
  }

  private createRequestBody(
    route: OpenAiCompatibleProviderRoute,
    command: AiTextGenerationCommand,
  ): object {
    return {
      model: route.model,
      messages: command.messages,
      max_tokens: command.maxTokens,
      temperature: command.temperature,
      response_format: {
        type: 'json_object',
      },
    };
  }

  private createHeaders(route: OpenAiCompatibleProviderRoute): HeadersInit {
    return {
      Authorization: `Bearer ${route.apiKey}`,
      'Content-Type': JSON_CONTENT_TYPE,
    };
  }

  private async ensureSuccessfulResponse(
    response: Response,
    route: OpenAiCompatibleProviderRoute,
  ): Promise<void> {
    if (response.ok) {
      return;
    }

    throw this.createHttpError(
      response.status,
      this.sanitizeErrorBody(await this.readErrorBody(response), route),
    );
  }

  private createHttpError(
    statusCode: number,
    detail?: string,
  ): AiProviderRequestError {
    return this.isRetryableStatus(statusCode)
      ? AiProviderRequestError.retryable('http_error', statusCode, detail)
      : AiProviderRequestError.nonRetryable('http_error', statusCode, detail);
  }

  private async readErrorBody(response: Response): Promise<string | undefined> {
    try {
      const responseText = await response.text();

      return responseText.trim().slice(0, 1000) || undefined;
    } catch {
      return undefined;
    }
  }

  private sanitizeErrorBody(
    detail: string | undefined,
    route: OpenAiCompatibleProviderRoute,
  ): string | undefined {
    return detail?.replaceAll(route.apiKey, '[redacted-api-key]');
  }

  private isRetryableStatus(statusCode: number): boolean {
    return RETRYABLE_STATUS_CODES.has(statusCode) || statusCode >= 500;
  }

  private async readJsonResponse(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw AiProviderRequestError.retryable('invalid_response_json');
    }
  }

  private readResponseText(responseBody: unknown): string {
    const completion = responseBody as OpenAiChatCompletionResponse;
    const responseText = completion.choices?.[0]?.message?.content;

    if (!responseText?.trim()) {
      throw AiProviderRequestError.retryable('empty_response');
    }

    return responseText.trim();
  }

  private createRequestError(error: unknown): AiProviderRequestError {
    if (error instanceof AiProviderRequestError) {
      return error;
    }

    return this.isAbortError(error)
      ? AiProviderRequestError.retryable('timeout')
      : AiProviderRequestError.retryable('network_error');
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }
}
