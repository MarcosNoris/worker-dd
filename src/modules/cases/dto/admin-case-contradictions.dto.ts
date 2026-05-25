import type { AdminContradictionRecord } from '../cases.repository';

export interface AdminCaseContradictionDto {
  readonly caseId: string;
  readonly createdAt: string;
  readonly explanation: string;
  readonly id: string;
  readonly isInitiallyVisible: boolean;
  readonly proves: string;
  readonly refutingEvidenceId: string;
  readonly statementId: string;
  readonly suspectId?: string;
  readonly title: string;
}

export interface AdminCaseContradictionsResponseDto {
  readonly contradictions: readonly AdminCaseContradictionDto[];
}

export function createAdminCaseContradictionsResponse(
  contradictions: readonly AdminContradictionRecord[],
): AdminCaseContradictionsResponseDto {
  return {
    contradictions: contradictions.map((contradiction) =>
      createAdminCaseContradictionResponse(contradiction),
    ),
  };
}

function createAdminCaseContradictionResponse(
  contradiction: AdminContradictionRecord,
): AdminCaseContradictionDto {
  return {
    caseId: contradiction.caseId,
    createdAt: contradiction.createdAt,
    explanation: contradiction.explanation,
    id: contradiction.id,
    isInitiallyVisible: contradiction.isInitiallyVisible,
    proves: contradiction.proves,
    refutingEvidenceId: contradiction.refutingEvidenceId,
    statementId: contradiction.statementId,
    suspectId: contradiction.suspectId,
    title: contradiction.title,
  };
}
