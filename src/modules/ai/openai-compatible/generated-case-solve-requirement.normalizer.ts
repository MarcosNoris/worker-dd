import { Injectable } from '@nestjs/common';
import {
  ADMIN_PROOF_ROLES,
  ADMIN_REQUIREMENT_TYPES,
  AdminCaseDifficulty,
  AdminProofRole,
  AdminRequirementType,
} from '../../cases/constants/admin-case.constants';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GeneratedCaseSolveRequirement,
  GeneratedCaseSolveRequirementsContent,
  GenerateCaseSolveRequirementsInput,
} from '../types/ai.types';

const MAX_DESCRIPTION_LENGTH = 5000;
const MIN_DESCRIPTION_LENGTH = 5;
const MIN_REQUIREMENT_WEIGHT = 1;
const REQUIREMENT_COUNT_BY_DIFFICULTY: Record<
  AdminCaseDifficulty,
  { readonly max: number; readonly min: number }
> = {
  easy: { min: 3, max: 4 },
  medium: { min: 4, max: 6 },
  hard: { min: 6, max: 8 },
  expert: { min: 8, max: 10 },
};

export interface GeneratedCaseSolveRequirementsPayload {
  readonly solveRequirements?: unknown;
}

interface SolveRequirementPayload {
  readonly description?: unknown;
  readonly isMandatory?: unknown;
  readonly proofRole?: unknown;
  readonly requiredContradictionId?: unknown;
  readonly requiredEvidenceId?: unknown;
  readonly requiredSuspectId?: unknown;
  readonly requirementType?: unknown;
  readonly weight?: unknown;
}

@Injectable()
export class GeneratedCaseSolveRequirementNormalizer {
  createContentFromPayload(
    payload: GeneratedCaseSolveRequirementsPayload,
    input: GenerateCaseSolveRequirementsInput,
  ): GeneratedCaseSolveRequirementsContent {
    const payloadRequirements = this.readPayloadRequirements(
      payload.solveRequirements,
    );
    this.ensureRequirementCount(payloadRequirements, input.difficulty);

    const requirements = payloadRequirements.map((requirement) =>
      this.createRequirement(requirement, input),
    );
    this.ensureCulpritRequirementExists(requirements, input);

    return {
      culpritSuspectId: input.culpritSuspectId,
      difficulty: input.difficulty,
      requirements,
    };
  }

  private createRequirement(
    payload: SolveRequirementPayload,
    input: GenerateCaseSolveRequirementsInput,
  ): GeneratedCaseSolveRequirement {
    const requirement: GeneratedCaseSolveRequirement = {
      description: this.readDescription(payload.description),
      isMandatory: this.readMandatoryFlag(payload.isMandatory),
      proofRole: this.readOptionalProofRole(payload.proofRole),
      requiredContradictionId: this.readOptionalContradictionId(
        payload.requiredContradictionId,
        input,
      ),
      requiredEvidenceId: this.readOptionalEvidenceId(
        payload.requiredEvidenceId,
        input,
      ),
      requiredSuspectId: this.readOptionalSuspectId(
        payload.requiredSuspectId,
        input,
      ),
      requirementType: this.readRequirementType(payload.requirementType),
      weight: this.readWeight(payload.weight),
    };

    this.ensureRequirementHasTarget(requirement);

    return requirement;
  }

  private readPayloadRequirements(
    value: unknown,
  ): readonly SolveRequirementPayload[] {
    if (!Array.isArray(value)) {
      throw this.createInvalidRequirementsError(
        'La respuesta no incluye un arreglo solveRequirements.',
      );
    }

    return value.map((requirement, requirementIndex) =>
      this.readPayloadRequirement(requirement, requirementIndex),
    );
  }

  private readPayloadRequirement(
    value: unknown,
    requirementIndex: number,
  ): SolveRequirementPayload {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidRequirementsError(
      `El requisito en posicion ${requirementIndex} no es un objeto valido.`,
    );
  }

  private ensureRequirementCount(
    requirements: readonly SolveRequirementPayload[],
    difficulty: AdminCaseDifficulty,
  ): void {
    const countRule = REQUIREMENT_COUNT_BY_DIFFICULTY[difficulty];

    if (
      requirements.length < countRule.min ||
      requirements.length > countRule.max
    ) {
      throw this.createInvalidRequirementsError(
        `La IA devolvio ${requirements.length} requisitos para dificultad ${difficulty}; el rango permitido es ${countRule.min}-${countRule.max}.`,
      );
    }
  }

  private readRequirementType(value: unknown): AdminRequirementType {
    if (
      typeof value === 'string' &&
      ADMIN_REQUIREMENT_TYPES.includes(value as AdminRequirementType)
    ) {
      return value as AdminRequirementType;
    }

    throw this.createInvalidRequirementsError(
      `La IA devolvio un requirementType invalido: ${String(value)}.`,
    );
  }

  private readOptionalProofRole(value: unknown): AdminProofRole | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (
      typeof value === 'string' &&
      ADMIN_PROOF_ROLES.includes(value as AdminProofRole)
    ) {
      return value as AdminProofRole;
    }

    throw this.createInvalidRequirementsError(
      `La IA devolvio un proofRole invalido: ${String(value)}.`,
    );
  }

  private readOptionalSuspectId(
    value: unknown,
    input: GenerateCaseSolveRequirementsInput,
  ): string | undefined {
    const suspectId = this.readOptionalText(value);

    if (!suspectId) {
      return undefined;
    }

    if (!input.suspects.some((suspect) => suspect.id === suspectId)) {
      throw this.createInvalidRequirementsError(
        `La IA devolvio un requiredSuspectId que no pertenece al caso: ${suspectId}.`,
      );
    }

    return suspectId;
  }

  private readOptionalEvidenceId(
    value: unknown,
    input: GenerateCaseSolveRequirementsInput,
  ): string | undefined {
    const evidenceId = this.readOptionalText(value);

    if (!evidenceId) {
      return undefined;
    }

    if (!input.evidences.some((evidence) => evidence.id === evidenceId)) {
      throw this.createInvalidRequirementsError(
        `La IA devolvio un requiredEvidenceId que no pertenece al caso: ${evidenceId}.`,
      );
    }

    return evidenceId;
  }

  private readOptionalContradictionId(
    value: unknown,
    input: GenerateCaseSolveRequirementsInput,
  ): string | undefined {
    const contradictionId = this.readOptionalText(value);

    if (!contradictionId) {
      return undefined;
    }

    if (
      !input.contradictions.some(
        (contradiction) => contradiction.id === contradictionId,
      )
    ) {
      throw this.createInvalidRequirementsError(
        `La IA devolvio un requiredContradictionId que no pertenece al caso: ${contradictionId}.`,
      );
    }

    return contradictionId;
  }

  private ensureRequirementHasTarget(
    requirement: GeneratedCaseSolveRequirement,
  ): void {
    if (
      !requirement.requiredSuspectId &&
      !requirement.requiredEvidenceId &&
      !requirement.requiredContradictionId
    ) {
      throw this.createInvalidRequirementsError(
        'La IA devolvio un requisito sin objetivo verificable.',
      );
    }
  }

  private ensureCulpritRequirementExists(
    requirements: readonly GeneratedCaseSolveRequirement[],
    input: GenerateCaseSolveRequirementsInput,
  ): void {
    const hasCulpritRequirement = requirements.some(
      (requirement) =>
        requirement.requirementType === 'culprit' &&
        requirement.isMandatory &&
        requirement.requiredSuspectId === input.culpritSuspectId,
    );

    if (!hasCulpritRequirement) {
      throw this.createInvalidRequirementsError(
        `La IA no devolvio un requisito culprit obligatorio para ${input.culpritSuspectId}.`,
      );
    }
  }

  private readDescription(value: unknown): string {
    if (typeof value !== 'string') {
      throw this.createInvalidRequirementsError(
        'La IA no devolvio una descripcion valida.',
      );
    }

    const description = value.trim();

    if (description.length < MIN_DESCRIPTION_LENGTH) {
      throw this.createInvalidRequirementsError(
        `La IA devolvio una descripcion con menos de ${MIN_DESCRIPTION_LENGTH} caracteres.`,
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw this.createInvalidRequirementsError(
        `La IA devolvio una descripcion con mas de ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      );
    }

    return description;
  }

  private readMandatoryFlag(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    throw this.createInvalidRequirementsError(
      `La IA devolvio un isMandatory invalido: ${String(value)}.`,
    );
  }

  private readWeight(value: unknown): number {
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_REQUIREMENT_WEIGHT
    ) {
      return value;
    }

    throw this.createInvalidRequirementsError(
      `La IA devolvio un weight invalido: ${String(value)}.`,
    );
  }

  private readOptionalText(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    throw this.createInvalidRequirementsError(
      `La IA devolvio un identificador invalido: ${String(value)}.`,
    );
  }

  private createInvalidRequirementsError(
    detail: string,
  ): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_requirements',
      undefined,
      detail,
    );
  }

  private isRecord(value: unknown): value is SolveRequirementPayload {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
