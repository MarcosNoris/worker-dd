import { Inject, Injectable } from '@nestjs/common';
import { AiDetectiveProfileService } from './openai-compatible/ai-detective-profile.service';
import {
  AI_CONTENT_PROVIDER,
  AiContentProvider,
} from './providers/ai-content-provider.interface';
import {
  GenerateDetectiveProfileInput,
  GeneratedDetectiveProfile,
  GenerateAdminCaseBaseInput,
  GenerateAdminCaseBaseResult,
  GenerateCaseContradictionsInput,
  GenerateCaseContradictionsResult,
  GenerateCaseInput,
  GenerateCaseEvidencesInput,
  GenerateCaseEvidencesResult,
  GenerateCaseInvestigationGraphInput,
  GenerateCaseInvestigationGraphResult,
  GenerateCaseResult,
  GenerateCaseSolveRequirementsInput,
  GenerateCaseSolveRequirementsResult,
  GenerateCaseSolutionInput,
  GenerateCaseSolutionResult,
  GenerateCaseStatementsInput,
  GenerateCaseStatementsResult,
  GenerateCaseSuspectsInput,
  GenerateCaseSuspectsResult,
  InvestigationStepGenerationResult,
  InvestigationStepInput,
  VerdictGenerationResult,
  VerdictInput,
} from './types/ai.types';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_CONTENT_PROVIDER)
    private readonly contentProvider: AiContentProvider,
    private readonly detectiveProfileService: AiDetectiveProfileService,
  ) {}

  async generateCase(input: GenerateCaseInput): Promise<GenerateCaseResult> {
    const generation = await this.contentProvider.generateCase(input);

    return {
      caseData: generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateAdminCaseBase(
    input: GenerateAdminCaseBaseInput,
  ): Promise<GenerateAdminCaseBaseResult> {
    const generation = await this.contentProvider.generateAdminCaseBase(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseEvidences(
    input: GenerateCaseEvidencesInput,
  ): Promise<GenerateCaseEvidencesResult> {
    const generation = await this.contentProvider.generateCaseEvidences(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseSuspects(
    input: GenerateCaseSuspectsInput,
  ): Promise<GenerateCaseSuspectsResult> {
    const generation = await this.contentProvider.generateCaseSuspects(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseContradictions(
    input: GenerateCaseContradictionsInput,
  ): Promise<GenerateCaseContradictionsResult> {
    const generation =
      await this.contentProvider.generateCaseContradictions(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseSolveRequirements(
    input: GenerateCaseSolveRequirementsInput,
  ): Promise<GenerateCaseSolveRequirementsResult> {
    const generation =
      await this.contentProvider.generateCaseSolveRequirements(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseInvestigationGraph(
    input: GenerateCaseInvestigationGraphInput,
  ): Promise<GenerateCaseInvestigationGraphResult> {
    const generation =
      await this.contentProvider.generateCaseInvestigationGraph(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseSolution(
    input: GenerateCaseSolutionInput,
  ): Promise<GenerateCaseSolutionResult> {
    const generation = await this.contentProvider.generateCaseSolution(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateCaseStatements(
    input: GenerateCaseStatementsInput,
  ): Promise<GenerateCaseStatementsResult> {
    const generation = await this.contentProvider.generateCaseStatements(input);

    return {
      ...generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateInvestigationStep(
    input: InvestigationStepInput,
  ): Promise<InvestigationStepGenerationResult> {
    const generation =
      await this.contentProvider.generateInvestigationStep(input);

    return {
      step: generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  async generateVerdict(input: VerdictInput): Promise<VerdictGenerationResult> {
    const generation = await this.contentProvider.generateVerdict(input);

    return {
      result: generation.content,
      usedFallback: generation.usedFallback,
    };
  }

  generateDetectiveProfile(
    input: GenerateDetectiveProfileInput,
  ): Promise<GeneratedDetectiveProfile> {
    return this.detectiveProfileService.generateDetectiveProfile(input);
  }
}
