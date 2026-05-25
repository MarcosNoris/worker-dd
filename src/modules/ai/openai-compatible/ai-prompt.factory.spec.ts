import {
  GenerateCaseInvestigationGraphInput,
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
    expect(prompt).toContain('La dificultad del caso es hard');
    expect(prompt).toContain('No incluyas id, caseId, createdAt');
    expect(prompt).toContain('campos extra');
    expect(prompt).toContain('"title":"Caso de prueba"');
  });

  it('builds a compact investigation graph prompt without raw persistence noise', () => {
    const messages = factory.buildCaseInvestigationGraphMessages(
      createInvestigationGraphInput(),
    );

    const prompt = messages[1].content;

    expect(prompt).toContain('Dossier compacto');
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
    expect(prompt).toContain('minimumSkillLevel siempre debe ser un entero');
    expect(prompt).toContain('Nunca uses valores menores a 50');
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
    expect(prompt).toContain('Devuelve el JSON completo corregido');
    expect(prompt).toContain('El JSON anterior tiene 1 acciones');
    expect(prompt).toContain('El JSON final debe respetar ese rango');
    expect(prompt).toContain('Prioriza agregar o corregir reglas de unlock');
    expect(prompt).toContain('La accion no inicial request_autopsy');
    expect(prompt).toContain('"tempId":"request_autopsy"');
    expect(prompt).toContain('"alias":"EV1"');
    expect(prompt).not.toContain('evidence-1');
  });
});

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
    suspectCount: 3,
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
