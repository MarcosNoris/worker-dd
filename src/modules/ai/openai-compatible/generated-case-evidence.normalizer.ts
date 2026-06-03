import { Injectable } from '@nestjs/common';
import {
  ADMIN_EVIDENCE_IMPORTANCES,
  ADMIN_EVIDENCE_TYPES,
  ADMIN_PROOF_ROLES,
  AdminProofRole,
} from '../../cases/constants/admin-case.constants';
import { readString } from '../../../shared/utils/value.util';
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
const CORE_EVIDENCE_PROOF_ROLES = [
  'identity',
  'motive',
  'method',
  'opportunity',
] as const satisfies readonly AdminProofRole[];

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
  ): GeneratedCaseEvidencesContent {
    const selectedCulpritSuspectId = this.selectCulpritSuspectId(
      payload.selectedCulpritSuspectId,
      input,
    );

    return {
      evidences: this.createEvidences(payload.evidences, {
        input,
        selectedCulpritSuspectId,
      }),
      selectedCulpritSuspectId,
      solution: this.createOptionalSolution(payload.solution, {
        input,
        selectedCulpritSuspectId,
      }),
    };
  }

  private createEvidences(
    value: unknown,
    context: NormalizationContext,
  ): readonly GeneratedCaseEvidence[] {
    const evidences = this.readPayloadEvidences(value, context.input).map(
      (evidence, evidenceIndex) =>
        this.createEvidence(evidence, evidenceIndex, context),
    );

    return this.normalizeEvidenceProofMatrix(evidences);
  }

  private createEvidence(
    value: unknown,
    evidenceIndex: number,
    context: NormalizationContext,
  ): GeneratedCaseEvidence {
    const payload = this.readPayload(value);
    const importance = this.readImportance(payload.importance, evidenceIndex);
    const isDecoy =
      importance === 'misleading' ||
      this.readBoolean(payload.isDecoy, {
        evidenceIndex,
        fieldName: 'isDecoy',
      });

    return {
      description: this.readText(
        payload.description,
        'description',
        evidenceIndex,
        MAX_DESCRIPTION_LENGTH,
      ),
      discoveryHint: this.readOptionalText(
        payload.discoveryHint,
        MAX_HINT_LENGTH,
      ),
      importance,
      isDecoy,
      isInitiallyVisible: this.readBoolean(payload.isInitiallyVisible, {
        evidenceIndex,
        fieldName: 'isInitiallyVisible',
      }),
      location: this.readOptionalText(payload.location, MAX_LOCATION_LENGTH),
      metadata: this.createMetadata(payload.metadata, {
        evidenceIndex,
        isDecoy,
      }),
      title: this.readText(
        payload.title,
        'title',
        evidenceIndex,
        MAX_TITLE_LENGTH,
      ),
      type: this.readType(payload.type, evidenceIndex),
      weight: this.readWeight(payload.weight, evidenceIndex),
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

    return {
      culpritSuspectId: context.selectedCulpritSuspectId,
      fullExplanation: this.readText(
        payload.fullExplanation,
        'solution.fullExplanation',
        undefined,
        MAX_DESCRIPTION_LENGTH,
      ),
      methodSummary: this.readText(
        payload.methodSummary,
        'solution.methodSummary',
        undefined,
        MAX_DESCRIPTION_LENGTH,
      ),
      motiveSummary: this.readText(
        payload.motiveSummary,
        'solution.motiveSummary',
        undefined,
        MAX_DESCRIPTION_LENGTH,
      ),
      opportunitySummary: this.readText(
        payload.opportunitySummary,
        'solution.opportunitySummary',
        undefined,
        MAX_DESCRIPTION_LENGTH,
      ),
    };
  }

  private selectCulpritSuspectId(
    value: unknown,
    input: GenerateCaseEvidencesInput,
  ): string {
    if (this.isKnownSuspect(input, input.culpritSuspectId)) {
      return input.culpritSuspectId;
    }

    const generatedSuspectId = readString(value, '');

    if (this.isKnownSuspect(input, generatedSuspectId)) {
      return generatedSuspectId;
    }

    throw new Error(
      'La IA devolvio un selectedCulpritSuspectId que no pertenece al caso.',
    );
  }

  private normalizeEvidenceProofMatrix(
    evidences: readonly GeneratedCaseEvidence[],
  ): readonly GeneratedCaseEvidence[] {
    const assignedCoreRoles = this.assignCoreProofRoles(evidences);

    return evidences.map((evidence, evidenceIndex) =>
      this.normalizeEvidenceProofMetadata(
        evidence,
        assignedCoreRoles.get(evidenceIndex),
      ),
    );
  }

  private assignCoreProofRoles(
    evidences: readonly GeneratedCaseEvidence[],
  ): ReadonlyMap<number, AdminProofRole> {
    const assignedCoreRoles = new Map<number, AdminProofRole>();

    for (const coreRole of CORE_EVIDENCE_PROOF_ROLES) {
      const evidenceIndex = this.findEvidenceIndexForCoreRole(
        evidences,
        coreRole,
        assignedCoreRoles,
      );

      if (evidenceIndex >= 0) {
        assignedCoreRoles.set(evidenceIndex, coreRole);
      }
    }

    return assignedCoreRoles;
  }

  private findEvidenceIndexForCoreRole(
    evidences: readonly GeneratedCaseEvidence[],
    coreRole: AdminProofRole,
    assignedCoreRoles: ReadonlyMap<number, AdminProofRole>,
  ): number {
    return (
      this.findEvidenceIndexByPrimaryRole(
        evidences,
        coreRole,
        assignedCoreRoles,
      ) ??
      this.findEvidenceIndexByDeclaredRole(
        evidences,
        coreRole,
        assignedCoreRoles,
      ) ??
      this.findUnassignedNonDecoyEvidenceIndex(evidences, assignedCoreRoles) ??
      -1
    );
  }

  private findEvidenceIndexByPrimaryRole(
    evidences: readonly GeneratedCaseEvidence[],
    coreRole: AdminProofRole,
    assignedCoreRoles: ReadonlyMap<number, AdminProofRole>,
  ): number | undefined {
    const evidenceIndex = evidences.findIndex(
      (evidence, candidateIndex) =>
        !assignedCoreRoles.has(candidateIndex) &&
        !evidence.isDecoy &&
        evidence.metadata.primaryProofRole === coreRole,
    );

    return evidenceIndex >= 0 ? evidenceIndex : undefined;
  }

  private findEvidenceIndexByDeclaredRole(
    evidences: readonly GeneratedCaseEvidence[],
    coreRole: AdminProofRole,
    assignedCoreRoles: ReadonlyMap<number, AdminProofRole>,
  ): number | undefined {
    const evidenceIndex = evidences.findIndex(
      (evidence, candidateIndex) =>
        !assignedCoreRoles.has(candidateIndex) &&
        !evidence.isDecoy &&
        this.hasDeclaredProofRole(evidence.metadata.proofRoles, coreRole),
    );

    return evidenceIndex >= 0 ? evidenceIndex : undefined;
  }

  private hasDeclaredProofRole(
    value: unknown,
    coreRole: AdminProofRole,
  ): boolean {
    return Array.isArray(value)
      ? value.some((proofRole) => this.readProofRole(proofRole) === coreRole)
      : false;
  }

  private findUnassignedNonDecoyEvidenceIndex(
    evidences: readonly GeneratedCaseEvidence[],
    assignedCoreRoles: ReadonlyMap<number, AdminProofRole>,
  ): number | undefined {
    const evidenceIndex = evidences.findIndex(
      (evidence, candidateIndex) =>
        !assignedCoreRoles.has(candidateIndex) && !evidence.isDecoy,
    );

    return evidenceIndex >= 0 ? evidenceIndex : undefined;
  }

  private normalizeEvidenceProofMetadata(
    evidence: GeneratedCaseEvidence,
    assignedCoreRole?: AdminProofRole,
  ): GeneratedCaseEvidence {
    const primaryProofRole =
      assignedCoreRole ?? this.resolveExtraEvidenceProofRole(evidence);
    const shouldKeepRationale =
      this.readProofRole(evidence.metadata.primaryProofRole) ===
      primaryProofRole;

    return {
      ...evidence,
      metadata: {
        ...evidence.metadata,
        mandatoryCandidate: Boolean(assignedCoreRole),
        primaryProofRole,
        proofRationale: shouldKeepRationale
          ? this.readProofRationale(evidence.metadata, primaryProofRole)
          : this.createProofRationale(primaryProofRole),
        proofRoles: [primaryProofRole],
        proves: primaryProofRole,
      },
    };
  }

  private resolveExtraEvidenceProofRole(
    evidence: GeneratedCaseEvidence,
  ): AdminProofRole {
    return evidence.isDecoy ? 'false_alibi' : 'support';
  }

  private createMetadata(
    value: unknown,
    context: EvidenceMetadataContext,
  ): Record<string, unknown> {
    const metadata = this.isRecord(value) ? value : {};
    const primaryProofRole = this.readPrimaryProofRole(metadata, context);

    return {
      ...metadata,
      mandatoryCandidate:
        typeof metadata.mandatoryCandidate === 'boolean'
          ? metadata.mandatoryCandidate
          : !context.isDecoy &&
            context.evidenceIndex < CORE_EVIDENCE_PROOF_ROLES.length,
      primaryProofRole,
      proofRationale: this.readProofRationale(metadata, primaryProofRole),
      proofRoles: this.readProofRoles(metadata, primaryProofRole),
    };
  }

  private readPrimaryProofRole(
    metadata: Record<string, unknown>,
    context: EvidenceMetadataContext,
  ): AdminProofRole {
    return (
      this.readProofRole(metadata.primaryProofRole) ??
      this.readFirstProofRole(metadata.proofRoles) ??
      this.resolveFallbackProofRole(context.evidenceIndex)
    );
  }

  private readProofRoles(
    metadata: Record<string, unknown>,
    primaryProofRole: AdminProofRole,
  ): readonly AdminProofRole[] {
    const proofRoles = Array.isArray(metadata.proofRoles)
      ? metadata.proofRoles
          .map((proofRole) => this.readProofRole(proofRole))
          .filter((proofRole): proofRole is AdminProofRole =>
            Boolean(proofRole),
          )
      : [];

    return proofRoles.includes(primaryProofRole)
      ? proofRoles
      : [primaryProofRole, ...proofRoles];
  }

  private readFirstProofRole(value: unknown): AdminProofRole | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .map((proofRole) => this.readProofRole(proofRole))
      .find((proofRole): proofRole is AdminProofRole => Boolean(proofRole));
  }

  private readProofRole(value: unknown): AdminProofRole | undefined {
    return typeof value === 'string' &&
      ADMIN_PROOF_ROLES.includes(value as AdminProofRole)
      ? (value as AdminProofRole)
      : undefined;
  }

  private readProofRationale(
    metadata: Record<string, unknown>,
    primaryProofRole: AdminProofRole,
  ): string {
    return typeof metadata.proofRationale === 'string' &&
      metadata.proofRationale.trim().length > 0
      ? metadata.proofRationale.trim()
      : this.createProofRationale(primaryProofRole);
  }

  private createProofRationale(primaryProofRole: AdminProofRole): string {
    return `Esta evidencia funciona principalmente como prueba de ${primaryProofRole}.`;
  }

  private resolveFallbackProofRole(evidenceIndex: number): AdminProofRole {
    return CORE_EVIDENCE_PROOF_ROLES[evidenceIndex] ?? 'support';
  }

  private readText(
    value: unknown,
    fieldName: string,
    evidenceIndex: number | undefined,
    maxLength: number,
  ): string {
    if (typeof value !== 'string') {
      throw this.createInvalidEvidenceError(fieldName, evidenceIndex);
    }

    const text = value.trim();

    if (text.length === 0) {
      throw this.createInvalidEvidenceError(fieldName, evidenceIndex);
    }

    return text.slice(0, maxLength);
  }

  private readOptionalText(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    const text = readString(value, '');
    return text ? text.slice(0, maxLength) : undefined;
  }

  private readPayload(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new Error('La IA devolvio una evidencia invalida.');
    }

    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private readPayloadEvidences(
    value: unknown,
    input: GenerateCaseEvidencesInput,
  ): readonly unknown[] {
    if (!Array.isArray(value)) {
      throw new Error('La IA no devolvio un arreglo evidences valido.');
    }

    if (value.length !== input.evidenceCount) {
      throw new Error(
        `La IA devolvio ${value.length} evidencias; se esperaban ${input.evidenceCount}.`,
      );
    }

    return value;
  }

  private readImportance(
    value: unknown,
    evidenceIndex: number,
  ): GeneratedCaseEvidence['importance'] {
    if (
      typeof value === 'string' &&
      ADMIN_EVIDENCE_IMPORTANCES.includes(
        value as GeneratedCaseEvidence['importance'],
      )
    ) {
      return value as GeneratedCaseEvidence['importance'];
    }

    throw this.createInvalidEvidenceError('importance', evidenceIndex);
  }

  private readType(
    value: unknown,
    evidenceIndex: number,
  ): GeneratedCaseEvidence['type'] {
    if (
      typeof value === 'string' &&
      ADMIN_EVIDENCE_TYPES.includes(value as GeneratedCaseEvidence['type'])
    ) {
      return value as GeneratedCaseEvidence['type'];
    }

    throw this.createInvalidEvidenceError('type', evidenceIndex);
  }

  private readBoolean(
    value: unknown,
    context: RequiredEvidenceFieldContext,
  ): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    throw this.createInvalidEvidenceError(
      context.fieldName,
      context.evidenceIndex,
    );
  }

  private readWeight(value: unknown, evidenceIndex: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.createInvalidEvidenceError('weight', evidenceIndex);
    }

    return Math.max(0, Math.round(value));
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

  private createInvalidEvidenceError(
    fieldName: string,
    evidenceIndex: number | undefined,
  ): Error {
    const evidenceLabel =
      evidenceIndex === undefined
        ? 'la respuesta'
        : `evidences[${evidenceIndex}]`;

    return new Error(
      `La IA no devolvio un valor valido para ${evidenceLabel}.${fieldName}.`,
    );
  }
}

interface NormalizationContext {
  readonly input: GenerateCaseEvidencesInput;
  readonly selectedCulpritSuspectId: string;
}

interface EvidenceMetadataContext {
  readonly evidenceIndex: number;
  readonly isDecoy: boolean;
}

interface RequiredEvidenceFieldContext {
  readonly evidenceIndex: number;
  readonly fieldName: string;
}
