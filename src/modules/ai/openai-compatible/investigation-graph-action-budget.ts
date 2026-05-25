import { AdminCaseDifficulty } from '../../cases/constants/admin-case.constants';
import { GenerateCaseInvestigationGraphInput } from '../types/ai.types';

const BASE_ACTION_COUNT_BY_DIFFICULTY: Record<
  AdminCaseDifficulty,
  { readonly max: number; readonly min: number }
> = {
  easy: { min: 4, max: 7 },
  medium: { min: 6, max: 9 },
  hard: { min: 8, max: 12 },
  expert: { min: 10, max: 14 },
};
const CORE_INVESTIGATION_ACTION_COUNT = 3;
const DISCOVERABLE_ITEMS_PER_ACTION = 3;
const CONTRADICTIONS_PER_ACTION = 2;
const DYNAMIC_RANGE_WIDTH = 3;
const MAX_ACTION_COUNT = 18;

export interface InvestigationGraphActionBudget {
  readonly baseMax: number;
  readonly baseMin: number;
  readonly hiddenContradictionCount: number;
  readonly hiddenEvidenceCount: number;
  readonly hiddenStatementCount: number;
  readonly max: number;
  readonly min: number;
}

export function createInvestigationGraphActionBudget(
  input: GenerateCaseInvestigationGraphInput,
): InvestigationGraphActionBudget {
  const baseBudget = BASE_ACTION_COUNT_BY_DIFFICULTY[input.difficulty];
  const hiddenEvidenceCount = countHiddenItems(input.evidences);
  const hiddenStatementCount = countHiddenItems(input.statements);
  const hiddenContradictionCount = countHiddenItems(input.contradictions);
  const contentDrivenMin = calculateContentDrivenMinimum({
    hiddenContradictionCount,
    hiddenEvidenceCount,
    hiddenStatementCount,
  });
  const min = Math.min(
    MAX_ACTION_COUNT,
    Math.max(baseBudget.min, contentDrivenMin),
  );
  const max = Math.min(
    MAX_ACTION_COUNT,
    Math.max(baseBudget.max, min + DYNAMIC_RANGE_WIDTH),
  );

  return {
    baseMax: baseBudget.max,
    baseMin: baseBudget.min,
    hiddenContradictionCount,
    hiddenEvidenceCount,
    hiddenStatementCount,
    max,
    min,
  };
}

export function describeInvestigationGraphActionBudget(
  budget: InvestigationGraphActionBudget,
): string {
  return [
    `El rango base de dificultad era ${budget.baseMin}-${budget.baseMax}.`,
    `Este caso tiene ${budget.hiddenEvidenceCount} evidencias ocultas, ${budget.hiddenStatementCount} declaraciones ocultas y ${budget.hiddenContradictionCount} contradicciones ocultas.`,
    `El JSON final debe tener entre ${budget.min} y ${budget.max} acciones.`,
  ].join(' ');
}

function calculateContentDrivenMinimum(command: {
  readonly hiddenContradictionCount: number;
  readonly hiddenEvidenceCount: number;
  readonly hiddenStatementCount: number;
}): number {
  const discoverableItemCount =
    command.hiddenEvidenceCount + command.hiddenStatementCount;

  return (
    CORE_INVESTIGATION_ACTION_COUNT +
    Math.ceil(discoverableItemCount / DISCOVERABLE_ITEMS_PER_ACTION) +
    Math.ceil(command.hiddenContradictionCount / CONTRADICTIONS_PER_ACTION)
  );
}

function countHiddenItems(
  items: readonly { readonly isInitiallyVisible: boolean }[],
): number {
  return items.filter((item) => !item.isInitiallyVisible).length;
}
