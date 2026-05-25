import { Injectable } from '@nestjs/common';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GeneratedCaseSolution,
  GenerateCaseSolutionInput,
} from '../types/ai.types';

const MAX_CULPRIT_ID_LENGTH = 160;
const MAX_LONG_TEXT_LENGTH = 5000;
const MIN_SUMMARY_LENGTH = 5;
const MIN_FULL_EXPLANATION_LENGTH = 10;

export interface GeneratedCaseSolutionPayload {
  readonly culpritSuspectId?: unknown;
  readonly fullExplanation?: unknown;
  readonly methodSummary?: unknown;
  readonly motiveSummary?: unknown;
  readonly opportunitySummary?: unknown;
}

@Injectable()
export class GeneratedCaseSolutionNormalizer {
  createSolutionFromPayload(
    payload: GeneratedCaseSolutionPayload,
    input: GenerateCaseSolutionInput,
  ): GeneratedCaseSolution {
    const culpritSuspectId = this.readCulpritSuspectId(
      payload.culpritSuspectId,
      input,
    );

    return {
      culpritSuspectId,
      fullExplanation: this.readText({
        fieldName: 'fullExplanation',
        maxLength: MAX_LONG_TEXT_LENGTH,
        minLength: MIN_FULL_EXPLANATION_LENGTH,
        value: payload.fullExplanation,
      }),
      methodSummary: this.readText({
        fieldName: 'methodSummary',
        maxLength: MAX_LONG_TEXT_LENGTH,
        minLength: MIN_SUMMARY_LENGTH,
        value: payload.methodSummary,
      }),
      motiveSummary: this.readText({
        fieldName: 'motiveSummary',
        maxLength: MAX_LONG_TEXT_LENGTH,
        minLength: MIN_SUMMARY_LENGTH,
        value: payload.motiveSummary,
      }),
      opportunitySummary: this.readText({
        fieldName: 'opportunitySummary',
        maxLength: MAX_LONG_TEXT_LENGTH,
        minLength: MIN_SUMMARY_LENGTH,
        value: payload.opportunitySummary,
      }),
    };
  }

  private readCulpritSuspectId(
    value: unknown,
    input: GenerateCaseSolutionInput,
  ): string {
    const culpritSuspectId = this.readText({
      fieldName: 'culpritSuspectId',
      maxLength: MAX_CULPRIT_ID_LENGTH,
      minLength: MIN_SUMMARY_LENGTH,
      value,
    });

    if (culpritSuspectId !== input.culpritSuspectId) {
      throw this.createInvalidSolutionError(
        `La IA devolvio culpritSuspectId ${culpritSuspectId}, pero se esperaba ${input.culpritSuspectId}.`,
      );
    }

    return culpritSuspectId;
  }

  private readText(command: {
    readonly fieldName: string;
    readonly maxLength: number;
    readonly minLength: number;
    readonly value: unknown;
  }): string {
    if (typeof command.value !== 'string') {
      throw this.createInvalidSolutionError(
        `La IA no devolvio un texto valido para ${command.fieldName}.`,
      );
    }

    const value = command.value.trim();

    if (value.length < command.minLength) {
      throw this.createInvalidSolutionError(
        `La IA devolvio ${command.fieldName} con menos de ${command.minLength} caracteres.`,
      );
    }

    if (value.length > command.maxLength) {
      throw this.createInvalidSolutionError(
        `La IA devolvio ${command.fieldName} con mas de ${command.maxLength} caracteres.`,
      );
    }

    return value;
  }

  private createInvalidSolutionError(detail: string): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_solution',
      undefined,
      detail,
    );
  }
}
