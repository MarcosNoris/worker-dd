import { Injectable } from '@nestjs/common';
import {
  ADMIN_EVIDENCE_IMPORTANCES,
  ADMIN_EVIDENCE_TYPES,
  ADMIN_PROOF_ROLES,
  AdminProofRole,
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

    return this.normalizeEvidenceProofMatrix(
      this.withFallbackEvidences(evidences, context),
    );
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
    const isDecoy =
      importance === 'misleading' ||
      readBoolean(payload.isDecoy, fallback.isDecoy);

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
      isDecoy,
      isInitiallyVisible: readBoolean(
        payload.isInitiallyVisible,
        fallback.isInitiallyVisible,
      ),
      location: this.readOptionalText(
        payload.location,
        fallback.location,
        MAX_LOCATION_LENGTH,
      ),
      metadata: this.createMetadata(payload.metadata, fallback.metadata, {
        evidenceIndex,
        isDecoy,
      }),
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
        mandatoryCandidate: evidenceIndex < CORE_EVIDENCE_PROOF_ROLES.length,
        narrativePurpose: 'Completar la estructura minima de evidencias.',
        primaryProofRole: this.resolveFallbackProofRole(evidenceIndex),
        proofRationale:
          'Evidencia de respaldo generada para conservar la matriz probatoria minima.',
        proofRoles: [this.resolveFallbackProofRole(evidenceIndex)],
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
    context: EvidenceMetadataContext,
  ): Record<string, unknown> {
    const metadata = this.isRecord(value) ? value : fallback;
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

interface EvidenceMetadataContext {
  readonly evidenceIndex: number;
  readonly isDecoy: boolean;
}
