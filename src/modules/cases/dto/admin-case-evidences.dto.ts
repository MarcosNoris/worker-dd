import type { AdminEvidenceRecord } from '../cases.repository';

export interface AdminCaseEvidenceDto {
  readonly caseId: string;
  readonly createdAt: string;
  readonly description: string;
  readonly discoveryHint?: string;
  readonly id: string;
  readonly importance: string;
  readonly isDecoy: boolean;
  readonly isInitiallyVisible: boolean;
  readonly location?: string;
  readonly metadata: Record<string, unknown>;
  readonly title: string;
  readonly type: string;
  readonly weight: number;
}

export interface AdminCaseEvidencesResponseDto {
  readonly evidences: readonly AdminCaseEvidenceDto[];
}

export function createAdminCaseEvidencesResponse(
  evidences: readonly AdminEvidenceRecord[],
): AdminCaseEvidencesResponseDto {
  return {
    evidences: evidences.map((evidence) =>
      createAdminCaseEvidenceResponse(evidence),
    ),
  };
}

function createAdminCaseEvidenceResponse(
  evidence: AdminEvidenceRecord,
): AdminCaseEvidenceDto {
  return {
    caseId: evidence.caseId,
    createdAt: evidence.createdAt,
    description: evidence.description,
    discoveryHint: evidence.discoveryHint,
    id: evidence.id,
    importance: evidence.importance,
    isDecoy: evidence.isDecoy,
    isInitiallyVisible: evidence.isInitiallyVisible,
    location: evidence.location,
    metadata: evidence.metadata,
    title: evidence.title,
    type: evidence.type,
    weight: evidence.weight,
  };
}
