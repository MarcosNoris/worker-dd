import {
  CasePlayabilitySnapshot,
  AdminCaseRecord,
  AdminCaseSolutionRecord,
  AdminContradictionRecord,
  AdminEvidenceRecord,
  AdminEvidenceUnlockRuleRecord,
  AdminContradictionUnlockRuleRecord,
  AdminInvestigationActionRecord,
  AdminSolveRequirementRecord,
  AdminActionPrerequisiteRecord,
  AdminStatementRecord,
  AdminStatementUnlockRuleRecord,
  AdminSuspectRecord,
} from './cases.repository';
import { CasePlayabilityValidator } from './case-playability.validator';
import { CaseSolveRequirementLogicValidator } from './case-solve-requirement-logic.validator';

describe('CasePlayabilityValidator', () => {
  let validator: CasePlayabilityValidator;

  beforeEach(() => {
    validator = new CasePlayabilityValidator(
      new CaseSolveRequirementLogicValidator(),
    );
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

  it('blocks cases with incoherent mandatory solve requirements', () => {
    const culprit = createSuspect('suspect-one');
    const evidence = createEvidence({ id: 'evidence-critical' });
    const innocentEvidence = createEvidence({
      id: 'innocent-evidence',
      metadata: { relatedSuspectIds: ['suspect-two'] },
      title: 'Coartada del inocente',
    });
    const validation = validator.validate(
      createPlayableSnapshot({
        evidences: [evidence, innocentEvidence],
        requirements: createCompleteRequirements({
          culpritSuspectId: culprit.id,
          evidenceId: evidence.id,
        }).map((requirement) =>
          requirement.proofRole === 'opportunity'
            ? {
                ...requirement,
                requiredEvidenceId: innocentEvidence.id,
                requiredSuspectId: undefined,
              }
            : requirement,
        ),
        suspects: [culprit, createSuspect('suspect-two')],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'El requisito opportunity "Probar la oportunidad." debe probar oportunidad del culpable, no la coartada de otro sospechoso.',
    );
  });

  it('blocks evidences that declare more than one core proof role in state validation', () => {
    const mixedRoleEvidence = createEvidence({
      id: 'mixed-role-evidence',
      metadata: {
        primaryProofRole: 'identity',
        proofRoles: ['identity', 'motive'],
        relatedSuspectIds: ['suspect-one'],
      },
      title: 'Evidencia mezclada',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        evidences: [
          mixedRoleEvidence,
          createEvidence({
            id: 'evidence-critical-method',
            metadata: {
              primaryProofRole: 'method',
              proofRoles: ['method'],
              relatedSuspectIds: ['suspect-one'],
            },
          }),
          createEvidence({
            id: 'evidence-critical-motive',
            metadata: {
              primaryProofRole: 'motive',
              proofRoles: ['motive'],
              relatedSuspectIds: ['suspect-one'],
            },
          }),
          createEvidence({
            id: 'evidence-critical-opportunity',
            metadata: {
              primaryProofRole: 'opportunity',
              proofRoles: ['opportunity'],
              relatedSuspectIds: ['suspect-one'],
            },
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La evidencia "Evidencia mezclada" declara multiples roles core (identity, motive). Cada evidencia debe conservar como maximo un rol core.',
    );
  });

  it('blocks duplicate primary evidences for the same core proof role', () => {
    const validation = validator.validate(
      createPlayableSnapshot({
        evidences: [
          createEvidence({
            id: 'identity-evidence-one',
            metadata: {
              primaryProofRole: 'identity',
              proofRoles: ['identity'],
              relatedSuspectIds: ['suspect-one'],
            },
            title: 'Identidad uno',
          }),
          createEvidence({
            id: 'identity-evidence-two',
            metadata: {
              primaryProofRole: 'identity',
              proofRoles: ['identity'],
              relatedSuspectIds: ['suspect-one'],
            },
            title: 'Identidad dos',
          }),
          createEvidence({
            id: 'evidence-critical-method',
            metadata: {
              primaryProofRole: 'method',
              proofRoles: ['method'],
              relatedSuspectIds: ['suspect-one'],
            },
          }),
          createEvidence({
            id: 'evidence-critical-motive',
            metadata: {
              primaryProofRole: 'motive',
              proofRoles: ['motive'],
              relatedSuspectIds: ['suspect-one'],
            },
          }),
          createEvidence({
            id: 'evidence-critical-opportunity',
            metadata: {
              primaryProofRole: 'opportunity',
              proofRoles: ['opportunity'],
              relatedSuspectIds: ['suspect-one'],
            },
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La matriz probatoria declara 2 evidencias principales para "identity": "Identidad uno", "Identidad dos". Solo una evidencia puede ocupar cada rol core; las restantes deben ser support o false_alibi.',
    );
  });

  it('blocks extra mandatory evidences outside the proof matrix', () => {
    const validation = validator.validate(
      createPlayableSnapshot({
        evidences: [
          ...createCoreEvidences(),
          createEvidence({
            id: 'support-evidence',
            metadata: {
              mandatoryCandidate: true,
              primaryProofRole: 'support',
              proofRoles: ['support'],
              relatedSuspectIds: ['suspect-one'],
            },
            title: 'Apoyo obligatorio incorrecto',
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La evidencia "Apoyo obligatorio incorrecto" tiene mandatoryCandidate=true pero no ocupa un rol core unico; las evidencias extra deben quedar como support o false_alibi.',
    );
  });

  it('blocks non-initial interview actions used for witness work', () => {
    const witnessInterview = createAction('action-witness-interview', {
      actionType: 'interview',
      isInitiallyAvailable: false,
      title: 'Entrevistar al equipo de limpieza',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        actionPrerequisites: [
          createActionPrerequisite({
            actionId: witnessInterview.id,
            prerequisiteActionId: 'action-initial',
          }),
        ],
        actions: [
          createAction('action-initial'),
          createInterviewAction('action-interview-suspect-one'),
          createInterviewAction('action-interview-suspect-two'),
          witnessInterview,
        ],
        statementUnlockRules: [
          createStatementUnlockRule({
            actionId: 'action-interview-suspect-one',
            statementId: 'statement-suspect-one',
          }),
          createStatementUnlockRule({
            actionId: 'action-interview-suspect-two',
            id: 'statement-rule-two',
            statementId: 'statement-suspect-two',
          }),
          createStatementUnlockRule({
            actionId: witnessInterview.id,
            id: 'statement-rule-witness',
            statementId: 'statement-suspect-one',
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La accion "Entrevistar al equipo de limpieza" usa actionType="interview", pero interview solo se permite para entrevistas iniciales a sospechosos.',
    );
  });

  it('blocks statement unlock rules from non-interview actions', () => {
    const validation = validator.validate(
      createPlayableSnapshot({
        statementUnlockRules: [
          createStatementUnlockRule({
            actionId: 'action-initial',
            statementId: 'statement-suspect-one',
          }),
          createStatementUnlockRule({
            actionId: 'action-interview-suspect-two',
            id: 'statement-rule-two',
            statementId: 'statement-suspect-two',
          }),
        ],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La regla de declaracion "statement-rule-id" debe desbloquearse desde una accion interview; la accion "Inspeccionar escena" usa "inspect_scene".',
    );
  });

  it('blocks actions that depend on contradictions they unlock', () => {
    const contradiction = createContradiction();
    const action = createAction('action-confront', {
      actionType: 'custom',
      isInitiallyAvailable: false,
      title: 'Confrontar coartada',
    });

    const validation = validator.validate(
      createPlayableSnapshot({
        actionPrerequisites: [
          createActionPrerequisite({
            actionId: action.id,
            prerequisiteActionId: undefined,
            prerequisiteContradictionId: contradiction.id,
          }),
        ],
        actions: [
          createAction('action-initial'),
          createInterviewAction('action-interview-suspect-one'),
          createInterviewAction('action-interview-suspect-two'),
          action,
        ],
        contradictionUnlockRules: [
          createContradictionUnlockRule({
            actionId: action.id,
            contradictionId: contradiction.id,
          }),
        ],
        contradictions: [contradiction],
      }),
    );

    expect(validation.canPublish).toBe(false);
    expect(validation.blockingIssues).toContain(
      'La accion "Confrontar coartada" no puede depender de la contradiccion "Coartada rota" porque esa misma accion la desbloquea.',
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
  const innocent = createSuspect('suspect-two');
  const [evidence, methodEvidence, motiveEvidence, identityEvidence] =
    createCoreEvidences(culprit.id);
  const action = createAction('action-initial');
  const culpritStatement = createStatement({
    id: 'statement-suspect-one',
    speakerName: culprit.name,
    suspectId: culprit.id,
  });
  const innocentStatement = createStatement({
    id: 'statement-suspect-two',
    speakerName: innocent.name,
    suspectId: innocent.id,
  });

  return {
    actionPrerequisites: [],
    actions: [
      action,
      createInterviewAction('action-interview-suspect-one'),
      createInterviewAction('action-interview-suspect-two'),
    ],
    caseRecord: createCase(),
    contradictionUnlockRules: [],
    contradictions: [],
    evidenceUnlockRules: [
      createEvidenceUnlockRule({ actionId: action.id, evidenceId: evidence.id }),
      createEvidenceUnlockRule({
        actionId: action.id,
        evidenceId: methodEvidence.id,
        id: 'evidence-rule-method',
      }),
      createEvidenceUnlockRule({
        actionId: action.id,
        evidenceId: motiveEvidence.id,
        id: 'evidence-rule-motive',
      }),
      createEvidenceUnlockRule({
        actionId: action.id,
        evidenceId: identityEvidence.id,
        id: 'evidence-rule-identity',
      }),
    ],
    evidences: [evidence, methodEvidence, motiveEvidence, identityEvidence],
    requirements: createCompleteRequirements({
      culpritSuspectId: culprit.id,
      evidenceId: evidence.id,
    }),
    solution: createSolution(culprit.id),
    statementUnlockRules: [
      createStatementUnlockRule({
        actionId: 'action-interview-suspect-one',
        statementId: culpritStatement.id,
      }),
      createStatementUnlockRule({
        actionId: 'action-interview-suspect-two',
        id: 'statement-rule-two',
        statementId: innocentStatement.id,
      }),
    ],
    statements: [culpritStatement, innocentStatement],
    suspects: [culprit, innocent],
    ...overrides,
  };
}

function createCoreEvidences(
  culpritSuspectId = 'suspect-one',
): readonly AdminEvidenceRecord[] {
  const opportunityEvidence = createEvidence({
    id: 'evidence-critical',
    metadata: {
      primaryProofRole: 'opportunity',
      proofRoles: ['opportunity'],
      relatedSuspectIds: [culpritSuspectId],
    },
  });

  return [
    opportunityEvidence,
    createEvidence({
      id: `${opportunityEvidence.id}-method`,
      metadata: {
        primaryProofRole: 'method',
        proofRoles: ['method'],
        relatedSuspectIds: [culpritSuspectId],
      },
    }),
    createEvidence({
      id: `${opportunityEvidence.id}-motive`,
      metadata: {
        primaryProofRole: 'motive',
        proofRoles: ['motive'],
        relatedSuspectIds: [culpritSuspectId],
      },
    }),
    createEvidence({
      id: `${opportunityEvidence.id}-identity`,
      metadata: {
        primaryProofRole: 'identity',
        proofRoles: ['identity'],
        relatedSuspectIds: [culpritSuspectId],
      },
    }),
  ];
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
    metadata: { relatedSuspectIds: ['suspect-one'] },
    title: 'Evidencia critica',
    type: 'physical',
    weight: 10,
    ...overrides,
  };
}

function createEvidenceUnlockRule(
  overrides: Partial<AdminEvidenceUnlockRuleRecord> = {},
): AdminEvidenceUnlockRuleRecord {
  return {
    actionId: 'action-initial',
    createdAt: '2026-05-21T00:00:00.000Z',
    durationModifierMinutes: 0,
    evidenceId: 'evidence-critical',
    id: 'evidence-rule',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    successChance: 1,
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

function createCompleteRequirements(command: {
  readonly culpritSuspectId: string;
  readonly evidenceId: string;
}): AdminSolveRequirementRecord[] {
  const methodEvidenceId = `${command.evidenceId}-method`;
  const motiveEvidenceId = `${command.evidenceId}-motive`;
  const identityEvidenceId = `${command.evidenceId}-identity`;

  return [
    createRequirement({
      description: 'Identificar al culpable.',
      id: 'requirement-culprit',
      proofRole: undefined,
      requiredEvidenceId: undefined,
      requiredSuspectId: command.culpritSuspectId,
      requirementType: 'culprit',
    }),
    createRequirement({
      description: 'Probar el metodo.',
      id: 'requirement-method',
      proofRole: 'method',
      requiredEvidenceId: methodEvidenceId,
      requiredSuspectId: undefined,
      requirementType: 'method',
    }),
    createRequirement({
      description: 'Probar el motivo.',
      id: 'requirement-motive',
      proofRole: 'motive',
      requiredEvidenceId: motiveEvidenceId,
      requiredSuspectId: undefined,
      requirementType: 'motive',
    }),
    createRequirement({
      description: 'Probar la oportunidad.',
      id: 'requirement-opportunity',
      proofRole: 'opportunity',
      requiredEvidenceId: undefined,
      requiredSuspectId: command.culpritSuspectId,
      requirementType: 'opportunity',
    }),
    createRequirement({
      description: 'Probar la identidad.',
      id: 'requirement-identity',
      proofRole: 'identity',
      requiredEvidenceId: identityEvidenceId,
      requiredSuspectId: undefined,
      requirementType: 'identity',
    }),
  ];
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

function createInterviewAction(
  id: string,
  overrides: Partial<AdminInvestigationActionRecord> = {},
): AdminInvestigationActionRecord {
  return createAction(id, {
    actionType: 'interview',
    requiredSkill: 'interrogation',
    title: 'Entrevistar sospechoso',
    ...overrides,
  });
}

function createStatementUnlockRule(
  overrides: Partial<AdminStatementUnlockRuleRecord> = {},
): AdminStatementUnlockRuleRecord {
  return {
    actionId: 'action-interview-suspect-one',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'statement-rule-id',
    isGuaranteed: true,
    minimumSkillLevel: 50,
    requiredSkill: 'interrogation',
    statementId: 'statement-suspect-one',
    successChance: 1,
    ...overrides,
  };
}

function createActionPrerequisite(
  overrides: Partial<AdminActionPrerequisiteRecord> = {},
): AdminActionPrerequisiteRecord {
  return {
    actionId: 'action-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    id: 'action-prerequisite-id',
    prerequisiteActionId: 'action-initial',
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
