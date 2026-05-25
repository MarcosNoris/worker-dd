import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseClientFactory } from '../supabase/supabase-client.factory';
import { CasesRepository } from './cases.repository';

describe('CasesRepository', () => {
  it('finds evidences by case with the service role client', async () => {
    const selectQuery = createCaseResourcesQuery({
      data: [createEvidenceRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const evidences = await repository.findEvidencesByCase('case-id');

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(
      supabaseClientFactory.createAuthenticatedClient,
    ).not.toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('evidences');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(evidences).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'evidence-id',
        title: 'Registro del archivo',
      }),
    ]);
  });

  it('finds suspects by case with the service role client', async () => {
    const selectQuery = createCaseResourcesQuery({
      data: [createSuspectRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const suspects = await repository.findSuspectsByCase('case-id');

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(
      supabaseClientFactory.createAuthenticatedClient,
    ).not.toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('suspects');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(suspects).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'suspect-id',
        name: 'Alicia Mora',
      }),
    ]);
  });

  it('finds statements by case with the service role client', async () => {
    const selectQuery = createCaseResourcesQuery({
      data: [createStatementRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const statements = await repository.findStatementsByCase('case-id');

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(
      supabaseClientFactory.createAuthenticatedClient,
    ).not.toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('statements');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(statements).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'statement-id',
        suspectId: 'suspect-id',
      }),
    ]);
  });

  it('finds initially visible statements by case with the service role client', async () => {
    const selectQuery = createInitialStatementsQuery({
      data: [createStatementRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const statements = await repository.findInitialStatementsByCase('case-id');

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(
      supabaseClientFactory.createAuthenticatedClient,
    ).not.toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('statements');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(selectQuery.eq).toHaveBeenCalledWith('is_initially_visible', true);
    expect(statements).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'statement-id',
        isInitiallyVisible: true,
      }),
    ]);
  });

  it('finds contradictions by case with the service role client', async () => {
    const selectQuery = createCaseResourcesQuery({
      data: [createContradictionRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const contradictions = await repository.findContradictionsByCase('case-id');

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('contradictions');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(contradictions).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'contradiction-id',
        statementId: 'statement-id',
      }),
    ]);
  });

  it('finds solve requirements by case with the service role client', async () => {
    const selectQuery = createCaseResourcesQuery({
      data: [createRequirementRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const requirements = await repository.findRequirementsByCase('case-id');

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('solve_requirements');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(requirements).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        id: 'requirement-id',
        requirementType: 'identity',
      }),
    ]);
  });

  it('finds recent case titles with a service role limit', async () => {
    const selectQuery = createTitleSelectQuery({
      data: [createCaseTitleRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const titles = await repository.findRecentCaseTitles(500);

    expect(serviceRoleClient.from).toHaveBeenCalledWith('cases');
    expect(selectQuery.select).toHaveBeenCalledWith('title');
    expect(selectQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(selectQuery.limit).toHaveBeenCalledWith(500);
    expect(titles).toEqual(['Caso manual']);
  });

  it('finds admin cases with pagination and status filter', async () => {
    const selectQuery = createAdminCasesQuery({
      count: 11,
      data: [createCaseRecord({ status: 'draft' })],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const page = await repository.findAdminCases({
      limit: 10,
      page: 2,
      sort: 'asc',
      status: 'draft',
    });

    expect(serviceRoleClient.from).toHaveBeenCalledWith('cases');
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String), {
      count: 'exact',
    });
    expect(selectQuery.eq).toHaveBeenCalledWith('status', 'draft');
    expect(selectQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    });
    expect(selectQuery.range).toHaveBeenCalledWith(10, 19);
    expect(page.total).toBe(11);
    expect(page.cases).toEqual([
      expect.objectContaining({
        id: 'case-id',
        status: 'draft',
      }),
    ]);
  });

  it('finds a random playable case base not investigated by the department', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.7);
    const investigationsQuery = createInvestigatedCasesQuery({
      data: [{ case_id: 'case-already-investigated' }],
      error: null,
    });
    const countQuery = createPlayableCaseCountQuery({
      count: 3,
      error: null,
    });
    const selectQuery = createRandomPlayableCaseQuery({
      data: [createCaseRecord({ difficulty: 'hard', status: 'playable' })],
      error: null,
    });
    const serviceRoleClient = {
      from: jest
        .fn()
        .mockReturnValueOnce(investigationsQuery)
        .mockReturnValueOnce(countQuery)
        .mockReturnValueOnce(selectQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const caseRecord = await repository.findRandomPlayableCaseBase({
      departmentId: 'department-id',
      difficulty: 'hard',
    });

    expect(serviceRoleClient.from).toHaveBeenCalledWith('investigations');
    expect(investigationsQuery.select).toHaveBeenCalledWith('case_id');
    expect(investigationsQuery.eq).toHaveBeenCalledWith(
      'department_id',
      'department-id',
    );
    expect(serviceRoleClient.from).toHaveBeenCalledWith('cases');
    expect(countQuery.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(countQuery.eq).toHaveBeenCalledWith('status', 'playable');
    expect(countQuery.eq).toHaveBeenCalledWith('difficulty', 'hard');
    expect(countQuery.not).toHaveBeenCalledWith(
      'id',
      'in',
      '("case-already-investigated")',
    );
    expect(selectQuery.select).toHaveBeenCalledWith(expect.any(String));
    expect(selectQuery.eq).toHaveBeenCalledWith('status', 'playable');
    expect(selectQuery.eq).toHaveBeenCalledWith('difficulty', 'hard');
    expect(selectQuery.not).toHaveBeenCalledWith(
      'id',
      'in',
      '("case-already-investigated")',
    );
    expect(selectQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    });
    expect(selectQuery.range).toHaveBeenCalledWith(2, 2);
    expect(caseRecord?.difficulty).toBe('hard');

    randomSpy.mockRestore();
  });

  it('returns undefined when no playable case base matches the difficulty', async () => {
    const investigationsQuery = createInvestigatedCasesQuery({
      data: [],
      error: null,
    });
    const countQuery = createPlayableCaseCountQuery({
      count: 0,
      error: null,
    });
    const serviceRoleClient = {
      from: jest
        .fn()
        .mockReturnValueOnce(investigationsQuery)
        .mockReturnValueOnce(countQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const caseRecord = await repository.findRandomPlayableCaseBase({
      departmentId: 'department-id',
      difficulty: 'expert',
    });

    expect(caseRecord).toBeUndefined();
    expect(serviceRoleClient.from).toHaveBeenCalledTimes(2);
  });

  it('creates manual cases with the service role client', async () => {
    const insertQuery = createInsertQuery({
      data: createCaseRecord(),
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const createdCase = await repository.createManualCase({
      createdBy: 'user-id',
      difficulty: 'medium',
      summary: 'Un expediente manual de prueba.',
      title: 'Caso manual',
    });

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(
      supabaseClientFactory.createAuthenticatedClient,
    ).not.toHaveBeenCalled();
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: 'user-id',
        department_id: null,
        generated_by_ai: false,
        status: 'draft',
      }),
    );
    expect(createdCase.departmentId).toBeNull();
  });

  it('creates AI generated cases with generated_by_ai enabled', async () => {
    const insertQuery = createInsertQuery({
      data: createCaseRecord({ generated_by_ai: true }),
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const createdCase = await repository.createAiGeneratedCase({
      aiGenerationMetadata: { themeProvided: true },
      createdBy: 'user-id',
      difficulty: 'medium',
      generationPrompt: 'sabotaje documental',
      publicBriefing: 'Briefing visible para el jugador.',
      summary: 'Un expediente generado por IA.',
      title: 'El Archivo Invertido',
      victimName: 'Roberto Salas',
    });

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ai_generation_metadata: { themeProvided: true },
        created_by: 'user-id',
        generated_by_ai: true,
        generation_prompt: 'sabotaje documental',
        status: 'draft',
      }),
    );
    expect(createdCase.generatedByAi).toBe(true);
  });

  it('creates case AI generation runs with the service role client', async () => {
    const insertQuery = createInsertQuery({
      data: createCaseAiGenerationRunRecord(),
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const run = await repository.createCaseAiGenerationRun({
      attemptsByStep: { generate_case_base: 1 },
      createdBy: 'user-id',
      currentStep: 'generate_case_base',
      difficulty: 'medium',
      generationOptions: { evidenceCount: 6 },
      status: 'running',
      theme: 'hackeo de influencer',
    });

    expect(serviceRoleClient.from).toHaveBeenCalledWith(
      'case_ai_generation_runs',
    );
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts_by_step: { generate_case_base: 1 },
        created_by: 'user-id',
        current_step: 'generate_case_base',
        generation_options: { evidenceCount: 6 },
        status: 'running',
      }),
    );
    expect(run).toEqual(
      expect.objectContaining({
        currentStep: 'generate_case_base',
        status: 'running',
      }),
    );
  });

  it('updates case AI generation runs with nullable errors', async () => {
    const updateQuery = createUpdateQuery({
      data: createCaseAiGenerationRunRecord({
        last_error: null,
        status: 'completed',
      }),
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(updateQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const run = await repository.updateCaseAiGenerationRun('run-id', {
      finishedAt: '2026-05-24T15:10:00.000Z',
      lastError: null,
      status: 'completed',
    });

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        finished_at: '2026-05-24T15:10:00.000Z',
        last_error: null,
        status: 'completed',
      }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'run-id');
    expect(run.status).toBe('completed');
    expect(run.lastError).toBeUndefined();
  });

  it('finds the latest case AI generation run by case', async () => {
    const selectQuery = createLatestCaseAiGenerationRunQuery({
      data: [createCaseAiGenerationRunRecord({ status: 'failed' })],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(selectQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const run = await repository.findLatestCaseAiGenerationRunByCase('case-id');

    expect(serviceRoleClient.from).toHaveBeenCalledWith(
      'case_ai_generation_runs',
    );
    expect(selectQuery.eq).toHaveBeenCalledWith('case_id', 'case-id');
    expect(selectQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(selectQuery.limit).toHaveBeenCalledWith(1);
    expect(run?.status).toBe('failed');
  });

  it('acquires case AI generation job locks through RPC', async () => {
    const rpcQuery = createRpcQuery({ data: true, error: null });
    const serviceRoleClient = {
      rpc: rpcQuery,
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const acquired = await repository.tryAcquireCaseAiGenerationJobLock({
      lockedBy: 'worker-id',
      lockName: 'case-ai-generation',
      ttlSeconds: 7200,
    });

    expect(rpcQuery).toHaveBeenCalledWith(
      'try_acquire_case_ai_generation_job_lock',
      {
        p_lock_name: 'case-ai-generation',
        p_locked_by: 'worker-id',
        p_ttl_seconds: 7200,
      },
    );
    expect(acquired).toBe(true);
  });

  it('releases case AI generation job locks through RPC', async () => {
    const rpcQuery = createRpcQuery({ data: null, error: null });
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue({
        rpc: rpcQuery,
      }),
    } as unknown as SupabaseClientFactory);

    await repository.releaseCaseAiGenerationJobLock({
      lockedBy: 'worker-id',
      lockName: 'case-ai-generation',
    });

    expect(rpcQuery).toHaveBeenCalledWith(
      'release_case_ai_generation_job_lock',
      {
        p_lock_name: 'case-ai-generation',
        p_locked_by: 'worker-id',
      },
    );
  });

  it('finds recoverable case AI generation runs through RPC', async () => {
    const rpcQuery = createRpcQuery({
      data: [createCaseAiGenerationRunRecord({ status: 'failed' })],
      error: null,
    });
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue({
        rpc: rpcQuery,
      }),
    } as unknown as SupabaseClientFactory);

    const runs = await repository.findRecoverableCaseAiGenerationRuns(2);

    expect(rpcQuery).toHaveBeenCalledWith(
      'get_recoverable_case_ai_generation_runs',
      { p_limit: 2 },
    );
    expect(runs).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        status: 'failed',
      }),
    ]);
  });

  it('marks stale running case AI generation runs as failed', async () => {
    const updateQuery = createStaleRunsUpdateQuery({
      data: [{ id: 'run-id' }, { id: 'second-run-id' }],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(updateQuery),
    };
    const repository = new CasesRepository({
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    } as unknown as SupabaseClientFactory);

    const updatedCount =
      await repository.markStaleRunningCaseAiGenerationRunsAsFailed(
        '2026-05-24T15:00:00.000Z',
      );

    expect(serviceRoleClient.from).toHaveBeenCalledWith(
      'case_ai_generation_runs',
    );
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
      }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith('status', 'running');
    expect(updateQuery.lt).toHaveBeenCalledWith(
      'updated_at',
      '2026-05-24T15:00:00.000Z',
    );
    expect(updatedCount).toBe(2);
  });

  it('creates a suspect through the batch insert path', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createSuspectRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const suspect = await repository.createSuspect({
      caseId: 'case-id',
      name: 'Alicia Mora',
    });

    expect(serviceRoleClient.from).toHaveBeenCalledWith('suspects');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        name: 'Alicia Mora',
      }),
    ]);
    expect(suspect).toEqual(
      expect.objectContaining({
        caseId: 'case-id',
        name: 'Alicia Mora',
      }),
    );
  });

  it('creates suspects in batch with the service role client', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [
        createSuspectRecord(),
        createSuspectRecord({
          id: 'other-suspect-id',
          name: 'Bruno Rivas',
        }),
      ],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const suspects = await repository.createSuspects([
      {
        caseId: 'case-id',
        name: 'Alicia Mora',
      },
      {
        caseId: 'case-id',
        name: 'Bruno Rivas',
      },
    ]);

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('suspects');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        name: 'Alicia Mora',
      }),
      expect.objectContaining({
        case_id: 'case-id',
        name: 'Bruno Rivas',
      }),
    ]);
    expect(suspects).toEqual([
      expect.objectContaining({ name: 'Alicia Mora' }),
      expect.objectContaining({ name: 'Bruno Rivas' }),
    ]);
  });

  it('creates evidences in batch with the service role client', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createEvidenceRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const evidences = await repository.createEvidences([
      {
        caseId: 'case-id',
        description: 'Registro fisico recuperado.',
        importance: 'critical',
        title: 'Registro del archivo',
        type: 'physical',
      },
    ]);

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('evidences');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        title: 'Registro del archivo',
      }),
    ]);
    expect(evidences).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        title: 'Registro del archivo',
      }),
    ]);
  });

  it('creates statements in batch with the service role client', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createStatementRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const statements = await repository.createStatements([
      {
        caseId: 'case-id',
        content: 'Vi a Alicia entrar al archivo.',
        speakerName: 'Testigo',
        suspectId: 'suspect-id',
      },
    ]);

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('statements');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        suspect_id: 'suspect-id',
      }),
    ]);
    expect(statements).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        suspectId: 'suspect-id',
      }),
    ]);
  });

  it('creates contradictions in batch with the service role client', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createContradictionRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const contradictions = await repository.createContradictions([
      {
        caseId: 'case-id',
        explanation: 'La declaracion contradice el registro.',
        proves: 'contradiction',
        refutingEvidenceId: 'evidence-id',
        statementId: 'statement-id',
        suspectId: 'suspect-id',
        title: 'Registro contra declaracion',
      },
    ]);

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('contradictions');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        refuting_evidence_id: 'evidence-id',
        statement_id: 'statement-id',
      }),
    ]);
    expect(contradictions).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        statementId: 'statement-id',
      }),
    ]);
  });

  it('creates a single contradiction through the batch insert path', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createContradictionRecord()],
      error: null,
    });
    const repository = new CasesRepository({
      createServiceRoleClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(insertQuery),
      }),
    } as unknown as SupabaseClientFactory);

    const contradiction = await repository.createContradiction({
      caseId: 'case-id',
      explanation: 'La declaracion contradice el registro.',
      proves: 'contradiction',
      refutingEvidenceId: 'evidence-id',
      statementId: 'statement-id',
      suspectId: 'suspect-id',
      title: 'Registro contra declaracion',
    });

    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        statement_id: 'statement-id',
      }),
    ]);
    expect(contradiction.id).toBe('contradiction-id');
  });

  it('creates solve requirements in batch with the service role client', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createRequirementRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const requirements = await repository.createSolveRequirements([
      {
        caseId: 'case-id',
        description: 'Identificar al culpable con evidencia suficiente.',
        isMandatory: true,
        proofRole: 'identity',
        requiredSuspectId: 'suspect-id',
        requirementType: 'culprit',
        weight: 5,
      },
    ]);

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('solve_requirements');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        required_suspect_id: 'suspect-id',
        requirement_type: 'culprit',
      }),
    ]);
    expect(requirements).toEqual([
      expect.objectContaining({
        caseId: 'case-id',
        requiredSuspectId: 'suspect-id',
      }),
    ]);
  });

  it('creates a single solve requirement through the batch insert path', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createRequirementRecord()],
      error: null,
    });
    const repository = new CasesRepository({
      createServiceRoleClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(insertQuery),
      }),
    } as unknown as SupabaseClientFactory);

    const requirement = await repository.createSolveRequirement({
      caseId: 'case-id',
      description: 'Identificar al culpable con evidencia suficiente.',
      isMandatory: true,
      proofRole: 'identity',
      requiredSuspectId: 'suspect-id',
      requirementType: 'culprit',
      weight: 5,
    });

    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        case_id: 'case-id',
        required_suspect_id: 'suspect-id',
      }),
    ]);
    expect(requirement.id).toBe('requirement-id');
  });

  it('creates action prerequisites in batch with the service role client', async () => {
    const insertQuery = createBatchInsertQuery({
      data: [createActionPrerequisiteRecord()],
      error: null,
    });
    const serviceRoleClient = {
      from: jest.fn().mockReturnValue(insertQuery),
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const prerequisites = await repository.createActionPrerequisites([
      {
        actionId: 'action-compare',
        prerequisiteActionId: 'action-inspect',
      },
    ]);

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(serviceRoleClient.from).toHaveBeenCalledWith('action_prerequisites');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        action_id: 'action-compare',
        prerequisite_action_id: 'action-inspect',
      }),
    ]);
    expect(prerequisites).toEqual([
      expect.objectContaining({
        actionId: 'action-compare',
        prerequisiteActionId: 'action-inspect',
      }),
    ]);
  });

  it('creates an investigation graph through the atomic RPC', async () => {
    const rpcQuery = createRpcQuery({
      data: createInvestigationGraphRpcRecord(),
      error: null,
    });
    const serviceRoleClient = {
      rpc: rpcQuery,
    };
    const supabaseClientFactory = {
      createAuthenticatedClient: jest.fn(),
      createServiceRoleClient: jest.fn().mockReturnValue(serviceRoleClient),
    };
    const repository = new CasesRepository(
      supabaseClientFactory as unknown as SupabaseClientFactory,
    );

    const graph = await repository.createInvestigationGraph({
      actionPrerequisites: [
        {
          actionTempId: 'compare_versions',
          prerequisiteActionTempId: 'inspect_case_files',
        },
      ],
      actions: [
        {
          actionType: 'inspect_scene',
          baseDurationMinutes: 45,
          description: 'Revisar el expediente inicial.',
          isInitiallyAvailable: true,
          metadata: { source: 'ai' },
          minimumSkillLevel: 50,
          requiredSkill: 'crime_scene_analysis',
          requiresDetective: true,
          tempId: 'inspect_case_files',
          title: 'Revisar expediente',
        },
      ],
      caseId: 'case-id',
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
          actionTempId: 'inspect_case_files',
          isGuaranteed: true,
          minimumSkillLevel: 50,
          requiredSkill: 'interrogation',
          statementId: 'statement-id',
          successChance: 1,
        },
      ],
    });

    expect(supabaseClientFactory.createServiceRoleClient).toHaveBeenCalled();
    expect(
      supabaseClientFactory.createAuthenticatedClient,
    ).not.toHaveBeenCalled();
    expect(rpcQuery).toHaveBeenCalledWith('create_case_investigation_graph', {
      payload: expect.objectContaining({
        actions: [
          expect.objectContaining({
            tempId: 'inspect_case_files',
            title: 'Revisar expediente',
          }),
        ],
        caseId: 'case-id',
        evidenceUnlockRules: [
          expect.objectContaining({
            actionTempId: 'inspect_case_files',
            evidenceId: 'evidence-id',
          }),
        ],
      }),
    });
    expect(graph.actions).toEqual([
      expect.objectContaining({
        id: 'action-id',
        title: 'Revisar expediente',
      }),
    ]);
    expect(graph.evidenceUnlockRules).toEqual([
      expect.objectContaining({
        actionId: 'action-id',
        evidenceId: 'evidence-id',
      }),
    ]);
    expect(graph.actionPrerequisites).toEqual([
      expect.objectContaining({
        actionId: 'action-compare',
        prerequisiteActionId: 'action-id',
      }),
    ]);
  });

  it('throws a service unavailable error when Supabase cannot create a case', async () => {
    const insertQuery = createInsertQuery({
      data: null,
      error: { message: 'database unavailable' },
    });
    const repository = new CasesRepository({
      createServiceRoleClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(insertQuery),
      }),
    } as unknown as SupabaseClientFactory);

    await expect(
      repository.createManualCase({
        createdBy: 'user-id',
        difficulty: 'medium',
        summary: 'Un expediente manual de prueba.',
        title: 'Caso manual',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('logs Supabase error details and payload when an investigation action cannot be created', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const insertQuery = createInsertQuery({
      data: null,
      error: {
        code: '22P02',
        details: 'Enum value does not exist.',
        hint: 'Check action_type.',
        message:
          'invalid input value for enum investigation_action_type: "interview"',
      },
    });
    const repository = new CasesRepository({
      createServiceRoleClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(insertQuery),
      }),
    } as unknown as SupabaseClientFactory);

    await expect(
      repository.createInvestigationAction({
        actionType: 'interview',
        baseDurationMinutes: 30,
        caseId: 'case-id',
        description: 'Entrevistar al sospechoso principal.',
        isInitiallyAvailable: true,
        metadata: {
          authorization: 'secret-token',
          suggestedUnlockAction: 'entrevistar',
        },
        minimumSkillLevel: 50,
        requiredSkill: 'interrogation',
        requiresDetective: true,
        title: 'Entrevistar sospechoso',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const logMessage = String(loggerSpy.mock.calls[0]?.[0]);

    expect(logMessage).toContain('createInvestigationAction');
    expect(logMessage).toContain('investigation_actions');
    expect(logMessage).toContain('22P02');
    expect(logMessage).toContain('invalid input value for enum');
    expect(logMessage).toContain('"action_type": "interview"');
    expect(logMessage).toContain('"required_skill": "interrogation"');
    expect(logMessage).toContain('"authorization": "[redacted]"');
    expect(logMessage).not.toContain('secret-token');

    loggerSpy.mockRestore();
  });
});

function createCaseResourcesQuery(response: { data: unknown; error: unknown }) {
  return {
    eq: jest.fn().mockResolvedValue(response),
    select: jest.fn().mockReturnThis(),
  };
}

function createInitialStatementsQuery(response: {
  data: unknown;
  error: unknown;
}) {
  const query = {
    eq: jest.fn(),
    select: jest.fn().mockReturnThis(),
  };

  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce(response);

  return query;
}

function createAdminCasesQuery(response: {
  count: number | null;
  data: unknown;
  error: unknown;
}) {
  return {
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(response),
    select: jest.fn().mockReturnThis(),
  };
}

function createPlayableCaseCountQuery(response: {
  count: number | null;
  error: unknown;
}) {
  return {
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (value: typeof response) => unknown) =>
      Promise.resolve(resolve(response)),
    ),
  };
}

function createRandomPlayableCaseQuery(response: {
  data: unknown;
  error: unknown;
}) {
  return {
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(response),
    select: jest.fn().mockReturnThis(),
  };
}

function createInvestigatedCasesQuery(response: {
  data: unknown;
  error: unknown;
}) {
  return {
    eq: jest.fn().mockResolvedValue(response),
    select: jest.fn().mockReturnThis(),
  };
}

function createTitleSelectQuery(response: { data: unknown; error: unknown }) {
  return {
    limit: jest.fn().mockResolvedValue(response),
    order: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  };
}

function createInsertQuery(response: { data: unknown; error: unknown }) {
  return {
    insert: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(response),
    select: jest.fn().mockReturnThis(),
  };
}

function createUpdateQuery(response: { data: unknown; error: unknown }) {
  return {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(response),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
}

function createStaleRunsUpdateQuery(response: {
  data: unknown;
  error: unknown;
}) {
  return {
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(response),
    update: jest.fn().mockReturnThis(),
  };
}

function createBatchInsertQuery(response: { data: unknown; error: unknown }) {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(response),
  };
}

function createLatestCaseAiGenerationRunQuery(response: {
  data: unknown;
  error: unknown;
}) {
  return {
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(response),
    order: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  };
}

function createRpcQuery(response: { data: unknown; error: unknown }) {
  return jest.fn().mockResolvedValue(response);
}

function createInvestigationGraphRpcRecord() {
  return {
    actionPrerequisites: [
      createActionPrerequisiteRecord({
        action_id: 'action-compare',
        prerequisite_action_id: 'action-id',
      }),
    ],
    actions: [createActionRecord()],
    contradictionUnlockRules: [createContradictionUnlockRuleRecord()],
    evidenceUnlockRules: [createEvidenceUnlockRuleRecord()],
    statementUnlockRules: [createStatementUnlockRuleRecord()],
  };
}

function createEvidenceRecord() {
  return {
    case_id: 'case-id',
    created_at: '2026-05-21T00:00:00.000Z',
    description: 'Registro fisico recuperado.',
    id: 'evidence-id',
    importance: 'critical',
    is_decoy: false,
    is_initially_visible: true,
    metadata: {},
    title: 'Registro del archivo',
    type: 'physical',
    weight: 10,
  };
}

function createSuspectRecord(overrides: Record<string, unknown> = {}) {
  return {
    case_id: 'case-id',
    created_at: '2026-05-21T00:00:00.000Z',
    id: 'suspect-id',
    name: 'Alicia Mora',
    ...overrides,
  };
}

function createStatementRecord() {
  return {
    case_id: 'case-id',
    content: 'Vi a Alicia entrar al archivo.',
    created_at: '2026-05-21T00:00:00.000Z',
    id: 'statement-id',
    is_initially_visible: true,
    speaker_name: 'Testigo',
    suspect_id: 'suspect-id',
  };
}

function createContradictionRecord() {
  return {
    case_id: 'case-id',
    created_at: '2026-05-21T00:00:00.000Z',
    explanation: 'La declaracion contradice el registro.',
    id: 'contradiction-id',
    is_initially_visible: false,
    proves: 'contradiction',
    refuting_evidence_id: 'evidence-id',
    statement_id: 'statement-id',
    suspect_id: 'suspect-id',
    title: 'Registro contra declaracion',
  };
}

function createRequirementRecord() {
  return {
    case_id: 'case-id',
    created_at: '2026-05-21T00:00:00.000Z',
    description: 'Identificar al culpable con evidencia suficiente.',
    id: 'requirement-id',
    is_mandatory: true,
    proof_role: 'identity',
    required_suspect_id: 'suspect-id',
    requirement_type: 'identity',
    weight: 10,
  };
}

function createActionPrerequisiteRecord(
  overrides: Record<string, unknown> = {},
) {
  return {
    action_id: 'action-compare',
    created_at: '2026-05-21T00:00:00.000Z',
    id: 'action-prerequisite-id',
    prerequisite_action_id: 'action-inspect',
    ...overrides,
  };
}

function createActionRecord() {
  return {
    action_type: 'inspect_scene',
    base_duration_minutes: 45,
    case_id: 'case-id',
    created_at: '2026-05-21T00:00:00.000Z',
    description: 'Revisar el expediente inicial.',
    id: 'action-id',
    is_initially_available: true,
    metadata: {},
    minimum_skill_level: 50,
    required_skill: 'crime_scene_analysis',
    requires_detective: true,
    title: 'Revisar expediente',
  };
}

function createEvidenceUnlockRuleRecord() {
  return {
    action_id: 'action-id',
    created_at: '2026-05-21T00:00:00.000Z',
    duration_modifier_minutes: 0,
    evidence_id: 'evidence-id',
    id: 'evidence-unlock-rule-id',
    is_guaranteed: true,
    minimum_skill_level: 50,
    required_skill: 'crime_scene_analysis',
    success_chance: 1,
  };
}

function createStatementUnlockRuleRecord() {
  return {
    action_id: 'action-id',
    created_at: '2026-05-21T00:00:00.000Z',
    id: 'statement-unlock-rule-id',
    is_guaranteed: true,
    minimum_skill_level: 50,
    required_skill: 'interrogation',
    statement_id: 'statement-id',
    success_chance: 1,
  };
}

function createContradictionUnlockRuleRecord() {
  return {
    action_id: 'action-id',
    contradiction_id: 'contradiction-id',
    created_at: '2026-05-21T00:00:00.000Z',
    id: 'contradiction-unlock-rule-id',
    is_guaranteed: true,
    minimum_skill_level: 50,
    required_skill: 'psychology',
    success_chance: 1,
  };
}

function createCaseRecord(overrides: Record<string, unknown> = {}) {
  return {
    ai_generation_metadata: {},
    created_at: '2026-05-21T00:00:00.000Z',
    created_by: 'user-id',
    department_id: null,
    difficulty: 'medium',
    generated_by_ai: false,
    id: 'case-id',
    status: 'draft',
    summary: 'Un expediente manual de prueba.',
    title: 'Caso manual',
    updated_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function createCaseAiGenerationRunRecord(
  overrides: Record<string, unknown> = {},
) {
  return {
    attempts_by_step: { generate_case_base: 1 },
    case_id: 'case-id',
    created_at: '2026-05-24T15:00:00.000Z',
    created_by: 'user-id',
    culprit_suspect_id: 'suspect-id',
    current_step: 'generate_case_base',
    difficulty: 'medium',
    finished_at: null,
    generation_options: { evidenceCount: 6 },
    id: 'run-id',
    last_error: null,
    status: 'running',
    theme: 'hackeo de influencer',
    updated_at: '2026-05-24T15:00:00.000Z',
    ...overrides,
  };
}

function createCaseTitleRecord() {
  return {
    title: 'Caso manual',
  };
}
