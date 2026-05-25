import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CASE_CATEGORIES,
  CASE_SEVERITIES,
  CASE_STATUSES,
  CLUE_CATEGORIES,
  DETECTIVE_RANKS,
  LOG_ENTRY_TYPES,
  SUSPECT_STATUSES,
} from '../../../shared/constants/domain.constants';
import {
  CaseCategory,
  CaseSeverity,
  CaseStatus,
  ClueCategory,
  DetectiveRank,
  LogEntryType,
  SuspectStatus,
} from '../types/case.types';

export class DetectiveDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  badgeNumber!: string;

  @IsIn(DETECTIVE_RANKS)
  rank!: DetectiveRank;

  @IsString()
  specialty!: string;

  @IsString()
  avatarColor!: string;

  @IsOptional()
  @IsString()
  activeCaseId!: string | null;

  @IsInt()
  @Min(0)
  casesCompleted!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  efficiency!: number;

  @IsString()
  bio!: string;
}

export class SuspectDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(SUSPECT_STATUSES)
  status!: SuspectStatus;

  @IsInt()
  @Min(0)
  age!: number;

  @IsString()
  occupation!: string;

  @IsString()
  alibi!: string;

  @IsString()
  relationToCase!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClueDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsIn(CLUE_CATEGORIES)
  category!: ClueCategory;

  @IsString()
  dateFound!: string;

  @IsIn(CASE_SEVERITIES)
  relevance!: CaseSeverity;
}

export class LogEntryDto {
  @IsString()
  id!: string;

  @IsString()
  timestamp!: string;

  @IsString()
  title!: string;

  @IsString()
  text!: string;

  @IsIn(LOG_ENTRY_TYPES)
  type!: LogEntryType;
}

export class CaseDto {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  codeName!: string;

  @IsString()
  description!: string;

  @IsIn(CASE_CATEGORIES)
  category!: CaseCategory;

  @IsIn(CASE_SEVERITIES)
  severity!: CaseSeverity;

  @IsIn(CASE_STATUSES)
  status!: CaseStatus;

  @IsString()
  location!: string;

  @IsString()
  dateCreated!: string;

  @IsOptional()
  @IsString()
  assignedDetectiveId!: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuspectDto)
  suspects!: SuspectDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClueDto)
  clues!: ClueDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LogEntryDto)
  logs!: LogEntryDto[];

  @IsOptional()
  @IsString()
  resolutionDetails?: string;

  @IsOptional()
  @IsString()
  culpritId?: string;
}
