import { GeneratedCaseInvestigationGraphNormalizer } from './generated-case-investigation-graph.normalizer';
import { GenerateCaseInvestigationGraphInput } from '../types/ai.types';

describe('GeneratedCaseInvestigationGraphNormalizer', () => {
  let normalizer: GeneratedCaseInvestigationGraphNormalizer;

  beforeEach(() => {
    normalizer = new GeneratedCaseInvestigationGraphNormalizer();
  });

  it('normalizes a reachable graph with guaranteed mandatory findings', () => {
    const content = normalizer.createContentFromPayload(
      createValidPayload(),
      createInput(),
    );

    expect(content.actions).toHaveLength(6);
    expect(content.evidenceUnlockRules[0]).toEqual(
      expect.objectContaining({
        actionTempId: 'inspect_case_files',
        evidenceId: 'evidence-id',
        isGuaranteed: true,
      }),
    );
    expect(content.contradictionUnlockRules[0]).toEqual(
      expect.objectContaining({
        actionTempId: 'compare_versions',
        contradictionId: 'contradiction-id',
        isGuaranteed: true,
      }),
    );
  });

  it('maps legacy AI action types to Supabase action type values', () => {
    const payload = createValidPayload({
      actions: [
        createActionPayload({
          actionType: 'inspection',
          isInitiallyAvailable: true,
          tempId: 'inspect_case_files',
        }),
        createActionPayload({
          actionType: 'camera_review',
          isInitiallyAvailable: true,
          tempId: 'interview_case_circle',
        }),
        createActionPayload({
          actionType: 'area_canvass',
          tempId: 'compare_versions',
        }),
        createActionPayload({ tempId: 'follow_up_line_1' }),
        createActionPayload({ tempId: 'follow_up_line_2' }),
        createActionPayload({ tempId: 'follow_up_line_3' }),
      ],
    });

    const content = normalizer.createContentFromPayload(payload, createInput());

    expect(content.actions.map((action) => action.actionType)).toEqual([
      'inspect_scene',
      'review_security_camera',
      'canvass_area',
      'inspect_scene',
      'inspect_scene',
      'inspect_scene',
    ]);
  });

  it('raises generated minimum skill levels below fifty to the playable floor', () => {
    const payload = createValidPayload({
      actions: [
        createActionPayload({
          isInitiallyAvailable: true,
          minimumSkillLevel: 2,
          tempId: 'inspect_case_files',
        }),
        createActionPayload({
          actionType: 'interview',
          isInitiallyAvailable: true,
          minimumSkillLevel: 49,
          requiredSkill: 'interrogation',
          tempId: 'interview_case_circle',
        }),
        createActionPayload({
          actionType: 'custom',
          minimumSkillLevel: 0,
          requiredSkill: 'psychology',
          tempId: 'compare_versions',
        }),
        createActionPayload({ tempId: 'follow_up_line_1' }),
        createActionPayload({ tempId: 'follow_up_line_2' }),
        createActionPayload({ tempId: 'follow_up_line_3' }),
      ],
      contradictionUnlockRules: [
        {
          actionTempId: 'compare_versions',
          contradictionAlias: 'CT1',
          isGuaranteed: true,
          minimumSkillLevel: 1,
          successChance: 1,
        },
      ],
      evidenceUnlockRules: [
        {
          actionTempId: 'inspect_case_files',
          evidenceAlias: 'EV1',
          isGuaranteed: true,
          minimumSkillLevel: 12,
          successChance: 1,
        },
      ],
      statementUnlockRules: [
        {
          actionTempId: 'interview_case_circle',
          isGuaranteed: true,
          minimumSkillLevel: 30,
          statementAlias: 'ST1',
          successChance: 1,
        },
      ],
    });

    const content = normalizer.createContentFromPayload(payload, createInput());

    expect(content.actions.map((action) => action.minimumSkillLevel)).toEqual([
      50, 50, 50, 50, 50, 50,
    ]);
    expect(content.evidenceUnlockRules[0].minimumSkillLevel).toBe(50);
    expect(content.statementUnlockRules[0].minimumSkillLevel).toBe(50);
    expect(content.contradictionUnlockRules[0].minimumSkillLevel).toBe(50);
  });

  it('rejects mandatory evidence without a guaranteed route', () => {
    const payload = createValidPayload({
      evidenceUnlockRules: [
        {
          actionTempId: 'inspect_case_files',
          evidenceAlias: 'EV1',
          isGuaranteed: false,
          successChance: 0.5,
        },
      ],
    });

    expect(() =>
      normalizer.createContentFromPayload(payload, createInput()),
    ).toThrow(
      'La evidencia obligatoria EV1 no tiene una ruta garantizada. Aliases permitidos: EV1.',
    );
  });

  it('rejects contradictions when their statement is not reachable', () => {
    const payload = createValidPayload({
      statementUnlockRules: [],
    });

    expect(() =>
      normalizer.createContentFromPayload(payload, createInput()),
    ).toThrow(
      'La declaracion ST1 no queda descubierta por el grafo. Aliases permitidos: ST1.',
    );
  });

  it('returns all validation issues for a normalized but incomplete graph', () => {
    const content = normalizer.createNormalizedContentFromPayload(
      createValidPayload({
        actionPrerequisites: [],
        contradictionUnlockRules: [],
        evidenceUnlockRules: [],
        statementUnlockRules: [],
      }),
      createInput(),
    );

    const report = normalizer.validateContent(content, createInput());

    expect(report.isValid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'non_initial_action_without_prerequisite',
        'unreachable_evidence',
        'unreachable_statement',
        'unreachable_contradiction',
        'mandatory_evidence_not_guaranteed',
        'mandatory_contradiction_not_guaranteed',
      ]),
    );
    expect(report.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'La accion no inicial compare_versions no tiene prerequisitos.',
        'La evidencia EV1 no queda descubierta por el grafo. Aliases permitidos: EV1.',
        'La declaracion ST1 no queda descubierta por el grafo. Aliases permitidos: ST1.',
      ]),
    );
  });

  it('reports action count as a repairable validation issue', () => {
    const content = normalizer.createNormalizedContentFromPayload(
      createValidPayload({
        actionPrerequisites: [
          {
            actionTempId: 'compare_versions',
            prerequisiteActionTempId: 'inspect_case_files',
          },
          {
            actionTempId: 'compare_versions',
            prerequisiteActionTempId: 'interview_case_circle',
          },
          {
            actionTempId: 'follow_up_line_1',
            prerequisiteActionTempId: 'compare_versions',
          },
        ],
        actions: [
          createActionPayload({
            isInitiallyAvailable: true,
            tempId: 'inspect_case_files',
          }),
          createActionPayload({
            actionType: 'interview',
            isInitiallyAvailable: true,
            requiredSkill: 'interrogation',
            tempId: 'interview_case_circle',
          }),
          createActionPayload({
            actionType: 'custom',
            requiredSkill: 'psychology',
            tempId: 'compare_versions',
          }),
          createActionPayload({ tempId: 'follow_up_line_1' }),
        ],
      }),
      createInput(),
    );

    const report = normalizer.validateContent(content, createInput());

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'action_count_outside_budget',
          message: expect.stringContaining('rango permitido es 6-9'),
        }),
      ]),
    );
  });

  it('reports the received value when actionTempId is invalid', () => {
    const payload = createValidPayload({
      evidenceUnlockRules: [
        {
          actionId: 'inspect_case_files',
          evidenceId: 'evidence-id',
          isGuaranteed: true,
          successChance: 1,
        },
      ],
    });

    expect(() =>
      normalizer.createContentFromPayload(payload, createInput()),
    ).toThrow(
      'La IA no devolvio un valor valido para evidenceUnlockRules[0].actionTempId. Valor recibido: undefined.',
    );
  });

  it('reports invalid aliases with the allowed aliases', () => {
    const payload = createValidPayload({
      statementUnlockRules: [
        {
          actionTempId: 'interview_case_circle',
          isGuaranteed: true,
          statementAlias: 'ST9',
          successChance: 1,
        },
      ],
    });

    expect(() =>
      normalizer.createContentFromPayload(payload, createInput()),
    ).toThrow(
      'La IA devolvio un alias de declaracion invalido en statementUnlockRules[0].statementAlias. Valor recibido: "ST9". Aliases permitidos: ST1.',
    );
  });
});

function createInput(): GenerateCaseInvestigationGraphInput {
  return {
    caseData: {
      difficulty: 'medium',
      id: 'case-id',
      summary: 'Caso estructurado.',
      title: 'Caso de prueba',
    },
    contradictions: [
      {
        explanation: 'La evidencia contradice la declaracion.',
        id: 'contradiction-id',
        isInitiallyVisible: false,
        proves: 'contradiction',
        refutingEvidenceId: 'evidence-id',
        statementId: 'statement-id',
        suspectId: 'suspect-id',
        title: 'Coartada falsa',
      },
    ],
    culpritSuspectId: 'suspect-id',
    difficulty: 'medium',
    evidences: [
      {
        description: 'Registro que ubica al sospechoso.',
        id: 'evidence-id',
        importance: 'critical',
        isDecoy: false,
        isInitiallyVisible: false,
        metadata: {},
        title: 'Registro de acceso',
        type: 'digital',
        weight: 10,
      },
    ],
    requirements: [
      {
        description: 'Probar identidad.',
        id: 'requirement-evidence',
        isMandatory: true,
        proofRole: 'identity',
        requiredEvidenceId: 'evidence-id',
        requirementType: 'identity',
        weight: 5,
      },
      {
        description: 'Romper coartada.',
        id: 'requirement-contradiction',
        isMandatory: true,
        proofRole: 'contradiction',
        requiredContradictionId: 'contradiction-id',
        requirementType: 'contradiction',
        weight: 5,
      },
    ],
    solution: {
      caseId: 'case-id',
      createdAt: '2026-05-21T00:00:00.000Z',
      culpritSuspectId: 'suspect-id',
      fullExplanation: 'Explicacion completa.',
      id: 'solution-id',
      methodSummary: 'Metodo.',
      motiveSummary: 'Motivo.',
      opportunitySummary: 'Oportunidad.',
    },
    statements: [
      {
        content: 'No estuve en la escena.',
        id: 'statement-id',
        isInitiallyVisible: false,
        speakerName: 'Alicia Mora',
        suspectId: 'suspect-id',
      },
    ],
    suspects: [
      {
        createdAt: '2026-05-21T00:00:00.000Z',
        id: 'suspect-id',
        name: 'Alicia Mora',
      },
    ],
  };
}

function createValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    actionPrerequisites: [
      {
        actionTempId: 'compare_versions',
        prerequisiteActionTempId: 'inspect_case_files',
      },
      {
        actionTempId: 'compare_versions',
        prerequisiteActionTempId: 'interview_case_circle',
      },
      {
        actionTempId: 'follow_up_line_1',
        prerequisiteActionTempId: 'compare_versions',
      },
      {
        actionTempId: 'follow_up_line_2',
        prerequisiteActionTempId: 'follow_up_line_1',
      },
      {
        actionTempId: 'follow_up_line_3',
        prerequisiteActionTempId: 'follow_up_line_2',
      },
    ],
    actions: [
      createActionPayload({
        isInitiallyAvailable: true,
        tempId: 'inspect_case_files',
      }),
      createActionPayload({
        actionType: 'interview',
        isInitiallyAvailable: true,
        requiredSkill: 'interrogation',
        tempId: 'interview_case_circle',
      }),
      createActionPayload({
        actionType: 'custom',
        requiredSkill: 'psychology',
        tempId: 'compare_versions',
      }),
      createActionPayload({ tempId: 'follow_up_line_1' }),
      createActionPayload({ tempId: 'follow_up_line_2' }),
      createActionPayload({ tempId: 'follow_up_line_3' }),
    ],
    contradictionUnlockRules: [
      {
        actionTempId: 'compare_versions',
        contradictionAlias: 'CT1',
        isGuaranteed: true,
        successChance: 1,
      },
    ],
    evidenceUnlockRules: [
      {
        actionTempId: 'inspect_case_files',
        evidenceAlias: 'EV1',
        isGuaranteed: true,
        successChance: 1,
      },
    ],
    statementUnlockRules: [
      {
        actionTempId: 'interview_case_circle',
        isGuaranteed: true,
        statementAlias: 'ST1',
        successChance: 1,
      },
    ],
    ...overrides,
  };
}

function createActionPayload(overrides: Record<string, unknown> = {}) {
  return {
    actionType: 'inspect_scene',
    baseDurationMinutes: 45,
    description: 'Accion de investigacion.',
    isInitiallyAvailable: false,
    metadata: {},
    minimumSkillLevel: 50,
    requiredSkill: 'crime_scene_analysis',
    requiresDetective: true,
    tempId: 'action-temp-id',
    title: 'Accion investigativa',
    ...overrides,
  };
}
