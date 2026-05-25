import { Injectable } from '@nestjs/common';
import {
  ADMIN_EVIDENCE_IMPORTANCES,
  ADMIN_EVIDENCE_TYPES,
} from '../../cases/constants/admin-case.constants';
import {
  readArray,
  readBoolean,
  readEnumValue,
  readNumber,
  readString,
} from '../../../shared/utils/value.util';
import {
  GenerateCaseEvidencesInput,
  GeneratedCaseEvidence,
  GeneratedCaseEvidencesContent,
  GeneratedCaseSolution,
} from '../types/ai.types';

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 300;
const MAX_HINT_LENGTH = 1000;

export interface GeneratedCaseEvidencesPayload {
  readonly evidences?: unknown;
  readonly selectedCulpritSuspectId?: unknown;
  readonly solution?: unknown;
}

@Injectable()
export class GeneratedCaseEvidenceNormalizer {
  createContentFromPayload(
    payload: GeneratedCaseEvidencesPayload,
    input: GenerateCaseEvidencesInput,
    fallback: GeneratedCaseEvidencesContent,
  ): GeneratedCaseEvidencesContent {
    const selectedCulpritSuspectId = this.selectCulpritSuspectId(
      payload.selectedCulpritSuspectId,
      input,
      fallback,
    );

    return {
      evidences: this.createEvidences(payload.evidences, {
        fallback,
        input,
        selectedCulpritSuspectId,
      }),
      selectedCulpritSuspectId,
      solution: this.createOptionalSolution(payload.solution, {
        fallback,
        input,
        selectedCulpritSuspectId,
      }),
    };
  }

  private createEvidences(
    value: unknown,
    context: NormalizationContext,
  ): readonly GeneratedCaseEvidence[] {
    const evidences = readArray(value)
      .slice(0, context.input.evidenceCount)
      .map((evidence, evidenceIndex) =>
        this.createEvidence(evidence, evidenceIndex, context),
      );

    return this.withFallbackEvidences(evidences, context);
  }

  private createEvidence(
    value: unknown,
    evidenceIndex: number,
    context: NormalizationContext,
  ): GeneratedCaseEvidence {
    const payload = this.readPayload(value);
    const fallback = this.getFallbackEvidence(evidenceIndex, context);
    const importance = readEnumValue(
      payload.importance,
      ADMIN_EVIDENCE_IMPORTANCES,
      fallback.importance,
    );

    return {
      description: this.readText(
        payload.description,
        fallback.description,
        MAX_DESCRIPTION_LENGTH,
      ),
      discoveryHint: this.readOptionalText(
        payload.discoveryHint,
        fallback.discoveryHint,
        MAX_HINT_LENGTH,
      ),
      importance,
      isDecoy:
        importance === 'misleading' ||
        readBoolean(payload.isDecoy, fallback.isDecoy),
      isInitiallyVisible: readBoolean(
        payload.isInitiallyVisible,
        fallback.isInitiallyVisible,
      ),
      location: this.readOptionalText(
        payload.location,
        fallback.location,
        MAX_LOCATION_LENGTH,
      ),
      metadata: this.createMetadata(payload.metadata, fallback.metadata),
      title: this.readText(payload.title, fallback.title, MAX_TITLE_LENGTH),
      type: readEnumValue(payload.type, ADMIN_EVIDENCE_TYPES, fallback.type),
      weight: this.readWeight(payload.weight, fallback.weight),
    };
  }

  private createOptionalSolution(
    value: unknown,
    context: NormalizationContext,
  ): GeneratedCaseSolution | undefined {
    if (!context.input.generateSolution) {
      return undefined;
    }

    const payload = this.readPayload(value);
    const fallback = context.fallback.solution;

    return {
      culpritSuspectId: context.selectedCulpritSuspectId,
      fullExplanation: this.readText(
        payload.fullExplanation,
        fallback?.fullExplanation ??
          'La solucion conecta evidencia, motivo y oportunidad.',
        MAX_DESCRIPTION_LENGTH,
      ),
      methodSummary: this.readText(
        payload.methodSummary,
        fallback?.methodSummary ??
          'El metodo se deduce desde las evidencias criticas.',
        MAX_DESCRIPTION_LENGTH,
      ),
      motiveSummary: this.readText(
        payload.motiveSummary,
        fallback?.motiveSummary ??
          'El motivo se sostiene por el contexto del caso.',
        MAX_DESCRIPTION_LENGTH,
      ),
      opportunitySummary: this.readText(
        payload.opportunitySummary,
        fallback?.opportunitySummary ??
          'La oportunidad surge de acceso y ventana temporal.',
        MAX_DESCRIPTION_LENGTH,
      ),
    };
  }

  private selectCulpritSuspectId(
    value: unknown,
    input: GenerateCaseEvidencesInput,
    fallback: GeneratedCaseEvidencesContent,
  ): string {
    if (this.isKnownSuspect(input, input.culpritSuspectId)) {
      return input.culpritSuspectId;
    }

    const generatedSuspectId = readString(value, '');

    if (this.isKnownSuspect(input, generatedSuspectId)) {
      return generatedSuspectId;
    }

    if (this.isKnownSuspect(input, fallback.selectedCulpritSuspectId)) {
      return fallback.selectedCulpritSuspectId;
    }

    return this.findOldestSuspectId(input);
  }

  private withFallbackEvidences(
    evidences: readonly GeneratedCaseEvidence[],
    context: NormalizationContext,
  ): readonly GeneratedCaseEvidence[] {
    const completedEvidences = [...evidences];

    while (completedEvidences.length < context.input.evidenceCount) {
      completedEvidences.push(
        this.getFallbackEvidence(completedEvidences.length, context),
      );
    }

    return completedEvidences.slice(0, context.input.evidenceCount);
  }

  private getFallbackEvidence(
    evidenceIndex: number,
    context: NormalizationContext,
  ): GeneratedCaseEvidence {
    return (
      context.fallback.evidences[evidenceIndex] ??
      this.createGenericFallbackEvidence(evidenceIndex, context)
    );
  }

  private createGenericFallbackEvidence(
    evidenceIndex: number,
    context: NormalizationContext,
  ): GeneratedCaseEvidence {
    return {
      description:
        'Registro generado para sostener una linea de investigacion del caso.',
      importance: evidenceIndex === 0 ? 'critical' : 'supporting',
      isDecoy: false,
      isInitiallyVisible: evidenceIndex === 0,
      metadata: {
        narrativePurpose: 'Completar la estructura minima de evidencias.',
        relatedSuspectIds: [context.selectedCulpritSuspectId],
      },
      title: `Evidencia generada ${evidenceIndex + 1}`,
      type: 'document',
      weight: evidenceIndex === 0 ? 10 : 5,
    };
  }

  private createMetadata(
    value: unknown,
    fallback: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.isRecord(value) ? value : fallback;
  }

  private readText(
    value: unknown,
    fallback: string,
    maxLength: number,
  ): string {
    return readString(value, fallback).slice(0, maxLength);
  }

  private readOptionalText(
    value: unknown,
    fallback: string | undefined,
    maxLength: number,
  ): string | undefined {
    const text = readString(value, fallback ?? '');
    return text ? text.slice(0, maxLength) : undefined;
  }

  private readWeight(value: unknown, fallback: number): number {
    return Math.max(0, Math.round(readNumber(value, fallback)));
  }

  private isKnownSuspect(
    input: GenerateCaseEvidencesInput,
    suspectId?: string,
  ): suspectId is string {
    return (
      Boolean(suspectId) &&
      input.suspects.some((suspect) => suspect.id === suspectId)
    );
  }

  private findOldestSuspectId(input: GenerateCaseEvidencesInput): string {
    return (
      [...input.suspects].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      )[0]?.id ?? 'unknown-suspect'
    );
  }

  private readPayload(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}

interface NormalizationContext {
  readonly fallback: GeneratedCaseEvidencesContent;
  readonly input: GenerateCaseEvidencesInput;
  readonly selectedCulpritSuspectId: string;
}
