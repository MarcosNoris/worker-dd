import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  GeneratedAdminCaseBase,
  GenerateCaseContradictionsInput,
  GenerateCaseEvidencesInput,
  GenerateCaseEvidencesResult,
  GenerateCaseInvestigationGraphInput,
  GenerateCaseInvestigationGraphResult,
  GenerateCaseSolveRequirementsInput,
  GenerateCaseSolutionInput,
  GenerateCaseStatementsInput,
  GenerateCaseSuspectsInput,
} from '../ai/types/ai.types';
import { CasePlayabilityValidator } from './case-playability.validator';
import {
  ADMIN_CASE_DIFFICULTIES,
  AdminCaseDifficulty,
} from './constants/admin-case.constants';
import {
  AdminActionPrerequisiteRecord,
  AdminCaseRecord,
  AdminCaseSolutionRecord,
  AdminContradictionRecord,
  AdminContradictionUnlockRuleRecord,
  AdminEvidenceRecord,
  AdminEvidenceUnlockRuleRecord,
  AdminInvestigationActionRecord,
  AdminSolveRequirementRecord,
  AdminStatementRecord,
  AdminStatementUnlockRuleRecord,
  AdminSuspectRecord,
  CasePlayabilitySnapshot,
  CasesRepository,
  CreateInvestigationGraphRecordCommand,
  CreatedInvestigationGraphRecord,
} from './cases.repository';
import {
  CreateAiCaseDto,
  CreateCaseContradictionDto,
  CreateCaseEvidenceDto,
  CreateCaseSolutionDto,
  CreateCaseStatementDto,
  CreateCaseSuspectDto,
  CreateContradictionUnlockRuleDto,
  CreateEvidenceUnlockRuleDto,
  CreateInvestigationActionDto,
  CreateManualCaseDto,
  CreateSolveRequirementDto,
  CreateStatementUnlockRuleDto,
  GenerateCaseContradictionsDto,
  GenerateCaseEvidencesDto,
  GenerateCaseInvestigationGraphDto,
  GenerateCaseSolveRequirementsDto,
  GenerateCaseSolutionDto,
  GenerateCaseStatementsDto,
  GenerateCaseSuspectsDto,
} from './dto/admin-case.dto';
import {
  AdminCaseContradictionsResponseDto,
  createAdminCaseContradictionsResponse,
} from './dto/admin-case-contradictions.dto';
import {
  AdminCaseEvidenceDto,
  AdminCaseEvidencesResponseDto,
  createAdminCaseEvidencesResponse,
} from './dto/admin-case-evidences.dto';
import {
  AdminCaseInvestigationGraphResponseDto,
  createAdminCaseInvestigationGraphResponse,
} from './dto/admin-case-investigation-graph.dto';
import {
  AdminCaseStateResponseDto,
  createAdminCaseStateResponse,
} from './dto/admin-case-state.dto';
import {
  AdminCasesListQueryDto,
  AdminCasesListResponseDto,
  createAdminCasesListResponse,
} from './dto/admin-cases-list.dto';
import {
  CaseRequirementsResponseDto,
  createCaseRequirementsResponse,
} from './dto/case-requirements.dto';
import {
  CaseSuspectsResponseDto,
  createCaseSuspectsResponse,
} from './dto/case-suspects.dto';
import {
  CaseSolutionResponseDto,
  createCaseSolutionResponse,
} from './dto/case-solution.dto';
import { GenerateCaseDto } from './dto/generate-case.dto';
import { GenerateCaseResponse } from './types/case-response.types';

const AI_CASE_FORBIDDEN_TITLE_LIMIT = 500;
const AI_CASE_DIFFICULTY_WEIGHTS = [
  { difficulty: 'easy', weight: 30 },
  { difficulty: 'medium', weight: 45 },
  { difficulty: 'hard', weight: 20 },
  { difficulty: 'expert', weight: 5 },
] as const satisfies readonly {
  readonly difficulty: AdminCaseDifficulty;
  readonly weight: number;
}[];
const TOTAL_AI_CASE_DIFFICULTY_WEIGHT = AI_CASE_DIFFICULTY_WEIGHTS.reduce(
  (totalWeight, item) => totalWeight + item.weight,
  0,
);
const GENERATED_SUSPECT_COUNT_BY_DIFFICULTY = {
  easy: 2,
  medium: 3,
  hard: 4,
  expert: 5,
} as const satisfies Record<AdminCaseDifficulty, number>;
const PLAYER_VISIBLE_CASE_STATUS = 'playable';

export interface AdminMutationResponse<TData> {
  readonly data: TData;
  readonly success: true;
}

interface CreateManualCaseCommand {
  readonly dto: CreateManualCaseDto;
  readonly userId: string;
}

interface CreateAiGeneratedCaseCommand {
  readonly dto: CreateAiCaseDto;
  readonly userId: string;
}

type DifficultySource = 'random' | 'request';

interface ResolvedCaseDifficulty {
  readonly difficulty: AdminCaseDifficulty;
  readonly source: DifficultySource;
}

export interface RandomPlayableCaseBaseQuery {
  readonly departmentId: string;
  readonly difficulty: AdminCaseDifficulty;
}

export interface GeneratedCaseEvidencesResponse {
  readonly evidences: readonly AdminCaseEvidenceDto[];
  readonly selectedCulpritSuspectId: string;
  readonly usedFallback: boolean;
}

export interface GeneratedCaseSuspectsResponse {
  readonly difficulty: AdminCaseDifficulty;
  readonly suspectCount: number;
  readonly suspects: readonly AdminSuspectRecord[];
  readonly usedFallback: boolean;
}

export interface GeneratedCaseStatementsResponse {
  readonly culpritSuspectId: string;
  readonly statements: readonly AdminStatementRecord[];
  readonly usedFallback: boolean;
}

export interface GeneratedCaseContradictionsResponse {
  readonly contradictions: readonly AdminContradictionRecord[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly usedFallback: boolean;
}

export interface GeneratedCaseSolutionResponse {
  readonly culpritSuspectId: string;
  readonly solution: AdminCaseSolutionRecord;
  readonly usedFallback: boolean;
}

export interface GeneratedCaseSolveRequirementsResponse {
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly requirements: readonly AdminSolveRequirementRecord[];
  readonly usedFallback: boolean;
}

export interface GeneratedCaseInvestigationGraphResponse {
  readonly actionPrerequisites: readonly AdminActionPrerequisiteRecord[];
  readonly actions: readonly AdminInvestigationActionRecord[];
  readonly contradictionUnlockRules: readonly AdminContradictionUnlockRuleRecord[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly evidenceUnlockRules: readonly AdminEvidenceUnlockRuleRecord[];
  readonly statementUnlockRules: readonly AdminStatementUnlockRuleRecord[];
  readonly usedFallback: boolean;
}

interface CaseEvidenceGenerationContext {
  readonly caseRecord: AdminCaseRecord;
  readonly suspects: readonly AdminSuspectRecord[];
}

interface CaseSuspectGenerationContext {
  readonly caseRecord: AdminCaseRecord;
  readonly suspects: readonly AdminSuspectRecord[];
}

interface CaseStatementGenerationContext {
  readonly caseRecord: AdminCaseRecord;
  readonly evidences: readonly AdminEvidenceRecord[];
  readonly statements: readonly AdminStatementRecord[];
  readonly suspects: readonly AdminSuspectRecord[];
}

interface CaseContradictionGenerationContext {
  readonly caseRecord: AdminCaseRecord;
  readonly contradictions: readonly AdminContradictionRecord[];
  readonly evidences: readonly AdminEvidenceRecord[];
  readonly statements: readonly AdminStatementRecord[];
  readonly suspects: readonly AdminSuspectRecord[];
}

interface CaseSolutionGenerationContext {
  readonly caseRecord: AdminCaseRecord;
  readonly contradictions: readonly AdminContradictionRecord[];
  readonly evidences: readonly AdminEvidenceRecord[];
  readonly solution?: AdminCaseSolutionRecord;
  readonly statements: readonly AdminStatementRecord[];
  readonly suspects: readonly AdminSuspectRecord[];
}

interface ResolveSelectedCulpritCommand {
  readonly dto: GenerateCaseEvidencesDto;
  readonly generation: GenerateCaseEvidencesResult;
  readonly suspects: readonly AdminSuspectRecord[];
}

@Injectable()
export class CasesService {
  constructor(
    private readonly aiService: AiService,
    private readonly casesRepository: CasesRepository,
    private readonly casePlayabilityValidator: CasePlayabilityValidator,
  ) {}

  async generateCase(dto: GenerateCaseDto): Promise<GenerateCaseResponse> {
    const generatedCase = await this.aiService.generateCase({
      theme: dto.theme.trim(),
      category: dto.category,
      severity: dto.severity,
    });

    return {
      success: true,
      case: generatedCase.caseData,
      alertMessage: this.buildAlertMessage(generatedCase.usedFallback),
    };
  }

  private buildAlertMessage(usedFallback: boolean): string | undefined {
    return usedFallback
      ? 'Caso generado en modo demo local porque no hay un proveedor externo de IA configurado.'
      : undefined;
  }

  async getRandomPlayableCaseBase(
    query: RandomPlayableCaseBaseQuery,
  ): Promise<AdminCaseRecord | undefined> {
    return this.casesRepository.findRandomPlayableCaseBase(query);
  }

  async getAdminCases(
    query: AdminCasesListQueryDto,
  ): Promise<AdminCasesListResponseDto> {
    const page = await this.casesRepository.findAdminCases({
      limit: query.limit,
      page: query.page,
      sort: query.sort,
      status: query.status,
    });

    return createAdminCasesListResponse({
      cases: page.cases,
      query,
      total: page.total,
    });
  }

  async getCaseSuspects(caseId: string): Promise<CaseSuspectsResponseDto> {
    await this.ensurePlayerVisibleCaseExists(caseId);

    const [suspects, statements] = await Promise.all([
      this.casesRepository.findSuspectsByCase(caseId),
      this.casesRepository.findInitialStatementsByCase(caseId),
    ]);

    return createCaseSuspectsResponse({ statements, suspects });
  }

  async getAdminCaseSuspects(caseId: string): Promise<CaseSuspectsResponseDto> {
    await this.ensureCaseExists(caseId);

    const [suspects, statements] = await Promise.all([
      this.casesRepository.findSuspectsByCase(caseId),
      this.casesRepository.findStatementsByCase(caseId),
    ]);

    return createCaseSuspectsResponse({ statements, suspects });
  }

  async getCaseSolution(caseId: string): Promise<CaseSolutionResponseDto> {
    await this.ensureCaseExists(caseId);

    const solution = await this.casesRepository.findSolutionByCase(caseId);

    if (!solution) {
      throw new NotFoundException('No se encontro la solucion del caso.');
    }

    return createCaseSolutionResponse(solution);
  }

  async getCaseRequirements(
    caseId: string,
  ): Promise<CaseRequirementsResponseDto> {
    await this.ensureCaseExists(caseId);

    const requirements =
      await this.casesRepository.findRequirementsByCase(caseId);

    return createCaseRequirementsResponse(requirements);
  }

  async getAdminCaseEvidences(
    caseId: string,
  ): Promise<AdminCaseEvidencesResponseDto> {
    await this.ensureCaseExists(caseId);

    const evidences = await this.casesRepository.findEvidencesByCase(caseId);

    return createAdminCaseEvidencesResponse(evidences);
  }

  async getAdminCaseContradictions(
    caseId: string,
  ): Promise<AdminCaseContradictionsResponseDto> {
    await this.ensureCaseExists(caseId);

    const contradictions =
      await this.casesRepository.findContradictionsByCase(caseId);

    return createAdminCaseContradictionsResponse(contradictions);
  }

  async getAdminCaseState(caseId: string): Promise<AdminCaseStateResponseDto> {
    const snapshot = await this.casesRepository.findPlayabilitySnapshot(caseId);

    if (!snapshot) {
      throw new NotFoundException('No se encontro el caso.');
    }

    const validation = this.casePlayabilityValidator.validate(snapshot);

    return createAdminCaseStateResponse(snapshot, validation);
  }

  async getAdminCaseInvestigationGraph(
    caseId: string,
  ): Promise<AdminCaseInvestigationGraphResponseDto> {
    const snapshot = await this.casesRepository.findPlayabilitySnapshot(caseId);

    if (!snapshot) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return createAdminCaseInvestigationGraphResponse(snapshot);
  }

  async createManualCase(
    command: CreateManualCaseCommand,
  ): Promise<AdminMutationResponse<AdminCaseRecord>> {
    const createdCase = await this.casesRepository.createManualCase({
      aiGenerationMetadata: command.dto.aiGenerationMetadata,
      aiModel: command.dto.aiModel,
      createdBy: command.userId,
      difficulty: command.dto.difficulty,
      generationPrompt: command.dto.generationPrompt,
      publicBriefing: command.dto.publicBriefing,
      summary: command.dto.summary,
      title: command.dto.title,
      victimName: command.dto.victimName,
    });

    return this.createMutationResponse(createdCase);
  }

  async createAiGeneratedCase(
    command: CreateAiGeneratedCaseCommand,
  ): Promise<AdminMutationResponse<AdminCaseRecord>> {
    const theme = this.normalizeOptionalText(command.dto.theme);
    const resolvedDifficulty = this.resolveAiCaseDifficulty(
      command.dto.difficulty,
    );
    const forbiddenTitles = await this.casesRepository.findRecentCaseTitles(
      AI_CASE_FORBIDDEN_TITLE_LIMIT,
    );
    const generatedCase = await this.aiService.generateAdminCaseBase({
      difficulty: resolvedDifficulty.difficulty,
      forbiddenTitles,
      theme,
    });

    this.ensureGeneratedTitleIsAllowed(generatedCase, forbiddenTitles);

    const createdCase = await this.casesRepository.createAiGeneratedCase({
      aiGenerationMetadata: this.createAiCaseGenerationMetadata({
        difficultySource: resolvedDifficulty.source,
        forbiddenTitles,
        theme,
      }),
      createdBy: command.userId,
      difficulty: generatedCase.difficulty,
      generationPrompt: theme,
      publicBriefing: generatedCase.publicBriefing,
      summary: generatedCase.summary,
      title: generatedCase.title,
      victimName: generatedCase.victimName,
    });

    return this.createMutationResponse(createdCase);
  }

  async addSuspect(
    caseId: string,
    dto: CreateCaseSuspectDto,
  ): Promise<AdminMutationResponse<AdminSuspectRecord>> {
    await this.ensureCaseExists(caseId);

    const suspect = await this.casesRepository.createSuspect({
      age: dto.age,
      background: dto.background,
      caseId,
      name: dto.name,
      occupation: dto.occupation,
      personality: dto.personality,
      publicNotes: dto.publicNotes,
      relationshipToVictim: dto.relationshipToVictim,
    });

    return this.createMutationResponse(suspect);
  }

  async generateCaseSuspects(
    caseId: string,
    dto?: GenerateCaseSuspectsDto,
  ): Promise<AdminMutationResponse<GeneratedCaseSuspectsResponse>> {
    const context = await this.getSuspectGenerationContext(caseId);
    const difficulty = this.readCaseDifficulty(context.caseRecord.difficulty);
    const suspectCount = this.resolveGeneratedSuspectCount(difficulty, dto);

    this.ensureCaseHasNoSuspects(context.suspects);

    const generation = await this.aiService.generateCaseSuspects(
      this.createSuspectGenerationInput({
        caseRecord: context.caseRecord,
        difficulty,
        suspectCount,
      }),
    );
    const suspects = await this.casesRepository.createSuspects(
      generation.suspects.map((suspect) => ({
        ...suspect,
        caseId,
      })),
    );

    return this.createMutationResponse({
      difficulty,
      suspectCount,
      suspects,
      usedFallback: generation.usedFallback,
    });
  }

  async addEvidence(
    caseId: string,
    dto: CreateCaseEvidenceDto,
  ): Promise<AdminMutationResponse<AdminEvidenceRecord>> {
    await this.ensureCaseExists(caseId);

    const evidence = await this.casesRepository.createEvidence({
      caseId,
      description: dto.description,
      discoveryHint: dto.discoveryHint,
      importance: dto.importance,
      isDecoy: dto.isDecoy,
      isInitiallyVisible: dto.isInitiallyVisible,
      location: dto.location,
      metadata: dto.metadata,
      title: dto.title,
      type: dto.type,
      weight: dto.weight,
    });

    return this.createMutationResponse(evidence);
  }

  async generateCaseEvidences(
    caseId: string,
    dto: GenerateCaseEvidencesDto,
  ): Promise<AdminMutationResponse<GeneratedCaseEvidencesResponse>> {
    const context = await this.getEvidenceGenerationContext(caseId);
    this.ensureCaseHasSuspects(context.suspects);
    this.ensureRequestedCulpritBelongsToCase(
      context.suspects,
      dto.culpritSuspectId,
    );
    this.ensureEvidenceGenerationDoesNotRequestSolution(dto.generateSolution);

    const generation = await this.aiService.generateCaseEvidences(
      this.createEvidenceGenerationInput(context, dto),
    );
    const selectedCulpritSuspectId = this.resolveSelectedCulpritSuspectId({
      dto,
      generation,
      suspects: context.suspects,
    });

    const evidences = await this.casesRepository.createEvidences(
      generation.evidences.map((evidence) => ({
        ...evidence,
        caseId,
      })),
    );

    return this.createMutationResponse({
      evidences: createAdminCaseEvidencesResponse(evidences).evidences,
      selectedCulpritSuspectId,
      usedFallback: generation.usedFallback,
    });
  }

  async addStatement(
    caseId: string,
    dto: CreateCaseStatementDto,
  ): Promise<AdminMutationResponse<AdminStatementRecord>> {
    await this.ensureCaseExists(caseId);
    await this.ensureOptionalSuspectBelongsToCase(caseId, dto.suspectId);

    const statement = await this.casesRepository.createStatement({
      caseId,
      content: dto.content,
      context: dto.context,
      isInitiallyVisible: dto.isInitiallyVisible,
      speakerName: dto.speakerName,
      suspectId: dto.suspectId,
    });

    return this.createMutationResponse(statement);
  }

  async generateCaseStatements(
    caseId: string,
    dto: GenerateCaseStatementsDto,
  ): Promise<AdminMutationResponse<GeneratedCaseStatementsResponse>> {
    const context = await this.getStatementGenerationContext(caseId);
    this.ensureCaseHasSuspectsForStatements(context.suspects);
    this.ensureCaseHasEvidences(context.evidences);
    this.ensureCaseHasNoStatements(context.statements);
    this.ensureRequestedCulpritBelongsToCase(
      context.suspects,
      dto.culpritSuspectId,
    );

    const generation = await this.aiService.generateCaseStatements(
      this.createStatementGenerationInput(context, dto),
    );
    const statements = await this.casesRepository.createStatements(
      generation.statements.map((statement) => ({
        ...statement,
        caseId,
      })),
    );

    return this.createMutationResponse({
      culpritSuspectId: generation.culpritSuspectId,
      statements,
      usedFallback: generation.usedFallback,
    });
  }

  async generateCaseContradictions(
    caseId: string,
    dto: GenerateCaseContradictionsDto,
  ): Promise<AdminMutationResponse<GeneratedCaseContradictionsResponse>> {
    const context = await this.getContradictionGenerationContext(caseId);
    this.ensureCaseHasSuspectsForContradictions(context.suspects);
    this.ensureCaseHasEvidencesForContradictions(context.evidences);
    this.ensureCaseHasStatements(context.statements);
    this.ensureCaseHasNoContradictions(context.contradictions);
    this.ensureRequestedCulpritBelongsToCase(
      context.suspects,
      dto.culpritSuspectId,
    );
    this.ensureCulpritHasStatement(context.statements, dto.culpritSuspectId);

    const generation = await this.aiService.generateCaseContradictions(
      this.createContradictionGenerationInput(context, dto),
    );
    const contradictions = await this.casesRepository.createContradictions(
      generation.contradictions.map((contradiction) => ({
        ...contradiction,
        caseId,
      })),
    );

    return this.createMutationResponse({
      contradictions,
      culpritSuspectId: generation.culpritSuspectId,
      difficulty: generation.difficulty,
      usedFallback: generation.usedFallback,
    });
  }

  async addContradiction(
    caseId: string,
    dto: CreateCaseContradictionDto,
  ): Promise<AdminMutationResponse<AdminContradictionRecord>> {
    await this.ensureCaseExists(caseId);
    await this.ensureOptionalSuspectBelongsToCase(caseId, dto.suspectId);
    await this.ensureStatementBelongsToCase(caseId, dto.statementId);
    await this.ensureEvidenceBelongsToCase(caseId, dto.refutingEvidenceId);

    const contradiction = await this.casesRepository.createContradiction({
      caseId,
      explanation: dto.explanation,
      isInitiallyVisible: dto.isInitiallyVisible,
      proves: dto.proves,
      refutingEvidenceId: dto.refutingEvidenceId,
      statementId: dto.statementId,
      suspectId: dto.suspectId,
      title: dto.title,
    });

    return this.createMutationResponse(contradiction);
  }

  async addSolution(
    caseId: string,
    dto: CreateCaseSolutionDto,
  ): Promise<AdminMutationResponse<AdminCaseSolutionRecord>> {
    await this.ensureCaseExists(caseId);
    await this.ensureSuspectBelongsToCase(caseId, dto.culpritSuspectId);

    const solution = await this.casesRepository.createSolution({
      caseId,
      culpritSuspectId: dto.culpritSuspectId,
      fullExplanation: dto.fullExplanation,
      methodSummary: dto.methodSummary,
      motiveSummary: dto.motiveSummary,
      opportunitySummary: dto.opportunitySummary,
    });

    return this.createMutationResponse(solution);
  }

  async generateCaseSolution(
    caseId: string,
    dto: GenerateCaseSolutionDto,
  ): Promise<AdminMutationResponse<GeneratedCaseSolutionResponse>> {
    const context = await this.getSolutionGenerationContext(caseId);
    this.ensureCaseHasSuspectsForSolution(context.suspects);
    this.ensureCaseHasEvidencesForSolution(context.evidences);
    this.ensureCaseHasStatementsForSolution(context.statements);
    this.ensureCaseHasContradictionsForSolution(context.contradictions);
    this.ensureCaseHasNoSolution(context.solution);
    this.ensureRequestedCulpritBelongsToCase(
      context.suspects,
      dto.culpritSuspectId,
    );
    this.ensureCulpritHasStatement(context.statements, dto.culpritSuspectId);
    this.ensureCulpritHasContradiction(
      context.statements,
      context.contradictions,
      dto.culpritSuspectId,
    );

    const generation = await this.aiService.generateCaseSolution(
      this.createSolutionGenerationInput(context, dto),
    );
    const solution = await this.casesRepository.createSolution({
      caseId,
      culpritSuspectId: generation.culpritSuspectId,
      fullExplanation: generation.fullExplanation,
      methodSummary: generation.methodSummary,
      motiveSummary: generation.motiveSummary,
      opportunitySummary: generation.opportunitySummary,
    });

    return this.createMutationResponse({
      culpritSuspectId: generation.culpritSuspectId,
      solution,
      usedFallback: generation.usedFallback,
    });
  }

  async generateCaseSolveRequirements(
    caseId: string,
    dto?: GenerateCaseSolveRequirementsDto,
  ): Promise<AdminMutationResponse<GeneratedCaseSolveRequirementsResponse>> {
    this.ensureSolveRequirementGenerationBodyIsEmpty(dto);

    const snapshot = await this.getSolveRequirementGenerationContext(caseId);
    this.ensureCaseHasSuspectsForRequirements(snapshot.suspects);
    this.ensureCaseHasEvidencesForRequirements(snapshot.evidences);
    this.ensureCaseHasStatementsForRequirements(snapshot.statements);
    this.ensureCaseHasContradictionsForRequirements(snapshot.contradictions);
    this.ensureCaseHasNoRequirements(snapshot.requirements);

    const solution = this.ensureCaseHasSolutionForRequirements(
      snapshot.solution,
    );
    this.ensureSolutionCulpritBelongsToCase(
      snapshot.suspects,
      solution.culpritSuspectId,
    );

    const generation = await this.aiService.generateCaseSolveRequirements(
      this.createSolveRequirementGenerationInput(snapshot, solution),
    );
    const requirements = await this.casesRepository.createSolveRequirements(
      generation.requirements.map((requirement) => ({
        ...requirement,
        caseId,
      })),
    );

    return this.createMutationResponse({
      culpritSuspectId: generation.culpritSuspectId,
      difficulty: generation.difficulty,
      requirements,
      usedFallback: generation.usedFallback,
    });
  }

  async generateCaseInvestigationGraph(
    caseId: string,
    dto?: GenerateCaseInvestigationGraphDto,
  ): Promise<AdminMutationResponse<GeneratedCaseInvestigationGraphResponse>> {
    this.ensureInvestigationGraphGenerationBodyIsEmpty(dto);

    const snapshot = await this.getSolveRequirementGenerationContext(caseId);
    this.ensureCaseHasSuspectsForInvestigationGraph(snapshot.suspects);
    this.ensureCaseHasEvidencesForInvestigationGraph(snapshot.evidences);
    this.ensureCaseHasStatementsForInvestigationGraph(snapshot.statements);
    this.ensureCaseHasContradictionsForInvestigationGraph(
      snapshot.contradictions,
    );
    this.ensureCaseHasRequirementsForInvestigationGraph(snapshot.requirements);
    this.ensureCaseHasNoActions(snapshot.actions);

    const solution = this.ensureCaseHasSolutionForInvestigationGraph(
      snapshot.solution,
    );
    this.ensureSolutionCulpritBelongsToCase(
      snapshot.suspects,
      solution.culpritSuspectId,
    );

    const generation = await this.aiService.generateCaseInvestigationGraph(
      this.createInvestigationGraphGenerationInput(snapshot, solution),
    );
    const persistedGraph = await this.createGeneratedInvestigationGraph(
      caseId,
      generation,
    );

    return this.createMutationResponse({
      ...persistedGraph,
      culpritSuspectId: generation.culpritSuspectId,
      difficulty: generation.difficulty,
      usedFallback: generation.usedFallback,
    });
  }

  async addSolveRequirement(
    caseId: string,
    dto: CreateSolveRequirementDto,
  ): Promise<AdminMutationResponse<AdminSolveRequirementRecord>> {
    await this.ensureCaseExists(caseId);
    await this.ensureOptionalSuspectBelongsToCase(
      caseId,
      dto.requiredSuspectId,
    );
    await this.ensureOptionalEvidenceBelongsToCase(
      caseId,
      dto.requiredEvidenceId,
    );
    await this.ensureOptionalContradictionBelongsToCase(
      caseId,
      dto.requiredContradictionId,
    );

    const requirement = await this.casesRepository.createSolveRequirement({
      caseId,
      description: dto.description,
      isMandatory: dto.isMandatory,
      proofRole: dto.proofRole,
      requiredContradictionId: dto.requiredContradictionId,
      requiredEvidenceId: dto.requiredEvidenceId,
      requiredSuspectId: dto.requiredSuspectId,
      requirementType: dto.requirementType,
      weight: dto.weight,
    });

    return this.createMutationResponse(requirement);
  }

  async addInvestigationAction(
    caseId: string,
    dto: CreateInvestigationActionDto,
  ): Promise<AdminMutationResponse<AdminInvestigationActionRecord>> {
    await this.ensureCaseExists(caseId);

    const action = await this.casesRepository.createInvestigationAction({
      actionType: dto.actionType,
      baseDurationMinutes: dto.baseDurationMinutes,
      caseId,
      description: dto.description,
      isInitiallyAvailable: dto.isInitiallyAvailable,
      metadata: dto.metadata,
      minimumSkillLevel: dto.minimumSkillLevel,
      requiredSkill: dto.requiredSkill,
      requiresDetective: dto.requiresDetective,
      title: dto.title,
    });

    return this.createMutationResponse(action);
  }

  async addEvidenceUnlockRule(
    caseId: string,
    dto: CreateEvidenceUnlockRuleDto,
  ): Promise<AdminMutationResponse<AdminEvidenceUnlockRuleRecord>> {
    await this.ensureActionBelongsToCase(caseId, dto.actionId);
    await this.ensureEvidenceBelongsToCase(caseId, dto.evidenceId);

    const rule = await this.casesRepository.createEvidenceUnlockRule({
      actionId: dto.actionId,
      durationModifierMinutes: dto.durationModifierMinutes,
      evidenceId: dto.evidenceId,
      isGuaranteed: dto.isGuaranteed,
      minimumSkillLevel: dto.minimumSkillLevel,
      requiredSkill: dto.requiredSkill,
      successChance: dto.successChance,
    });

    return this.createMutationResponse(rule);
  }

  async addStatementUnlockRule(
    caseId: string,
    dto: CreateStatementUnlockRuleDto,
  ): Promise<AdminMutationResponse<AdminStatementUnlockRuleRecord>> {
    await this.ensureActionBelongsToCase(caseId, dto.actionId);
    await this.ensureStatementBelongsToCase(caseId, dto.statementId);

    const rule = await this.casesRepository.createStatementUnlockRule({
      actionId: dto.actionId,
      isGuaranteed: dto.isGuaranteed,
      minimumSkillLevel: dto.minimumSkillLevel,
      requiredSkill: dto.requiredSkill,
      statementId: dto.statementId,
      successChance: dto.successChance,
    });

    return this.createMutationResponse(rule);
  }

  async addContradictionUnlockRule(
    caseId: string,
    dto: CreateContradictionUnlockRuleDto,
  ): Promise<AdminMutationResponse<AdminContradictionUnlockRuleRecord>> {
    await this.ensureActionBelongsToCase(caseId, dto.actionId);
    await this.ensureContradictionBelongsToCase(caseId, dto.contradictionId);

    const rule = await this.casesRepository.createContradictionUnlockRule({
      actionId: dto.actionId,
      contradictionId: dto.contradictionId,
      isGuaranteed: dto.isGuaranteed,
      minimumSkillLevel: dto.minimumSkillLevel,
      requiredSkill: dto.requiredSkill,
      successChance: dto.successChance,
    });

    return this.createMutationResponse(rule);
  }

  async publishCase(
    caseId: string,
  ): Promise<AdminMutationResponse<AdminCaseRecord>> {
    const snapshot = await this.casesRepository.findPlayabilitySnapshot(caseId);

    if (!snapshot) {
      throw new NotFoundException('No se encontro el caso.');
    }

    const validation = this.casePlayabilityValidator.validate(snapshot);

    if (!validation.canPublish) {
      throw new BadRequestException({
        blockingIssues: validation.blockingIssues,
        message: 'El caso no esta listo para publicarse.',
        warnings: validation.warnings,
      });
    }

    const publishedCase = await this.casesRepository.publishCase(caseId);

    return this.createMutationResponse(publishedCase);
  }

  private async getEvidenceGenerationContext(
    caseId: string,
  ): Promise<CaseEvidenceGenerationContext> {
    const [caseRecord, suspects] = await Promise.all([
      this.casesRepository.findCase(caseId),
      this.casesRepository.findSuspectsByCase(caseId),
    ]);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return {
      caseRecord,
      suspects,
    };
  }

  private async getSuspectGenerationContext(
    caseId: string,
  ): Promise<CaseSuspectGenerationContext> {
    const [caseRecord, suspects] = await Promise.all([
      this.casesRepository.findCase(caseId),
      this.casesRepository.findSuspectsByCase(caseId),
    ]);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return {
      caseRecord,
      suspects,
    };
  }

  private async getStatementGenerationContext(
    caseId: string,
  ): Promise<CaseStatementGenerationContext> {
    const [caseRecord, suspects, evidences, statements] = await Promise.all([
      this.casesRepository.findCase(caseId),
      this.casesRepository.findSuspectsByCase(caseId),
      this.casesRepository.findEvidencesByCase(caseId),
      this.casesRepository.findStatementsByCase(caseId),
    ]);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return {
      caseRecord,
      evidences,
      statements,
      suspects,
    };
  }

  private async getContradictionGenerationContext(
    caseId: string,
  ): Promise<CaseContradictionGenerationContext> {
    const [caseRecord, suspects, evidences, statements, contradictions] =
      await Promise.all([
        this.casesRepository.findCase(caseId),
        this.casesRepository.findSuspectsByCase(caseId),
        this.casesRepository.findEvidencesByCase(caseId),
        this.casesRepository.findStatementsByCase(caseId),
        this.casesRepository.findContradictionsByCase(caseId),
      ]);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return {
      caseRecord,
      contradictions,
      evidences,
      statements,
      suspects,
    };
  }

  private async getSolutionGenerationContext(
    caseId: string,
  ): Promise<CaseSolutionGenerationContext> {
    const [
      caseRecord,
      suspects,
      evidences,
      statements,
      contradictions,
      solution,
    ] = await Promise.all([
      this.casesRepository.findCase(caseId),
      this.casesRepository.findSuspectsByCase(caseId),
      this.casesRepository.findEvidencesByCase(caseId),
      this.casesRepository.findStatementsByCase(caseId),
      this.casesRepository.findContradictionsByCase(caseId),
      this.casesRepository.findSolutionByCase(caseId),
    ]);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return {
      caseRecord,
      contradictions,
      evidences,
      solution,
      statements,
      suspects,
    };
  }

  private async getSolveRequirementGenerationContext(
    caseId: string,
  ): Promise<CasePlayabilitySnapshot> {
    const snapshot = await this.casesRepository.findPlayabilitySnapshot(caseId);

    if (!snapshot) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return snapshot;
  }

  private createSuspectGenerationInput(command: {
    readonly caseRecord: AdminCaseRecord;
    readonly difficulty: AdminCaseDifficulty;
    readonly suspectCount: number;
  }): GenerateCaseSuspectsInput {
    return {
      caseData: {
        difficulty: command.difficulty,
        id: command.caseRecord.id,
        publicBriefing: command.caseRecord.publicBriefing,
        summary: command.caseRecord.summary,
        title: command.caseRecord.title,
        victimName: command.caseRecord.victimName,
      },
      difficulty: command.difficulty,
      suspectCount: command.suspectCount,
    };
  }

  private createEvidenceGenerationInput(
    context: CaseEvidenceGenerationContext,
    dto: GenerateCaseEvidencesDto,
  ): GenerateCaseEvidencesInput {
    return {
      caseData: {
        difficulty: context.caseRecord.difficulty,
        id: context.caseRecord.id,
        publicBriefing: context.caseRecord.publicBriefing,
        summary: context.caseRecord.summary,
        title: context.caseRecord.title,
        victimName: context.caseRecord.victimName,
      },
      culpritSuspectId: dto.culpritSuspectId,
      evidenceCount: dto.evidenceCount,
      generateSolution: false,
      suspects: context.suspects.map((suspect) => ({
        age: suspect.age,
        background: suspect.background,
        createdAt: suspect.createdAt,
        id: suspect.id,
        name: suspect.name,
        occupation: suspect.occupation,
        personality: suspect.personality,
        publicNotes: suspect.publicNotes,
        relationshipToVictim: suspect.relationshipToVictim,
      })),
    };
  }

  private createStatementGenerationInput(
    context: CaseStatementGenerationContext,
    dto: GenerateCaseStatementsDto,
  ): GenerateCaseStatementsInput {
    return {
      caseData: {
        difficulty: context.caseRecord.difficulty,
        id: context.caseRecord.id,
        publicBriefing: context.caseRecord.publicBriefing,
        summary: context.caseRecord.summary,
        title: context.caseRecord.title,
        victimName: context.caseRecord.victimName,
      },
      culpritSuspectId: dto.culpritSuspectId,
      evidences: context.evidences.map((evidence) => ({
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
      })),
      suspects: context.suspects.map((suspect) => ({
        age: suspect.age,
        background: suspect.background,
        createdAt: suspect.createdAt,
        id: suspect.id,
        name: suspect.name,
        occupation: suspect.occupation,
        personality: suspect.personality,
        publicNotes: suspect.publicNotes,
        relationshipToVictim: suspect.relationshipToVictim,
      })),
    };
  }

  private createContradictionGenerationInput(
    context: CaseContradictionGenerationContext,
    dto: GenerateCaseContradictionsDto,
  ): GenerateCaseContradictionsInput {
    return {
      caseData: {
        difficulty: context.caseRecord.difficulty,
        id: context.caseRecord.id,
        publicBriefing: context.caseRecord.publicBriefing,
        summary: context.caseRecord.summary,
        title: context.caseRecord.title,
        victimName: context.caseRecord.victimName,
      },
      culpritSuspectId: dto.culpritSuspectId,
      difficulty: dto.difficulty,
      evidences: context.evidences.map((evidence) => ({
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
      })),
      statements: context.statements.map((statement) => ({
        content: statement.content,
        context: statement.context,
        id: statement.id,
        isInitiallyVisible: statement.isInitiallyVisible,
        speakerName: statement.speakerName,
        suspectId: statement.suspectId,
      })),
      suspects: context.suspects.map((suspect) => ({
        age: suspect.age,
        background: suspect.background,
        createdAt: suspect.createdAt,
        id: suspect.id,
        name: suspect.name,
        occupation: suspect.occupation,
        personality: suspect.personality,
        publicNotes: suspect.publicNotes,
        relationshipToVictim: suspect.relationshipToVictim,
      })),
    };
  }

  private createSolutionGenerationInput(
    context: CaseSolutionGenerationContext,
    dto: GenerateCaseSolutionDto,
  ): GenerateCaseSolutionInput {
    return {
      caseData: {
        difficulty: context.caseRecord.difficulty,
        id: context.caseRecord.id,
        publicBriefing: context.caseRecord.publicBriefing,
        summary: context.caseRecord.summary,
        title: context.caseRecord.title,
        victimName: context.caseRecord.victimName,
      },
      contradictions: context.contradictions.map((contradiction) => ({
        explanation: contradiction.explanation,
        id: contradiction.id,
        isInitiallyVisible: contradiction.isInitiallyVisible,
        proves: contradiction.proves,
        refutingEvidenceId: contradiction.refutingEvidenceId,
        statementId: contradiction.statementId,
        suspectId: contradiction.suspectId,
        title: contradiction.title,
      })),
      culpritSuspectId: dto.culpritSuspectId,
      evidences: context.evidences.map((evidence) => ({
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
      })),
      statements: context.statements.map((statement) => ({
        content: statement.content,
        context: statement.context,
        id: statement.id,
        isInitiallyVisible: statement.isInitiallyVisible,
        speakerName: statement.speakerName,
        suspectId: statement.suspectId,
      })),
      suspects: context.suspects.map((suspect) => ({
        age: suspect.age,
        background: suspect.background,
        createdAt: suspect.createdAt,
        id: suspect.id,
        name: suspect.name,
        occupation: suspect.occupation,
        personality: suspect.personality,
        publicNotes: suspect.publicNotes,
        relationshipToVictim: suspect.relationshipToVictim,
      })),
    };
  }

  private createSolveRequirementGenerationInput(
    snapshot: CasePlayabilitySnapshot,
    solution: AdminCaseSolutionRecord,
  ): GenerateCaseSolveRequirementsInput {
    const difficulty = this.readCaseDifficulty(snapshot.caseRecord.difficulty);

    return {
      actions: snapshot.actions.map((action) => ({
        actionType: action.actionType,
        baseDurationMinutes: action.baseDurationMinutes,
        description: action.description,
        id: action.id,
        isInitiallyAvailable: action.isInitiallyAvailable,
        metadata: action.metadata,
        minimumSkillLevel: action.minimumSkillLevel,
        requiredSkill: action.requiredSkill,
        requiresDetective: action.requiresDetective,
        title: action.title,
      })),
      caseData: {
        difficulty,
        id: snapshot.caseRecord.id,
        publicBriefing: snapshot.caseRecord.publicBriefing,
        summary: snapshot.caseRecord.summary,
        title: snapshot.caseRecord.title,
        victimName: snapshot.caseRecord.victimName,
      },
      contradictionUnlockRules: snapshot.contradictionUnlockRules.map(
        (rule) => ({
          actionId: rule.actionId,
          contradictionId: rule.contradictionId,
          id: rule.id,
          isGuaranteed: rule.isGuaranteed,
          minimumSkillLevel: rule.minimumSkillLevel,
          requiredSkill: rule.requiredSkill,
          successChance: rule.successChance,
        }),
      ),
      contradictions: snapshot.contradictions.map((contradiction) => ({
        explanation: contradiction.explanation,
        id: contradiction.id,
        isInitiallyVisible: contradiction.isInitiallyVisible,
        proves: contradiction.proves,
        refutingEvidenceId: contradiction.refutingEvidenceId,
        statementId: contradiction.statementId,
        suspectId: contradiction.suspectId,
        title: contradiction.title,
      })),
      culpritSuspectId: solution.culpritSuspectId,
      difficulty,
      evidenceUnlockRules: snapshot.evidenceUnlockRules.map((rule) => ({
        actionId: rule.actionId,
        durationModifierMinutes: rule.durationModifierMinutes,
        evidenceId: rule.evidenceId,
        id: rule.id,
        isGuaranteed: rule.isGuaranteed,
        minimumSkillLevel: rule.minimumSkillLevel,
        requiredSkill: rule.requiredSkill,
        successChance: rule.successChance,
      })),
      evidences: snapshot.evidences.map((evidence) => ({
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
      })),
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
      statements: snapshot.statements.map((statement) => ({
        content: statement.content,
        context: statement.context,
        id: statement.id,
        isInitiallyVisible: statement.isInitiallyVisible,
        speakerName: statement.speakerName,
        suspectId: statement.suspectId,
      })),
      suspects: snapshot.suspects.map((suspect) => ({
        age: suspect.age,
        background: suspect.background,
        createdAt: suspect.createdAt,
        id: suspect.id,
        name: suspect.name,
        occupation: suspect.occupation,
        personality: suspect.personality,
        publicNotes: suspect.publicNotes,
        relationshipToVictim: suspect.relationshipToVictim,
      })),
    };
  }

  private createInvestigationGraphGenerationInput(
    snapshot: CasePlayabilitySnapshot,
    solution: AdminCaseSolutionRecord,
  ): GenerateCaseInvestigationGraphInput {
    const difficulty = this.readCaseDifficulty(snapshot.caseRecord.difficulty);

    return {
      caseData: {
        difficulty,
        id: snapshot.caseRecord.id,
        publicBriefing: snapshot.caseRecord.publicBriefing,
        summary: snapshot.caseRecord.summary,
        title: snapshot.caseRecord.title,
        victimName: snapshot.caseRecord.victimName,
      },
      contradictions: snapshot.contradictions.map((contradiction) => ({
        explanation: contradiction.explanation,
        id: contradiction.id,
        isInitiallyVisible: contradiction.isInitiallyVisible,
        proves: contradiction.proves,
        refutingEvidenceId: contradiction.refutingEvidenceId,
        statementId: contradiction.statementId,
        suspectId: contradiction.suspectId,
        title: contradiction.title,
      })),
      culpritSuspectId: solution.culpritSuspectId,
      difficulty,
      evidences: snapshot.evidences.map((evidence) => ({
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
      })),
      requirements: snapshot.requirements.map((requirement) => ({
        description: requirement.description,
        id: requirement.id,
        isMandatory: requirement.isMandatory,
        proofRole: requirement.proofRole,
        requiredContradictionId: requirement.requiredContradictionId,
        requiredEvidenceId: requirement.requiredEvidenceId,
        requiredSuspectId: requirement.requiredSuspectId,
        requirementType: requirement.requirementType,
        weight: requirement.weight,
      })),
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
      statements: snapshot.statements.map((statement) => ({
        content: statement.content,
        context: statement.context,
        id: statement.id,
        isInitiallyVisible: statement.isInitiallyVisible,
        speakerName: statement.speakerName,
        suspectId: statement.suspectId,
      })),
      suspects: snapshot.suspects.map((suspect) => ({
        age: suspect.age,
        background: suspect.background,
        createdAt: suspect.createdAt,
        id: suspect.id,
        name: suspect.name,
        occupation: suspect.occupation,
        personality: suspect.personality,
        publicNotes: suspect.publicNotes,
        relationshipToVictim: suspect.relationshipToVictim,
      })),
    };
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const trimmedValue = value?.trim();

    return trimmedValue ? trimmedValue : undefined;
  }

  private resolveGeneratedSuspectCount(
    difficulty: AdminCaseDifficulty,
    dto?: GenerateCaseSuspectsDto,
  ): number {
    return (
      dto?.suspectCount ?? GENERATED_SUSPECT_COUNT_BY_DIFFICULTY[difficulty]
    );
  }

  private resolveAiCaseDifficulty(
    requestedDifficulty?: AdminCaseDifficulty,
  ): ResolvedCaseDifficulty {
    if (requestedDifficulty) {
      return {
        difficulty: requestedDifficulty,
        source: 'request',
      };
    }

    return {
      difficulty: this.chooseWeightedCaseDifficulty(),
      source: 'random',
    };
  }

  private chooseWeightedCaseDifficulty(): AdminCaseDifficulty {
    const roll = Math.random() * TOTAL_AI_CASE_DIFFICULTY_WEIGHT;
    let accumulatedWeight = 0;

    for (const item of AI_CASE_DIFFICULTY_WEIGHTS) {
      accumulatedWeight += item.weight;

      if (roll < accumulatedWeight) {
        return item.difficulty;
      }
    }

    return AI_CASE_DIFFICULTY_WEIGHTS[AI_CASE_DIFFICULTY_WEIGHTS.length - 1]
      .difficulty;
  }

  private ensureGeneratedTitleIsAllowed(
    generatedCase: GeneratedAdminCaseBase,
    forbiddenTitles: readonly string[],
  ): void {
    const forbiddenTitleSet = new Set(
      forbiddenTitles.map((title) => this.normalizeCaseTitle(title)),
    );

    if (forbiddenTitleSet.has(this.normalizeCaseTitle(generatedCase.title))) {
      throw new BadRequestException(
        'La IA genero un titulo que ya existe en los casos recientes.',
      );
    }
  }

  private normalizeCaseTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private createAiCaseGenerationMetadata(command: {
    readonly difficultySource: DifficultySource;
    readonly forbiddenTitles: readonly string[];
    readonly theme?: string;
  }): Record<string, unknown> {
    return {
      difficultySource: command.difficultySource,
      forbiddenTitleCount: command.forbiddenTitles.length,
      forbiddenTitleLimit: AI_CASE_FORBIDDEN_TITLE_LIMIT,
      generatedAt: new Date().toISOString(),
      themeProvided: command.theme !== undefined,
    };
  }

  private ensureCaseHasSuspects(suspects: readonly AdminSuspectRecord[]): void {
    if (suspects.length === 0) {
      throw new BadRequestException(
        'El caso necesita sospechosos antes de generar evidencias.',
      );
    }
  }

  private ensureCaseHasSuspectsForStatements(
    suspects: readonly AdminSuspectRecord[],
  ): void {
    if (suspects.length === 0) {
      throw new BadRequestException(
        'El caso necesita sospechosos antes de generar declaraciones.',
      );
    }
  }

  private ensureCaseHasSuspectsForContradictions(
    suspects: readonly AdminSuspectRecord[],
  ): void {
    if (suspects.length === 0) {
      throw new BadRequestException(
        'El caso necesita sospechosos antes de generar contradicciones.',
      );
    }
  }

  private ensureCaseHasSuspectsForSolution(
    suspects: readonly AdminSuspectRecord[],
  ): void {
    if (suspects.length === 0) {
      throw new BadRequestException(
        'El caso necesita sospechosos antes de generar la solucion.',
      );
    }
  }

  private ensureCaseHasSuspectsForRequirements(
    suspects: readonly AdminSuspectRecord[],
  ): void {
    if (suspects.length === 0) {
      throw new BadRequestException(
        'El caso necesita sospechosos antes de generar requisitos de resolucion.',
      );
    }
  }

  private ensureCaseHasSuspectsForInvestigationGraph(
    suspects: readonly AdminSuspectRecord[],
  ): void {
    if (suspects.length === 0) {
      throw new BadRequestException(
        'El caso necesita sospechosos antes de generar acciones.',
      );
    }
  }

  private ensureCaseHasEvidences(
    evidences: readonly AdminEvidenceRecord[],
  ): void {
    if (evidences.length === 0) {
      throw new BadRequestException(
        'El caso necesita evidencias antes de generar declaraciones.',
      );
    }
  }

  private ensureCaseHasEvidencesForInvestigationGraph(
    evidences: readonly AdminEvidenceRecord[],
  ): void {
    if (evidences.length === 0) {
      throw new BadRequestException(
        'El caso necesita evidencias antes de generar acciones.',
      );
    }
  }

  private ensureCaseHasEvidencesForContradictions(
    evidences: readonly AdminEvidenceRecord[],
  ): void {
    if (evidences.length === 0) {
      throw new BadRequestException(
        'El caso necesita evidencias antes de generar contradicciones.',
      );
    }
  }

  private ensureCaseHasEvidencesForSolution(
    evidences: readonly AdminEvidenceRecord[],
  ): void {
    if (evidences.length === 0) {
      throw new BadRequestException(
        'El caso necesita evidencias antes de generar la solucion.',
      );
    }
  }

  private ensureCaseHasEvidencesForRequirements(
    evidences: readonly AdminEvidenceRecord[],
  ): void {
    if (evidences.length === 0) {
      throw new BadRequestException(
        'El caso necesita evidencias antes de generar requisitos de resolucion.',
      );
    }
  }

  private ensureCaseHasStatements(
    statements: readonly AdminStatementRecord[],
  ): void {
    if (statements.length === 0) {
      throw new BadRequestException(
        'El caso necesita declaraciones antes de generar contradicciones.',
      );
    }
  }

  private ensureCaseHasStatementsForSolution(
    statements: readonly AdminStatementRecord[],
  ): void {
    if (statements.length === 0) {
      throw new BadRequestException(
        'El caso necesita declaraciones antes de generar la solucion.',
      );
    }
  }

  private ensureCaseHasStatementsForRequirements(
    statements: readonly AdminStatementRecord[],
  ): void {
    if (statements.length === 0) {
      throw new BadRequestException(
        'El caso necesita declaraciones antes de generar requisitos de resolucion.',
      );
    }
  }

  private ensureCaseHasStatementsForInvestigationGraph(
    statements: readonly AdminStatementRecord[],
  ): void {
    if (statements.length === 0) {
      throw new BadRequestException(
        'El caso necesita declaraciones antes de generar acciones.',
      );
    }
  }

  private ensureCaseHasContradictionsForSolution(
    contradictions: readonly AdminContradictionRecord[],
  ): void {
    if (contradictions.length === 0) {
      throw new BadRequestException(
        'El caso necesita contradicciones antes de generar la solucion.',
      );
    }
  }

  private ensureCaseHasContradictionsForRequirements(
    contradictions: readonly AdminContradictionRecord[],
  ): void {
    if (contradictions.length === 0) {
      throw new BadRequestException(
        'El caso necesita contradicciones antes de generar requisitos de resolucion.',
      );
    }
  }

  private ensureCaseHasContradictionsForInvestigationGraph(
    contradictions: readonly AdminContradictionRecord[],
  ): void {
    if (contradictions.length === 0) {
      throw new BadRequestException(
        'El caso necesita contradicciones antes de generar acciones.',
      );
    }
  }

  private ensureCaseHasRequirementsForInvestigationGraph(
    requirements: readonly AdminSolveRequirementRecord[],
  ): void {
    if (requirements.length === 0) {
      throw new BadRequestException(
        'El caso necesita requisitos de resolucion antes de generar acciones.',
      );
    }
  }

  private ensureCaseHasNoActions(
    actions: readonly AdminInvestigationActionRecord[],
  ): void {
    if (actions.length > 0) {
      throw new BadRequestException(
        'El caso ya tiene acciones de investigacion.',
      );
    }
  }

  private ensureCaseHasNoSuspects(
    suspects: readonly AdminSuspectRecord[],
  ): void {
    if (suspects.length > 0) {
      throw new BadRequestException('El caso ya tiene sospechosos.');
    }
  }

  private ensureCaseHasNoStatements(
    statements: readonly AdminStatementRecord[],
  ): void {
    if (statements.length > 0) {
      throw new BadRequestException('El caso ya tiene declaraciones.');
    }
  }

  private ensureCaseHasNoContradictions(
    contradictions: readonly AdminContradictionRecord[],
  ): void {
    if (contradictions.length > 0) {
      throw new BadRequestException('El caso ya tiene contradicciones.');
    }
  }

  private ensureCaseHasNoRequirements(
    requirements: readonly AdminSolveRequirementRecord[],
  ): void {
    if (requirements.length > 0) {
      throw new BadRequestException(
        'El caso ya tiene requisitos de resolucion.',
      );
    }
  }

  private ensureCaseHasNoSolution(solution?: AdminCaseSolutionRecord): void {
    if (solution) {
      throw new BadRequestException('El caso ya tiene solucion privada.');
    }
  }

  private ensureCaseHasSolutionForRequirements(
    solution?: AdminCaseSolutionRecord,
  ): AdminCaseSolutionRecord {
    if (!solution) {
      throw new BadRequestException(
        'El caso necesita solucion privada antes de generar requisitos de resolucion.',
      );
    }

    return solution;
  }

  private ensureCaseHasSolutionForInvestigationGraph(
    solution?: AdminCaseSolutionRecord,
  ): AdminCaseSolutionRecord {
    if (!solution) {
      throw new BadRequestException(
        'El caso necesita solucion privada antes de generar acciones.',
      );
    }

    return solution;
  }

  private ensureSolutionCulpritBelongsToCase(
    suspects: readonly AdminSuspectRecord[],
    culpritSuspectId: string,
  ): void {
    if (!this.hasSuspect(suspects, culpritSuspectId)) {
      throw new BadRequestException(
        'La solucion apunta a un culpable que no pertenece al caso.',
      );
    }
  }

  private ensureSolveRequirementGenerationBodyIsEmpty(
    dto?: GenerateCaseSolveRequirementsDto,
  ): void {
    if (Object.keys(dto ?? {}).length > 0) {
      throw new BadRequestException('Este endpoint no acepta body.');
    }
  }

  private ensureInvestigationGraphGenerationBodyIsEmpty(
    dto?: GenerateCaseInvestigationGraphDto,
  ): void {
    if (Object.keys(dto ?? {}).length > 0) {
      throw new BadRequestException('Este endpoint no acepta body.');
    }
  }

  private ensureCulpritHasStatement(
    statements: readonly AdminStatementRecord[],
    culpritSuspectId: string,
  ): void {
    if (
      !statements.some((statement) => statement.suspectId === culpritSuspectId)
    ) {
      throw new BadRequestException(
        'El culpable esperado necesita al menos una declaracion.',
      );
    }
  }

  private ensureCulpritHasContradiction(
    statements: readonly AdminStatementRecord[],
    contradictions: readonly AdminContradictionRecord[],
    culpritSuspectId: string,
  ): void {
    const culpritStatementIds = new Set(
      statements
        .filter((statement) => statement.suspectId === culpritSuspectId)
        .map((statement) => statement.id),
    );
    const hasCulpritContradiction = contradictions.some(
      (contradiction) =>
        contradiction.suspectId === culpritSuspectId ||
        culpritStatementIds.has(contradiction.statementId),
    );

    if (!hasCulpritContradiction) {
      throw new BadRequestException(
        'El culpable esperado necesita al menos una contradiccion.',
      );
    }
  }

  private ensureRequestedCulpritBelongsToCase(
    suspects: readonly AdminSuspectRecord[],
    culpritSuspectId?: string,
  ): void {
    if (!culpritSuspectId) {
      return;
    }

    if (!this.hasSuspect(suspects, culpritSuspectId)) {
      throw new BadRequestException('El sospechoso no pertenece al caso.');
    }
  }

  private ensureEvidenceGenerationDoesNotRequestSolution(
    generateSolution?: boolean,
  ): void {
    if (!generateSolution) {
      return;
    }

    throw new BadRequestException(
      'Este endpoint no permite crear la solucion privada.',
    );
  }

  private resolveSelectedCulpritSuspectId(
    command: ResolveSelectedCulpritCommand,
  ): string {
    if (
      command.dto.culpritSuspectId &&
      this.hasSuspect(command.suspects, command.dto.culpritSuspectId)
    ) {
      return command.dto.culpritSuspectId;
    }

    if (
      this.hasSuspect(
        command.suspects,
        command.generation.selectedCulpritSuspectId,
      )
    ) {
      return command.generation.selectedCulpritSuspectId;
    }

    return this.findOldestSuspect(command.suspects).id;
  }

  private async createGeneratedInvestigationGraph(
    caseId: string,
    generation: GenerateCaseInvestigationGraphResult,
  ): Promise<CreatedInvestigationGraphRecord> {
    return this.casesRepository.createInvestigationGraph(
      this.createInvestigationGraphRecordCommand(caseId, generation),
    );
  }

  private createInvestigationGraphRecordCommand(
    caseId: string,
    generation: GenerateCaseInvestigationGraphResult,
  ): CreateInvestigationGraphRecordCommand {
    return {
      actionPrerequisites:
        this.createGeneratedActionPrerequisiteCommands(generation),
      actions: this.createGeneratedActionCommands(generation),
      caseId,
      contradictionUnlockRules:
        this.createGeneratedContradictionUnlockRuleCommands(generation),
      evidenceUnlockRules:
        this.createGeneratedEvidenceUnlockRuleCommands(generation),
      statementUnlockRules:
        this.createGeneratedStatementUnlockRuleCommands(generation),
    };
  }

  private createGeneratedActionCommands(
    generation: GenerateCaseInvestigationGraphResult,
  ): CreateInvestigationGraphRecordCommand['actions'] {
    return generation.actions.map((action) => ({
      actionType: action.actionType,
      baseDurationMinutes: action.baseDurationMinutes,
      description: action.description,
      isInitiallyAvailable: action.isInitiallyAvailable,
      metadata: action.metadata,
      minimumSkillLevel: action.minimumSkillLevel,
      requiredSkill: action.requiredSkill,
      requiresDetective: action.requiresDetective,
      tempId: action.tempId,
      title: action.title,
    }));
  }

  private createGeneratedActionPrerequisiteCommands(
    generation: GenerateCaseInvestigationGraphResult,
  ): CreateInvestigationGraphRecordCommand['actionPrerequisites'] {
    return generation.actionPrerequisites.map((prerequisite) => ({
      actionTempId: prerequisite.actionTempId,
      prerequisiteActionTempId: prerequisite.prerequisiteActionTempId,
      prerequisiteContradictionId: prerequisite.prerequisiteContradictionId,
      prerequisiteEvidenceId: prerequisite.prerequisiteEvidenceId,
    }));
  }

  private createGeneratedContradictionUnlockRuleCommands(
    generation: GenerateCaseInvestigationGraphResult,
  ): CreateInvestigationGraphRecordCommand['contradictionUnlockRules'] {
    return generation.contradictionUnlockRules.map((rule) => ({
      actionTempId: rule.actionTempId,
      contradictionId: rule.contradictionId,
      isGuaranteed: rule.isGuaranteed,
      minimumSkillLevel: rule.minimumSkillLevel,
      requiredSkill: rule.requiredSkill,
      successChance: rule.successChance,
    }));
  }

  private createGeneratedEvidenceUnlockRuleCommands(
    generation: GenerateCaseInvestigationGraphResult,
  ): CreateInvestigationGraphRecordCommand['evidenceUnlockRules'] {
    return generation.evidenceUnlockRules.map((rule) => ({
      actionTempId: rule.actionTempId,
      durationModifierMinutes: rule.durationModifierMinutes,
      evidenceId: rule.evidenceId,
      isGuaranteed: rule.isGuaranteed,
      minimumSkillLevel: rule.minimumSkillLevel,
      requiredSkill: rule.requiredSkill,
      successChance: rule.successChance,
    }));
  }

  private createGeneratedStatementUnlockRuleCommands(
    generation: GenerateCaseInvestigationGraphResult,
  ): CreateInvestigationGraphRecordCommand['statementUnlockRules'] {
    return generation.statementUnlockRules.map((rule) => ({
      actionTempId: rule.actionTempId,
      isGuaranteed: rule.isGuaranteed,
      minimumSkillLevel: rule.minimumSkillLevel,
      requiredSkill: rule.requiredSkill,
      statementId: rule.statementId,
      successChance: rule.successChance,
    }));
  }

  private hasSuspect(
    suspects: readonly AdminSuspectRecord[],
    suspectId: string,
  ): boolean {
    return suspects.some((suspect) => suspect.id === suspectId);
  }

  private readCaseDifficulty(difficulty: string): AdminCaseDifficulty {
    if (ADMIN_CASE_DIFFICULTIES.includes(difficulty as AdminCaseDifficulty)) {
      return difficulty as AdminCaseDifficulty;
    }

    throw new BadRequestException('El caso no tiene una dificultad valida.');
  }

  private findOldestSuspect(
    suspects: readonly AdminSuspectRecord[],
  ): AdminSuspectRecord {
    return [...suspects].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )[0];
  }

  private async ensureCaseExists(caseId: string): Promise<void> {
    const caseRecord = await this.casesRepository.findCase(caseId);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }
  }

  private async ensurePlayerVisibleCaseExists(caseId: string): Promise<void> {
    const caseRecord = await this.casesRepository.findCase(caseId);

    if (!caseRecord || caseRecord.status !== PLAYER_VISIBLE_CASE_STATUS) {
      throw new NotFoundException('No se encontro el caso.');
    }
  }

  private async ensureOptionalSuspectBelongsToCase(
    caseId: string,
    suspectId?: string,
  ): Promise<void> {
    if (!suspectId) {
      return;
    }

    await this.ensureSuspectBelongsToCase(caseId, suspectId);
  }

  private async ensureSuspectBelongsToCase(
    caseId: string,
    suspectId: string,
  ): Promise<void> {
    const suspect = await this.casesRepository.findSuspect(suspectId);

    if (!suspect || suspect.caseId !== caseId) {
      throw new BadRequestException('El sospechoso no pertenece al caso.');
    }
  }

  private async ensureOptionalEvidenceBelongsToCase(
    caseId: string,
    evidenceId?: string,
  ): Promise<void> {
    if (!evidenceId) {
      return;
    }

    await this.ensureEvidenceBelongsToCase(caseId, evidenceId);
  }

  private async ensureEvidenceBelongsToCase(
    caseId: string,
    evidenceId: string,
  ): Promise<void> {
    const evidence = await this.casesRepository.findEvidence(evidenceId);

    if (!evidence || evidence.caseId !== caseId) {
      throw new BadRequestException('La evidencia no pertenece al caso.');
    }
  }

  private async ensureStatementBelongsToCase(
    caseId: string,
    statementId: string,
  ): Promise<void> {
    const statement = await this.casesRepository.findStatement(statementId);

    if (!statement || statement.caseId !== caseId) {
      throw new BadRequestException('La declaracion no pertenece al caso.');
    }
  }

  private async ensureOptionalContradictionBelongsToCase(
    caseId: string,
    contradictionId?: string,
  ): Promise<void> {
    if (!contradictionId) {
      return;
    }

    await this.ensureContradictionBelongsToCase(caseId, contradictionId);
  }

  private async ensureContradictionBelongsToCase(
    caseId: string,
    contradictionId: string,
  ): Promise<void> {
    const contradiction =
      await this.casesRepository.findContradiction(contradictionId);

    if (!contradiction || contradiction.caseId !== caseId) {
      throw new BadRequestException('La contradiccion no pertenece al caso.');
    }
  }

  private async ensureActionBelongsToCase(
    caseId: string,
    actionId: string,
  ): Promise<void> {
    const action = await this.casesRepository.findAction(actionId);

    if (!action || action.caseId !== caseId) {
      throw new BadRequestException(
        'La accion de investigacion no pertenece al caso.',
      );
    }
  }

  private createMutationResponse<TData>(
    data: TData,
  ): AdminMutationResponse<TData> {
    return {
      data,
      success: true,
    };
  }
}
