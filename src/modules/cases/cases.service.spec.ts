import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  GeneratedAdminCaseBase,
  GenerateAdminCaseBaseResult,
  GeneratedCaseContradiction,
  GeneratedCaseEvidence,
  GeneratedCaseInvestigationAction,
  GeneratedCaseInvestigationGraphContent,
  GeneratedCaseSolveRequirement,
  GeneratedCaseSolution,
  GeneratedCaseStatement,
  GeneratedCaseSuspect,
} from '../ai/types/ai.types';
import { CasePlayabilityValidator } from './case-playability.validator';
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
} from './cases.repository';
import { CasesService } from './cases.service';

type CasesRepositoryStub = jest.Mocked<
  Pick<
    CasesRepository,
    | 'createContradiction'
    | 'createContradictions'
    | 'createActionPrerequisites'
    | 'createContradictionUnlockRule'
    | 'createEvidences'
    | 'createEvidenceUnlockRule'
    | 'createInvestigationGraph'
    | 'createInvestigationAction'
    | 'createAiGeneratedCase'
    | 'createManualCase'
    | 'createSolution'
    | 'createSolveRequirements'
    | 'createStatementUnlockRule'
    | 'createStatements'
    | 'createSuspects'
    | 'findCase'
    | 'findContradictionsByCase'
    | 'findEvidencesByCase'
    | 'findEvidence'
    | 'findAdminCases'
    | 'findInitialStatementsByCase'
    | 'findRequirementsByCase'
    | 'findPlayabilitySnapshot'
    | 'findRecentCaseTitles'
    | 'findRandomPlayableCaseBase'
    | 'findSolutionByCase'
    | 'findStatementsByCase'
    | 'findStatement'
    | 'findSuspectsByCase'
  >
>;
type AiServiceStub = jest.Mocked<
  Pick<
    AiService,
    | 'generateCaseContradictions'
    | 'generateAdminCaseBase'
    | 'generateCaseEvidences'
    | 'generateCaseInvestigationGraph'
    | 'generateCaseSolveRequirements'
    | 'generateCaseSolution'
    | 'generateCaseStatements'
    | 'generateCaseSuspects'
  >
>;

describe('CasesService', () => {
  let aiService: AiServiceStub;
  let repository: CasesRepositoryStub;
  let service: CasesService;

  beforeEach(() => {
    aiService = {
      generateAdminCaseBase: jest.fn(),
      generateCaseContradictions: jest.fn(),
      generateCaseEvidences: jest.fn(),
      generateCaseInvestigationGraph: jest.fn(),
      generateCaseSolveRequirements: jest.fn(),
      generateCaseSolution: jest.fn(),
      generateCaseStatements: jest.fn(),
      generateCaseSuspects: jest.fn(),
    };
    repository = {
      createContradiction: jest.fn(),
      createContradictions: jest.fn(),
      createActionPrerequisites: jest.fn(),
      createContradictionUnlockRule: jest.fn(),
      createEvidences: jest.fn(),
      createEvidenceUnlockRule: jest.fn(),
      createInvestigationGraph: jest.fn(),
      createInvestigationAction: jest.fn(),
      createAiGeneratedCase: jest.fn(),
      createManualCase: jest.fn(),
      createSolution: jest.fn(),
      createSolveRequirements: jest.fn(),
      createStatementUnlockRule: jest.fn(),
      createStatements: jest.fn(),
      createSuspects: jest.fn(),
      findCase: jest.fn(),
      findContradictionsByCase: jest.fn(),
      findEvidencesByCase: jest.fn(),
      findEvidence: jest.fn(),
      findAdminCases: jest.fn(),
      findInitialStatementsByCase: jest.fn(),
      findRequirementsByCase: jest.fn(),
      findPlayabilitySnapshot: jest.fn(),
      findRecentCaseTitles: jest.fn(),
      findRandomPlayableCaseBase: jest.fn(),
      findSolutionByCase: jest.fn(),
      findStatementsByCase: jest.fn(),
      findStatement: jest.fn(),
      findSuspectsByCase: jest.fn(),
    };
    service = new CasesService(
      aiService as unknown as AiService,
      repository as unknown as CasesRepository,
      new CasePlayabilityValidator(),
    );
  });

  function mockValidContradictionGenerationContext(
    overrides: {
      readonly caseRecord?: AdminCaseRecord;
      readonly contradictions?: readonly AdminContradictionRecord[];
      readonly evidences?: readonly AdminEvidenceRecord[];
      readonly statements?: readonly AdminStatementRecord[];
      readonly suspects?: readonly AdminSuspectRecord[];
    } = {},
  ): void {
    repository.findCase.mockResolvedValue(overrides.caseRecord ?? createCase());
    repository.findSuspectsByCase.mockResolvedValue([
      ...(overrides.suspects ?? [createSuspect()]),
    ]);
    repository.findEvidencesByCase.mockResolvedValue([
      ...(overrides.evidences ?? [createEvidence()]),
    ]);
    repository.findStatementsByCase.mockResolvedValue([
      ...(overrides.statements ?? [
        createStatement({ suspectId: 'suspect-id' }),
      ]),
    ]);
    repository.findContradictionsByCase.mockResolvedValue([
      ...(overrides.contradictions ?? []),
    ]);
  }

  function mockValidSolutionGenerationContext(
    overrides: {
      readonly caseRecord?: AdminCaseRecord;
      readonly contradictions?: readonly AdminContradictionRecord[];
      readonly evidences?: readonly AdminEvidenceRecord[];
      readonly solution?: AdminCaseSolutionRecord;
      readonly statements?: readonly AdminStatementRecord[];
      readonly suspects?: readonly AdminSuspectRecord[];
    } = {},
  ): void {
    repository.findCase.mockResolvedValue(overrides.caseRecord ?? createCase());
    repository.findSuspectsByCase.mockResolvedValue([
      ...(overrides.suspects ?? [createSuspect()]),
    ]);
    repository.findEvidencesByCase.mockResolvedValue([
      ...(overrides.evidences ?? [createEvidence()]),
    ]);
    repository.findStatementsByCase.mockResolvedValue([
      ...(overrides.statements ?? [
        createStatement({ suspectId: 'suspect-id' }),
      ]),
    ]);
    repository.findContradictionsByCase.mockResolvedValue([
      ...(overrides.contradictions ?? [createContradiction()]),
    ]);
    repository.findSolutionByCase.mockResolvedValue(overrides.solution);
  }

  it('creates manual cases as unassigned global drafts', async () => {
    repository.createManualCase.mockResolvedValue(createCase());

    const response = await service.createManualCase({
      userId: 'user-id',
      dto: {
        difficulty: 'medium',
        summary: 'Un expediente manual de prueba.',
        title: 'Caso manual',
      },
    });

    expect(response.data.departmentId).toBeNull();
    expect(repository.createManualCase).toHaveBeenCalledWith({
      aiGenerationMetadata: undefined,
      aiModel: undefined,
      createdBy: 'user-id',
      difficulty: 'medium',
      generationPrompt: undefined,
      publicBriefing: undefined,
      summary: 'Un expediente manual de prueba.',
      title: 'Caso manual',
      victimName: undefined,
    });
  });

  it('creates AI generated cases with explicit theme and difficulty', async () => {
    repository.findRecentCaseTitles.mockResolvedValue(['Caso anterior']);
    aiService.generateAdminCaseBase.mockResolvedValue(
      createGeneratedAdminCaseBase({
        difficulty: 'hard',
        publicBriefing: 'Briefing visible para el jugador.',
        title: 'El Archivo Invertido',
        victimName: 'Roberto Salas',
      }),
    );
    repository.createAiGeneratedCase.mockResolvedValue(
      createCase({
        difficulty: 'hard',
        generatedByAi: true,
        generationPrompt: 'sabotaje documental',
        title: 'El Archivo Invertido',
      }),
    );

    const response = await service.createAiGeneratedCase({
      userId: 'user-id',
      dto: {
        difficulty: 'hard',
        theme: '  sabotaje documental  ',
      },
    });

    expect(repository.findRecentCaseTitles).toHaveBeenCalledWith(500);
    expect(aiService.generateAdminCaseBase).toHaveBeenCalledWith({
      difficulty: 'hard',
      forbiddenTitles: ['Caso anterior'],
      theme: 'sabotaje documental',
    });
    expect(repository.createAiGeneratedCase).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'user-id',
        difficulty: 'hard',
        generationPrompt: 'sabotaje documental',
        publicBriefing: 'Briefing visible para el jugador.',
        summary: 'Un expediente generado por IA para probar el flujo admin.',
        title: 'El Archivo Invertido',
        victimName: 'Roberto Salas',
      }),
    );
    expect(repository.createAiGeneratedCase).toHaveBeenCalledWith(
      expect.objectContaining({
        aiGenerationMetadata: expect.objectContaining({
          difficultySource: 'request',
          forbiddenTitleCount: 1,
          forbiddenTitleLimit: 500,
          generatedAt: expect.any(String),
          themeProvided: true,
        }),
      }),
    );
    expect(response.data.generatedByAi).toBe(true);
  });

  it('creates AI generated cases without theme', async () => {
    repository.findRecentCaseTitles.mockResolvedValue([]);
    aiService.generateAdminCaseBase.mockResolvedValue(
      createGeneratedAdminCaseBase({ difficulty: 'easy' }),
    );
    repository.createAiGeneratedCase.mockResolvedValue(
      createCase({ difficulty: 'easy', generatedByAi: true }),
    );

    await service.createAiGeneratedCase({
      userId: 'user-id',
      dto: {
        difficulty: 'easy',
      },
    });

    expect(aiService.generateAdminCaseBase).toHaveBeenCalledWith({
      difficulty: 'easy',
      forbiddenTitles: [],
      theme: undefined,
    });
    expect(repository.createAiGeneratedCase).toHaveBeenCalledWith(
      expect.objectContaining({
        generationPrompt: undefined,
        aiGenerationMetadata: expect.objectContaining({
          themeProvided: false,
        }),
      }),
    );
  });

  it('chooses a weighted random difficulty when AI case difficulty is omitted', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.8);
    repository.findRecentCaseTitles.mockResolvedValue([]);
    aiService.generateAdminCaseBase.mockResolvedValue(
      createGeneratedAdminCaseBase({ difficulty: 'hard' }),
    );
    repository.createAiGeneratedCase.mockResolvedValue(
      createCase({ difficulty: 'hard', generatedByAi: true }),
    );

    await service.createAiGeneratedCase({
      userId: 'user-id',
      dto: {},
    });

    expect(aiService.generateAdminCaseBase).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: 'hard',
      }),
    );
    expect(repository.createAiGeneratedCase).toHaveBeenCalledWith(
      expect.objectContaining({
        aiGenerationMetadata: expect.objectContaining({
          difficultySource: 'random',
        }),
        difficulty: 'hard',
      }),
    );

    randomSpy.mockRestore();
  });

  it('rejects AI generated cases when the title duplicates a recent case', async () => {
    repository.findRecentCaseTitles.mockResolvedValue(['Caso anterior']);
    aiService.generateAdminCaseBase.mockResolvedValue(
      createGeneratedAdminCaseBase({
        title: ' caso   anterior ',
      }),
    );

    await expect(
      service.createAiGeneratedCase({
        userId: 'user-id',
        dto: {
          difficulty: 'medium',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createAiGeneratedCase).not.toHaveBeenCalled();
  });

  it('generates and persists case suspects with an explicit count', async () => {
    repository.findCase.mockResolvedValue(createCase({ difficulty: 'hard' }));
    repository.findSuspectsByCase.mockResolvedValue([]);
    aiService.generateCaseSuspects.mockResolvedValue({
      suspects: [
        createGeneratedSuspect({ name: 'Alicia Mora' }),
        createGeneratedSuspect({ name: 'Bruno Rivas', occupation: 'Guardia' }),
      ],
      usedFallback: false,
    });
    repository.createSuspects.mockResolvedValue([
      createSuspect({ name: 'Alicia Mora' }),
      createSuspect({
        id: 'other-suspect-id',
        name: 'Bruno Rivas',
        occupation: 'Guardia',
      }),
    ]);

    const response = await service.generateCaseSuspects('case-id', {
      suspectCount: 2,
    });

    expect(aiService.generateCaseSuspects).toHaveBeenCalledWith({
      caseData: expect.objectContaining({
        difficulty: 'hard',
        id: 'case-id',
        title: 'Caso manual',
      }),
      difficulty: 'hard',
      suspectCount: 2,
    });
    expect(repository.createSuspects).toHaveBeenCalledWith([
      expect.objectContaining({
        caseId: 'case-id',
        name: 'Alicia Mora',
      }),
      expect.objectContaining({
        caseId: 'case-id',
        name: 'Bruno Rivas',
      }),
    ]);
    expect(response.data).toEqual(
      expect.objectContaining({
        difficulty: 'hard',
        suspectCount: 2,
        usedFallback: false,
      }),
    );
    expect(response.data.suspects).toHaveLength(2);
  });

  it('uses the case difficulty rule when suspect count is omitted', async () => {
    repository.findCase.mockResolvedValue(createCase({ difficulty: 'expert' }));
    repository.findSuspectsByCase.mockResolvedValue([]);
    aiService.generateCaseSuspects.mockResolvedValue({
      suspects: [
        createGeneratedSuspect({ name: 'Alicia Mora' }),
        createGeneratedSuspect({ name: 'Bruno Rivas' }),
        createGeneratedSuspect({ name: 'Iris Duarte' }),
        createGeneratedSuspect({ name: 'Tomas Arce' }),
        createGeneratedSuspect({ name: 'Nadia Rios' }),
      ],
      usedFallback: false,
    });
    repository.createSuspects.mockResolvedValue([
      createSuspect({ name: 'Alicia Mora' }),
      createSuspect({ id: 'suspect-two', name: 'Bruno Rivas' }),
      createSuspect({ id: 'suspect-three', name: 'Iris Duarte' }),
      createSuspect({ id: 'suspect-four', name: 'Tomas Arce' }),
      createSuspect({ id: 'suspect-five', name: 'Nadia Rios' }),
    ]);

    const response = await service.generateCaseSuspects('case-id', {});

    expect(aiService.generateCaseSuspects).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: 'expert',
        suspectCount: 5,
      }),
    );
    expect(response.data.suspectCount).toBe(5);
  });

  it('rejects generated suspects for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);
    repository.findSuspectsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseSuspects('case-id', { suspectCount: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiService.generateCaseSuspects).not.toHaveBeenCalled();
    expect(repository.createSuspects).not.toHaveBeenCalled();
  });

  it('rejects generated suspects when the case already has suspects', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);

    await expect(
      service.generateCaseSuspects('case-id', { suspectCount: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSuspects).not.toHaveBeenCalled();
    expect(repository.createSuspects).not.toHaveBeenCalled();
  });

  it('does not persist generated suspects when AI generation fails', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([]);
    aiService.generateCaseSuspects.mockRejectedValue(
      new Error('AI provider failed with invalid_generated_suspects'),
    );

    await expect(
      service.generateCaseSuspects('case-id', { suspectCount: 2 }),
    ).rejects.toThrow('AI provider failed with invalid_generated_suspects');

    expect(repository.createSuspects).not.toHaveBeenCalled();
  });

  it('returns a random playable case base by difficulty', async () => {
    repository.findRandomPlayableCaseBase.mockResolvedValue(
      createCase({ difficulty: 'hard' }),
    );

    const caseRecord = await service.getRandomPlayableCaseBase({
      departmentId: 'department-id',
      difficulty: 'hard',
    });

    expect(repository.findRandomPlayableCaseBase).toHaveBeenCalledWith({
      departmentId: 'department-id',
      difficulty: 'hard',
    });
    expect(caseRecord?.difficulty).toBe('hard');
  });

  it('returns paginated admin cases with status filter', async () => {
    repository.findAdminCases.mockResolvedValue({
      cases: [createCase({ status: 'draft' })],
      total: 11,
    });

    const response = await service.getAdminCases({
      limit: 10,
      page: 2,
      sort: 'asc',
      status: 'draft',
    });

    expect(repository.findAdminCases).toHaveBeenCalledWith({
      limit: 10,
      page: 2,
      sort: 'asc',
      status: 'draft',
    });
    expect(response.cases).toHaveLength(1);
    expect(response.pagination).toEqual({
      hasNextPage: false,
      hasPreviousPage: true,
      limit: 10,
      page: 2,
      sort: 'asc',
      status: 'draft',
      total: 11,
      totalPages: 2,
    });
  });

  it('returns suspects for an existing case', async () => {
    repository.findCase.mockResolvedValue(createCase({ status: 'playable' }));
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.findInitialStatementsByCase.mockResolvedValue([
      createStatement({
        content: 'Vi a Alicia entrar al archivo.',
        speakerName: 'Alicia Mora',
        suspectId: 'suspect-id',
      }),
      createStatement({
        id: 'other-statement-id',
        suspectId: 'other-suspect-id',
      }),
    ]);

    const response = await service.getCaseSuspects('case-id');

    expect(repository.findCase).toHaveBeenCalledWith('case-id');
    expect(repository.findSuspectsByCase).toHaveBeenCalledWith('case-id');
    expect(repository.findInitialStatementsByCase).toHaveBeenCalledWith(
      'case-id',
    );
    expect(response.suspects).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'suspect-id',
        name: 'Alicia Mora',
        statements: [
          expect.objectContaining({
            content: 'Vi a Alicia entrar al archivo.',
            id: 'statement-id',
            suspectId: 'suspect-id',
          }),
        ],
      }),
    ]);
  });

  it('rejects suspect queries for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);

    await expect(service.getCaseSuspects('case-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findSuspectsByCase).not.toHaveBeenCalled();
    expect(repository.findInitialStatementsByCase).not.toHaveBeenCalled();
  });

  it('rejects suspect queries for non-playable cases', async () => {
    repository.findCase.mockResolvedValue(createCase({ status: 'draft' }));

    await expect(service.getCaseSuspects('case-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findSuspectsByCase).not.toHaveBeenCalled();
    expect(repository.findInitialStatementsByCase).not.toHaveBeenCalled();
  });

  it('returns all suspects and statements for an existing case in the admin flow', async () => {
    repository.findCase.mockResolvedValue(createCase({ status: 'draft' }));
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.findStatementsByCase.mockResolvedValue([
      createStatement({
        content: 'Declaracion inicial.',
        isInitiallyVisible: true,
        suspectId: 'suspect-id',
      }),
      createStatement({
        content: 'Declaracion oculta.',
        id: 'hidden-statement-id',
        isInitiallyVisible: false,
        suspectId: 'suspect-id',
      }),
    ]);

    const response = await service.getAdminCaseSuspects('case-id');

    expect(repository.findCase).toHaveBeenCalledWith('case-id');
    expect(repository.findSuspectsByCase).toHaveBeenCalledWith('case-id');
    expect(repository.findStatementsByCase).toHaveBeenCalledWith('case-id');
    expect(response.suspects[0]?.statements).toEqual([
      expect.objectContaining({
        content: 'Declaracion inicial.',
        isInitiallyVisible: true,
      }),
      expect.objectContaining({
        content: 'Declaracion oculta.',
        id: 'hidden-statement-id',
        isInitiallyVisible: false,
      }),
    ]);
  });

  it('returns the solution for an existing case', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSolutionByCase.mockResolvedValue(createSolution());

    const response = await service.getCaseSolution('case-id');

    expect(repository.findCase).toHaveBeenCalledWith('case-id');
    expect(repository.findSolutionByCase).toHaveBeenCalledWith('case-id');
    expect(response.solution).toEqual(
      expect.objectContaining({
        caseId: 'case-id',
        culpritSuspectId: 'suspect-id',
        id: 'solution-id',
      }),
    );
  });

  it('rejects solution queries for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);

    await expect(service.getCaseSolution('case-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findSolutionByCase).not.toHaveBeenCalled();
  });

  it('rejects solution queries when the case has no solution', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSolutionByCase.mockResolvedValue(undefined);

    await expect(service.getCaseSolution('case-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns solve requirements for an existing case', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findRequirementsByCase.mockResolvedValue([createRequirement()]);

    const response = await service.getCaseRequirements('case-id');

    expect(repository.findCase).toHaveBeenCalledWith('case-id');
    expect(repository.findRequirementsByCase).toHaveBeenCalledWith('case-id');
    expect(response.requirements).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'requirement-id',
        requiredSuspectId: 'suspect-id',
        requirementType: 'identity',
      }),
    ]);
  });

  it('returns an empty requirement list for cases without requirements', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findRequirementsByCase.mockResolvedValue([]);

    const response = await service.getCaseRequirements('case-id');

    expect(response.requirements).toEqual([]);
  });

  it('rejects requirement queries for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);

    await expect(service.getCaseRequirements('case-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findRequirementsByCase).not.toHaveBeenCalled();
  });

  it('returns evidences for an existing case in the admin flow', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findEvidencesByCase.mockResolvedValue([createEvidence()]);

    const response = await service.getAdminCaseEvidences('case-id');

    expect(repository.findCase).toHaveBeenCalledWith('case-id');
    expect(repository.findEvidencesByCase).toHaveBeenCalledWith('case-id');
    expect(response.evidences).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'evidence-id',
        title: 'Registro del archivo',
      }),
    ]);
  });

  it('rejects admin evidence queries for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);

    await expect(
      service.getAdminCaseEvidences('case-id'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findEvidencesByCase).not.toHaveBeenCalled();
  });

  it('returns contradictions for an existing case in the admin flow', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findContradictionsByCase.mockResolvedValue([
      createContradiction(),
    ]);

    const response = await service.getAdminCaseContradictions('case-id');

    expect(repository.findCase).toHaveBeenCalledWith('case-id');
    expect(repository.findContradictionsByCase).toHaveBeenCalledWith('case-id');
    expect(response.contradictions).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'contradiction-id',
        suspectId: 'suspect-id',
        title: 'Registro contra declaracion',
      }),
    ]);
  });

  it('rejects admin contradiction queries for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);

    await expect(
      service.getAdminCaseContradictions('case-id'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findContradictionsByCase).not.toHaveBeenCalled();
  });

  it('returns the current admin case state and authoring progress', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        actions: [createAction()],
        contradictionUnlockRules: [createContradictionUnlockRule()],
        evidenceUnlockRules: [createEvidenceUnlockRule()],
        requirements: [createRequirement()],
        statementUnlockRules: [createStatementUnlockRule()],
        suspects: [createSuspect(), createSuspect({ id: 'second-suspect-id' })],
      }),
    );

    const response = await service.getAdminCaseState('case-id');

    expect(repository.findPlayabilitySnapshot).toHaveBeenCalledWith('case-id');
    expect(response).toEqual(
      expect.objectContaining({
        caseId: 'case-id',
        currentProcess: {
          code: 'ready_to_publish',
          label: 'Listo para publicar',
        },
        status: 'draft',
      }),
    );
    expect(response.progress).toEqual(
      expect.objectContaining({
        actions: { count: 1, hasItems: true },
        contradictions: { count: 1, hasItems: true },
        evidences: { count: 1, hasItems: true },
        solution: { count: 1, hasItems: true },
        solveRequirements: { count: 1, hasItems: true },
        statements: { count: 1, hasItems: true },
        suspects: { count: 2, hasItems: true },
      }),
    );
    expect(response.progress.unlockRules).toEqual({
      actionPrerequisites: { count: 0, hasItems: false },
      contradictions: { count: 1, hasItems: true },
      evidences: { count: 1, hasItems: true },
      statements: { count: 1, hasItems: true },
    });
    expect(response.publishability.canPublish).toBe(true);
  });

  it('points the current admin case process to the first missing authoring step', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        evidences: [],
        statements: [],
      }),
    );

    const response = await service.getAdminCaseState('case-id');

    expect(response.currentProcess).toEqual({
      code: 'add_evidences',
      label: 'Cargar evidencias',
    });
    expect(response.progress.evidences).toEqual({
      count: 0,
      hasItems: false,
    });
  });

  it('does not request statement unlock rules for initially visible statements', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        actions: [createAction()],
        contradictionUnlockRules: [createContradictionUnlockRule()],
        requirements: [createRequirement()],
        statements: [
          createStatement({
            isInitiallyVisible: true,
          }),
        ],
      }),
    );

    const response = await service.getAdminCaseState('case-id');

    expect(response.currentProcess.code).not.toBe(
      'configure_statement_unlock_rules',
    );
  });

  it('requests statement unlock rules when a hidden statement has no rule', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        actions: [createAction()],
        contradictionUnlockRules: [createContradictionUnlockRule()],
        requirements: [createRequirement()],
        statementUnlockRules: [createStatementUnlockRule()],
        statements: [
          createStatement(),
          createStatement({
            id: 'unlocked-later-statement-id',
            isInitiallyVisible: false,
          }),
        ],
      }),
    );

    const response = await service.getAdminCaseState('case-id');

    expect(response.currentProcess).toEqual({
      code: 'configure_statement_unlock_rules',
      label: 'Configurar reglas de desbloqueo de declaraciones',
    });
  });

  it('rejects admin case state queries for missing cases', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(undefined);

    await expect(service.getAdminCaseState('case-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns an admin investigation graph ready for frontend rendering', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        actionPrerequisites: [createActionPrerequisite()],
        actions: [
          createAction({
            id: 'action-inspect',
            isInitiallyAvailable: true,
            title: 'Inspeccionar escena',
          }),
          createAction({
            id: 'action-compare',
            isInitiallyAvailable: false,
            title: 'Contrastar versiones',
          }),
        ],
        contradictionUnlockRules: [
          createContradictionUnlockRule({ actionId: 'action-inspect' }),
        ],
        evidenceUnlockRules: [
          createEvidenceUnlockRule({ actionId: 'action-inspect' }),
        ],
        statementUnlockRules: [
          createStatementUnlockRule({ actionId: 'action-inspect' }),
        ],
      }),
    );

    const response = await service.getAdminCaseInvestigationGraph('case-id');

    expect(repository.findPlayabilitySnapshot).toHaveBeenCalledWith('case-id');
    expect(response.caseId).toBe('case-id');
    expect(response.actions).toEqual([
      expect.objectContaining({
        id: 'action-inspect',
        isInitial: true,
        nodeType: 'action',
        unlockIds: ['evidence-id', 'statement-id', 'contradiction-id'],
      }),
      expect.objectContaining({
        id: 'action-compare',
        isInitial: false,
        nodeType: 'action',
        prerequisiteIds: ['action-inspect'],
      }),
    ]);
    expect(response.resources.evidences).toEqual([
      expect.objectContaining({
        id: 'evidence-id',
        nodeType: 'evidence',
        resourceType: 'evidence',
      }),
    ]);
    expect(response.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeType: 'action_prerequisite',
          fromId: 'action-inspect',
          toId: 'action-compare',
        }),
        expect.objectContaining({
          edgeType: 'unlock_evidence',
          fromId: 'action-inspect',
          toId: 'evidence-id',
        }),
        expect.objectContaining({
          edgeType: 'unlock_statement',
          fromId: 'action-inspect',
          toId: 'statement-id',
        }),
        expect.objectContaining({
          edgeType: 'unlock_contradiction',
          fromId: 'action-inspect',
          toId: 'contradiction-id',
        }),
      ]),
    );
  });

  it('rejects admin investigation graph queries for missing cases', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(undefined);

    await expect(
      service.getAdminCaseInvestigationGraph('case-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('generates and persists case evidences without creating a solution', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.createEvidences.mockResolvedValue([createEvidence()]);
    aiService.generateCaseEvidences.mockResolvedValue({
      evidences: [createGeneratedEvidence()],
      selectedCulpritSuspectId: 'suspect-id',
      usedFallback: false,
    });

    const response = await service.generateCaseEvidences('case-id', {
      evidenceCount: 1,
    });

    expect(aiService.generateCaseEvidences).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceCount: 1,
        generateSolution: false,
      }),
    );
    expect(repository.createEvidences).toHaveBeenCalledWith([
      expect.objectContaining({
        caseId: 'case-id',
        title: 'Registro de acceso',
      }),
    ]);
    expect(repository.createSolution).not.toHaveBeenCalled();
    expect(response.data.evidences).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        title: 'Registro del archivo',
      }),
    ]);
    expect(response.data).not.toHaveProperty('solution');
  });

  it('rejects private solution generation from the evidences endpoint', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);

    await expect(
      service.generateCaseEvidences('case-id', {
        evidenceCount: 1,
        generateSolution: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findSolutionByCase).not.toHaveBeenCalled();
    expect(aiService.generateCaseEvidences).not.toHaveBeenCalled();
    expect(repository.createEvidences).not.toHaveBeenCalled();
    expect(repository.createSolution).not.toHaveBeenCalled();
  });

  it('rejects generated evidences for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);
    repository.findSuspectsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseEvidences('case-id', { evidenceCount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiService.generateCaseEvidences).not.toHaveBeenCalled();
  });

  it('rejects generated evidences when the case has no suspects', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseEvidences('case-id', { evidenceCount: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseEvidences).not.toHaveBeenCalled();
  });

  it('rejects generated evidences when the requested culprit is outside the case', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);

    await expect(
      service.generateCaseEvidences('case-id', {
        culpritSuspectId: 'other-suspect-id',
        evidenceCount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseEvidences).not.toHaveBeenCalled();
  });

  it('generates and persists one statement per suspect', async () => {
    const suspects = [
      createSuspect(),
      createSuspect({
        createdAt: '2026-05-22T00:00:00.000Z',
        id: 'other-suspect-id',
        name: 'Bruno Rivas',
      }),
    ];
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue(suspects);
    repository.findEvidencesByCase.mockResolvedValue([createEvidence()]);
    repository.findStatementsByCase.mockResolvedValue([]);
    repository.createStatements.mockResolvedValue([
      createStatement({
        content: 'No estuve en el archivo despues del cierre.',
        speakerName: 'Alicia Mora',
        suspectId: 'suspect-id',
      }),
      createStatement({
        id: 'other-statement-id',
        speakerName: 'Bruno Rivas',
        suspectId: 'other-suspect-id',
      }),
    ]);
    aiService.generateCaseStatements.mockResolvedValue({
      culpritSuspectId: 'suspect-id',
      statements: [
        createGeneratedStatement({
          content: 'No estuve en el archivo despues del cierre.',
          suspectId: 'suspect-id',
        }),
        createGeneratedStatement({
          speakerName: 'Bruno Rivas',
          suspectId: 'other-suspect-id',
        }),
      ],
      usedFallback: false,
    });

    const response = await service.generateCaseStatements('case-id', {
      culpritSuspectId: 'suspect-id',
    });

    expect(aiService.generateCaseStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        culpritSuspectId: 'suspect-id',
        evidences: [
          expect.objectContaining({
            id: 'evidence-id',
            title: 'Registro del archivo',
          }),
        ],
        suspects: [
          expect.objectContaining({ id: 'suspect-id' }),
          expect.objectContaining({ id: 'other-suspect-id' }),
        ],
      }),
    );
    expect(repository.createStatements).toHaveBeenCalledWith([
      expect.objectContaining({
        caseId: 'case-id',
        suspectId: 'suspect-id',
      }),
      expect.objectContaining({
        caseId: 'case-id',
        suspectId: 'other-suspect-id',
      }),
    ]);
    expect(response.data.culpritSuspectId).toBe('suspect-id');
    expect(response.data.statements).toHaveLength(2);
  });

  it('rejects generated statements for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);
    repository.findSuspectsByCase.mockResolvedValue([]);
    repository.findEvidencesByCase.mockResolvedValue([]);
    repository.findStatementsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseStatements('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiService.generateCaseStatements).not.toHaveBeenCalled();
  });

  it('rejects generated statements when the case has no suspects', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([]);
    repository.findEvidencesByCase.mockResolvedValue([createEvidence()]);
    repository.findStatementsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseStatements('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseStatements).not.toHaveBeenCalled();
  });

  it('rejects generated statements when the case has no evidences', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.findEvidencesByCase.mockResolvedValue([]);
    repository.findStatementsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseStatements('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseStatements).not.toHaveBeenCalled();
  });

  it('rejects generated statements when the culprit is outside the case', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.findEvidencesByCase.mockResolvedValue([createEvidence()]);
    repository.findStatementsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseStatements('case-id', {
        culpritSuspectId: 'other-suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseStatements).not.toHaveBeenCalled();
  });

  it('rejects generated statements when the case already has statements', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.findEvidencesByCase.mockResolvedValue([createEvidence()]);
    repository.findStatementsByCase.mockResolvedValue([createStatement()]);

    await expect(
      service.generateCaseStatements('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseStatements).not.toHaveBeenCalled();
  });

  it('does not persist generated statements when AI generation fails', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findSuspectsByCase.mockResolvedValue([createSuspect()]);
    repository.findEvidencesByCase.mockResolvedValue([createEvidence()]);
    repository.findStatementsByCase.mockResolvedValue([]);
    aiService.generateCaseStatements.mockRejectedValue(
      new Error('AI provider failed with invalid_json'),
    );

    await expect(
      service.generateCaseStatements('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toThrow('AI provider failed with invalid_json');

    expect(repository.createStatements).not.toHaveBeenCalled();
  });

  it('generates and persists case contradictions', async () => {
    mockValidContradictionGenerationContext();
    repository.createContradictions.mockResolvedValue([createContradiction()]);
    aiService.generateCaseContradictions.mockResolvedValue({
      contradictions: [createGeneratedContradiction()],
      culpritSuspectId: 'suspect-id',
      difficulty: 'medium',
      usedFallback: false,
    });

    const response = await service.generateCaseContradictions('case-id', {
      culpritSuspectId: 'suspect-id',
      difficulty: 'medium',
    });

    expect(aiService.generateCaseContradictions).toHaveBeenCalledWith(
      expect.objectContaining({
        culpritSuspectId: 'suspect-id',
        difficulty: 'medium',
        evidences: [expect.objectContaining({ id: 'evidence-id' })],
        statements: [expect.objectContaining({ id: 'statement-id' })],
        suspects: [expect.objectContaining({ id: 'suspect-id' })],
      }),
    );
    expect(repository.createContradictions).toHaveBeenCalledWith([
      expect.objectContaining({
        caseId: 'case-id',
        refutingEvidenceId: 'evidence-id',
        statementId: 'statement-id',
      }),
    ]);
    expect(response.data.contradictions).toHaveLength(1);
    expect(response.data.difficulty).toBe('medium');
    expect(response.data.usedFallback).toBe(false);
  });

  it('rejects generated contradictions for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);
    repository.findSuspectsByCase.mockResolvedValue([]);
    repository.findEvidencesByCase.mockResolvedValue([]);
    repository.findStatementsByCase.mockResolvedValue([]);
    repository.findContradictionsByCase.mockResolvedValue([]);

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('rejects generated contradictions when the case has no suspects', async () => {
    mockValidContradictionGenerationContext({ suspects: [] });

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('rejects generated contradictions when the case has no evidences', async () => {
    mockValidContradictionGenerationContext({ evidences: [] });

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('rejects generated contradictions when the case has no statements', async () => {
    mockValidContradictionGenerationContext({ statements: [] });

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('rejects generated contradictions when the culprit is outside the case', async () => {
    mockValidContradictionGenerationContext();

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'other-suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('rejects generated contradictions when the culprit has no statement', async () => {
    mockValidContradictionGenerationContext({
      statements: [
        createStatement({
          id: 'other-statement-id',
          suspectId: 'other-suspect-id',
        }),
      ],
    });

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('rejects generated contradictions when the case already has contradictions', async () => {
    mockValidContradictionGenerationContext({
      contradictions: [createContradiction()],
    });

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseContradictions).not.toHaveBeenCalled();
  });

  it('does not persist generated contradictions when AI generation fails', async () => {
    mockValidContradictionGenerationContext();
    aiService.generateCaseContradictions.mockRejectedValue(
      new Error('AI provider failed with invalid_json'),
    );

    await expect(
      service.generateCaseContradictions('case-id', {
        culpritSuspectId: 'suspect-id',
        difficulty: 'easy',
      }),
    ).rejects.toThrow('AI provider failed with invalid_json');

    expect(repository.createContradictions).not.toHaveBeenCalled();
  });

  it('generates and persists a private case solution', async () => {
    mockValidSolutionGenerationContext();
    repository.createSolution.mockResolvedValue(createSolution());
    aiService.generateCaseSolution.mockResolvedValue({
      ...createGeneratedSolution(),
      usedFallback: false,
    });

    const response = await service.generateCaseSolution('case-id', {
      culpritSuspectId: 'suspect-id',
    });

    expect(aiService.generateCaseSolution).toHaveBeenCalledWith(
      expect.objectContaining({
        contradictions: [
          expect.objectContaining({
            id: 'contradiction-id',
            suspectId: 'suspect-id',
          }),
        ],
        culpritSuspectId: 'suspect-id',
        evidences: [expect.objectContaining({ id: 'evidence-id' })],
        statements: [expect.objectContaining({ id: 'statement-id' })],
        suspects: [expect.objectContaining({ id: 'suspect-id' })],
      }),
    );
    expect(repository.createSolution).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-id',
        culpritSuspectId: 'suspect-id',
      }),
    );
    expect(response.data.culpritSuspectId).toBe('suspect-id');
    expect(response.data.solution.culpritSuspectId).toBe('suspect-id');
    expect(response.data.usedFallback).toBe(false);
  });

  it('rejects generated solutions for missing cases', async () => {
    repository.findCase.mockResolvedValue(undefined);
    repository.findSuspectsByCase.mockResolvedValue([]);
    repository.findEvidencesByCase.mockResolvedValue([]);
    repository.findStatementsByCase.mockResolvedValue([]);
    repository.findContradictionsByCase.mockResolvedValue([]);
    repository.findSolutionByCase.mockResolvedValue(undefined);

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the case has no suspects', async () => {
    mockValidSolutionGenerationContext({ suspects: [] });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the case has no evidences', async () => {
    mockValidSolutionGenerationContext({ evidences: [] });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the case has no statements', async () => {
    mockValidSolutionGenerationContext({ statements: [] });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the case has no contradictions', async () => {
    mockValidSolutionGenerationContext({ contradictions: [] });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the culprit is outside the case', async () => {
    mockValidSolutionGenerationContext();

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'other-suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the culprit has no statement', async () => {
    mockValidSolutionGenerationContext({
      statements: [
        createStatement({
          id: 'other-statement-id',
          suspectId: 'other-suspect-id',
        }),
      ],
    });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the culprit has no contradiction', async () => {
    mockValidSolutionGenerationContext({
      contradictions: [
        createContradiction({
          statementId: 'other-statement-id',
          suspectId: 'other-suspect-id',
        }),
      ],
    });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('rejects generated solutions when the case already has a solution', async () => {
    mockValidSolutionGenerationContext({ solution: createSolution() });

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolution).not.toHaveBeenCalled();
  });

  it('does not persist generated solutions when AI generation fails', async () => {
    mockValidSolutionGenerationContext();
    aiService.generateCaseSolution.mockRejectedValue(
      new Error('AI provider failed with invalid_json'),
    );

    await expect(
      service.generateCaseSolution('case-id', {
        culpritSuspectId: 'suspect-id',
      }),
    ).rejects.toThrow('AI provider failed with invalid_json');

    expect(repository.createSolution).not.toHaveBeenCalled();
  });

  it('generates and persists solve requirements from the full case snapshot', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot(),
    );
    repository.createSolveRequirements.mockResolvedValue([
      createRequirement({
        requirementType: 'culprit',
      }),
    ]);
    aiService.generateCaseSolveRequirements.mockResolvedValue({
      culpritSuspectId: 'suspect-id',
      difficulty: 'medium',
      requirements: [
        createGeneratedRequirement({
          requirementType: 'culprit',
          requiredSuspectId: 'suspect-id',
        }),
      ],
      usedFallback: false,
    });

    const response = await service.generateCaseSolveRequirements('case-id', {});

    expect(aiService.generateCaseSolveRequirements).toHaveBeenCalledWith(
      expect.objectContaining({
        contradictionUnlockRules: [],
        culpritSuspectId: 'suspect-id',
        difficulty: 'medium',
        evidenceUnlockRules: [],
        solution: expect.objectContaining({
          culpritSuspectId: 'suspect-id',
          id: 'solution-id',
        }),
      }),
    );
    expect(repository.createSolveRequirements).toHaveBeenCalledWith([
      expect.objectContaining({
        caseId: 'case-id',
        requiredSuspectId: 'suspect-id',
        requirementType: 'culprit',
      }),
    ]);
    expect(response.data.culpritSuspectId).toBe('suspect-id');
    expect(response.data.requirements).toHaveLength(1);
    expect(response.data.usedFallback).toBe(false);
  });

  it('rejects generated solve requirements for missing cases', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(undefined);

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the case has no suspects', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ suspects: [] }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the case has no evidences', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ evidences: [] }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the case has no statements', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ statements: [] }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the case has no contradictions', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ contradictions: [] }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the case has no private solution', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ solution: undefined }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the solution culprit is outside the case', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        solution: createSolution({ culpritSuspectId: 'other-suspect-id' }),
      }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('rejects generated solve requirements when the case already has requirements', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ requirements: [createRequirement()] }),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseSolveRequirements).not.toHaveBeenCalled();
  });

  it('does not persist generated solve requirements when AI generation fails', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot(),
    );
    aiService.generateCaseSolveRequirements.mockRejectedValue(
      new Error('AI provider failed with invalid_generated_requirements'),
    );

    await expect(
      service.generateCaseSolveRequirements('case-id', {}),
    ).rejects.toThrow('AI provider failed with invalid_generated_requirements');

    expect(repository.createSolveRequirements).not.toHaveBeenCalled();
  });

  it('generates and persists the investigation graph from a complete case snapshot', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        requirements: [
          createRequirement({ requiredEvidenceId: 'evidence-id' }),
        ],
      }),
    );
    repository.createInvestigationGraph.mockResolvedValue({
      actionPrerequisites: [
        createActionPrerequisite({
          actionId: 'action-compare',
          prerequisiteActionId: 'action-inspect',
        }),
      ],
      actions: [
        createAction({ id: 'action-inspect' }),
        createAction({ id: 'action-interview' }),
        createAction({ id: 'action-compare' }),
        createAction({ id: 'action-follow-up' }),
      ],
      contradictionUnlockRules: [
        createContradictionUnlockRule({ actionId: 'action-compare' }),
      ],
      evidenceUnlockRules: [
        createEvidenceUnlockRule({ actionId: 'action-inspect' }),
      ],
      statementUnlockRules: [
        createStatementUnlockRule({ actionId: 'action-interview' }),
      ],
    });
    aiService.generateCaseInvestigationGraph.mockResolvedValue({
      ...createGeneratedInvestigationGraph(),
      usedFallback: false,
    });

    const response = await service.generateCaseInvestigationGraph(
      'case-id',
      {},
    );

    expect(aiService.generateCaseInvestigationGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        culpritSuspectId: 'suspect-id',
        difficulty: 'medium',
        requirements: [expect.objectContaining({ id: 'requirement-id' })],
        solution: expect.objectContaining({ id: 'solution-id' }),
      }),
    );
    expect(repository.createInvestigationGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-id',
        actions: [
          expect.objectContaining({
            tempId: 'inspect_case_files',
            title: 'Revisar expediente',
          }),
          expect.objectContaining({
            tempId: 'interview_case_circle',
          }),
          expect.objectContaining({
            tempId: 'compare_versions',
          }),
          expect.objectContaining({
            tempId: 'follow_up_line',
          }),
        ],
        evidenceUnlockRules: [
          expect.objectContaining({
            actionTempId: 'inspect_case_files',
            evidenceId: 'evidence-id',
          }),
        ],
      }),
    );
    expect(repository.createInvestigationAction).not.toHaveBeenCalled();
    expect(repository.createEvidenceUnlockRule).not.toHaveBeenCalled();
    expect(repository.createStatementUnlockRule).not.toHaveBeenCalled();
    expect(repository.createContradictionUnlockRule).not.toHaveBeenCalled();
    expect(repository.createActionPrerequisites).not.toHaveBeenCalled();
    expect(response.data.actions).toHaveLength(4);
    expect(response.data.usedFallback).toBe(false);
  });

  it('rejects investigation graph generation when the case has no requirements', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({ requirements: [] }),
    );

    await expect(
      service.generateCaseInvestigationGraph('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseInvestigationGraph).not.toHaveBeenCalled();
  });

  it('rejects investigation graph generation when actions already exist', async () => {
    repository.findPlayabilitySnapshot.mockResolvedValue(
      createPlayabilitySnapshot({
        actions: [createAction()],
        requirements: [createRequirement()],
      }),
    );

    await expect(
      service.generateCaseInvestigationGraph('case-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiService.generateCaseInvestigationGraph).not.toHaveBeenCalled();
  });

  it('rejects contradictions when the statement belongs to another case', async () => {
    repository.findCase.mockResolvedValue(createCase());
    repository.findStatement.mockResolvedValue(
      createStatement({ caseId: 'other-case-id' }),
    );

    await expect(
      service.addContradiction('case-id', {
        explanation: 'La declaracion contradice la evidencia.',
        proves: 'contradiction',
        refutingEvidenceId: 'evidence-id',
        statementId: 'statement-id',
        title: 'Coartada falsa',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createContradiction).not.toHaveBeenCalled();
  });
});

function createCase(overrides: Partial<AdminCaseRecord> = {}): AdminCaseRecord {
  return {
    aiGenerationMetadata: {},
    createdAt: '2026-05-21T00:00:00.000Z',
    createdBy: 'user-id',
    departmentId: null,
    difficulty: 'medium',
    generatedByAi: false,
    id: 'case-id',
    status: 'draft',
    summary: 'Un expediente manual de prueba.',
    title: 'Caso manual',
    updatedAt: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function createEvidence(
  overrides: Partial<AdminEvidenceRecord> = {},
): AdminEvidenceRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Registro fisico recuperado.',
    id: 'evidence-id',
    importance: 'critical',
    isDecoy: false,
    isInitiallyVisible: true,
    metadata: {},
    title: 'Registro del archivo',
    type: 'physical',
    weight: 10,
    ...overrides,
  };
}

function createGeneratedEvidence(
  overrides: Partial<GeneratedCaseEvidence> = {},
): GeneratedCaseEvidence {
  return {
    description: 'Registro digital que ubica al sospechoso.',
    importance: 'critical',
    isDecoy: false,
    isInitiallyVisible: false,
    metadata: {},
    title: 'Registro de acceso',
    type: 'digital',
    weight: 10,
    ...overrides,
  };
}

function createGeneratedSuspect(
  overrides: Partial<GeneratedCaseSuspect> = {},
): GeneratedCaseSuspect {
  return {
    age: 42,
    background: 'Tenia acceso al archivo.',
    name: 'Alicia Mora',
    occupation: 'Archivista',
    personality: 'Reservada.',
    publicNotes: 'Coartada pendiente.',
    relationshipToVictim: 'Colega',
    ...overrides,
  };
}

function createGeneratedAdminCaseBase(
  overrides: Partial<GeneratedAdminCaseBase> = {},
): GenerateAdminCaseBaseResult {
  return {
    difficulty: 'medium',
    publicBriefing: 'Briefing visible para el jugador.',
    summary: 'Un expediente generado por IA para probar el flujo admin.',
    title: 'El Archivo Invertido',
    usedFallback: false,
    victimName: 'Roberto Salas',
    ...overrides,
  };
}

function createSolution(
  overrides: Partial<AdminCaseSolutionRecord> = {},
): AdminCaseSolutionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    culpritSuspectId: 'suspect-id',
    fullExplanation: 'Alicia aprovecho su acceso al archivo.',
    id: 'solution-id',
    methodSummary: 'Manipulo un registro.',
    motiveSummary: 'Necesitaba ocultar un expediente.',
    opportunitySummary: 'Estuvo sola en el archivo.',
    ...overrides,
  };
}

function createRequirement(
  overrides: Partial<AdminSolveRequirementRecord> = {},
): AdminSolveRequirementRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Identificar al culpable con evidencia suficiente.',
    id: 'requirement-id',
    isMandatory: true,
    proofRole: 'identity',
    requiredSuspectId: 'suspect-id',
    requirementType: 'identity',
    weight: 10,
    ...overrides,
  };
}

function createGeneratedSolution(
  overrides: Partial<GeneratedCaseSolution> = {},
): GeneratedCaseSolution {
  return {
    culpritSuspectId: 'suspect-id',
    fullExplanation: 'Alicia aprovecho su acceso al archivo.',
    methodSummary: 'Manipulo un registro.',
    motiveSummary: 'Necesitaba ocultar un expediente.',
    opportunitySummary: 'Estuvo sola en el archivo.',
    ...overrides,
  };
}

function createGeneratedStatement(
  overrides: Partial<GeneratedCaseStatement> = {},
): GeneratedCaseStatement {
  return {
    content: 'Declara una version contrastable con las evidencias.',
    context: 'Declaracion generada por IA.',
    isInitiallyVisible: true,
    speakerName: 'Alicia Mora',
    suspectId: 'suspect-id',
    ...overrides,
  };
}

function createGeneratedContradiction(
  overrides: Partial<GeneratedCaseContradiction> = {},
): GeneratedCaseContradiction {
  return {
    explanation: 'La declaracion contradice el registro recuperado.',
    isInitiallyVisible: false,
    proves: 'contradiction',
    refutingEvidenceId: 'evidence-id',
    statementId: 'statement-id',
    suspectId: 'suspect-id',
    title: 'Registro contra declaracion',
    ...overrides,
  };
}

function createGeneratedRequirement(
  overrides: Partial<GeneratedCaseSolveRequirement> = {},
): GeneratedCaseSolveRequirement {
  return {
    description: 'Identificar al culpable con evidencia suficiente.',
    isMandatory: true,
    proofRole: 'identity',
    requiredSuspectId: 'suspect-id',
    requirementType: 'identity',
    weight: 5,
    ...overrides,
  };
}

function createPlayabilitySnapshot(
  overrides: Partial<CasePlayabilitySnapshot> = {},
): CasePlayabilitySnapshot {
  return {
    actionPrerequisites: [],
    actions: [],
    caseRecord: createCase(),
    contradictionUnlockRules: [],
    contradictions: [createContradiction()],
    evidenceUnlockRules: [],
    evidences: [createEvidence()],
    requirements: [],
    solution: createSolution(),
    statementUnlockRules: [],
    statements: [createStatement({ suspectId: 'suspect-id' })],
    suspects: [createSuspect()],
    ...overrides,
  };
}

function createGeneratedInvestigationGraph(): GeneratedCaseInvestigationGraphContent {
  return {
    actionPrerequisites: [
      {
        actionTempId: 'compare_versions',
        prerequisiteActionTempId: 'inspect_case_files',
      },
    ],
    actions: [
      createGeneratedAction({
        tempId: 'inspect_case_files',
        title: 'Revisar expediente',
      }),
      createGeneratedAction({
        actionType: 'interview',
        requiredSkill: 'interrogation',
        tempId: 'interview_case_circle',
        title: 'Entrevistar sospechosos',
      }),
      createGeneratedAction({
        actionType: 'custom',
        isInitiallyAvailable: false,
        requiredSkill: 'psychology',
        tempId: 'compare_versions',
        title: 'Contrastar versiones',
      }),
      createGeneratedAction({
        actionType: 'background_check',
        isInitiallyAvailable: false,
        requiredSkill: 'field_investigation',
        tempId: 'follow_up_line',
        title: 'Seguimiento operativo',
      }),
    ],
    contradictionUnlockRules: [
      {
        actionTempId: 'compare_versions',
        contradictionId: 'contradiction-id',
        isGuaranteed: true,
        minimumSkillLevel: 50,
        requiredSkill: 'psychology',
        successChance: 1,
      },
    ],
    culpritSuspectId: 'suspect-id',
    difficulty: 'medium',
    evidenceUnlockRules: [
      {
        actionTempId: 'inspect_case_files',
        durationModifierMinutes: 0,
        evidenceId: 'evidence-id',
        isGuaranteed: true,
        minimumSkillLevel: 50,
        requiredSkill: 'crime_scene_analysis',
        successChance: 1,
      },
    ],
    statementUnlockRules: [
      {
        actionTempId: 'interview_case_circle',
        isGuaranteed: true,
        minimumSkillLevel: 50,
        requiredSkill: 'interrogation',
        statementId: 'statement-id',
        successChance: 1,
      },
    ],
  };
}

function createGeneratedAction(
  overrides: Partial<GeneratedCaseInvestigationAction> = {},
): GeneratedCaseInvestigationAction {
  return {
    actionType: 'inspect_scene',
    baseDurationMinutes: 45,
    description: 'Accion generada por IA.',
    isInitiallyAvailable: true,
    metadata: {},
    minimumSkillLevel: 50,
    requiredSkill: 'crime_scene_analysis',
    requiresDetective: true,
    tempId: 'inspect_case_files',
    title: 'Revisar expediente',
    ...overrides,
  };
}

function createAction(
  overrides: Partial<AdminInvestigationActionRecord> = {},
): AdminInvestigationActionRecord {
  return {
    actionType: 'inspect_scene',
    baseDurationMinutes: 45,
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Accion persistida.',
    id: 'action-id',
    isInitiallyAvailable: true,
    metadata: {},
    minimumSkillLevel: 50,
    requiredSkill: 'crime_scene_analysis',
    requiresDetective: true,
    title: 'Revisar expediente',
    ...overrides,
  };
}

function createEvidenceUnlockRule(
  overrides: Partial<AdminEvidenceUnlockRuleRecord> = {},
): AdminEvidenceUnlockRuleRecord {
  return {
    actionId: 'action-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    durationModifierMinutes: 0,
    evidenceId: 'evidence-id',
    id: 'evidence-rule-id',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    requiredSkill: 'crime_scene_analysis',
    successChance: 1,
    ...overrides,
  };
}

function createStatementUnlockRule(
  overrides: Partial<AdminStatementUnlockRuleRecord> = {},
): AdminStatementUnlockRuleRecord {
  return {
    actionId: 'action-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'statement-rule-id',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    requiredSkill: 'interrogation',
    statementId: 'statement-id',
    successChance: 1,
    ...overrides,
  };
}

function createContradictionUnlockRule(
  overrides: Partial<AdminContradictionUnlockRuleRecord> = {},
): AdminContradictionUnlockRuleRecord {
  return {
    actionId: 'action-id',
    contradictionId: 'contradiction-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'contradiction-rule-id',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    requiredSkill: 'psychology',
    successChance: 1,
    ...overrides,
  };
}

function createActionPrerequisite(
  overrides: Partial<AdminActionPrerequisiteRecord> = {},
): AdminActionPrerequisiteRecord {
  return {
    actionId: 'action-compare',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'action-prerequisite-id',
    prerequisiteActionId: 'action-inspect',
    ...overrides,
  };
}

function createSuspect(
  overrides: Partial<AdminSuspectRecord> = {},
): AdminSuspectRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'suspect-id',
    name: 'Alicia Mora',
    ...overrides,
  };
}

function createStatement(
  overrides: Partial<AdminStatementRecord> = {},
): AdminStatementRecord {
  return {
    caseId: 'case-id',
    content: 'Declaracion.',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'statement-id',
    isInitiallyVisible: false,
    speakerName: 'Testigo',
    ...overrides,
  };
}

function createContradiction(
  overrides: Partial<AdminContradictionRecord> = {},
): AdminContradictionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    explanation: 'La declaracion contradice el registro recuperado.',
    id: 'contradiction-id',
    isInitiallyVisible: false,
    proves: 'contradiction',
    refutingEvidenceId: 'evidence-id',
    statementId: 'statement-id',
    suspectId: 'suspect-id',
    title: 'Registro contra declaracion',
    ...overrides,
  };
}
