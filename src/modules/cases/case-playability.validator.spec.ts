import {
  CasePlayabilitySnapshot,
  AdminCaseRecord,
  AdminCaseSolutionRecord,
  AdminContradictionRecord,
  AdminEvidenceRecord,
  AdminContradictionUnlockRuleRecord,
  AdminInvestigationActionRecord,
  AdminSolveRequirementRecord,
  AdminStatementRecord,
  AdminStatementUnlockRuleRecord,
  AdminSuspectRecord,
} from './cases.repository';
import { CasePlayabilityValidator } from './case-playability.validator';

describe('CasePlayabilityValidator', () => {
  let validator: CasePlayabilityValidator;

  beforeEach(() => {
    validator = new CasePlayabilityValidator();
  });

  it('blocks cases without a private solution', () => {
    const validation = validator.validate(
      createPlayableSnapshot({ solution: undefined }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'El caso no tiene solucion privada en case_solutions.',
    );
  });

  it('blocks mandatory evidence without an initial unlock path', () => {
    const evidence = createEvidence({
      id: 'evidence-critical',
      isInitiallyVisible: false,
    });
    const validation = validator.validate(
      createPlayableSnapshot({
        evidences: [evidence],
        evidenceUnlockRules: [],
        requirements: [
          createRequirement({
            description: 'Probar el metodo.',
            requiredEvidenceId: evidence.id,
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La evidencia requerida por "Probar el metodo." no tiene ruta inicial garantizada de desbloqueo.',
    );
  });

  it('blocks mandatory requirements without structured targets', () => {
    const validation = validator.validate(
      createPlayableSnapshot({
        requirements: [
          createRequirement({
            description: 'Resolver una condicion narrativa.',
            requiredEvidenceId: undefined,
            requiredSuspectId: undefined,
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'El requisito "Resolver una condicion narrativa." no apunta a ningun dato verificable.',
    );
  });

  it('blocks mandatory contradictions until their statement and evidence are reachable', () => {
    const action = createAction('action-initial');
    const statement = createStatement({ isInitiallyVisible: false });
    const contradiction = createContradiction({
      refutingEvidenceId: 'evidence-critical',
      statementId: statement.id,
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        actions: [action],
        contradictionUnlockRules: [
          createContradictionUnlockRule({
            actionId: action.id,
            contradictionId: contradiction.id,
          }),
        ],
        contradictions: [contradiction],
        requirements: [
          createRequirement({
            description: 'Romper la coartada.',
            requiredContradictionId: contradiction.id,
          }),
        ],
        statements: [statement],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La contradiccion requerida por "Romper la coartada." no tiene ruta inicial garantizada de desbloqueo.',
    );
  });

  it('blocks unreachable non-mandatory evidences', () => {
    const unreachableEvidence = createEvidence({
      id: 'optional-evidence',
      importance: 'supporting',
      title: 'Evidencia opcional',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        evidences: [createEvidence(), unreachableEvidence],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La evidencia "Evidencia opcional" no tiene ruta de descubrimiento.',
    );
    expect(validation.warnings).toEqual([]);
  });

  it('blocks unreachable statements', () => {
    const statement = createStatement({
      isInitiallyVisible: false,
      speakerName: 'Testigo reservado',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        statements: [statement],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La declaracion de "Testigo reservado" no tiene ruta de descubrimiento.',
    );
  });

  it('blocks statements that are initially visible', () => {
    const statement = createStatement({
      isInitiallyVisible: true,
      speakerName: 'Testigo reservado',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        statements: [statement],
        statementUnlockRules: [
          createStatementUnlockRule({
            statementId: statement.id,
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La declaracion de "Testigo reservado" no puede ser inicialmente visible; debe desbloquearse por entrevista.',
    );
  });

  it('blocks statement rules that do not use interviews', () => {
    const statement = createStatement();

    const validation = validator.validate(
      createPlayableSnapshot({
        statements: [statement],
        statementUnlockRules: [
          createStatementUnlockRule({
            actionId: 'action-initial',
            statementId: statement.id,
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La regla de declaracion "statement-rule-id" debe usar una accion de entrevista.',
    );
  });

  it('blocks statement rules that are not guaranteed', () => {
    const statement = createStatement();

    const validation = validator.validate(
      createPlayableSnapshot({
        statements: [statement],
        statementUnlockRules: [
          createStatementUnlockRule({
            isGuaranteed: false,
            statementId: statement.id,
            successChance: 0.5,
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La regla de declaracion "statement-rule-id" debe ser garantizada con successChance 1.',
    );
  });

  it('blocks interviews that target more than one suspect', () => {
    const validation = validator.validate(
      createPlayableSnapshot({
        actions: [
          createAction('action-initial'),
          createAction('interview-shared', {
            actionType: 'interview',
            title: 'Entrevista compartida',
          }),
        ],
        statementUnlockRules: [
          createStatementUnlockRule({
            actionId: 'interview-shared',
            id: 'statement-rule-one',
            statementId: 'statement-one',
          }),
          createStatementUnlockRule({
            actionId: 'interview-shared',
            id: 'statement-rule-two',
            statementId: 'statement-two',
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La entrevista "Entrevista compartida" debe apuntar a un solo sospechoso mediante reglas de declaracion.',
    );
  });

  it('blocks unreachable contradictions even when they are not mandatory', () => {
    const contradiction = createContradiction({
      title: 'Contradiccion opcional',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        contradictions: [contradiction],
        statements: [createStatement()],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La contradiccion "Contradiccion opcional" no tiene ruta de descubrimiento.',
    );
  });

  it('allows a minimum playable case', () => {
    const validation = validator.validate(createPlayableSnapshot());

    expect(validation.canPublish).toBe(true);
    expect(validation.blockingIssues).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });
});

function createPlayableSnapshot(
  overrides: Partial<CasePlayabilitySnapshot> = {},
): CasePlayabilitySnapshot {
  const culprit = createSuspect('suspect-one');
  const otherSuspect = createSuspect('suspect-two');
  const evidence = createEvidence({ id: 'evidence-critical' });
  const action = createAction('action-initial');
  const culpritStatement = createStatement({
    id: 'statement-one',
    isInitiallyVisible: false,
    speakerName: culprit.name,
    suspectId: culprit.id,
  });
  const otherStatement = createStatement({
    id: 'statement-two',
    isInitiallyVisible: false,
    speakerName: otherSuspect.name,
    suspectId: otherSuspect.id,
  });
  const culpritInterview = createAction('interview-suspect-one', {
    actionType: 'interview',
    title: 'Entrevistar a suspect-one',
  });
  const otherInterview = createAction('interview-suspect-two', {
    actionType: 'interview',
    title: 'Entrevistar a suspect-two',
  });

  return {
    actionPrerequisites: [],
    actions: [action, culpritInterview, otherInterview],
    caseRecord: createCase(),
    contradictionUnlockRules: [],
    contradictions: [],
    evidenceUnlockRules: [
      {
        actionId: action.id,
        createdAt: '2026-05-21T00:00:00.000Z',
        durationModifierMinutes: 0,
        evidenceId: evidence.id,
        id: 'evidence-rule',
        isGuaranteed: true,
        minimumSkillLevel: 50,
        successChance: 1,
      },
    ],
    evidences: [evidence],
    requirements: [
      createRequirement({
        requiredEvidenceId: evidence.id,
        requiredSuspectId: culprit.id,
      }),
    ],
    solution: createSolution(culprit.id),
    statementUnlockRules: [
      createStatementUnlockRule({
        actionId: culpritInterview.id,
        id: 'statement-rule-one',
        statementId: culpritStatement.id,
      }),
      createStatementUnlockRule({
        actionId: otherInterview.id,
        id: 'statement-rule-two',
        statementId: otherStatement.id,
      }),
    ],
    statements: [culpritStatement, otherStatement],
    suspects: [culprit, otherSuspect],
    ...overrides,
  };
}

function createCase(): AdminCaseRecord {
  return {
    aiGenerationMetadata: {},
    createdAt: '2026-05-21T00:00:00.000Z',
    createdBy: 'user-id',
    departmentId: null,
    difficulty: 'medium',
    generatedByAi: false,
    id: 'case-id',
    status: 'draft',
    summary: 'Caso de prueba.',
    title: 'Caso minimo',
    updatedAt: '2026-05-21T00:00:00.000Z',
  };
}

function createSuspect(id: string): AdminSuspectRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    id,
    name: id,
  };
}

function createEvidence(
  overrides: Partial<AdminEvidenceRecord> = {},
): AdminEvidenceRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Evidencia critica.',
    id: 'evidence-critical',
    importance: 'critical',
    isDecoy: false,
    isInitiallyVisible: false,
    metadata: {},
    title: 'Evidencia critica',
    type: 'physical',
    weight: 10,
    ...overrides,
  };
}

function createRequirement(
  overrides: Partial<AdminSolveRequirementRecord> = {},
): AdminSolveRequirementRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Probar la identidad.',
    id: 'requirement-id',
    isMandatory: true,
    requirementType: 'identity',
    weight: 1,
    ...overrides,
  };
}

function createStatement(
  overrides: Partial<AdminStatementRecord> = {},
): AdminStatementRecord {
  return {
    caseId: 'case-id',
    content: 'Declaracion contrastable.',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'statement-id',
    isInitiallyVisible: false,
    speakerName: 'Alicia Mora',
    suspectId: 'suspect-one',
    ...overrides,
  };
}

function createStatementUnlockRule(
  overrides: Partial<AdminStatementUnlockRuleRecord> = {},
): AdminStatementUnlockRuleRecord {
  return {
    actionId: 'interview-suspect-one',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'statement-rule-id',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    statementId: 'statement-id',
    successChance: 1,
    ...overrides,
  };
}

function createContradiction(
  overrides: Partial<AdminContradictionRecord> = {},
): AdminContradictionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    explanation: 'La declaracion contradice la evidencia.',
    id: 'contradiction-id',
    isInitiallyVisible: false,
    proves: 'contradiction',
    refutingEvidenceId: 'evidence-critical',
    statementId: 'statement-id',
    suspectId: 'suspect-one',
    title: 'Coartada rota',
    ...overrides,
  };
}

function createContradictionUnlockRule(
  overrides: Partial<AdminContradictionUnlockRuleRecord> = {},
): AdminContradictionUnlockRuleRecord {
  return {
    actionId: 'action-initial',
    contradictionId: 'contradiction-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'contradiction-rule-id',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    successChance: 1,
    ...overrides,
  };
}

function createAction(
  id: string,
  overrides: Partial<AdminInvestigationActionRecord> = {},
): AdminInvestigationActionRecord {
  return {
    actionType: 'inspect_scene',
    baseDurationMinutes: 30,
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Inspeccionar escena.',
    id,
    isInitiallyAvailable: true,
    metadata: {},
    minimumSkillLevel: 50,
    requiresDetective: true,
    title: 'Inspeccionar escena',
    ...overrides,
  };
}

function createSolution(culpritSuspectId: string): AdminCaseSolutionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    culpritSuspectId,
    fullExplanation: 'Explicacion completa.',
    id: 'solution-id',
    methodSummary: 'Metodo.',
    motiveSummary: 'Motivo.',
    opportunitySummary: 'Oportunidad.',
  };
}
