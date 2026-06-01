import { Injectable } from '@nestjs/common';

export const INSTITUTIONAL_ACCESSES = [
  'historical_archive',
  'priority_autopsy',
  'state_lab',
  'fast_warrant',
  'informants',
  'federal_cooperation',
] as const;

export type InstitutionalAccess = (typeof INSTITUTIONAL_ACCESSES)[number];

export interface InstitutionalAccessGrant {
  readonly access: InstitutionalAccess;
  readonly reputationRequired: number;
  readonly unlocked: boolean;
}

const REPUTATION_THRESHOLD_BY_ACCESS = {
  historical_archive: 100,
  priority_autopsy: 250,
  state_lab: 400,
  fast_warrant: 600,
  informants: 800,
  federal_cooperation: 1000,
} satisfies Record<InstitutionalAccess, number>;

@Injectable()
export class InstitutionalAccessRuleService {
  listAccessForReputation(reputation: number): InstitutionalAccessGrant[] {
    return INSTITUTIONAL_ACCESSES.map((access) => ({
      access,
      reputationRequired: REPUTATION_THRESHOLD_BY_ACCESS[access],
      unlocked: this.hasAccess({ access, reputation }),
    }));
  }

  hasAccess(command: {
    readonly access: InstitutionalAccess;
    readonly reputation: number;
  }): boolean {
    return command.reputation >= REPUTATION_THRESHOLD_BY_ACCESS[command.access];
  }

  durationMultiplierForUnlockedAccess(unlocked: boolean): number {
    return unlocked ? 0.9 : 1;
  }

  optionalChanceModifierForUnlockedAccess(unlocked: boolean): number {
    return unlocked ? 0.05 : 0;
  }
}
