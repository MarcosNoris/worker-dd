export type AiProviderFailureReason =
  | 'empty_response'
  | 'http_error'
  | 'invalid_generated_admin_case_base'
  | 'invalid_generated_contradictions'
  | 'invalid_generated_investigation_graph'
  | 'invalid_generated_requirements'
  | 'invalid_generated_solution'
  | 'invalid_generated_statements'
  | 'invalid_generated_suspects'
  | 'invalid_profile'
  | 'invalid_json'
  | 'invalid_response_json'
  | 'network_error'
  | 'no_available_provider'
  | 'timeout';

export class AiProviderRequestError extends Error {
  private constructor(
    readonly reason: AiProviderFailureReason,
    readonly retryable: boolean,
    readonly statusCode?: number,
    readonly detail?: string,
  ) {
    super(AiProviderRequestError.createMessage(reason, statusCode, detail));
  }

  static retryable(
    reason: AiProviderFailureReason,
    statusCode?: number,
    detail?: string,
  ): AiProviderRequestError {
    return new AiProviderRequestError(reason, true, statusCode, detail);
  }

  static nonRetryable(
    reason: AiProviderFailureReason,
    statusCode?: number,
    detail?: string,
  ): AiProviderRequestError {
    return new AiProviderRequestError(reason, false, statusCode, detail);
  }

  private static createMessage(
    reason: AiProviderFailureReason,
    statusCode?: number,
    detail?: string,
  ): string {
    const baseMessage = statusCode
      ? `AI provider failed with ${reason} (${statusCode})`
      : `AI provider failed with ${reason}`;

    return detail ? `${baseMessage}: ${detail}` : baseMessage;
  }
}
