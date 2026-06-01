import { Injectable } from '@nestjs/common';

export const INVESTIGATION_ACCELERATION_TYPES = [
  'extra_shift',
  'priority_lab',
  'support_team',
] as const;

export const ACTION_OPERATIONAL_CATEGORIES = [
  'lab',
  'field',
  'records',
  'interview',
  'surveillance',
  'digital',
  'forensic',
  'custom',
] as const;

export type InvestigationAccelerationType =
  (typeof INVESTIGATION_ACCELERATION_TYPES)[number];
export type ActionOperationalCategory =
  (typeof ACTION_OPERATIONAL_CATEGORIES)[number];

export interface InvestigationAccelerationRule {
  readonly budgetCost: number;
  readonly eligibleCategories: readonly ActionOperationalCategory[];
  readonly fatigueDelta: number;
  readonly remainingTimeMultiplier: number;
  readonly successChanceModifier: number;
  readonly type: InvestigationAccelerationType;
}

const ACCELERATION_RULES = {
  extra_shift: {
    budgetCost: 75,
    eligibleCategories: ACTION_OPERATIONAL_CATEGORIES,
    fatigueDelta: 1,
    remainingTimeMultiplier: 0.7,
    successChanceModifier: 0,
    type: 'extra_shift',
  },
  priority_lab: {
    budgetCost: 125,
    eligibleCategories: ['lab', 'forensic'],
    fatigueDelta: 0,
    remainingTimeMultiplier: 0.6,
    successChanceModifier: 0.05,
    type: 'priority_lab',
  },
  support_team: {
    budgetCost: 150,
    eligibleCategories: ['field', 'surveillance', 'records', 'digital'],
    fatigueDelta: 0,
    remainingTimeMultiplier: 0.8,
    successChanceModifier: 0.1,
    type: 'support_team',
  },
} satisfies Record<InvestigationAccelerationType, InvestigationAccelerationRule>;

@Injectable()
export class InvestigationAccelerationRuleService {
  findRule(type: InvestigationAccelerationType): InvestigationAccelerationRule {
    return ACCELERATION_RULES[type];
  }
}
