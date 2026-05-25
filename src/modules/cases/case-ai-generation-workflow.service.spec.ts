import { CasePlayabilityValidator } from './case-playability.validator';
import { CaseAiGenerationWorkflowService } from './case-ai-generation-workflow.service';
import {
  AdminContradictionRecord,
  AdminCaseRecord,
  AdminCaseSolutionRecord,
  AdminEvidenceRecord,
  AdminInvestigationActionRecord,
  AdminSolveRequirementRecord,
  AdminStatementRecord,
  AdminSuspectRecord,
  CaseAiGenerationRunRecord,
  CasePlayabilitySnapshot,
  CasesRepository,
} from './cases.repository';
import { CasesService } from './cases.service';

type CasesRepositoryStub = Record<
  | 'createCaseAiGenerationRun'
  | 'findCase'
  | 'findLatestCaseAiGenerationRunByCase'
  | 'findPlayabilitySnapshot'
  | 'updateCaseAiGenerationRun',
  jest.Mock
>;

type CasesServiceStub = Record<
  | 'createAiGeneratedCase'
  | 'generateCaseContradictions'
  | 'generateCaseEvidences'
  | 'generateCaseInvestigationGraph'
  | 'generateCaseSolution'
  | 'generateCaseSolveRequirements'
  | 'generateCaseStatements'
  | 'generateCaseSuspects'
  | 'getAdminCaseState',
  jest.Mock
>;

describe('CaseAiGenerationWorkflowService', () => {
  let casesService: CasesServiceStub;
  let repository: CasesRepositoryStub;
  let runRecord: CaseAiGenerationRunRecord;
  let service: CaseAiGenerationWorkflowService;
  let snapshot: CasePlayabilitySnapshot;

  beforeEach(() => {
    runRecord = createRun();
    snapshot = createSnapshot();
    repository = {
      createCaseAiGenerationRun: jest.fn(async (command) => {
        runRecord = createRun({
          attemptsByStep: command.attemptsByStep ?? {},
          caseId: command.caseId,
          createdBy: command.createdBy,
          culpritSuspectId: command.culpritSuspectId,
          currentStep: command.currentStep,
          difficulty: command.difficulty,
          generationOptions: command.generationOptions ?? {},
          status: command.status,
          theme: command.theme,
        });

        return runRecord;
      }),
      findCase: jest.fn(),
      findLatestCaseAiGenerationRunByCase: jest.fn(),
      findPlayabilitySnapshot: jest.fn(async () => snapshot),
      updateCaseAiGenerationRun: jest.fn(async (_, command) => {
        runRecord = {
          ...runRecord,
          ...command,
          lastError:
            command.lastError === null
              ? undefined
              : (command.lastError ?? runRecord.lastError),
          updatedAt: '2026-05-24T15:00:00.000Z',
        };

        return runRecord;
      }),
    };
    casesService = {
      createAiGeneratedCase: jest.fn(async () => ({
        data: snapshot.caseRecord,
        success: true,
      })),
      generateCaseContradictions: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          contradictions: [createContradiction()],
        });

        return {
          data: {
            contradictions: [],
            culpritSuspectId: 'suspect-id',
            difficulty: 'medium',
            usedFallback: false,
          },
          success: true,
        };
      }),
      generateCaseEvidences: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          evidences: [createEvidence()],
        });

        return {
          data: {
            evidences: [],
            selectedCulpritSuspectId: 'suspect-id',
            usedFallback: false,
          },
          success: true,
        };
      }),
      generateCaseInvestigationGraph: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          actions: [createAction()],
        });

        return {
          data: {
            actionPrerequisites: [],
            actions: [],
            contradictionUnlockRules: [],
            culpritSuspectId: 'suspect-id',
            difficulty: 'medium',
            evidenceUnlockRules: [],
            statementUnlockRules: [],
            usedFallback: false,
          },
          success: true,
        };
      }),
      generateCaseSolution: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          solution: createSolution(),
        });

        return {
          data: {
            culpritSuspectId: 'suspect-id',
            solution: createSolution(),
            usedFallback: false,
          },
          success: true,
        };
      }),
      generateCaseSolveRequirements: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          requirements: [createRequirement()],
        });

        return {
          data: {
            culpritSuspectId: 'suspect-id',
            difficulty: 'medium',
            requirements: [],
            usedFallback: false,
          },
          success: true,
        };
      }),
      generateCaseStatements: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          statements: [createStatement()],
        });

        return {
          data: {
            culpritSuspectId: 'suspect-id',
            statements: [],
            usedFallback: false,
          },
          success: true,
        };
      }),
      generateCaseSuspects: jest.fn(async () => {
        snapshot = createSnapshot({
          ...snapshot,
          suspects: [
            createSuspect(),
            createSuspect({ id: 'second-suspect-id' }),
          ],
        });

        return {
          data: {
            difficulty: 'medium',
            suspectCount: 2,
            suspects: [],
            usedFallback: false,
          },
          success: true,
        };
      }),
      getAdminCaseState: jest.fn(async () => ({
        caseId: 'case-id',
        currentProcess: {
          code: 'ready_to_publish',
          label: 'Listo para publicar',
        },
        progress: {} as never,
        publishability: {
          blockingIssues: [],
          canPublish: true,
          warnings: [],
        },
        status: 'draft',
      })),
    };
    service = new CaseAiGenerationWorkflowService(
      repository as unknown as CasesRepository,
      casesService as unknown as CasesService,
      {
        validate: jest.fn(() => ({
          blockingIssues: [],
          canPublish: true,
          warnings: [],
        })),
      } as unknown as CasePlayabilityValidator,
    );
  });

  it('creates a full AI case through the generation pipeline', async () => {
    const response = await service.createFullAiCase({
      dto: {
        difficulty: 'medium',
        evidenceCount: 5,
        suspectCount: 2,
        theme: 'hackeo de influencer',
      },
      userId: 'user-id',
    });

    expect(casesService.createAiGeneratedCase).toHaveBeenCalledWith({
      dto: {
        difficulty: 'medium',
        theme: 'hackeo de influencer',
      },
      userId: 'user-id',
    });
    expect(casesService.generateCaseEvidences).toHaveBeenCalledWith(
      'case-id',
      expect.objectContaining({ evidenceCount: 5 }),
    );
    expect(response.data.run.status).toBe('completed');
    expect(response.data.run.culpritSuspectId).toBe('suspect-id');
    expect(response.data.run.attemptsByStep.generate_investigation_graph).toBe(
      1,
    );
  });

  it('stops and keeps the case when a step fails twice', async () => {
    casesService.generateCaseSuspects.mockRejectedValue(
      new Error('AI provider failed with invalid_json'),
    );

    const response = await service.createFullAiCase({
      dto: {
        difficulty: 'medium',
        theme: 'archivo cerrado',
      },
      userId: 'user-id',
    });

    expect(casesService.generateCaseSuspects).toHaveBeenCalledTimes(2);
    expect(response.data.run.caseId).toBe('case-id');
    expect(response.data.run.currentStep).toBe('generate_suspects');
    expect(response.data.run.status).toBe('failed');
    expect(response.data.run.lastError).toContain('invalid_json');
  });

  it('starts a fresh recovery run and continues from missing content', async () => {
    repository.findLatestCaseAiGenerationRunByCase.mockResolvedValue(
      createRun({
        attemptsByStep: { generate_evidences: 2 },
        caseId: 'case-id',
        culpritSuspectId: 'suspect-id',
        currentStep: 'generate_evidences',
        generationOptions: { evidenceCount: 7 },
        status: 'failed',
      }),
    );
    snapshot = createSnapshot({
      suspects: [createSuspect(), createSuspect({ id: 'second-suspect-id' })],
    });

    const response = await service.recoverAiCaseGeneration({
      caseId: 'case-id',
      userId: 'user-id',
    });

    expect(repository.createCaseAiGenerationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptsByStep: {},
        caseId: 'case-id',
        culpritSuspectId: 'suspect-id',
        generationOptions: { evidenceCount: 7 },
      }),
    );
    expect(casesService.generateCaseEvidences).toHaveBeenCalledWith(
      'case-id',
      expect.objectContaining({ evidenceCount: 7 }),
    );
    expect(response.data.run.status).toBe('completed');
  });
});

function createRun(
  overrides: Partial<CaseAiGenerationRunRecord> = {},
): CaseAiGenerationRunRecord {
  return {
    attemptsByStep: {},
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    createdBy: 'user-id',
    currentStep: 'generate_case_base',
    difficulty: 'medium',
    generationOptions: {},
    id: 'run-id',
    status: 'running',
    theme: 'hackeo de influencer',
    updatedAt: '2026-05-24T15:00:00.000Z',
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<CasePlayabilitySnapshot> = {},
): CasePlayabilitySnapshot {
  return {
    actionPrerequisites: [],
    actions: [],
    caseRecord: createCase(),
    contradictionUnlockRules: [],
    contradictions: [],
    evidenceUnlockRules: [],
    evidences: [],
    requirements: [],
    solution: undefined,
    statementUnlockRules: [],
    statements: [],
    suspects: [],
    ...overrides,
  } as CasePlayabilitySnapshot;
}

function createCase(overrides: Partial<AdminCaseRecord> = {}): AdminCaseRecord {
  return {
    aiGenerationMetadata: {},
    createdAt: '2026-05-24T15:00:00.000Z',
    createdBy: 'user-id',
    departmentId: null,
    difficulty: 'medium',
    generatedByAi: true,
    id: 'case-id',
    status: 'draft',
    summary: 'Caso generado por IA.',
    title: 'Hackeo de influencer',
    updatedAt: '2026-05-24T15:00:00.000Z',
    ...overrides,
  };
}

function createSuspect(
  overrides: Partial<AdminSuspectRecord> = {},
): AdminSuspectRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    id: 'suspect-id',
    name: 'Sofia Herrera',
    ...overrides,
  };
}

function createEvidence(): AdminEvidenceRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    description: 'Registro critico.',
    id: 'evidence-id',
    importance: 'critical',
    isDecoy: false,
    isInitiallyVisible: false,
    metadata: {},
    title: 'Registro de acceso',
    type: 'digital',
    weight: 10,
  };
}

function createSolution(): AdminCaseSolutionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    culpritSuspectId: 'suspect-id',
    fullExplanation: 'Sofia cometio el hackeo.',
    id: 'solution-id',
    methodSummary: 'Uso credenciales filtradas.',
    motiveSummary: 'Venganza profesional.',
    opportunitySummary: 'Tenia acceso al dispositivo.',
  };
}

function createStatement(): AdminStatementRecord {
  return {
    caseId: 'case-id',
    content: 'No sali de mi apartamento.',
    createdAt: '2026-05-24T15:00:00.000Z',
    id: 'statement-id',
    isInitiallyVisible: true,
    speakerName: 'Sofia Herrera',
    suspectId: 'suspect-id',
  };
}

function createContradiction(): AdminContradictionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    explanation: 'El registro contradice la coartada.',
    id: 'contradiction-id',
    isInitiallyVisible: false,
    proves: 'culprit_identity',
    refutingEvidenceId: 'evidence-id',
    statementId: 'statement-id',
    suspectId: 'suspect-id',
    title: 'Coartada falsa',
  };
}

function createRequirement(): AdminSolveRequirementRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    description: 'Identificar al culpable.',
    id: 'requirement-id',
    isMandatory: true,
    proofRole: 'culprit_identity',
    requiredSuspectId: 'suspect-id',
    requirementType: 'identify_culprit',
    weight: 10,
  };
}

function createAction(): AdminInvestigationActionRecord {
  return {
    actionType: 'inspect_scene',
    baseDurationMinutes: 30,
    caseId: 'case-id',
    createdAt: '2026-05-24T15:00:00.000Z',
    description: 'Examinar registros.',
    id: 'action-id',
    isInitiallyAvailable: true,
    metadata: {},
    minimumSkillLevel: 50,
    requiresDetective: false,
    title: 'Examinar registros',
  };
}
