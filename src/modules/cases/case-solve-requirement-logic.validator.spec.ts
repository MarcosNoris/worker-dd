import {
  AdminContradictionRecord,
  AdminEvidenceRecord,
  AdminSolveRequirementRecord,
  AdminStatementRecord,
} from './cases.repository';
import {
  CaseSolveRequirementLogicValidator,
  SolveRequirementLogicValidationInput,
} from './case-solve-requirement-logic.validator';

describe('CaseSolveRequirementLogicValidator', () => {
  let validator: CaseSolveRequirementLogicValidator;

  beforeEach(() => {
    validator = new CaseSolveRequirementLogicValidator();
  });

  it('blocks mandatory opportunity requirements that only clear an innocent suspect', () => {
    const innocentEvidence = createEvidence({
      id: 'innocent-evidence',
      metadata: { relatedSuspectIds: ['innocent-suspect'] },
      title: 'Coartada del inocente',
    });
    const issues = validator.validate(
      createValidationInput({
        evidences: [createEvidence(), innocentEvidence],
        requirements: createCompleteRequirements({
          opportunityTarget: {
            requiredEvidenceId: innocentEvidence.id,
            requiredSuspectId: undefined,
          },
        }),
      }),
    );

    expect(issues).toContain(
      'El requisito opportunity "Probar la oportunidad." debe probar oportunidad del culpable, no la coartada de otro sospechoso.',
    );
  });

  it('blocks mandatory decoy evidences', () => {
    const decoyEvidence = createEvidence({
      id: 'decoy-evidence',
      isDecoy: true,
      title: 'Pista distractora',
    });
    const issues = validator.validate(
      createValidationInput({
        evidences: [createEvidence(), decoyEvidence],
        requirements: createCompleteRequirements({
          methodTarget: { requiredEvidenceId: decoyEvidence.id },
        }),
      }),
    );

    expect(issues).toContain(
      'El requisito "Probar el metodo." no puede usar la evidencia distractora "Pista distractora" como obligatoria.',
    );
  });

  it('blocks mandatory contradictions linked to innocent suspects', () => {
    const contradiction = createContradiction({
      statementId: 'innocent-statement',
      suspectId: 'innocent-suspect',
    });
    const issues = validator.validate(
      createValidationInput({
        contradictions: [contradiction],
        requirements: createCompleteRequirements({
          identityTarget: {
            requiredContradictionId: contradiction.id,
            requiredEvidenceId: undefined,
          },
        }),
        statements: [
          createStatement(),
          createStatement({
            id: 'innocent-statement',
            suspectId: 'innocent-suspect',
          }),
        ],
      }),
    );

    expect(issues).toContain(
      'El requisito "Probar la identidad." exige una contradiccion que no esta asociada al culpable.',
    );
  });

  it('blocks duplicated mandatory proof roles', () => {
    const issues = validator.validate(
      createValidationInput({
        requirements: [
          ...createCompleteRequirements(),
          createRequirement({
            description: 'Probar otro metodo.',
            id: 'requirement-method-extra',
            proofRole: 'method',
            requiredEvidenceId: 'evidence-id',
            requirementType: 'method',
          }),
        ],
      }),
    );

    expect(issues).toContain(
      'El caso no puede exigir mas de un requisito obligatorio para "method". Convierte las pruebas extra en opcionales.',
    );
  });

  it('blocks mandatory requirements that reuse the same evidence target', () => {
    const issues = validator.validate(
      createValidationInput({
        requirements: createCompleteRequirements({
          methodTarget: { requiredEvidenceId: 'evidence-identity' },
        }),
      }),
    );

    expect(issues).toContain(
      'La misma evidencia o contradiccion obligatoria no puede probar "method" y "identity". Usa una relacion 1 a 1 entre prueba obligatoria y solve requirement.',
    );
  });

  it('blocks mandatory evidence whose metadata does not declare the required proof role', () => {
    const wrongRoleEvidence = createEvidence({
      id: 'wrong-role-evidence',
      metadata: {
        primaryProofRole: 'identity',
        proofRoles: ['identity'],
        relatedSuspectIds: ['culprit-suspect'],
      },
      title: 'Evidencia con rol incorrecto',
    });
    const issues = validator.validate(
      createValidationInput({
        evidences: [...createCoreEvidences(), wrongRoleEvidence],
        requirements: createCompleteRequirements({
          methodTarget: { requiredEvidenceId: wrongRoleEvidence.id },
        }),
      }),
    );

    expect(issues).toContain(
      'El requisito "Probar el metodo." usa la evidencia "Evidencia con rol incorrecto", pero su metadata no declara primaryProofRole/proofRoles="method".',
    );
  });

  it('blocks mandatory motive requirements that only identify the culprit', () => {
    const issues = validator.validate(
      createValidationInput({
        requirements: createCompleteRequirements({
          motiveTarget: {
            requiredEvidenceId: undefined,
            requiredSuspectId: 'culprit-suspect',
          },
        }),
      }),
    );

    expect(issues).toContain(
      'El requisito motive "Probar el motivo." debe apuntar a una evidencia o contradiccion que pruebe el motivo del culpable.',
    );
  });

  it('blocks mandatory motive evidence that is not related to the culprit', () => {
    const unrelatedMotiveEvidence = createEvidence({
      id: 'unrelated-motive-evidence',
      metadata: { relatedSuspectIds: ['innocent-suspect'] },
      title: 'Motivo de otro sospechoso',
    });
    const issues = validator.validate(
      createValidationInput({
        evidences: [createEvidence(), unrelatedMotiveEvidence],
        requirements: createCompleteRequirements({
          motiveTarget: { requiredEvidenceId: unrelatedMotiveEvidence.id },
        }),
      }),
    );

    expect(issues).toContain(
      'El requisito motive "Probar el motivo." debe usar una evidencia relacionada con el culpable.',
    );
  });

  it('allows mandatory motive contradictions linked to the culprit', () => {
    const contradiction = createContradiction({
      id: 'motive-contradiction',
      proves: 'motive',
      suspectId: 'culprit-suspect',
    });
    const issues = validator.validate(
      createValidationInput({
        contradictions: [contradiction],
        requirements: createCompleteRequirements({
          motiveTarget: {
            requiredContradictionId: contradiction.id,
            requiredEvidenceId: undefined,
          },
        }),
      }),
    );

    expect(issues).toEqual([]);
  });

  it('allows optional support evidence that clears an innocent suspect', () => {
    const innocentEvidence = createEvidence({
      id: 'innocent-evidence',
      metadata: { relatedSuspectIds: ['innocent-suspect'] },
    });
    const issues = validator.validate(
      createValidationInput({
        evidences: [createEvidence(), innocentEvidence],
        requirements: [
          ...createCompleteRequirements(),
          createRequirement({
            description: 'Descartar al inocente.',
            id: 'requirement-support',
            isMandatory: false,
            proofRole: 'support',
            requiredEvidenceId: innocentEvidence.id,
            requirementType: 'custom',
          }),
        ],
      }),
    );

    expect(issues).toEqual([]);
  });

  it('allows justified mandatory innocent exclusion on non-easy cases', () => {
    const innocentEvidence = createEvidence({
      id: 'innocent-evidence',
      metadata: {
        logicValidation: {
          allowsMandatoryInnocentExclusion: true,
          reason: 'Caso avanzado que exige descartar una coartada central.',
        },
        primaryProofRole: 'method',
        proofRoles: ['method'],
        relatedSuspectIds: ['innocent-suspect'],
      },
    });
    const issues = validator.validate(
      createValidationInput({
        evidences: [createEvidence(), innocentEvidence],
        requirements: createCompleteRequirements({
          methodTarget: { requiredEvidenceId: innocentEvidence.id },
        }),
      }),
    );

    expect(issues).toEqual([]);
  });

  it('blocks justified mandatory innocent exclusion on easy cases', () => {
    const innocentEvidence = createEvidence({
      id: 'innocent-evidence',
      metadata: {
        logicValidation: {
          allowsMandatoryInnocentExclusion: true,
          reason: 'Caso avanzado que exige descartar una coartada central.',
        },
        primaryProofRole: 'method',
        proofRoles: ['method'],
        relatedSuspectIds: ['innocent-suspect'],
      },
    });
    const issues = validator.validate(
      createValidationInput({
        difficulty: 'easy',
        evidences: [createEvidence(), innocentEvidence],
        requirements: createCompleteRequirements({
          methodTarget: { requiredEvidenceId: innocentEvidence.id },
        }),
      }),
    );

    expect(issues).toContain(
      'El requisito "Probar el metodo." usa una evidencia enfocada solo en sospechosos inocentes.',
    );
  });

  it('requires culprit, method, motive, opportunity and identity mandatory proof keys', () => {
    const issues = validator.validate(
      createValidationInput({
        requirements: [
          createRequirement({
            proofRole: undefined,
            requiredSuspectId: 'culprit-suspect',
            requirementType: 'culprit',
          }),
        ],
      }),
    );

    expect(issues).toContain(
      'El caso necesita un requisito obligatorio que pruebe "method".',
    );
    expect(issues).toContain(
      'El caso necesita un requisito obligatorio que pruebe "motive".',
    );
    expect(issues).toContain(
      'El caso necesita un requisito obligatorio que pruebe "opportunity".',
    );
    expect(issues).toContain(
      'El caso necesita un requisito obligatorio que pruebe "identity".',
    );
  });
});

function createValidationInput(
  overrides: Partial<SolveRequirementLogicValidationInput> = {},
): SolveRequirementLogicValidationInput {
  return {
    contradictions: [],
    culpritSuspectId: 'culprit-suspect',
    difficulty: 'medium',
    evidences: createCoreEvidences(),
    requirements: createCompleteRequirements(),
    statements: [createStatement()],
    ...overrides,
  };
}

function createCompleteRequirements(
  overrides: {
    readonly identityTarget?: Partial<AdminSolveRequirementRecord>;
    readonly methodTarget?: Partial<AdminSolveRequirementRecord>;
    readonly motiveTarget?: Partial<AdminSolveRequirementRecord>;
    readonly opportunityTarget?: Partial<AdminSolveRequirementRecord>;
  } = {},
): AdminSolveRequirementRecord[] {
  return [
    createRequirement({
      description: 'Identificar al culpable.',
      id: 'requirement-culprit',
      proofRole: undefined,
      requiredEvidenceId: undefined,
      requiredSuspectId: 'culprit-suspect',
      requirementType: 'culprit',
    }),
    createRequirement({
      description: 'Probar el metodo.',
      id: 'requirement-method',
      proofRole: 'method',
      requiredEvidenceId: 'evidence-method',
      requiredSuspectId: undefined,
      requirementType: 'method',
      ...overrides.methodTarget,
    }),
    createRequirement({
      description: 'Probar el motivo.',
      id: 'requirement-motive',
      proofRole: 'motive',
      requiredEvidenceId: 'evidence-motive',
      requiredSuspectId: undefined,
      requirementType: 'motive',
      ...overrides.motiveTarget,
    }),
    createRequirement({
      description: 'Probar la oportunidad.',
      id: 'requirement-opportunity',
      proofRole: 'opportunity',
      requiredEvidenceId: undefined,
      requiredSuspectId: 'culprit-suspect',
      requirementType: 'opportunity',
      ...overrides.opportunityTarget,
    }),
    createRequirement({
      description: 'Probar la identidad.',
      id: 'requirement-identity',
      proofRole: 'identity',
      requiredEvidenceId: 'evidence-identity',
      requiredSuspectId: undefined,
      requirementType: 'identity',
      ...overrides.identityTarget,
    }),
  ];
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
    proofRole: 'identity',
    requiredEvidenceId: 'evidence-id',
    requirementType: 'identity',
    weight: 1,
    ...overrides,
  };
}

function createEvidence(
  overrides: Partial<AdminEvidenceRecord> = {},
): AdminEvidenceRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    description: 'Evidencia directa.',
    id: 'evidence-method',
    importance: 'critical',
    isDecoy: false,
    isInitiallyVisible: true,
    metadata: {
      primaryProofRole: 'method',
      proofRoles: ['method'],
      relatedSuspectIds: ['culprit-suspect'],
    },
    title: 'Evidencia directa',
    type: 'physical',
    weight: 10,
    ...overrides,
  };
}

function createCoreEvidences(): AdminEvidenceRecord[] {
  return [
    createEvidence(),
    createEvidence({
      id: 'evidence-motive',
      metadata: {
        primaryProofRole: 'motive',
        proofRoles: ['motive'],
        relatedSuspectIds: ['culprit-suspect'],
      },
    }),
    createEvidence({
      id: 'evidence-identity',
      metadata: {
        primaryProofRole: 'identity',
        proofRoles: ['identity'],
        relatedSuspectIds: ['culprit-suspect'],
      },
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
    speakerName: 'Sospechoso culpable',
    suspectId: 'culprit-suspect',
    ...overrides,
  };
}

function createContradiction(
  overrides: Partial<AdminContradictionRecord> = {},
): AdminContradictionRecord {
  return {
    caseId: 'case-id',
    createdAt: '2026-05-21T00:00:00.000Z',
    explanation: 'Contradiccion con evidencia.',
    id: 'contradiction-id',
    isInitiallyVisible: true,
    proves: 'contradiction',
    refutingEvidenceId: 'evidence-method',
    statementId: 'statement-id',
    suspectId: 'culprit-suspect',
    title: 'Contradiccion central',
    ...overrides,
  };
}
