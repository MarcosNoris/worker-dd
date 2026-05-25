import { Injectable } from '@nestjs/common';
import { readBoolean } from '../../../shared/utils/value.util';
import {
  ADMIN_PROOF_ROLES,
  AdminProofRole,
} from '../../cases/constants/admin-case.constants';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  CaseContradictionGenerationStatementContext,
  GenerateCaseContradictionsInput,
  GeneratedCaseContradiction,
  GeneratedCaseContradictionsContent,
} from '../types/ai.types';

const MAX_TITLE_LENGTH = 160;
const MAX_EXPLANATION_LENGTH = 5000;
const MAX_CONTRADICTIONS_BY_DIFFICULTY = {
  easy: 2,
  medium: 3,
  hard: 5,
  expert: 7,
} as const;

export interface GeneratedCaseContradictionsPayload {
  readonly contradictions?: unknown;
}

@Injectable()
export class GeneratedCaseContradictionNormalizer {
  createContentFromPayload(
    payload: GeneratedCaseContradictionsPayload,
    input: GenerateCaseContradictionsInput,
  ): GeneratedCaseContradictionsContent {
    const payloadContradictions = this.readPayloadContradictions(
      payload.contradictions,
    );
    this.ensureContradictionCount(payloadContradictions, input);

    const contradictions = payloadContradictions.map((contradiction) =>
      this.createContradiction(contradiction, input),
    );
    this.ensureCulpritContradictionExists(contradictions, input);
    this.ensureUniquePairs(contradictions);

    return {
      contradictions,
      culpritSuspectId: input.culpritSuspectId,
      difficulty: input.difficulty,
    };
  }

  private createContradiction(
    payload: ContradictionPayload,
    input: GenerateCaseContradictionsInput,
  ): GeneratedCaseContradiction {
    const statement = this.findStatement(input, payload.statementId);
    const suspectId = this.readSuspectId(payload.suspectId, statement, input);
    const refutingEvidenceId = this.readEvidenceId(
      payload.refutingEvidenceId,
      input,
    );

    return {
      explanation: this.readText(
        payload.explanation,
        'explanation',
        MAX_EXPLANATION_LENGTH,
      ),
      isInitiallyVisible: readBoolean(payload.isInitiallyVisible, false),
      proves: this.readProofRole(payload.proves),
      refutingEvidenceId,
      statementId: statement.id,
      suspectId,
      title: this.readText(payload.title, 'title', MAX_TITLE_LENGTH),
    };
  }

  private readPayloadContradictions(
    value: unknown,
  ): readonly ContradictionPayload[] {
    if (!Array.isArray(value)) {
      throw this.createInvalidContradictionsError(
        'La respuesta no incluye un arreglo contradictions.',
      );
    }

    return value.map((contradiction, contradictionIndex) =>
      this.readPayload(contradiction, contradictionIndex),
    );
  }

  private ensureContradictionCount(
    contradictions: readonly ContradictionPayload[],
    input: GenerateCaseContradictionsInput,
  ): void {
    if (contradictions.length === 0) {
      throw this.createInvalidContradictionsError(
        'La IA no devolvio contradicciones.',
      );
    }

    const maxContradictions =
      MAX_CONTRADICTIONS_BY_DIFFICULTY[input.difficulty];

    if (contradictions.length > maxContradictions) {
      throw this.createInvalidContradictionsError(
        `La IA devolvio ${contradictions.length} contradicciones para dificultad ${input.difficulty}; el maximo es ${maxContradictions}.`,
      );
    }
  }

  private findStatement(
    input: GenerateCaseContradictionsInput,
    statementId: unknown,
  ): CaseContradictionGenerationStatementContext {
    const normalizedStatementId = this.readText(
      statementId,
      'statementId',
      MAX_TITLE_LENGTH,
    );
    const statement = input.statements.find(
      (candidate) => candidate.id === normalizedStatementId,
    );

    if (!statement) {
      throw this.createInvalidContradictionsError(
        `La IA devolvio un statementId que no pertenece al caso: ${normalizedStatementId}.`,
      );
    }

    return statement;
  }

  private readSuspectId(
    value: unknown,
    statement: CaseContradictionGenerationStatementContext,
    input: GenerateCaseContradictionsInput,
  ): string | undefined {
    if (!statement.suspectId) {
      return this.readOptionalKnownSuspectId(value, input);
    }

    const suspectId = this.readText(value, 'suspectId', MAX_TITLE_LENGTH);

    if (suspectId !== statement.suspectId) {
      throw this.createInvalidContradictionsError(
        `La IA devolvio suspectId ${suspectId} para un statement de ${statement.suspectId}.`,
      );
    }

    this.ensureKnownSuspectId(suspectId, input);

    return suspectId;
  }

  private readOptionalKnownSuspectId(
    value: unknown,
    input: GenerateCaseContradictionsInput,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const suspectId = this.readText(value, 'suspectId', MAX_TITLE_LENGTH);
    this.ensureKnownSuspectId(suspectId, input);

    return suspectId;
  }

  private readEvidenceId(
    value: unknown,
    input: GenerateCaseContradictionsInput,
  ): string {
    const evidenceId = this.readText(
      value,
      'refutingEvidenceId',
      MAX_TITLE_LENGTH,
    );
    const hasEvidence = input.evidences.some(
      (evidence) => evidence.id === evidenceId,
    );

    if (!hasEvidence) {
      throw this.createInvalidContradictionsError(
        `La IA devolvio un refutingEvidenceId que no pertenece al caso: ${evidenceId}.`,
      );
    }

    return evidenceId;
  }

  private ensureKnownSuspectId(
    suspectId: string,
    input: GenerateCaseContradictionsInput,
  ): void {
    const hasSuspect = input.suspects.some(
      (suspect) => suspect.id === suspectId,
    );

    if (!hasSuspect) {
      throw this.createInvalidContradictionsError(
        `La IA devolvio un suspectId que no pertenece al caso: ${suspectId}.`,
      );
    }
  }

  private readProofRole(value: unknown): AdminProofRole {
    if (
      typeof value === 'string' &&
      ADMIN_PROOF_ROLES.includes(value as AdminProofRole)
    ) {
      return value as AdminProofRole;
    }

    throw this.createInvalidContradictionsError(
      `La IA devolvio un proves invalido: ${String(value)}.`,
    );
  }

  private ensureCulpritContradictionExists(
    contradictions: readonly GeneratedCaseContradiction[],
    input: GenerateCaseContradictionsInput,
  ): void {
    const hasCulpritContradiction = contradictions.some((contradiction) =>
      this.isCulpritContradiction(contradiction, input),
    );

    if (!hasCulpritContradiction) {
      throw this.createInvalidContradictionsError(
        `La IA no devolvio ninguna contradiccion para el culpable ${input.culpritSuspectId}.`,
      );
    }
  }

  private isCulpritContradiction(
    contradiction: GeneratedCaseContradiction,
    input: GenerateCaseContradictionsInput,
  ): boolean {
    const statement = input.statements.find(
      (candidate) => candidate.id === contradiction.statementId,
    );

    return (
      contradiction.suspectId === input.culpritSuspectId ||
      statement?.suspectId === input.culpritSuspectId
    );
  }

  private ensureUniquePairs(
    contradictions: readonly GeneratedCaseContradiction[],
  ): void {
    const pairs = new Set<string>();

    contradictions.forEach((contradiction) => {
      const pair = `${contradiction.statementId}:${contradiction.refutingEvidenceId}`;

      if (pairs.has(pair)) {
        throw this.createInvalidContradictionsError(
          `La IA devolvio una contradiccion duplicada para statement ${contradiction.statementId} y evidencia ${contradiction.refutingEvidenceId}.`,
        );
      }

      pairs.add(pair);
    });
  }

  private readPayload(
    value: unknown,
    contradictionIndex: number,
  ): ContradictionPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw this.createInvalidContradictionsError(
        `La contradiccion ${contradictionIndex + 1} no es un objeto JSON valido.`,
      );
    }

    return value as ContradictionPayload;
  }

  private readText(
    value: unknown,
    fieldName: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.createInvalidContradictionsError(
        `La IA no devolvio un valor valido para ${fieldName}.`,
      );
    }

    return value.trim().slice(0, maxLength);
  }

  private createInvalidContradictionsError(
    detail: string,
  ): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_contradictions',
      undefined,
      detail,
    );
  }
}

interface ContradictionPayload {
  readonly explanation?: unknown;
  readonly isInitiallyVisible?: unknown;
  readonly proves?: unknown;
  readonly refutingEvidenceId?: unknown;
  readonly statementId?: unknown;
  readonly suspectId?: unknown;
  readonly title?: unknown;
}
