import { ConfigService } from '@nestjs/config';
import { CaseAiGenerationWorkerService } from './case-ai-generation-worker.service';
import {
  CaseAiGenerationRunRecord,
  CasesRepository,
} from './modules/cases/cases.repository';
import { CaseAiGenerationWorkflowService } from './modules/cases/case-ai-generation-workflow.service';

type CasesRepositoryStub = Record<
  | 'findRecoverableCaseAiGenerationRuns'
  | 'markStaleRunningCaseAiGenerationRunsAsFailed'
  | 'releaseCaseAiGenerationJobLock'
  | 'tryAcquireCaseAiGenerationJobLock',
  jest.Mock
>;

type CaseAiGenerationWorkflowServiceStub = Record<
  'createFullAiCase' | 'recoverAiCaseGeneration',
  jest.Mock
>;

describe('CaseAiGenerationWorkerService', () => {
  let casesRepository: CasesRepositoryStub;
  let workflowService: CaseAiGenerationWorkflowServiceStub;

  beforeEach(() => {
    casesRepository = {
      findRecoverableCaseAiGenerationRuns: jest.fn(async () => []),
      markStaleRunningCaseAiGenerationRunsAsFailed: jest.fn(async () => 0),
      releaseCaseAiGenerationJobLock: jest.fn(async () => undefined),
      tryAcquireCaseAiGenerationJobLock: jest.fn(async () => true),
    };
    workflowService = {
      createFullAiCase: jest.fn(async () => ({ success: true })),
      recoverAiCaseGeneration: jest.fn(async () => ({ success: true })),
    };
  });

  it('fails when cron user id is missing', async () => {
    const service = createService({});

    await expect(service.createCase()).rejects.toThrow(
      'AI_CASE_CRON_USER_ID is required.',
    );

    expect(
      casesRepository.tryAcquireCaseAiGenerationJobLock,
    ).not.toHaveBeenCalled();
  });

  it('skips case creation when the job lock is owned elsewhere', async () => {
    casesRepository.tryAcquireCaseAiGenerationJobLock.mockResolvedValue(false);
    const service = createService({
      AI_CASE_CRON_USER_ID: 'user-id',
    });

    await service.createCase();

    expect(workflowService.createFullAiCase).not.toHaveBeenCalled();
    expect(
      casesRepository.releaseCaseAiGenerationJobLock,
    ).not.toHaveBeenCalled();
  });

  it('creates one full AI case when it acquires the job lock', async () => {
    const service = createService({
      AI_CASE_CRON_USER_ID: 'user-id',
    });

    await service.createCase();

    expect(
      casesRepository.tryAcquireCaseAiGenerationJobLock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        lockName: 'case-ai-generation',
        ttlSeconds: 7200,
      }),
    );
    expect(workflowService.createFullAiCase).toHaveBeenCalledWith({
      dto: {},
      userId: 'user-id',
    });
    expect(casesRepository.releaseCaseAiGenerationJobLock).toHaveBeenCalledWith(
      expect.objectContaining({
        lockName: 'case-ai-generation',
      }),
    );
  });

  it('releases the job lock when case creation fails', async () => {
    workflowService.createFullAiCase.mockRejectedValue(
      new Error('AI provider failed'),
    );
    const service = createService({
      AI_CASE_CRON_USER_ID: 'user-id',
    });

    await expect(service.createCase()).rejects.toThrow('AI provider failed');

    expect(casesRepository.releaseCaseAiGenerationJobLock).toHaveBeenCalled();
  });

  it('recovers at most the default failed case runs', async () => {
    casesRepository.findRecoverableCaseAiGenerationRuns.mockResolvedValue([
      createRun({ caseId: 'case-1', status: 'failed' }),
      createRun({ caseId: 'case-2', status: 'failed' }),
      createRun({ caseId: 'case-3', status: 'failed' }),
    ]);
    const service = createService({
      AI_CASE_CRON_USER_ID: 'user-id',
    });

    await service.recoverCases();

    expect(
      casesRepository.markStaleRunningCaseAiGenerationRunsAsFailed,
    ).toHaveBeenCalled();
    expect(
      casesRepository.findRecoverableCaseAiGenerationRuns,
    ).toHaveBeenCalledWith(2);
    expect(workflowService.recoverAiCaseGeneration).toHaveBeenCalledTimes(2);
    expect(workflowService.recoverAiCaseGeneration).toHaveBeenNthCalledWith(1, {
      caseId: 'case-1',
      userId: 'user-id',
    });
    expect(workflowService.recoverAiCaseGeneration).toHaveBeenNthCalledWith(2, {
      caseId: 'case-2',
      userId: 'user-id',
    });
  });

  it('does not recover needs_review runs', async () => {
    casesRepository.findRecoverableCaseAiGenerationRuns.mockResolvedValue([
      createRun({ caseId: 'case-review', status: 'needs_review' }),
      createRun({ caseId: 'case-failed', status: 'failed' }),
    ]);
    const service = createService({
      AI_CASE_CRON_USER_ID: 'user-id',
    });

    await service.recoverCases();

    expect(workflowService.recoverAiCaseGeneration).toHaveBeenCalledTimes(1);
    expect(workflowService.recoverAiCaseGeneration).toHaveBeenCalledWith({
      caseId: 'case-failed',
      userId: 'user-id',
    });
  });

  it('recovers failed case runs sequentially', async () => {
    const recoveryOrder: string[] = [];
    casesRepository.findRecoverableCaseAiGenerationRuns.mockResolvedValue([
      createRun({ caseId: 'case-1', status: 'failed' }),
      createRun({ caseId: 'case-2', status: 'failed' }),
    ]);
    workflowService.recoverAiCaseGeneration.mockImplementation(
      async (command: { readonly caseId: string }) => {
        recoveryOrder.push(`start:${command.caseId}`);
        await Promise.resolve();
        recoveryOrder.push(`end:${command.caseId}`);
      },
    );
    const service = createService({
      AI_CASE_CRON_USER_ID: 'user-id',
      AI_CASE_RECOVERY_BATCH_LIMIT: '2',
    });

    await service.recoverCases();

    expect(recoveryOrder).toEqual([
      'start:case-1',
      'end:case-1',
      'start:case-2',
      'end:case-2',
    ]);
  });

  function createService(
    env: Record<string, string>,
  ): CaseAiGenerationWorkerService {
    const configService = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;

    return new CaseAiGenerationWorkerService(
      configService,
      casesRepository as unknown as CasesRepository,
      workflowService as unknown as CaseAiGenerationWorkflowService,
    );
  }
});

function createRun(
  overrides: Partial<CaseAiGenerationRunRecord> = {},
): CaseAiGenerationRunRecord {
  return {
    attemptsByStep: {},
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    createdBy: 'user-id',
    currentStep: 'generate_investigation_graph',
    generationOptions: {},
    id: 'run-id',
    status: 'failed',
    updatedAt: '2026-05-24T15:00:00.000Z',
    ...overrides,
  };
}
