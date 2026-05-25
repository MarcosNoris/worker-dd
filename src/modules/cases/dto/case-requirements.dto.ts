import type { AdminSolveRequirementRecord } from '../cases.repository';

export interface CaseRequirementDto {
  readonly caseId: string;
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly isMandatory: boolean;
  readonly proofRole?: string;
  readonly requiredContradictionId?: string;
  readonly requiredEvidenceId?: string;
  readonly requiredSuspectId?: string;
  readonly requirementType: string;
  readonly weight: number;
}

export interface CaseRequirementsResponseDto {
  readonly requirements: readonly CaseRequirementDto[];
}

export function createCaseRequirementsResponse(
  requirements: readonly AdminSolveRequirementRecord[],
): CaseRequirementsResponseDto {
  return {
    requirements: requirements.map((requirement) =>
      createCaseRequirementResponse(requirement),
    ),
  };
}

function createCaseRequirementResponse(
  requirement: AdminSolveRequirementRecord,
): CaseRequirementDto {
  return {
    caseId: requirement.caseId,
    createdAt: requirement.createdAt,
    description: requirement.description,
    id: requirement.id,
    isMandatory: requirement.isMandatory,
    proofRole: requirement.proofRole,
    requiredContradictionId: requirement.requiredContradictionId,
    requiredEvidenceId: requirement.requiredEvidenceId,
    requiredSuspectId: requirement.requiredSuspectId,
    requirementType: requirement.requirementType,
    weight: requirement.weight,
  };
}
