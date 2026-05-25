import { Case } from '../../cases/types/case.types';
import {
  InvestigationStepResult,
  VerdictResult,
} from '../../investigations/types/investigation.types';
import {
  AiContentGenerationResult,
  GeneratedCaseContradictionsContent,
  GeneratedCaseEvidencesContent,
  GeneratedCaseInvestigationGraphContent,
  GeneratedCaseSolveRequirementsContent,
  GeneratedCaseSolution,
  GeneratedCaseStatementsContent,
  GeneratedCaseSuspectsContent,
  GeneratedAdminCaseBase,
  GenerateAdminCaseBaseInput,
  GenerateCaseContradictionsInput,
  GenerateCaseInput,
  GenerateCaseEvidencesInput,
  GenerateCaseInvestigationGraphInput,
  GenerateCaseSolveRequirementsInput,
  GenerateCaseSolutionInput,
  GenerateCaseStatementsInput,
  GenerateCaseSuspectsInput,
  InvestigationStepInput,
  VerdictInput,
} from '../types/ai.types';

export const AI_CONTENT_PROVIDER = Symbol('AI_CONTENT_PROVIDER');

export interface AiContentProvider {
  generateCase(
    input: GenerateCaseInput,
  ): Promise<AiContentGenerationResult<Case>>;

  generateAdminCaseBase(
    input: GenerateAdminCaseBaseInput,
  ): Promise<AiContentGenerationResult<GeneratedAdminCaseBase>>;

  generateCaseEvidences(
    input: GenerateCaseEvidencesInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseEvidencesContent>>;

  generateCaseSuspects(
    input: GenerateCaseSuspectsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSuspectsContent>>;

  generateCaseContradictions(
    input: GenerateCaseContradictionsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseContradictionsContent>>;

  generateCaseSolveRequirements(
    input: GenerateCaseSolveRequirementsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSolveRequirementsContent>>;

  generateCaseInvestigationGraph(
    input: GenerateCaseInvestigationGraphInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseInvestigationGraphContent>>;

  generateCaseSolution(
    input: GenerateCaseSolutionInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSolution>>;

  generateCaseStatements(
    input: GenerateCaseStatementsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseStatementsContent>>;

  generateInvestigationStep(
    input: InvestigationStepInput,
  ): Promise<AiContentGenerationResult<InvestigationStepResult>>;

  generateVerdict(
    input: VerdictInput,
  ): Promise<AiContentGenerationResult<VerdictResult>>;
}
