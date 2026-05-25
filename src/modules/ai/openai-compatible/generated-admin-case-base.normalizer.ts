import { Injectable } from '@nestjs/common';
import { ADMIN_CASE_DIFFICULTIES } from '../../cases/constants/admin-case.constants';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GeneratedAdminCaseBase,
  GenerateAdminCaseBaseInput,
} from '../types/ai.types';

const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 2000;
const MAX_LONG_TEXT_LENGTH = 5000;
const MAX_SHORT_TEXT_LENGTH = 300;
const MIN_TITLE_LENGTH = 3;
const MIN_SUMMARY_LENGTH = 10;
const MIN_OPTIONAL_TEXT_LENGTH = 1;

export interface GeneratedAdminCaseBasePayload {
  readonly difficulty?: unknown;
  readonly publicBriefing?: unknown;
  readonly summary?: unknown;
  readonly title?: unknown;
  readonly victimName?: unknown;
}

@Injectable()
export class GeneratedAdminCaseBaseNormalizer {
  createCaseBaseFromPayload(
    payload: GeneratedAdminCaseBasePayload,
    input: GenerateAdminCaseBaseInput,
  ): GeneratedAdminCaseBase {
    const difficulty = this.readDifficulty(payload.difficulty, input);

    return {
      difficulty,
      publicBriefing: this.readOptionalText({
        fieldName: 'publicBriefing',
        maxLength: MAX_LONG_TEXT_LENGTH,
        value: payload.publicBriefing,
      }),
      summary: this.readText({
        fieldName: 'summary',
        maxLength: MAX_SUMMARY_LENGTH,
        minLength: MIN_SUMMARY_LENGTH,
        value: payload.summary,
      }),
      title: this.readText({
        fieldName: 'title',
        maxLength: MAX_TITLE_LENGTH,
        minLength: MIN_TITLE_LENGTH,
        value: payload.title,
      }),
      victimName: this.readOptionalText({
        fieldName: 'victimName',
        maxLength: MAX_SHORT_TEXT_LENGTH,
        value: payload.victimName,
      }),
    };
  }

  private readDifficulty(
    value: unknown,
    input: GenerateAdminCaseBaseInput,
  ): GeneratedAdminCaseBase['difficulty'] {
    if (
      typeof value !== 'string' ||
      !ADMIN_CASE_DIFFICULTIES.includes(
        value as GeneratedAdminCaseBase['difficulty'],
      )
    ) {
      throw this.createInvalidCaseBaseError(
        'La IA no devolvio una dificultad valida.',
      );
    }

    if (value !== input.difficulty) {
      throw this.createInvalidCaseBaseError(
        `La IA devolvio dificultad ${value}, pero se esperaba ${input.difficulty}.`,
      );
    }

    return value;
  }

  private readText(command: {
    readonly fieldName: string;
    readonly maxLength: number;
    readonly minLength: number;
    readonly value: unknown;
  }): string {
    if (typeof command.value !== 'string') {
      throw this.createInvalidCaseBaseError(
        `La IA no devolvio un texto valido para ${command.fieldName}.`,
      );
    }

    const value = command.value.trim();

    if (value.length < command.minLength) {
      throw this.createInvalidCaseBaseError(
        `La IA devolvio ${command.fieldName} con menos de ${command.minLength} caracteres.`,
      );
    }

    if (value.length > command.maxLength) {
      throw this.createInvalidCaseBaseError(
        `La IA devolvio ${command.fieldName} con mas de ${command.maxLength} caracteres.`,
      );
    }

    return value;
  }

  private readOptionalText(command: {
    readonly fieldName: string;
    readonly maxLength: number;
    readonly value: unknown;
  }): string | undefined {
    if (command.value === null || command.value === undefined) {
      return undefined;
    }

    return this.readText({
      ...command,
      minLength: MIN_OPTIONAL_TEXT_LENGTH,
    });
  }

  private createInvalidCaseBaseError(detail: string): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_admin_case_base',
      undefined,
      detail,
    );
  }
}
