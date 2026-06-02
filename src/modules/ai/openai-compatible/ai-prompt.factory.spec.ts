import {
  GenerateAdminCaseBaseInput,
  GenerateCaseEvidencesInput,
  GenerateCaseInvestigationGraphInput,
  GenerateCaseSolveRequirementsInput,
  GenerateCaseStatementsInput,
  GenerateCaseSuspectsInput,
} from '../types/ai.types';
import { AiPromptFactory } from './ai-prompt.factory';

describe('AiPromptFactory', () => {
  let factory: AiPromptFactory;

  beforeEach(() => {
    factory = new AiPromptFactory();
  });

  it('builds a case suspects prompt with exact count and strict output rules', () => {
    const messages = factory.buildCaseSuspectsMessages(
      createCaseSuspectsInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain('Genera exactamente 3 sospechosos');
    expect(prompt).toContain('Idioma obligatorio');
    expect(prompt).toContain('La dificultad del caso es hard');
    expect(prompt).toContain('Nombres obligatorios de sospechosos');
    expect(prompt).toContain('Alicia Mora');
    expect(prompt).toContain('no inventes nombres fuera de esa lista');
    expect(prompt).toContain('No incluyas id, caseId, createdAt');
    expect(prompt).toContain('campos extra');
    expect(prompt).toContain('"title":"Caso de prueba"');
  });

  it('builds an admin case base prompt with the required victim name pool', () => {
    const messages = factory.buildAdminCaseBaseMessages(
      createAdminCaseBaseInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain('Nombre obligatorio de victima');
    expect(prompt).toContain('Victor Ramos');
    expect(prompt).toContain('victimName debe ser exactamente uno');
  });

  it('builds a case statements prompt that keeps statements locked', () => {
    const messages = factory.buildCaseStatementsMessages(
      createCaseStatementsInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain('Cada statement debe incluir suspectId');
    expect(prompt).toContain('No mezcles ingles');
    expect(prompt).toContain('isInitiallyVisible debe ser siempre false');
    expect(prompt).toContain(
      'las declaraciones solo aparecen cuando el jugador completa la entrevista',
    );
  });

  it('builds a case evidences prompt that requires a motive proof for the culprit', () => {
    const messages = factory.buildCaseEvidencesMessages(
      createCaseEvidencesInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain(
      'Debe existir al menos una evidencia no distractora relacionada con el culpable',
    );
    expect(prompt).toContain('pruebe su motivo real');
    expect(prompt).toContain('Crea una matriz probatoria minima');
    expect(prompt).toContain('identity, una para motive, una para method y una para opportunity');
    expect(prompt).toContain('Las evidencias restantes deben ser support o decoy');
    expect(prompt).toContain('metadata.primaryProofRole');
    expect(prompt).toContain('metadata.mandatoryCandidate');
    expect(prompt).toContain('metadata.proofRationale');
    expect(prompt).toContain('metadata.narrativePurpose');
  });

  it('builds a solve requirements prompt that rejects suspect-only motive requirements', () => {
    const messages = factory.buildCaseSolveRequirementsMessages(
      createCaseSolveRequirementsInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain(
      'Un requisito motive obligatorio nunca debe usar solo requiredSuspectId',
    );
    expect(prompt).toContain(
      'Debe apuntar a requiredEvidenceId o requiredContradictionId',
    );
    expect(prompt).toContain(
      'Identificar al culpable no cuenta como probar motivo',
    );
    expect(prompt).toContain(
      'El requisito culprit no cuenta como identity aunque tenga proofRole identity',
    );
    expect(prompt).toContain(
      'No generes requisitos opcionales en easy',
    );
    expect(prompt).toContain(
      'No reutilices el mismo requiredEvidenceId ni el mismo requiredContradictionId',
    );
    expect(prompt).toContain(
      'metadata.primaryProofRole o estar incluido en metadata.proofRoles',
    );
    expect(prompt).toContain('contradiction.proves');
    expect(prompt).toContain('Ejemplo de estructura valida para easy');
  });

  it('builds a solution prompt that prevents unsupported official facts', () => {
    const messages = factory.buildCaseSolutionMessages(
      createCaseSolveRequirementsInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain(
      'Cada afirmacion fuerte de metodo u oportunidad debe estar respaldada',
    );
    expect(prompt).toContain('redactala como hipotesis limitada');
  });

  it('builds a compact investigation graph prompt without raw persistence noise', () => {
    const messages = factory.buildCaseInvestigationGraphMessages(
      createInvestigationGraphInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain('Dossier compacto');
    expect(prompt).toContain('Conserva sin traducir solo IDs');
    expect(prompt).toContain('El JSON final debe tener entre 6 y 9 acciones');
    expect(prompt).toContain('No uses actionId ni tempId dentro de reglas');
    expect(prompt).toContain(
      'prerequisiteEvidenceAlias o prerequisiteContradictionAlias',
    );
    expect(prompt).toContain('"culpritSuspectAlias":"SP1"');
    expect(prompt).toContain('"alias":"EV1"');
    expect(prompt).toContain('"statementAlias":"ST1"');
    expect(prompt).toContain('"refutingEvidenceAlias":"EV1"');
    expect(prompt).toContain('"fullExplanation":"La solucion conecta');
    expect(prompt).toContain('"suggestedUnlockAction":"inspeccionar archivo"');
    expect(prompt).toContain('inspect_scene');
    expect(prompt).toContain('analyze_forensic_sample');
    expect(prompt).toContain(
      'exactamente una accion inicial actionType="interview" por cada sospechoso',
    );
    expect(prompt).toContain(
      'Cada accion interview debe entrevistar a un solo sospechoso',
    );
    expect(prompt).toContain(
      'actionType="interview" es exclusivo para entrevistas iniciales a sospechosos',
    );
    expect(prompt).toContain(
      'No uses actionType="interview" para testigos, personal de limpieza, guardias, terceros',
    );
    expect(prompt).toContain('Ninguna declaracion puede tratarse como inicial');
    expect(prompt).toContain(
      'Cada declaracion debe tener una regla en statementUnlockRules apuntando a una accion interview',
    );
    expect(prompt).toContain(
      'Todas las reglas de statementUnlockRules deben usar isGuaranteed true y successChance 1',
    );
    expect(prompt).toContain(
      'Una accion que desbloquea una contradiccion nunca puede depender de esa misma contradiccion',
    );
    expect(prompt).toContain('minimumSkillLevel siempre debe ser un entero');
    expect(prompt).toContain('Nunca uses valores menores a 50');
    expect(prompt).toContain('promedio cercano a 3-3.5 minutos');
    expect(prompt).toContain('"mandatory"');
    expect(prompt).toContain('"optional"');
    expect(prompt).not.toContain('suspect-1');
    expect(prompt).not.toContain('evidence-1');
    expect(prompt).not.toContain('statement-1');
    expect(prompt).not.toContain('contradiction-1');
    expect(prompt).not.toContain('prerequisiteEvidenceId');
    expect(prompt).not.toContain('prerequisiteContradictionId');
    expect(prompt).not.toContain('"createdAt"');
    expect(prompt).not.toContain('"metadata"');
    expect(prompt).not.toContain('"weight"');
    expect(prompt).not.toContain('"caseId"');
  });

  it('builds an investigation graph repair prompt with validation feedback', () => {
    const messages = factory.buildCaseInvestigationGraphRepairMessages({
      attempt: 1,
      input: createInvestigationGraphInput(),
      maxAttempts: 2,
      previousPayload: {
        actionPrerequisites: [],
        actions: [{ tempId: 'request_autopsy' }],
        contradictionUnlockRules: [],
        evidenceUnlockRules: [],
        statementUnlockRules: [],
      },
      validationReport: {
        isValid: false,
        issues: [
          {
            code: 'non_initial_action_without_prerequisite',
            message:
              'La accion no inicial request_autopsy no tiene prerequisitos.',
            path: 'actions.request_autopsy',
          },
        ],
      },
    });

    const prompt = messages[1].content;

    expect(prompt).toContain('intento de reparacion 1 de 2');
    expect(prompt).toContain('si el contexto trae texto en ingles');
    expect(prompt).toContain('Devuelve el JSON completo corregido');
    expect(prompt).toContain('Errores detectados que debes corregir primero');
    expect(prompt).toContain('El JSON anterior tiene 1 acciones');
    expect(prompt).toContain('El JSON final debe respetar ese rango');
    expect(prompt).toContain('Prioriza agregar o corregir reglas de unlock');
    expect(prompt).toContain(
      'Cada sospechoso debe quedar cubierto por una accion inicial actionType="interview" propia',
    );
    expect(prompt).toContain(
      'Todas las declaraciones deben permanecer bloqueadas al inicio',
    );
    expect(prompt).toContain(
      'Las reglas de statementUnlockRules deben ser garantizadas',
    );
    expect(prompt).toContain(
      'actionType="interview" solo sirve para entrevistas iniciales a sospechosos',
    );
    expect(prompt).toContain(
      'reemplaza ese prerequisito por la entrevista del sospechoso y la evidencia refutadora',
    );
    expect(prompt).toContain('La accion no inicial request_autopsy');
    expect(prompt).toContain('"tempId":"request_autopsy"');
    expect(prompt).toContain('"alias":"EV1"');
    expect(prompt).not.toContain('evidence-1');
  });
});

function createAdminCaseBaseInput(): GenerateAdminCaseBaseInput {
  return {
    difficulty: 'medium',
    forbiddenTitles: ['Caso repetido'],
    theme: 'archivo municipal',
    victimNamePool: ['Victor Ramos'],
  };
}

function createCaseStatementsInput(): GenerateCaseStatementsInput {
  return {
    caseData: {
      difficulty: 'medium',
      id: 'case-1',
      publicBriefing: 'Briefing publico.',
      summary: 'Resumen del caso.',
      title: 'Caso de prueba',
    },
    culpritSuspectId: 'suspect-1',
    evidences: [
      {
        description: 'Evidencia visible.',
        id: 'evidence-1',
        importance: 'critical',
        isDecoy: false,
        isInitiallyVisible: true,
        metadata: {},
        title: 'Archivo inicial',
        type: 'document',
        weight: 10,
      },
    ],
    suspects: [
      {
        createdAt: '2026-05-21T00:00:00.000Z',
        id: 'suspect-1',
        name: 'Alicia Mora',
      },
    ],
  };
}

function createCaseSuspectsInput(): GenerateCaseSuspectsInput {
  return {
    caseData: {
      difficulty: 'hard',
      id: 'case-1',
      publicBriefing: 'Briefing publico.',
      summary: 'Resumen del caso.',
      title: 'Caso de prueba',
      victimName: 'Victor Ramos',
    },
    difficulty: 'hard',
    suspectNamePool: ['Alicia Mora', 'Bruno Rivas', 'Carla Soto'],
    suspectCount: 3,
  };
}

function createCaseEvidencesInput(): GenerateCaseEvidencesInput {
  return {
    caseData: createPromptCaseContext(),
    culpritSuspectId: 'suspect-1',
    evidenceCount: 5,
    generateSolution: true,
    suspects: createPromptSuspects(),
  };
}

function createCaseSolveRequirementsInput(): GenerateCaseSolveRequirementsInput {
  return {
    actions: [],
    caseData: createPromptCaseContext(),
    contradictionUnlockRules: [],
    contradictions: [
      {
        explanation: 'La evidencia contradice la coartada.',
        id: 'contradiction-1',
        isInitiallyVisible: false,
        proves: 'opportunity',
        refutingEvidenceId: 'evidence-1',
        statementId: 'statement-1',
        suspectId: 'suspect-1',
        title: 'Coartada rota',
      },
    ],
    culpritSuspectId: 'suspect-1',
    difficulty: 'medium',
    evidenceUnlockRules: [],
    evidences: [
      {
        description: 'Registro que ubica al sospechoso en el archivo.',
        discoveryHint: 'Buscar en el archivo central.',
        id: 'evidence-1',
        importance: 'critical',
        isDecoy: false,
        isInitiallyVisible: false,
        location: 'Archivo central',
        metadata: {
          narrativePurpose: 'probar oportunidad',
          relatedSuspectIds: ['suspect-1'],
        },
        title: 'Registro de acceso',
        type: 'document',
        weight: 90,
      },
    ],
    solution: {
      caseId: 'case-1',
      createdAt: '2026-05-23T00:00:00.000Z',
      culpritSuspectId: 'suspect-1',
      fullExplanation:
        'La solucion conecta el registro de acceso con la declaracion falsa.',
      id: 'solution-1',
      methodSummary: 'Manipulo el archivo.',
      motiveSummary: 'Ocultar una falsificacion.',
      opportunitySummary: 'Tuvo acceso fuera de horario.',
    },
    statements: [
      {
        content: 'No estuve en el archivo despues del cierre.',
        context: 'Declaracion contrastable con el registro.',
        id: 'statement-1',
        isInitiallyVisible: false,
        speakerName: 'Alicia',
        suspectId: 'suspect-1',
      },
    ],
    suspects: createPromptSuspects(),
  };
}

function createInvestigationGraphInput(): GenerateCaseInvestigationGraphInput {
  return {
    caseData: {
      difficulty: 'medium',
      id: 'case-1',
      publicBriefing: 'Informe publico   con espacios.',
      summary: 'Resumen del caso\ncon espacios.',
      title: 'Caso compacto',
      victimName: 'Victor Ramos',
    },
    contradictions: [
      {
        explanation: 'La evidencia contradice la coartada.',
        id: 'contradiction-1',
        isInitiallyVisible: false,
        proves: 'opportunity',
        refutingEvidenceId: 'evidence-1',
        statementId: 'statement-1',
        suspectId: 'suspect-1',
        title: 'Coartada rota',
      },
    ],
    culpritSuspectId: 'suspect-1',
    difficulty: 'medium',
    evidences: [
      {
        description: 'Registro que ubica al sospechoso en el archivo.',
        discoveryHint: 'Buscar en el archivo central.',
        id: 'evidence-1',
        importance: 'critical',
        isDecoy: false,
        isInitiallyVisible: false,
        location: 'Archivo central',
        metadata: {
          narrativePurpose: 'probar oportunidad',
          noisyField: {
            nested: true,
          },
          relatedSuspectIds: ['suspect-1'],
          suggestedUnlockAction: 'inspeccionar archivo',
        },
        title: 'Registro de acceso',
        type: 'document',
        weight: 90,
      },
    ],
    requirements: [
      {
        description: 'Identificar al culpable.',
        id: 'requirement-1',
        isMandatory: true,
        requiredSuspectId: 'suspect-1',
        requirementType: 'culprit',
        weight: 100,
      },
      {
        description: 'Encontrar el registro de acceso.',
        id: 'requirement-2',
        isMandatory: false,
        proofRole: 'opportunity',
        requiredEvidenceId: 'evidence-1',
        requirementType: 'evidence',
        weight: 60,
      },
    ],
    solution: {
      caseId: 'case-1',
      createdAt: '2026-05-23T00:00:00.000Z',
      culpritSuspectId: 'suspect-1',
      fullExplanation:
        'La solucion conecta el registro de acceso con la declaracion falsa.',
      id: 'solution-1',
      methodSummary: 'Manipulo el archivo.',
      motiveSummary: 'Ocultar una falsificacion.',
      opportunitySummary: 'Tuvo acceso fuera de horario.',
    },
    statements: [
      {
        content: 'No estuve en el archivo despues del cierre.',
        context: 'Declaracion contrastable con el registro.',
        id: 'statement-1',
        isInitiallyVisible: false,
        speakerName: 'Alicia',
        suspectId: 'suspect-1',
      },
    ],
    suspects: [
      {
        background: 'Responsable del archivo.',
        createdAt: '2026-05-23T00:00:00.000Z',
        id: 'suspect-1',
        name: 'Alicia',
        occupation: 'Archivista',
        personality: 'Reservada',
        publicNotes: 'Conocia la rutina de cierre.',
        relationshipToVictim: 'Colega',
      },
    ],
  };
}

function createPromptCaseContext() {
  return {
    difficulty: 'medium',
    id: 'case-1',
    publicBriefing: 'Briefing publico.',
    summary: 'Resumen del caso.',
    title: 'Caso de prueba',
    victimName: 'Victor Ramos',
  };
}

function createPromptSuspects() {
  return [
    {
      background: 'Responsable del archivo.',
      createdAt: '2026-05-23T00:00:00.000Z',
      id: 'suspect-1',
      name: 'Alicia',
      occupation: 'Archivista',
      personality: 'Reservada',
      publicNotes: 'Conocia la rutina de cierre.',
      relationshipToVictim: 'Colega',
    },
  ];
}
