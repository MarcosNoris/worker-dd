import { Injectable } from '@nestjs/common';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GeneratedCaseSuspect,
  GeneratedCaseSuspectsContent,
  GenerateCaseSuspectsInput,
} from '../types/ai.types';

const MAX_NAME_LENGTH = 300;
const MAX_SHORT_TEXT_LENGTH = 300;
const MAX_MEDIUM_TEXT_LENGTH = 1000;
const MIN_AGE = 1;
const MAX_AGE = 130;

export interface GeneratedCaseSuspectsPayload {
  readonly suspects?: unknown;
}

interface SuspectPayload {
  readonly age?: unknown;
  readonly background?: unknown;
  readonly name?: unknown;
  readonly occupation?: unknown;
  readonly personality?: unknown;
  readonly publicNotes?: unknown;
  readonly relationshipToVictim?: unknown;
}

@Injectable()
export class GeneratedCaseSuspectNormalizer {
  createContentFromPayload(
    payload: GeneratedCaseSuspectsPayload,
    input: GenerateCaseSuspectsInput,
  ): GeneratedCaseSuspectsContent {
    const suspects = this.readPayloadSuspects(payload.suspects, input);

    return {
      suspects: this.createSuspects(suspects),
    };
  }

  private createSuspects(
    payloadSuspects: readonly SuspectPayload[],
  ): readonly GeneratedCaseSuspect[] {
    const normalizedNames = new Set<string>();

    return payloadSuspects.map((payload, suspectIndex) =>
      this.createSuspect(payload, suspectIndex, normalizedNames),
    );
  }

  private createSuspect(
    payload: SuspectPayload,
    suspectIndex: number,
    normalizedNames: Set<string>,
  ): GeneratedCaseSuspect {
    const name = this.readRequiredText(
      payload.name,
      `name del sospechoso ${suspectIndex + 1}`,
      MAX_NAME_LENGTH,
    );

    this.ensureUniqueName(name, normalizedNames);

    return {
      age: this.readOptionalAge(payload.age, suspectIndex),
      background: this.readOptionalText(
        payload.background,
        MAX_MEDIUM_TEXT_LENGTH,
      ),
      name,
      occupation: this.readOptionalText(
        payload.occupation,
        MAX_SHORT_TEXT_LENGTH,
      ),
      personality: this.readOptionalText(
        payload.personality,
        MAX_MEDIUM_TEXT_LENGTH,
      ),
      publicNotes: this.readOptionalText(
        payload.publicNotes,
        MAX_MEDIUM_TEXT_LENGTH,
      ),
      relationshipToVictim: this.readOptionalText(
        payload.relationshipToVictim,
        MAX_SHORT_TEXT_LENGTH,
      ),
    };
  }

  private readPayloadSuspects(
    value: unknown,
    input: GenerateCaseSuspectsInput,
  ): readonly SuspectPayload[] {
    if (!Array.isArray(value)) {
      throw this.createInvalidSuspectsError(
        'La respuesta no incluye un arreglo suspects.',
      );
    }

    if (value.length !== input.suspectCount) {
      throw this.createInvalidSuspectsError(
        `La IA devolvio ${value.length} sospechosos; se esperaban ${input.suspectCount}.`,
      );
    }

    return value.map((suspect, suspectIndex) =>
      this.readPayload(suspect, suspectIndex),
    );
  }

  private readPayload(value: unknown, suspectIndex: number): SuspectPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw this.createInvalidSuspectsError(
        `El sospechoso ${suspectIndex + 1} no es un objeto JSON valido.`,
      );
    }

    return value as SuspectPayload;
  }

  private readRequiredText(
    value: unknown,
    fieldName: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.createInvalidSuspectsError(
        `La IA no devolvio un valor valido para ${fieldName}.`,
      );
    }

    return value.trim().slice(0, maxLength);
  }

  private readOptionalText(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const text = value.trim();

    return text ? text.slice(0, maxLength) : undefined;
  }

  private readOptionalAge(
    value: unknown,
    suspectIndex: number,
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_AGE &&
      value <= MAX_AGE
    ) {
      return value;
    }

    throw this.createInvalidSuspectsError(
      `La IA devolvio una edad invalida para el sospechoso ${suspectIndex + 1}.`,
    );
  }

  private ensureUniqueName(
    name: string,
    normalizedNames: Set<string>,
  ): void {
    const normalizedName = name.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedNames.has(normalizedName)) {
      throw this.createInvalidSuspectsError(
        `La IA devolvio un nombre de sospechoso duplicado: ${name}.`,
      );
    }

    normalizedNames.add(normalizedName);
  }

  private createInvalidSuspectsError(detail: string): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_suspects',
      undefined,
      detail,
    );
  }
}
