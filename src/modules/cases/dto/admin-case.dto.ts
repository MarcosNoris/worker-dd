import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmpty,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ADMIN_ACTION_TYPES,
  ADMIN_CASE_DIFFICULTIES,
  ADMIN_EVIDENCE_IMPORTANCES,
  ADMIN_EVIDENCE_TYPES,
  ADMIN_PROOF_ROLES,
  ADMIN_REQUIREMENT_TYPES,
  ADMIN_SKILL_TYPES,
  AdminActionType,
  AdminCaseDifficulty,
  AdminEvidenceImportance,
  AdminEvidenceType,
  AdminProofRole,
  AdminRequirementType,
  AdminSkillType,
  normalizeAdminActionType,
} from '../constants/admin-case.constants';

const MAX_TITLE_LENGTH = 160;
const MAX_AI_CASE_THEME_LENGTH = 500;
const MAX_SUMMARY_LENGTH = 2000;
const MAX_LONG_TEXT_LENGTH = 5000;
const MAX_SHORT_TEXT_LENGTH = 300;
const MAX_MEDIUM_TEXT_LENGTH = 1000;
const MIN_SKILL_LEVEL = 50;
const MAX_SKILL_LEVEL = 100;
const MIN_SUCCESS_CHANCE = 0;
const MAX_SUCCESS_CHANCE = 1;
const MIN_GENERATED_SUSPECT_COUNT = 2;
const MAX_GENERATED_SUSPECT_COUNT = 6;
const MIN_GENERATED_EVIDENCE_COUNT = 1;
const MAX_GENERATED_EVIDENCE_COUNT = 12;
const EVIDENCE_TYPE_ALIASES = new Map<string, AdminEvidenceType>([
  ['documentary', 'document'],
]);

function trimText(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptionalText(value: unknown): unknown {
  const trimmedValue = trimText(value);

  return trimmedValue === '' ? undefined : trimmedValue;
}

function normalizeEvidenceType(value: unknown): unknown {
  const trimmedValue = trimText(value);

  if (typeof trimmedValue !== 'string') {
    return trimmedValue;
  }

  return EVIDENCE_TYPE_ALIASES.get(trimmedValue) ?? trimmedValue;
}

function normalizeActionType(value: unknown): unknown {
  const trimmedValue = trimText(value);

  if (typeof trimmedValue !== 'string') {
    return trimmedValue;
  }

  return normalizeAdminActionType(trimmedValue) ?? trimmedValue;
}

export class CreateAiCaseDto {
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
}

export class CreateManualCaseDto {
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(3)
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(MAX_SUMMARY_LENGTH)
  summary!: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  publicBriefing?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  victimName?: string;

  @Transform(({ value }) => trimText(value))
  @IsIn(ADMIN_CASE_DIFFICULTIES)
  difficulty!: AdminCaseDifficulty;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  generationPrompt?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  aiModel?: string;

  @IsOptional()
  @IsObject()
  aiGenerationMetadata?: Record<string, unknown>;
}

export class CreateCaseSuspectDto {
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  name!: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(130)
  age?: number;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  occupation?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  relationshipToVictim?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDIUM_TEXT_LENGTH)
  background?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDIUM_TEXT_LENGTH)
  personality?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDIUM_TEXT_LENGTH)
  publicNotes?: string;
}

export class GenerateCaseSuspectsDto {
  @Type(() => Number)
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_GENERATED_SUSPECT_COUNT)
  @Max(MAX_GENERATED_SUSPECT_COUNT)
  suspectCount?: number;
}

export class CreateCaseEvidenceDto {
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  description!: string;

  @Transform(({ value }) => normalizeEvidenceType(value))
  @IsIn(ADMIN_EVIDENCE_TYPES)
  type!: AdminEvidenceType;

  @Transform(({ value }) => trimText(value))
  @IsIn(ADMIN_EVIDENCE_IMPORTANCES)
  importance!: AdminEvidenceImportance;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  location?: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDIUM_TEXT_LENGTH)
  discoveryHint?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  weight?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isDecoy?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isInitiallyVisible?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class GenerateCaseEvidencesDto {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_GENERATED_EVIDENCE_COUNT)
  @Max(MAX_GENERATED_EVIDENCE_COUNT)
  evidenceCount!: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  culpritSuspectId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  generateSolution?: boolean;
}

export class GenerateCaseStatementsDto {
  @IsUUID()
  culpritSuspectId!: string;
}

export class GenerateCaseContradictionsDto {
  @Transform(({ value }) => trimText(value))
  @IsIn(ADMIN_CASE_DIFFICULTIES)
  difficulty!: AdminCaseDifficulty;

  @IsUUID()
  culpritSuspectId!: string;
}

export class GenerateCaseSolutionDto {
  @IsUUID()
  culpritSuspectId!: string;
}

export class GenerateCaseSolveRequirementsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEmpty()
  readonly __noBodyFieldsAllowed?: never;
}

export class GenerateCaseInvestigationGraphDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEmpty()
  readonly __noBodyFieldsAllowed?: never;
}

export class CreateCaseStatementDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  suspectId?: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  speakerName!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  content!: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDIUM_TEXT_LENGTH)
  context?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isInitiallyVisible?: boolean;
}

export class CreateCaseContradictionDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  suspectId?: string;

  @IsUUID()
  statementId!: string;

  @IsUUID()
  refutingEvidenceId!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  explanation!: string;

  @Transform(({ value }) => trimText(value))
  @IsIn(ADMIN_PROOF_ROLES)
  proves!: AdminProofRole;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isInitiallyVisible?: boolean;
}

export class CreateCaseSolutionDto {
  @IsUUID()
  culpritSuspectId!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  motiveSummary!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  methodSummary!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  opportunitySummary!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  fullExplanation!: string;
}

export class CreateSolveRequirementDto {
  @Transform(({ value }) => trimText(value))
  @IsIn(ADMIN_REQUIREMENT_TYPES)
  requirementType!: AdminRequirementType;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_PROOF_ROLES)
  proofRole?: AdminProofRole;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  requiredSuspectId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  requiredEvidenceId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  requiredContradictionId?: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  description!: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  weight?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isMandatory?: boolean;
}

export class CreateInvestigationActionDto {
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_LONG_TEXT_LENGTH)
  description!: string;

  @Transform(({ value }) => normalizeActionType(value))
  @IsIn(ADMIN_ACTION_TYPES)
  actionType!: AdminActionType;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_SKILL_TYPES)
  requiredSkill?: AdminSkillType;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_SKILL_LEVEL)
  @Max(MAX_SKILL_LEVEL)
  minimumSkillLevel?: number;

  @IsInt()
  @Min(1)
  baseDurationMinutes!: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isInitiallyAvailable?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  requiresDetective?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateEvidenceUnlockRuleDto {
  @IsUUID()
  actionId!: string;

  @IsUUID()
  evidenceId!: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_SKILL_TYPES)
  requiredSkill?: AdminSkillType;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_SKILL_LEVEL)
  @Max(MAX_SKILL_LEVEL)
  minimumSkillLevel?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  durationModifierMinutes?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isGuaranteed?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(MIN_SUCCESS_CHANCE)
  @Max(MAX_SUCCESS_CHANCE)
  successChance?: number;
}

export class CreateStatementUnlockRuleDto {
  @IsUUID()
  actionId!: string;

  @IsUUID()
  statementId!: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_SKILL_TYPES)
  requiredSkill?: AdminSkillType;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_SKILL_LEVEL)
  @Max(MAX_SKILL_LEVEL)
  minimumSkillLevel?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isGuaranteed?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(MIN_SUCCESS_CHANCE)
  @Max(MAX_SUCCESS_CHANCE)
  successChance?: number;
}

export class CreateContradictionUnlockRuleDto {
  @IsUUID()
  actionId!: string;

  @IsUUID()
  contradictionId!: string;

  @Transform(({ value }) => trimText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ADMIN_SKILL_TYPES)
  requiredSkill?: AdminSkillType;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(MIN_SKILL_LEVEL)
  @Max(MAX_SKILL_LEVEL)
  minimumSkillLevel?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isGuaranteed?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(MIN_SUCCESS_CHANCE)
  @Max(MAX_SUCCESS_CHANCE)
  successChance?: number;
}
