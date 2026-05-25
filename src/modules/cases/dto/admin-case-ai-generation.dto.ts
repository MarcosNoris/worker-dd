import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AdminCaseStateResponseDto } from './admin-case-state.dto';
import {
  ADMIN_CASE_DIFFICULTIES,
  AdminCaseDifficulty,
} from '../constants/admin-case.constants';
import {
  CaseAiGenerationAttempts,
  CaseAiGenerationStatus,
  CaseAiGenerationStep,
} from '../types/case-ai-generation.types';

const MAX_AI_CASE_THEME_LENGTH = 500;
const MIN_GENERATED_SUSPECT_COUNT = 2;
const MAX_GENERATED_SUSPECT_COUNT = 6;
const MIN_GENERATED_EVIDENCE_COUNT = 1;
const MAX_GENERATED_EVIDENCE_COUNT = 12;

function trimText(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptionalText(value: unknown): unknown {
  const trimmedValue = trimText(value);

  return trimmedValue === '' ? undefined : trimmedValue;
}

export class CreateFullAiCaseDto {
  @Transform(({ value }) => normalizeOptionalText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(MAX_AI_CASE_THEME_LENGTH)
  theme?: string;

  @Transform(({ value }) => normalizeOptionalText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_CASE_DIFFICULTIES)
  difficulty?: AdminCaseDifficulty;

  @Type(() => Number)
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_GENERATED_SUSPECT_COUNT)
  @Max(MAX_GENERATED_SUSPECT_COUNT)
  suspectCount?: number;

  @Type(() => Number)
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_GENERATED_EVIDENCE_COUNT)
  @Max(MAX_GENERATED_EVIDENCE_COUNT)
  evidenceCount?: number;
}

export interface CaseAiGenerationRunDto {
  readonly attemptsByStep: CaseAiGenerationAttempts;
  readonly caseId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly culpritSuspectId?: string;
  readonly currentStep: CaseAiGenerationStep;
  readonly difficulty?: AdminCaseDifficulty;
  readonly finishedAt?: string;
  readonly generationOptions: Record<string, unknown>;
  readonly id: string;
  readonly lastError?: string;
  readonly status: CaseAiGenerationStatus;
  readonly theme?: string;
  readonly updatedAt: string;
}

export interface CaseAiGenerationWorkflowResponseDto {
  readonly run: CaseAiGenerationRunDto;
  readonly state?: AdminCaseStateResponseDto;
}
