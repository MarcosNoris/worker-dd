import type { AdminCaseSolutionRecord } from '../cases.repository';

export interface CaseSolutionDto {
  readonly caseId: string;
  readonly createdAt: string;
  readonly culpritSuspectId: string;
  readonly fullExplanation: string;
  readonly id: string;
  readonly methodSummary: string;
  readonly motiveSummary: string;
  readonly opportunitySummary: string;
}

export interface CaseSolutionResponseDto {
  readonly solution: CaseSolutionDto;
}

export function createCaseSolutionResponse(
  solution: AdminCaseSolutionRecord,
): CaseSolutionResponseDto {
  return {
    solution: {
      caseId: solution.caseId,
      createdAt: solution.createdAt,
      culpritSuspectId: solution.culpritSuspectId,
      fullExplanation: solution.fullExplanation,
      id: solution.id,
      methodSummary: solution.methodSummary,
      motiveSummary: solution.motiveSummary,
      opportunitySummary: solution.opportunitySummary,
    },
  };
}
