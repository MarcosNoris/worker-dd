import { Injectable, NotFoundException } from '@nestjs/common';
import { CasePlayabilityValidator } from './case-playability.validator';
import {
  AdminCaseRecord,
  CaseAiGenerationRunRecord,
  CasePlayabilitySnapshot,
  CasesRepository,
} from './cases.repository';
import { CasesService, AdminMutationResponse } from './cases.service';
import {
  ADMIN_CASE_DIFFICULTIES,
  AdminCaseDifficulty,
} from './constants/admin-case.constants';
import {
  CaseAiGenerationWorkflowResponseDto,
  CreateFullAiCaseDto,
} from './dto/admin-case-ai-generation.dto';
import {
  CaseAiGenerationAttempts,
  CaseAiGenerationStep,
} from './types/case-ai-generation.types';

const MAX_ATTEMPTS_PER_STEP = 2;
const DEFAULT_EVIDENCE_COUNT_BY_DIFFICULTY = {
  easy: 4,
  medium: 6,
  hard: 8,
  expert: 10,
} as const satisfies Record<AdminCaseDifficulty, number>;

interface CreateFullAiCaseCommand {
  readonly dto: CreateFullAiCaseDto;
  readonly userId: string;
}

interface RecoverAiCaseGenerationCommand {
  readonly caseId: string;
  readonly userId: string;
}

interface WorkflowOptions {
  readonly evidenceCount?: number;
  readonly suspectCount?: number;
}

interface StepResult {
  readonly completed: boolean;
  readonly run: CaseAiGenerationRunRecord;
}

class CaseAiGenerationNeedsReviewError extends Error {}

@Injectable()
export class CaseAiGenerationWorkflowService {
  constructor(
    private readonly casesRepository: CasesRepository,
    private readonly casesService: CasesService,
    private readonly casePlayabilityValidator: CasePlayabilityValidator,
  ) {}

  async createFullAiCase(
    command: CreateFullAiCaseCommand,
  ): Promise<AdminMutationResponse<CaseAiGenerationWorkflowResponseDto>> {
    const run = await this.casesRepository.createCaseAiGenerationRun({
      attemptsByStep: {},
      createdBy: command.userId,
      currentStep: 'generate_case_base',
      difficulty: command.dto.difficulty,
      generationOptions: this.createGenerationOptions(command.dto),
      status: 'running',
      theme: command.dto.theme,
    });

    return this.createMutationResponse(
      await this.executeWorkflow(run, command.userId),
    );
  }

  async recoverAiCaseGeneration(
    command: RecoverAiCaseGenerationCommand,
  ): Promise<AdminMutationResponse<CaseAiGenerationWorkflowResponseDto>> {
    const run = await this.findOrCreateRecoveryRun(command);
    const runningRun = await this.markRunAsRunning(run);

    return this.createMutationResponse(
      await this.executeWorkflow(runningRun, command.userId),
    );
  }

  private async executeWorkflow(
    run: CaseAiGenerationRunRecord,
    userId: string,
  ): Promise<CaseAiGenerationWorkflowResponseDto> {
    let currentRun = run;

    while (currentRun.status === 'running') {
      const nextStep = await this.findNextStep(currentRun);

      if (nextStep === 'validate_playability') {
        currentRun = await this.validatePlayability(currentRun);
        break;
      }

      const stepResult = await this.executeStepWithRetry({
        run: currentRun,
        step: nextStep,
        userId,
      });
      currentRun = stepResult.run;

      if (!stepResult.completed) {
        break;
      }
    }

    return this.createWorkflowResponse(currentRun);
  }

  private async executeStepWithRetry(command: {
    readonly run: CaseAiGenerationRunRecord;
    readonly step: CaseAiGenerationStep;
    readonly userId: string;
  }): Promise<StepResult> {
    let run = command.run;
    let attemptCount = this.readAttemptCount(run, command.step);

    while (attemptCount < MAX_ATTEMPTS_PER_STEP) {
      attemptCount += 1;
      run = await this.markStepAttempt(run, command.step, attemptCount);

      try {
        run = await this.executeStep(run, command.step, command.userId);
        run = await this.clearLastError(run);

        return { completed: true, run };
      } catch (error: unknown) {
        if (error instanceof CaseAiGenerationNeedsReviewError) {
          return {
            completed: false,
            run: await this.markRunAsNeedsReview(run, error.message),
          };
        }

        if (attemptCount >= MAX_ATTEMPTS_PER_STEP) {
          return {
            completed: false,
            run: await this.markRunAsFailed(run, this.readErrorMessage(error)),
          };
        }

        run = await this.saveRetryableError(run, this.readErrorMessage(error));
      }
    }

    return { completed: false, run };
  }

  private executeStep(
    run: CaseAiGenerationRunRecord,
    step: CaseAiGenerationStep,
    userId: string,
  ): Promise<CaseAiGenerationRunRecord> {
    const stepExecutors = {
      generate_case_base: () => this.generateCaseBase(run, userId),
      generate_contradictions: () => this.generateContradictions(run),
      generate_evidences: () => this.generateEvidences(run),
      generate_investigation_graph: () => this.generateInvestigationGraph(run),
      generate_solution: () => this.generateSolution(run),
      generate_solve_requirements: () => this.generateSolveRequirements(run),
      generate_statements: () => this.generateStatements(run),
      generate_suspects: () => this.generateSuspects(run),
      validate_playability: () => Promise.resolve(run),
    } satisfies Record<
      CaseAiGenerationStep,
      () => Promise<CaseAiGenerationRunRecord>
    >;

    return stepExecutors[step]();
  }

  private async generateCaseBase(
    run: CaseAiGenerationRunRecord,
    userId: string,
  ): Promise<CaseAiGenerationRunRecord> {
    if (run.caseId) {
      return run;
    }

    const response = await this.casesService.createAiGeneratedCase({
      dto: {
        difficulty: run.difficulty,
        theme: run.theme,
      },
      userId,
    });

    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      caseId: response.data.id,
      difficulty: this.readCaseDifficulty(response.data.difficulty),
    });
  }

  private async generateSuspects(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.suspects.length > 0) {
      return run;
    }

    await this.casesService.generateCaseSuspects(caseId, {
      suspectCount: this.readOptionalNumberOption(run, 'suspectCount'),
    });

    return run;
  }

  private async generateEvidences(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.evidences.length > 0) {
      return run;
    }

    const response = await this.casesService.generateCaseEvidences(caseId, {
      culpritSuspectId: run.culpritSuspectId,
      evidenceCount: this.resolveEvidenceCount(run, snapshot.caseRecord),
    });

    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      culpritSuspectId: response.data.selectedCulpritSuspectId,
    });
  }

  private async generateStatements(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.statements.length > 0) {
      return run;
    }

    await this.casesService.generateCaseStatements(caseId, {
      culpritSuspectId: await this.resolveCulpritSuspectId(run, snapshot),
    });

    return run;
  }

  private async generateContradictions(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.contradictions.length > 0) {
      return run;
    }

    await this.casesService.generateCaseContradictions(caseId, {
      culpritSuspectId: await this.resolveCulpritSuspectId(run, snapshot),
      difficulty: this.readCaseDifficulty(snapshot.caseRecord.difficulty),
    });

    return run;
  }

  private async generateSolution(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.solution) {
      return this.persistSolutionCulprit(run, snapshot);
    }

    const response = await this.casesService.generateCaseSolution(caseId, {
      culpritSuspectId: await this.resolveCulpritSuspectId(run, snapshot),
    });

    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      culpritSuspectId: response.data.culpritSuspectId,
    });
  }

  private async generateSolveRequirements(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.requirements.length > 0) {
      return run;
    }

    await this.casesService.generateCaseSolveRequirements(caseId, {});

    return run;
  }

  private async generateInvestigationGraph(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const caseId = this.requireCaseId(run);
    const snapshot = await this.getSnapshot(caseId);

    if (snapshot.actions.length > 0) {
      return run;
    }

    await this.casesService.generateCaseInvestigationGraph(caseId, {});

    return run;
  }

  private async validatePlayability(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    const snapshot = await this.getSnapshot(this.requireCaseId(run));
    const validation = this.casePlayabilityValidator.validate(snapshot);
    const finishedAt = new Date().toISOString();

    if (validation.canPublish) {
      return this.casesRepository.updateCaseAiGenerationRun(run.id, {
        currentStep: 'validate_playability',
        finishedAt,
        lastError: null,
        status: 'completed',
      });
    }

    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      currentStep: 'validate_playability',
      finishedAt,
      lastError: validation.blockingIssues.join(' | '),
      status: 'needs_review',
    });
  }

  private async findNextStep(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationStep> {
    if (!run.caseId) {
      return 'generate_case_base';
    }

    const snapshot = await this.getSnapshot(run.caseId);

    if (snapshot.suspects.length === 0) return 'generate_suspects';
    if (snapshot.evidences.length === 0) return 'generate_evidences';
    if (snapshot.statements.length === 0) return 'generate_statements';
    if (snapshot.contradictions.length === 0) return 'generate_contradictions';
    if (!snapshot.solution) return 'generate_solution';
    if (snapshot.requirements.length === 0)
      return 'generate_solve_requirements';
    if (snapshot.actions.length === 0) return 'generate_investigation_graph';

    return 'validate_playability';
  }

  private async findOrCreateRecoveryRun(
    command: RecoverAiCaseGenerationCommand,
  ): Promise<CaseAiGenerationRunRecord> {
    const existingRun =
      await this.casesRepository.findLatestCaseAiGenerationRunByCase(
        command.caseId,
      );

    if (existingRun) {
      if (existingRun.status === 'running') {
        return existingRun;
      }

      return this.casesRepository.createCaseAiGenerationRun({
        attemptsByStep: {},
        caseId: command.caseId,
        createdBy: command.userId,
        culpritSuspectId: existingRun.culpritSuspectId,
        currentStep: existingRun.currentStep,
        difficulty: existingRun.difficulty,
        generationOptions: existingRun.generationOptions,
        status: 'running',
        theme: existingRun.theme,
      });
    }

    const caseRecord = await this.findCaseOrThrow(command.caseId);

    return this.casesRepository.createCaseAiGenerationRun({
      attemptsByStep: {},
      caseId: caseRecord.id,
      createdBy: command.userId,
      currentStep: 'generate_suspects',
      difficulty: this.readCaseDifficulty(caseRecord.difficulty),
      generationOptions: {},
      status: 'running',
      theme: caseRecord.generationPrompt,
    });
  }

  private async findCaseOrThrow(caseId: string): Promise<AdminCaseRecord> {
    const caseRecord = await this.casesRepository.findCase(caseId);

    if (!caseRecord) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return caseRecord;
  }

  private async resolveCulpritSuspectId(
    run: CaseAiGenerationRunRecord,
    snapshot: CasePlayabilitySnapshot,
  ): Promise<string> {
    if (run.culpritSuspectId) {
      return run.culpritSuspectId;
    }

    if (snapshot.solution) {
      await this.casesRepository.updateCaseAiGenerationRun(run.id, {
        culpritSuspectId: snapshot.solution.culpritSuspectId,
      });

      return snapshot.solution.culpritSuspectId;
    }

    throw new CaseAiGenerationNeedsReviewError(
      'No se puede continuar la generacion IA porque no hay culpable seleccionado en el run.',
    );
  }

  private persistSolutionCulprit(
    run: CaseAiGenerationRunRecord,
    snapshot: CasePlayabilitySnapshot,
  ): Promise<CaseAiGenerationRunRecord> {
    if (!snapshot.solution || run.culpritSuspectId) {
      return Promise.resolve(run);
    }

    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      culpritSuspectId: snapshot.solution.culpritSuspectId,
    });
  }

  private async getSnapshot(caseId: string): Promise<CasePlayabilitySnapshot> {
    const snapshot = await this.casesRepository.findPlayabilitySnapshot(caseId);

    if (!snapshot) {
      throw new NotFoundException('No se encontro el caso.');
    }

    return snapshot;
  }

  private async markStepAttempt(
    run: CaseAiGenerationRunRecord,
    step: CaseAiGenerationStep,
    attemptCount: number,
  ): Promise<CaseAiGenerationRunRecord> {
    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      attemptsByStep: {
        ...run.attemptsByStep,
        [step]: attemptCount,
      },
      currentStep: step,
      lastError: null,
      status: 'running',
    });
  }

  private markRunAsRunning(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      lastError: null,
      status: 'running',
    });
  }

  private markRunAsFailed(
    run: CaseAiGenerationRunRecord,
    message: string,
  ): Promise<CaseAiGenerationRunRecord> {
    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      finishedAt: new Date().toISOString(),
      lastError: message,
      status: 'failed',
    });
  }

  private markRunAsNeedsReview(
    run: CaseAiGenerationRunRecord,
    message: string,
  ): Promise<CaseAiGenerationRunRecord> {
    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      finishedAt: new Date().toISOString(),
      lastError: message,
      status: 'needs_review',
    });
  }

  private saveRetryableError(
    run: CaseAiGenerationRunRecord,
    message: string,
  ): Promise<CaseAiGenerationRunRecord> {
    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      lastError: message,
    });
  }

  private clearLastError(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationRunRecord> {
    return this.casesRepository.updateCaseAiGenerationRun(run.id, {
      lastError: null,
    });
  }

  private async createWorkflowResponse(
    run: CaseAiGenerationRunRecord,
  ): Promise<CaseAiGenerationWorkflowResponseDto> {
    return {
      run: {
        attemptsByStep: run.attemptsByStep,
        caseId: run.caseId,
        createdAt: run.createdAt,
        createdBy: run.createdBy,
        culpritSuspectId: run.culpritSuspectId,
        currentStep: run.currentStep,
        difficulty: run.difficulty,
        finishedAt: run.finishedAt,
        generationOptions: run.generationOptions,
        id: run.id,
        lastError: run.lastError,
        status: run.status,
        theme: run.theme,
        updatedAt: run.updatedAt,
      },
      state: run.caseId
        ? await this.casesService.getAdminCaseState(run.caseId)
        : undefined,
    };
  }

  private createGenerationOptions(
    dto: CreateFullAiCaseDto,
  ): Record<string, unknown> {
    return {
      evidenceCount: dto.evidenceCount,
      suspectCount: dto.suspectCount,
    };
  }

  private resolveEvidenceCount(
    run: CaseAiGenerationRunRecord,
    caseRecord: AdminCaseRecord,
  ): number {
    return (
      this.readOptionalNumberOption(run, 'evidenceCount') ??
      DEFAULT_EVIDENCE_COUNT_BY_DIFFICULTY[
        this.readCaseDifficulty(caseRecord.difficulty)
      ]
    );
  }

  private readOptionalNumberOption(
    run: CaseAiGenerationRunRecord,
    key: string,
  ): number | undefined {
    const value = run.generationOptions[key];

    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private readAttemptCount(
    run: CaseAiGenerationRunRecord,
    step: CaseAiGenerationStep,
  ): number {
    return run.attemptsByStep[step] ?? 0;
  }

  private requireCaseId(run: CaseAiGenerationRunRecord): string {
    if (run.caseId) {
      return run.caseId;
    }

    throw new Error('La ejecucion IA no tiene caso asociado.');
  }

  private readCaseDifficulty(difficulty: string): AdminCaseDifficulty {
    if (ADMIN_CASE_DIFFICULTIES.includes(difficulty as AdminCaseDifficulty)) {
      return difficulty as AdminCaseDifficulty;
    }

    throw new Error('El caso no tiene una dificultad valida.');
  }

  private readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido.';
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
