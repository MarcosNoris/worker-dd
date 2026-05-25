import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CaseAiGenerationRunRecord,
  CasesRepository,
} from './modules/cases/cases.repository';
import { CaseAiGenerationWorkflowService } from './modules/cases/case-ai-generation-workflow.service';

const DEFAULT_JOB_LOCK_TTL_SECONDS = 7200;
const DEFAULT_RECOVERY_BATCH_LIMIT = 2;
const DEFAULT_STALE_RUNNING_MINUTES = 120;
const JOB_LOCK_NAME = 'case-ai-generation';
const MILLISECONDS_PER_MINUTE = 60 * 1000;

export type CaseAiGenerationWorkerCommand = 'create-case' | 'recover-cases';

@Injectable()
export class CaseAiGenerationWorkerService {
  private readonly lockOwner = `case-ai-worker:${randomUUID()}`;
  private readonly logger = new Logger(CaseAiGenerationWorkerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly casesRepository: CasesRepository,
    private readonly caseAiGenerationWorkflowService: CaseAiGenerationWorkflowService,
  ) {}

  async run(command: CaseAiGenerationWorkerCommand): Promise<void> {
    if (command === 'create-case') {
      await this.createCase();
      return;
    }

    await this.recoverCases();
  }

  async createCase(): Promise<void> {
    const userId = this.readRequiredCronUserId();

    await this.runWithLock('case creation', async () => {
      await this.caseAiGenerationWorkflowService.createFullAiCase({
        dto: {},
        userId,
      });
    });
  }

  async recoverCases(): Promise<void> {
    const userId = this.readRequiredCronUserId();

    await this.runWithLock('case recovery', async () => {
      await this.recoverFailedCases(userId);
    });
  }

  private async recoverFailedCases(userId: string): Promise<void> {
    const recoveryBatchLimit = this.readRecoveryBatchLimit();

    await this.markStaleRunsAsFailed();

    const runs =
      await this.casesRepository.findRecoverableCaseAiGenerationRuns(
        recoveryBatchLimit,
      );

    for (const run of this.filterRecoverableRuns(runs, recoveryBatchLimit)) {
      await this.caseAiGenerationWorkflowService.recoverAiCaseGeneration({
        caseId: run.caseId,
        userId,
      });
    }
  }

  private filterRecoverableRuns(
    runs: readonly CaseAiGenerationRunRecord[],
    recoveryBatchLimit: number,
  ): Array<CaseAiGenerationRunRecord & { readonly caseId: string }> {
    return runs
      .filter((run) => this.isFailedRunWithCaseId(run))
      .slice(0, recoveryBatchLimit);
  }

  private async markStaleRunsAsFailed(): Promise<void> {
    await this.casesRepository.markStaleRunningCaseAiGenerationRunsAsFailed(
      this.createStaleRunningThreshold(),
    );
  }

  private async runWithLock(
    operationName: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      this.logger.log(`Skipped ${operationName}; another job owns the lock.`);
      return;
    }

    try {
      await operation();
    } finally {
      await this.releaseLock();
    }
  }

  private acquireLock(): Promise<boolean> {
    return this.casesRepository.tryAcquireCaseAiGenerationJobLock({
      lockedBy: this.lockOwner,
      lockName: JOB_LOCK_NAME,
      ttlSeconds: this.readJobLockTtlSeconds(),
    });
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.casesRepository.releaseCaseAiGenerationJobLock({
        lockedBy: this.lockOwner,
        lockName: JOB_LOCK_NAME,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Could not release AI case job lock: ${this.readErrorMessage(error)}`,
      );
    }
  }

  private readRequiredCronUserId(): string {
    const userId = this.readTextConfig('AI_CASE_CRON_USER_ID');

    if (!userId) {
      throw new Error('AI_CASE_CRON_USER_ID is required.');
    }

    return userId;
  }

  private isFailedRunWithCaseId(
    run: CaseAiGenerationRunRecord,
  ): run is CaseAiGenerationRunRecord & { readonly caseId: string } {
    return run.status === 'failed' && Boolean(run.caseId);
  }

  private createStaleRunningThreshold(): string {
    const staleRunningMinutes = this.readStaleRunningMinutes();

    return new Date(
      Date.now() - staleRunningMinutes * MILLISECONDS_PER_MINUTE,
    ).toISOString();
  }

  private readRecoveryBatchLimit(): number {
    return this.readPositiveIntegerConfig(
      'AI_CASE_RECOVERY_BATCH_LIMIT',
      DEFAULT_RECOVERY_BATCH_LIMIT,
    );
  }

  private readStaleRunningMinutes(): number {
    return this.readPositiveIntegerConfig(
      'AI_CASE_RUNNING_STALE_MINUTES',
      DEFAULT_STALE_RUNNING_MINUTES,
    );
  }

  private readJobLockTtlSeconds(): number {
    return this.readPositiveIntegerConfig(
      'AI_CASE_JOB_LOCK_TTL_SECONDS',
      DEFAULT_JOB_LOCK_TTL_SECONDS,
    );
  }

  private readPositiveIntegerConfig(key: string, defaultValue: number): number {
    const value = Number(this.readTextConfig(key));

    if (Number.isInteger(value) && value > 0) {
      return value;
    }

    return defaultValue;
  }

  private readTextConfig(key: string): string | undefined {
    const value = this.configService.get<string | number | boolean>(key);

    if (value === undefined || value === null) {
      return undefined;
    }

    const text = String(value).trim();

    return text.length > 0 ? text : undefined;
  }

  private readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error.';
  }
}
