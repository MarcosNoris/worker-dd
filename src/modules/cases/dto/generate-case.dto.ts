import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  CASE_CATEGORIES,
  CASE_SEVERITIES,
} from '../../../shared/constants/domain.constants';
import { CaseCategory, CaseSeverity } from '../types/case.types';

export class GenerateCaseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  theme!: string;

  @IsIn(CASE_CATEGORIES)
  category!: CaseCategory;

  @IsIn(CASE_SEVERITIES)
  severity!: CaseSeverity;
}
