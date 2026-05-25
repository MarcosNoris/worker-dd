import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Case } from '../../cases/types/case.types';
import {
  InvestigationStepResult,
  VerdictResult,
} from '../../investigations/types/investigation.types';
import {
  AiContentGenerationResult,
  GeneratedAdminCaseBase,
  GeneratedCaseContradictionsContent,
  GeneratedCaseEvidencesContent,
  GeneratedCaseInvestigationGraphContent,
  GeneratedCaseSolveRequirementsContent,
  GeneratedCaseSolution,
  GeneratedCaseStatementsContent,
  GeneratedCaseSuspectsContent,
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
import { AiPromptFactory } from '../openai-compatible/ai-prompt.factory';
import {
  GeneratedCaseContradictionNormalizer,
  GeneratedCaseContradictionsPayload,
} from '../openai-compatible/generated-case-contradiction.normalizer';
import {
  GeneratedCaseEvidenceNormalizer,
  GeneratedCaseEvidencesPayload,
} from '../openai-compatible/generated-case-evidence.normalizer';
import {
  GeneratedCaseInvestigationGraphNormalizer,
  GeneratedCaseInvestigationGraphPayload,
  InvestigationGraphValidationReport,
} from '../openai-compatible/generated-case-investigation-graph.normalizer';
import {
  GeneratedCaseSolveRequirementNormalizer,
  GeneratedCaseSolveRequirementsPayload,
} from '../openai-compatible/generated-case-solve-requirement.normalizer';
import {
  GeneratedCaseSolutionNormalizer,
  GeneratedCaseSolutionPayload,
} from '../openai-compatible/generated-case-solution.normalizer';
import {
  GeneratedCaseStatementNormalizer,
  GeneratedCaseStatementsPayload,
} from '../openai-compatible/generated-case-statement.normalizer';
import {
  GeneratedCaseSuspectNormalizer,
  GeneratedCaseSuspectsPayload,
} from '../openai-compatible/generated-case-suspect.normalizer';
import {
  GeneratedAdminCaseBaseNormalizer,
  GeneratedAdminCaseBasePayload,
} from '../openai-compatible/generated-admin-case-base.normalizer';
import {
  GeneratedCasePayload,
  GeneratedContentNormalizer,
  GeneratedInvestigationStepPayload,
  GeneratedVerdictPayload,
} from '../openai-compatible/generated-content.normalizer';
import {
  parseJsonObject,
  parseJsonObjectWithRootArrayFallback,
} from '../openai-compatible/json-object.parser';
import { AiTextGenerationClient } from './ai-text-generation-client.service';
import { AiChatMessage } from './ai-text-generation.types';
import { AiPromptRegistryService } from '../openai-compatible/ai-prompt-registry.service';
import {
  AiProviderRotator,
  AiProviderRouteFailure,
} from './ai-provider-rotator.service';
import { AiProviderRoute } from './ai-provider.types';
import { AiContentProvider } from './ai-content-provider.interface';
import { LocalAiContentProvider } from './local-ai-content.provider';

const CASE_MAX_TOKENS = 2200;
const ADMIN_CASE_BASE_MAX_TOKENS = 1100;
const CASE_CONTRADICTIONS_MAX_TOKENS = 3200;
const CASE_EVIDENCES_MAX_TOKENS = 3200;
const CASE_INVESTIGATION_GRAPH_MAX_TOKENS = 5200;
const CASE_INVESTIGATION_GRAPH_REPAIR_MAX_ATTEMPTS = 2;
const CASE_SOLVE_REQUIREMENTS_MAX_TOKENS = 3200;
const CASE_SOLUTION_MAX_TOKENS = 2400;
const CASE_STATEMENTS_MAX_TOKENS = 2800;
const CASE_SUSPECTS_MAX_TOKENS = 2200;
const STEP_MAX_TOKENS = 1100;
const VERDICT_MAX_TOKENS = 800;
const NARRATIVE_TEMPERATURE = 0.75;
const REPAIR_TEMPERATURE = 0.25;

interface RegisteredChatCompletionCommand {
  readonly maxTokens: number;
  readonly messages: readonly AiChatMessage[];
  readonly operation: string;
  readonly route: AiProviderRoute;
  readonly temperature: number;
}

interface InvestigationGraphCandidate {
  readonly content: GeneratedCaseInvestigationGraphContent;
  readonly validationReport: InvestigationGraphValidationReport;
}

interface InvestigationGraphRepairCommand {
  readonly attempt: number;
  readonly input: GenerateCaseInvestigationGraphInput;
  readonly previousPayload: GeneratedCaseInvestigationGraphPayload;
  readonly route: AiProviderRoute;
  readonly validationReport: InvestigationGraphValidationReport;
}

@Injectable()
export class ExternalAiContentProvider implements AiContentProvider {
  private readonly logger = new Logger(ExternalAiContentProvider.name);

  constructor(
    private readonly providerRotator: AiProviderRotator,
    private readonly textGenerationClient: AiTextGenerationClient,
    private readonly promptFactory: AiPromptFactory,
    private readonly promptRegistry: AiPromptRegistryService,
    private readonly adminCaseBaseNormalizer: GeneratedAdminCaseBaseNormalizer,
    private readonly contentNormalizer: GeneratedContentNormalizer,
    private readonly contradictionNormalizer: GeneratedCaseContradictionNormalizer,
    private readonly evidenceNormalizer: GeneratedCaseEvidenceNormalizer,
    private readonly investigationGraphNormalizer: GeneratedCaseInvestigationGraphNormalizer,
    private readonly solveRequirementNormalizer: GeneratedCaseSolveRequirementNormalizer,
    private readonly solutionNormalizer: GeneratedCaseSolutionNormalizer,
    private readonly statementNormalizer: GeneratedCaseStatementNormalizer,
    private readonly suspectNormalizer: GeneratedCaseSuspectNormalizer,
    private readonly localContentProvider: LocalAiContentProvider,
  ) {}

  async generateCase(
    input: GenerateCaseInput,
  ): Promise<AiContentGenerationResult<Case>> {
    const caseData = await this.providerRotator.execute((route) =>
      this.generateCaseWithRoute(route, input),
    );

    return caseData
      ? this.createExternalResult(caseData)
      : this.localContentProvider.generateCase(input);
  }

  async generateAdminCaseBase(
    input: GenerateAdminCaseBaseInput,
  ): Promise<AiContentGenerationResult<GeneratedAdminCaseBase>> {
    try {
      const caseBase = await this.providerRotator.executeOrThrow(
        (route) => this.generateAdminCaseBaseWithRoute(route, input),
        (failure) => this.logAdminCaseBaseRouteFailure(input, failure),
      );

      return this.createExternalResult(caseBase);
    } catch (error: unknown) {
      this.logAdminCaseBaseGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudo generar el caso base con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateCaseEvidences(
    input: GenerateCaseEvidencesInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseEvidencesContent>> {
    const evidences = await this.providerRotator.execute((route) =>
      this.generateCaseEvidencesWithRoute(route, input),
    );

    return evidences
      ? this.createExternalResult(evidences)
      : this.localContentProvider.generateCaseEvidences(input);
  }

  async generateCaseSuspects(
    input: GenerateCaseSuspectsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSuspectsContent>> {
    try {
      const suspects = await this.providerRotator.executeOrThrow(
        (route) => this.generateCaseSuspectsWithRoute(route, input),
        (failure) => this.logCaseSuspectRouteFailure(input, failure),
      );

      return this.createExternalResult(suspects);
    } catch (error: unknown) {
      this.logCaseSuspectGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudieron generar sospechosos con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateCaseContradictions(
    input: GenerateCaseContradictionsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseContradictionsContent>> {
    try {
      const contradictions = await this.providerRotator.executeOrThrow(
        (route) => this.generateCaseContradictionsWithRoute(route, input),
        (failure) => this.logCaseContradictionRouteFailure(input, failure),
      );

      return this.createExternalResult(contradictions);
    } catch (error: unknown) {
      this.logCaseContradictionGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudieron generar contradicciones con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateCaseSolveRequirements(
    input: GenerateCaseSolveRequirementsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSolveRequirementsContent>> {
    try {
      const requirements = await this.providerRotator.executeOrThrow(
        (route) => this.generateCaseSolveRequirementsWithRoute(route, input),
        (failure) => this.logCaseSolveRequirementsRouteFailure(input, failure),
      );

      return this.createExternalResult(requirements);
    } catch (error: unknown) {
      this.logCaseSolveRequirementsGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudieron generar requisitos de resolucion con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateCaseInvestigationGraph(
    input: GenerateCaseInvestigationGraphInput,
  ): Promise<
    AiContentGenerationResult<GeneratedCaseInvestigationGraphContent>
  > {
    try {
      const graph = await this.providerRotator.executeOrThrow(
        (route) => this.generateCaseInvestigationGraphWithRoute(route, input),
        (failure) => this.logCaseInvestigationGraphRouteFailure(input, failure),
      );

      return this.createExternalResult(graph);
    } catch (error: unknown) {
      this.logCaseInvestigationGraphGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudo generar el grafo de investigacion con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateCaseSolution(
    input: GenerateCaseSolutionInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSolution>> {
    try {
      const solution = await this.providerRotator.executeOrThrow(
        (route) => this.generateCaseSolutionWithRoute(route, input),
        (failure) => this.logCaseSolutionRouteFailure(input, failure),
      );

      return this.createExternalResult(solution);
    } catch (error: unknown) {
      this.logCaseSolutionGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudo generar la solucion con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateCaseStatements(
    input: GenerateCaseStatementsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseStatementsContent>> {
    try {
      const statements = await this.providerRotator.executeOrThrow(
        (route) => this.generateCaseStatementsWithRoute(route, input),
        (failure) => this.logCaseStatementRouteFailure(input, failure),
      );

      return this.createExternalResult(statements);
    } catch (error: unknown) {
      this.logCaseStatementGenerationFailure(input, error);
      throw new ServiceUnavailableException(
        `No se pudieron generar declaraciones con IA: ${this.readErrorMessage(error)}`,
      );
    }
  }

  async generateInvestigationStep(
    input: InvestigationStepInput,
  ): Promise<AiContentGenerationResult<InvestigationStepResult>> {
    const step = await this.providerRotator.execute((route) =>
      this.generateInvestigationStepWithRoute(route, input),
    );

    return step
      ? this.createExternalResult(step)
      : this.localContentProvider.generateInvestigationStep(input);
  }

  async generateVerdict(
    input: VerdictInput,
  ): Promise<AiContentGenerationResult<VerdictResult>> {
    const verdict = await this.providerRotator.execute((route) =>
      this.generateVerdictWithRoute(route, input),
    );

    return verdict
      ? this.createExternalResult(verdict)
      : this.localContentProvider.generateVerdict(input);
  }

  private async generateCaseWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseInput,
  ): Promise<Case> {
    const payload = parseJsonObject<GeneratedCasePayload>(
      await this.createRegisteredChatCompletion({
        operation: 'case',
        route,
        messages: this.promptFactory.buildCaseMessages(input),
        maxTokens: CASE_MAX_TOKENS,
        temperature: NARRATIVE_TEMPERATURE,
      }),
    );
    const fallbackCase = (await this.localContentProvider.generateCase(input))
      .content;

    return this.contentNormalizer.createCaseFromPayload(payload, fallbackCase);
  }

  private async generateAdminCaseBaseWithRoute(
    route: AiProviderRoute,
    input: GenerateAdminCaseBaseInput,
  ): Promise<GeneratedAdminCaseBase> {
    const payload = parseJsonObject<GeneratedAdminCaseBasePayload>(
      await this.createRegisteredChatCompletion({
        operation: 'admin-case-base',
        route,
        messages: this.promptFactory.buildAdminCaseBaseMessages(input),
        maxTokens: ADMIN_CASE_BASE_MAX_TOKENS,
        temperature: NARRATIVE_TEMPERATURE,
      }),
    );

    return this.adminCaseBaseNormalizer.createCaseBaseFromPayload(
      payload,
      input,
    );
  }

  private async generateCaseEvidencesWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseEvidencesInput,
  ): Promise<GeneratedCaseEvidencesContent> {
    const payload =
      parseJsonObjectWithRootArrayFallback<GeneratedCaseEvidencesPayload>(
        await this.createRegisteredChatCompletion({
          operation: 'case-evidences',
          route,
          messages: this.promptFactory.buildCaseEvidencesMessages(input),
          maxTokens: CASE_EVIDENCES_MAX_TOKENS,
          temperature: NARRATIVE_TEMPERATURE,
        }),
        'evidences',
      );
    const fallbackEvidences = (
      await this.localContentProvider.generateCaseEvidences(input)
    ).content;

    return this.evidenceNormalizer.createContentFromPayload(
      payload,
      input,
      fallbackEvidences,
    );
  }

  private async generateCaseSuspectsWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseSuspectsInput,
  ): Promise<GeneratedCaseSuspectsContent> {
    const payload =
      parseJsonObjectWithRootArrayFallback<GeneratedCaseSuspectsPayload>(
        await this.createRegisteredChatCompletion({
          operation: 'case-suspects',
          route,
          messages: this.promptFactory.buildCaseSuspectsMessages(input),
          maxTokens: CASE_SUSPECTS_MAX_TOKENS,
          temperature: NARRATIVE_TEMPERATURE,
        }),
        'suspects',
      );

    return this.suspectNormalizer.createContentFromPayload(payload, input);
  }

  private async generateCaseContradictionsWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseContradictionsInput,
  ): Promise<GeneratedCaseContradictionsContent> {
    const payload =
      parseJsonObjectWithRootArrayFallback<GeneratedCaseContradictionsPayload>(
        await this.createRegisteredChatCompletion({
          operation: 'case-contradictions',
          route,
          messages: this.promptFactory.buildCaseContradictionsMessages(input),
          maxTokens: CASE_CONTRADICTIONS_MAX_TOKENS,
          temperature: NARRATIVE_TEMPERATURE,
        }),
        'contradictions',
      );

    return this.contradictionNormalizer.createContentFromPayload(
      payload,
      input,
    );
  }

  private async generateCaseSolveRequirementsWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseSolveRequirementsInput,
  ): Promise<GeneratedCaseSolveRequirementsContent> {
    const payload =
      parseJsonObjectWithRootArrayFallback<GeneratedCaseSolveRequirementsPayload>(
        await this.createRegisteredChatCompletion({
          operation: 'case-solve-requirements',
          route,
          messages:
            this.promptFactory.buildCaseSolveRequirementsMessages(input),
          maxTokens: CASE_SOLVE_REQUIREMENTS_MAX_TOKENS,
          temperature: NARRATIVE_TEMPERATURE,
        }),
        'solveRequirements',
      );

    return this.solveRequirementNormalizer.createContentFromPayload(
      payload,
      input,
    );
  }

  private async generateCaseInvestigationGraphWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseInvestigationGraphInput,
  ): Promise<GeneratedCaseInvestigationGraphContent> {
    let payload = await this.createCaseInvestigationGraphPayload(route, input);
    let repairAttempt = 0;

    while (true) {
      const candidate = this.createInvestigationGraphCandidate(payload, input);

      if (candidate.validationReport.isValid) {
        return candidate.content;
      }

      if (repairAttempt >= CASE_INVESTIGATION_GRAPH_REPAIR_MAX_ATTEMPTS) {
        this.investigationGraphNormalizer.assertValidContent(
          candidate.content,
          input,
        );

        return candidate.content;
      }

      repairAttempt += 1;
      this.logCaseInvestigationGraphRepairAttempt(
        input,
        route,
        repairAttempt,
        candidate.validationReport,
      );
      payload = await this.createCaseInvestigationGraphRepairPayload({
        attempt: repairAttempt,
        input,
        previousPayload: payload,
        route,
        validationReport: candidate.validationReport,
      });
    }
  }

  private async createCaseInvestigationGraphPayload(
    route: AiProviderRoute,
    input: GenerateCaseInvestigationGraphInput,
  ): Promise<GeneratedCaseInvestigationGraphPayload> {
    return parseJsonObject<GeneratedCaseInvestigationGraphPayload>(
      await this.createRegisteredChatCompletion({
        operation: 'case-investigation-graph',
        route,
        messages: this.promptFactory.buildCaseInvestigationGraphMessages(input),
        maxTokens: CASE_INVESTIGATION_GRAPH_MAX_TOKENS,
        temperature: NARRATIVE_TEMPERATURE,
      }),
    );
  }

  private async createCaseInvestigationGraphRepairPayload(
    command: InvestigationGraphRepairCommand,
  ): Promise<GeneratedCaseInvestigationGraphPayload> {
    return parseJsonObject<GeneratedCaseInvestigationGraphPayload>(
      await this.createRegisteredChatCompletion({
        operation: 'case-investigation-graph-repair',
        route: command.route,
        messages: this.promptFactory.buildCaseInvestigationGraphRepairMessages({
          attempt: command.attempt,
          input: command.input,
          maxAttempts: CASE_INVESTIGATION_GRAPH_REPAIR_MAX_ATTEMPTS,
          previousPayload: command.previousPayload,
          validationReport: command.validationReport,
        }),
        maxTokens: CASE_INVESTIGATION_GRAPH_MAX_TOKENS,
        temperature: REPAIR_TEMPERATURE,
      }),
    );
  }

  private createInvestigationGraphCandidate(
    payload: GeneratedCaseInvestigationGraphPayload,
    input: GenerateCaseInvestigationGraphInput,
  ): InvestigationGraphCandidate {
    const content =
      this.investigationGraphNormalizer.createNormalizedContentFromPayload(
        payload,
        input,
      );

    return {
      content,
      validationReport: this.investigationGraphNormalizer.validateContent(
        content,
        input,
      ),
    };
  }

  private async generateCaseSolutionWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseSolutionInput,
  ): Promise<GeneratedCaseSolution> {
    const payload = parseJsonObject<GeneratedCaseSolutionPayload>(
      await this.createRegisteredChatCompletion({
        operation: 'case-solution',
        route,
        messages: this.promptFactory.buildCaseSolutionMessages(input),
        maxTokens: CASE_SOLUTION_MAX_TOKENS,
        temperature: NARRATIVE_TEMPERATURE,
      }),
    );

    return this.solutionNormalizer.createSolutionFromPayload(payload, input);
  }

  private async generateCaseStatementsWithRoute(
    route: AiProviderRoute,
    input: GenerateCaseStatementsInput,
  ): Promise<GeneratedCaseStatementsContent> {
    const payload =
      parseJsonObjectWithRootArrayFallback<GeneratedCaseStatementsPayload>(
        await this.createRegisteredChatCompletion({
          operation: 'case-statements',
          route,
          messages: this.promptFactory.buildCaseStatementsMessages(input),
          maxTokens: CASE_STATEMENTS_MAX_TOKENS,
          temperature: NARRATIVE_TEMPERATURE,
        }),
        'statements',
      );

    return this.statementNormalizer.createContentFromPayload(payload, input);
  }

  private async generateInvestigationStepWithRoute(
    route: AiProviderRoute,
    input: InvestigationStepInput,
  ): Promise<InvestigationStepResult> {
    const payload = parseJsonObject<GeneratedInvestigationStepPayload>(
      await this.createRegisteredChatCompletion({
        operation: 'investigation-step',
        route,
        messages: this.promptFactory.buildInvestigationStepMessages(input),
        maxTokens: STEP_MAX_TOKENS,
        temperature: NARRATIVE_TEMPERATURE,
      }),
    );
    const fallbackStep = (
      await this.localContentProvider.generateInvestigationStep(input)
    ).content;

    return this.contentNormalizer.createInvestigationStepFromPayload(
      payload,
      input,
      fallbackStep,
    );
  }

  private async generateVerdictWithRoute(
    route: AiProviderRoute,
    input: VerdictInput,
  ): Promise<VerdictResult> {
    const payload = parseJsonObject<GeneratedVerdictPayload>(
      await this.createRegisteredChatCompletion({
        operation: 'verdict',
        route,
        messages: this.promptFactory.buildVerdictMessages(input),
        maxTokens: VERDICT_MAX_TOKENS,
        temperature: NARRATIVE_TEMPERATURE,
      }),
    );
    const fallbackVerdict = (
      await this.localContentProvider.generateVerdict(input)
    ).content;

    return this.contentNormalizer.createVerdictFromPayload(
      payload,
      fallbackVerdict,
    );
  }

  private async createRegisteredChatCompletion(
    command: RegisteredChatCompletionCommand,
  ): Promise<string> {
    const registryEntry = await this.promptRegistry.savePrompt(command);
    const responseText = await this.textGenerationClient.createTextCompletion(
      command.route,
      {
        messages: command.messages,
        maxTokens: command.maxTokens,
        temperature: command.temperature,
      },
    );

    await this.promptRegistry.saveResponse(registryEntry, responseText);

    return responseText;
  }

  private createExternalResult<TContent>(
    content: TContent,
  ): AiContentGenerationResult<TContent> {
    return {
      content,
      usedFallback: false,
    };
  }

  private logCaseStatementRouteFailure(
    input: GenerateCaseStatementsInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI statement route failed for case ${input.caseData.id} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logCaseSuspectRouteFailure(
    input: GenerateCaseSuspectsInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI suspect route failed for case ${input.caseData.id} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logAdminCaseBaseRouteFailure(
    input: GenerateAdminCaseBaseInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI admin case base route failed for difficulty ${input.difficulty} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logCaseContradictionRouteFailure(
    input: GenerateCaseContradictionsInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI contradiction route failed for case ${input.caseData.id} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logCaseSolutionRouteFailure(
    input: GenerateCaseSolutionInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI solution route failed for case ${input.caseData.id} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logCaseInvestigationGraphRouteFailure(
    input: GenerateCaseInvestigationGraphInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI investigation graph route failed for case ${input.caseData.id} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logCaseInvestigationGraphRepairAttempt(
    input: GenerateCaseInvestigationGraphInput,
    route: AiProviderRoute,
    attempt: number,
    validationReport: InvestigationGraphValidationReport,
  ): void {
    this.logger.warn(
      `AI investigation graph repair ${attempt}/${CASE_INVESTIGATION_GRAPH_REPAIR_MAX_ATTEMPTS} for case ${input.caseData.id} using ${route.provider}/${route.model}: ${this.formatValidationIssues(validationReport)}`,
    );
  }

  private logCaseSolveRequirementsRouteFailure(
    input: GenerateCaseSolveRequirementsInput,
    failure: AiProviderRouteFailure,
  ): void {
    this.logger.warn(
      `AI solve requirements route failed for case ${input.caseData.id} using ${failure.route.provider}/${failure.route.model}: ${this.readErrorMessage(failure.error)}`,
    );
  }

  private logCaseContradictionGenerationFailure(
    input: GenerateCaseContradictionsInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI contradiction generation failed for case ${input.caseData.id}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private logAdminCaseBaseGenerationFailure(
    input: GenerateAdminCaseBaseInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI admin case base generation failed for difficulty ${input.difficulty}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private logCaseSolveRequirementsGenerationFailure(
    input: GenerateCaseSolveRequirementsInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI solve requirements generation failed for case ${input.caseData.id}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private logCaseInvestigationGraphGenerationFailure(
    input: GenerateCaseInvestigationGraphInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI investigation graph generation failed for case ${input.caseData.id}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private logCaseSolutionGenerationFailure(
    input: GenerateCaseSolutionInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI solution generation failed for case ${input.caseData.id}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private logCaseStatementGenerationFailure(
    input: GenerateCaseStatementsInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI statement generation failed for case ${input.caseData.id}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private logCaseSuspectGenerationFailure(
    input: GenerateCaseSuspectsInput,
    error: unknown,
  ): void {
    this.logger.error(
      `AI suspect generation failed for case ${input.caseData.id}: ${this.readErrorMessage(error)}`,
      this.readErrorStack(error),
    );
  }

  private readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido de IA';
  }

  private formatValidationIssues(
    validationReport: InvestigationGraphValidationReport,
  ): string {
    return validationReport.issues
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join(' | ');
  }

  private readErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
