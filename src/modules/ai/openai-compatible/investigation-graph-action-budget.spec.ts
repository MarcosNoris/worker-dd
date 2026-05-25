import { GenerateCaseInvestigationGraphInput } from '../types/ai.types';
import { createInvestigationGraphActionBudget } from './investigation-graph-action-budget';

describe('createInvestigationGraphActionBudget', () => {
  it('keeps the base range for compact medium cases', () => {
    const budget = createInvestigationGraphActionBudget(createInput());

    expect(budget.min).toBe(6);
    expect(budget.max).toBe(9);
  });

  it('expands the range when a medium case has dense hidden content', () => {
    const budget = createInvestigationGraphActionBudget(
      createInput({
        contradictions: Array.from({ length: 5 }, (_, index) =>
          createContradiction(`contradiction-${index + 1}`),
        ),
        evidences: Array.from({ length: 12 }, (_, index) =>
          createEvidence(`evidence-${index + 1}`, index > 2),
        ),
      }),
    );

    expect(budget.min).toBe(9);
    expect(budget.max).toBe(12);
  });
});

function createInput(
  overrides: Partial<GenerateCaseInvestigationGraphInput> = {},
): GenerateCaseInvestigationGraphInput {
  return {
    caseData: {
      difficulty: 'medium',
      id: 'case-id',
      summary: 'Caso estructurado.',
      title: 'Caso de prueba',
    },
    contradictions: [createContradiction('contradiction-1')],
    culpritSuspectId: 'suspect-1',
    difficulty: 'medium',
    evidences: [createEvidence('evidence-1', false)],
    requirements: [],
    solution: {
      caseId: 'case-id',
      createdAt: '2026-05-23T00:00:00.000Z',
      culpritSuspectId: 'suspect-1',
      fullExplanation: 'Explicacion completa del caso.',
      id: 'solution-1',
      methodSummary: 'Metodo.',
      motiveSummary: 'Motivo.',
      opportunitySummary: 'Oportunidad.',
    },
    statements: [
      {
        content: 'Declaracion contrastable.',
        id: 'statement-1',
        isInitiallyVisible: true,
        speakerName: 'Testigo',
        suspectId: 'suspect-1',
      },
    ],
    suspects: [
      {
        createdAt: '2026-05-23T00:00:00.000Z',
        id: 'suspect-1',
        name: 'Sospechoso',
      },
    ],
    ...overrides,
  };
}

function createEvidence(id: string, isHidden: boolean) {
  return {
    description: `Descripcion de ${id}.`,
    id,
    importance: 'supporting' as const,
    isDecoy: false,
    isInitiallyVisible: !isHidden,
    metadata: {},
    title: `Evidencia ${id}`,
    type: 'document' as const,
    weight: 10,
  };
}

function createContradiction(id: string) {
  return {
    explanation: `Explicacion de ${id}.`,
    id,
    isInitiallyVisible: false,
    proves: 'contradiction',
    refutingEvidenceId: 'evidence-1',
    statementId: 'statement-1',
    suspectId: 'suspect-1',
    title: `Contradiccion ${id}`,
  };
}
