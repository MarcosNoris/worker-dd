import { Injectable } from '@nestjs/common';
import { readBoolean, readString } from '../../../shared/utils/value.util';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GenerateCaseStatementsInput,
  GeneratedCaseStatement,
  GeneratedCaseStatementsContent,
} from '../types/ai.types';

const MAX_SPEAKER_NAME_LENGTH = 300;
const MAX_CONTEXT_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 5000;

export interface GeneratedCaseStatementsPayload {
  readonly statements?: unknown;
}

@Injectable()
export class GeneratedCaseStatementNormalizer {
  createContentFromPayload(
    payload: GeneratedCaseStatementsPayload,
    input: GenerateCaseStatementsInput,
  ): GeneratedCaseStatementsContent {
    const payloadStatements = this.readPayloadStatements(payload.statements);
    this.ensureStatementsMatchSuspects(payloadStatements, input);

    return {
      culpritSuspectId: input.culpritSuspectId,
      statements: input.suspects.map((suspect, suspectIndex) =>
        this.createStatementForSuspect(
          suspect,
          suspectIndex,
          payloadStatements,
        ),
      ),
    };
  }

  private createStatementForSuspect(
    suspect: GenerateCaseStatementsInput['suspects'][number],
    suspectIndex: number,
    payloadStatements: readonly StatementPayload[],
  ): GeneratedCaseStatement {
    const payload = this.findPayloadForSuspect(payloadStatements, suspect.id);

    return {
      content: this.readText(
        payload?.content,
        `content para ${suspect.id}`,
        MAX_CONTENT_LENGTH,
      ),
      context: this.readOptionalText(payload?.context, MAX_CONTEXT_LENGTH),
      isInitiallyVisible: readBoolean(
        payload?.isInitiallyVisible,
        suspectIndex === 0,
      ),
      speakerName: this.readText(
        payload?.speakerName,
        `speakerName para ${suspect.id}`,
        MAX_SPEAKER_NAME_LENGTH,
      ),
      suspectId: suspect.id,
    };
  }

  private readPayloadStatements(value: unknown): readonly StatementPayload[] {
    if (!Array.isArray(value)) {
      throw this.createInvalidStatementsError(
        'La respuesta no incluye un arreglo statements.',
      );
    }

    return value.map((statement, statementIndex) =>
      this.readPayload(statement, statementIndex),
    );
  }

  private findPayloadForSuspect(
    statements: readonly StatementPayload[],
    suspectId: string,
  ): StatementPayload | undefined {
    return statements.find((statement) => statement.suspectId === suspectId);
  }

  private ensureStatementsMatchSuspects(
    statements: readonly StatementPayload[],
    input: GenerateCaseStatementsInput,
  ): void {
    const expectedSuspectIds = new Set(
      input.suspects.map((suspect) => suspect.id),
    );
    const receivedSuspectIds = new Set<string>();

    statements.forEach((statement, statementIndex) => {
      const suspectId = this.readText(
        statement.suspectId,
        `suspectId del statement ${statementIndex + 1}`,
        MAX_SPEAKER_NAME_LENGTH,
      );

      this.ensureKnownSuspectId(suspectId, expectedSuspectIds);
      this.ensureUniqueSuspectId(suspectId, receivedSuspectIds);
      receivedSuspectIds.add(suspectId);
    });

    input.suspects.forEach((suspect) =>
      this.ensureSuspectStatementExists(suspect.id, receivedSuspectIds),
    );
  }

  private ensureKnownSuspectId(
    suspectId: string,
    expectedSuspectIds: ReadonlySet<string>,
  ): void {
    if (!expectedSuspectIds.has(suspectId)) {
      throw this.createInvalidStatementsError(
        `La IA devolvio un suspectId que no pertenece al caso: ${suspectId}.`,
      );
    }
  }

  private ensureUniqueSuspectId(
    suspectId: string,
    receivedSuspectIds: ReadonlySet<string>,
  ): void {
    if (receivedSuspectIds.has(suspectId)) {
      throw this.createInvalidStatementsError(
        `La IA devolvio mas de un statement para el sospechoso ${suspectId}.`,
      );
    }
  }

  private ensureSuspectStatementExists(
    suspectId: string,
    receivedSuspectIds: ReadonlySet<string>,
  ): void {
    if (!receivedSuspectIds.has(suspectId)) {
      throw this.createInvalidStatementsError(
        `La IA no devolvio statement para el sospechoso ${suspectId}.`,
      );
    }
  }

  private readPayload(
    value: unknown,
    statementIndex: number,
  ): StatementPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw this.createInvalidStatementsError(
        `El statement ${statementIndex + 1} no es un objeto JSON valido.`,
      );
    }

    return value as StatementPayload;
  }

  private readText(
    value: unknown,
    fieldName: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.createInvalidStatementsError(
        `La IA no devolvio un valor valido para ${fieldName}.`,
      );
    }

    return value.trim().slice(0, maxLength);
  }

  private readOptionalText(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    const text = readString(value, '');

    return text ? text.slice(0, maxLength) : undefined;
  }

  private createInvalidStatementsError(detail: string): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_statements',
      undefined,
      detail,
    );
  }
}

interface StatementPayload {
  readonly content?: unknown;
  readonly context?: unknown;
  readonly isInitiallyVisible?: unknown;
  readonly speakerName?: unknown;
  readonly suspectId?: unknown;
}
