import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import type { AdminCaseRecord } from '../cases.repository';

const ADMIN_CASE_SORT_DIRECTIONS = ['asc', 'desc'] as const;
const ADMIN_CASE_STATUSES = ['draft', 'playable'] as const;
const DEFAULT_ADMIN_CASE_PAGE = 1;
const DEFAULT_ADMIN_CASE_LIMIT = 20;
const MAX_ADMIN_CASE_LIMIT = 100;

export type AdminCaseSortDirection =
  (typeof ADMIN_CASE_SORT_DIRECTIONS)[number];
export type AdminCaseStatusFilter = (typeof ADMIN_CASE_STATUSES)[number];

export class AdminCasesListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_ADMIN_CASE_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_CASE_LIMIT)
  limit: number = DEFAULT_ADMIN_CASE_LIMIT;

  @IsIn(ADMIN_CASE_SORT_DIRECTIONS)
  sort: AdminCaseSortDirection = 'desc';

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_CASE_STATUSES)
  status?: AdminCaseStatusFilter;
}

export interface AdminCaseListItemDto {
  readonly aiModel?: string;
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly departmentId: string | null;
  readonly difficulty: string;
  readonly generatedByAi: boolean;
  readonly generationPrompt?: string;
  readonly id: string;
  readonly publicBriefing?: string;
  readonly status: string;
  readonly summary: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly victimName?: string;
}

export interface AdminCasesListPaginationDto {
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly limit: number;
  readonly page: number;
  readonly sort: AdminCaseSortDirection;
  readonly status?: AdminCaseStatusFilter;
  readonly total: number;
  readonly totalPages: number;
}

export interface AdminCasesListResponseDto {
  readonly cases: readonly AdminCaseListItemDto[];
  readonly pagination: AdminCasesListPaginationDto;
}

export function createAdminCasesListResponse(input: {
  readonly cases: readonly AdminCaseRecord[];
  readonly query: AdminCasesListQueryDto;
  readonly total: number;
}): AdminCasesListResponseDto {
  const totalPages = Math.ceil(input.total / input.query.limit);

  return {
    cases: input.cases.map((caseRecord) => createAdminCaseListItem(caseRecord)),
    pagination: {
      hasNextPage: input.query.page < totalPages,
      hasPreviousPage: input.query.page > 1,
      limit: input.query.limit,
      page: input.query.page,
      sort: input.query.sort,
      status: input.query.status,
      total: input.total,
      totalPages,
    },
  };
}

function createAdminCaseListItem(
  caseRecord: AdminCaseRecord,
): AdminCaseListItemDto {
  return {
    aiModel: caseRecord.aiModel,
    createdAt: caseRecord.createdAt,
    createdBy: caseRecord.createdBy,
    departmentId: caseRecord.departmentId,
    difficulty: caseRecord.difficulty,
    generatedByAi: caseRecord.generatedByAi,
    generationPrompt: caseRecord.generationPrompt,
    id: caseRecord.id,
    publicBriefing: caseRecord.publicBriefing,
    status: caseRecord.status,
    summary: caseRecord.summary,
    title: caseRecord.title,
    updatedAt: caseRecord.updatedAt,
    victimName: caseRecord.victimName,
  };
}
