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
  const evidence = createEvidence({ id: 'evidence-critical' });
  const action = createAction('action-initial');

  return {
    actionPrerequisites: [],
    actions: [action],
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
    statementUnlockRules: [],
    statements: [],
    suspects: [culprit, createSuspect('suspect-two')],
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
    isInitiallyVisible: true,
    speakerName: 'Alicia Mora',
    suspectId: 'suspect-one',
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

function createAction(id: string): AdminInvestigationActionRecord {
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
