import { Injectable } from '@nestjs/common';
import {
  readArray,
  readNumber,
  readString,
} from '../../../shared/utils/value.util';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GeneratedDetectiveProfile,
  GeneratedDetectiveRank,
  GeneratedDetectiveSkill,
  GenerateDetectiveProfileInput,
} from '../types/ai.types';
import { normalizeDetectiveSkillType } from '../../../shared/constants/detective-skill.constants';

const MAX_DETECTIVE_BIO_LENGTH = 500;
const MAX_DETECTIVE_NAME_LENGTH = 80;
const MAX_DETECTIVE_SKILL_LENGTH = 80;
const MIN_DETECTIVE_SKILL_LEVEL = 0;
const MAX_DETECTIVE_SKILL_LEVEL = 100;
const MAX_GENERATED_SKILLS = 12;
const MAX_SKILL_LEVEL_BY_GENERAL_LEVEL = {
  1: 30,
  2: 40,
  3: 50,
  4: 60,
  5: 70,
  6: 78,
  7: 85,
  8: 90,
  9: 96,
  10: 100,
} as const;
const EXCEPTIONAL_SKILL_POLICY_BY_GENERAL_LEVEL = {
  1: { maximumCount: 0, threshold: 30 },
  2: { maximumCount: 0, threshold: 40 },
  3: { maximumCount: 0, threshold: 50 },
  4: { maximumCount: 1, threshold: 50 },
  5: { maximumCount: 2, threshold: 60 },
  6: { maximumCount: 3, threshold: 70 },
  7: { maximumCount: 3, threshold: 80 },
  8: { maximumCount: 4, threshold: 85 },
  9: { maximumCount: 6, threshold: 90 },
  10: { maximumCount: 6, threshold: 95 },
} as const;
interface GeneratedDetectiveProfilePayload {
  readonly bio?: unknown;
  readonly name?: unknown;
  readonly rank?: unknown;
  readonly skills?: unknown;
}

@Injectable()
export class DetectiveProfileNormalizer {
  createProfileFromPayload(
    payload: GeneratedDetectiveProfilePayload,
    input: GenerateDetectiveProfileInput,
  ): GeneratedDetectiveProfile {
    const profile = {
      name: this.readProfileName(payload.name),
      rank: this.readRank(payload.rank, input),
      bio: this.readProfileBio(payload.bio, input),
      skills: this.readSkills(payload.skills, input),
    };

    this.ensureProfileHasSkills(profile);

    return profile;
  }

  private readProfileName(value: unknown): string {
    return this.limitText(
      readString(value, 'Detective sin nombre'),
      MAX_DETECTIVE_NAME_LENGTH,
    );
  }

  private readRank(
    _value: unknown,
    input: GenerateDetectiveProfileInput,
  ): GeneratedDetectiveRank {
    return this.rankFor(input.generalSkillLevel);
  }

  private readProfileBio(
    value: unknown,
    input: GenerateDetectiveProfileInput,
  ): string {
    return this.limitText(
      readString(value, this.createFallbackBio(input)),
      MAX_DETECTIVE_BIO_LENGTH,
    );
  }

  private readSkills(
    value: unknown,
    input: GenerateDetectiveProfileInput,
  ): GeneratedDetectiveSkill[] {
    const skills = readArray(value)
      .map((skill) => this.readSkill(skill))
      .filter((skill): skill is GeneratedDetectiveSkill => Boolean(skill))
      .slice(0, MAX_GENERATED_SKILLS);

    return this.alignSkillLevelsWithGeneralSkillLevel(skills, input);
  }

  private readSkill(value: unknown): GeneratedDetectiveSkill | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const payload = value as Record<string, unknown>;
    const skill = normalizeDetectiveSkillType(readString(payload.skill, ''));
    const level = readNumber(payload.level, Number.NaN);

    if (skill === undefined || Number.isNaN(level)) {
      return undefined;
    }

    return {
      skill: this.limitText(skill, MAX_DETECTIVE_SKILL_LENGTH),
      level: this.clampSkillLevel(level),
    };
  }

  private ensureProfileHasSkills(profile: GeneratedDetectiveProfile): void {
    if (profile.skills.length > 0) {
      return;
    }

    throw AiProviderRequestError.retryable('invalid_profile');
  }

  private rankFor(generalSkillLevel: number): GeneratedDetectiveRank {
    if (generalSkillLevel <= 2) {
      return 'rookie';
    }

    if (generalSkillLevel <= 4) {
      return 'detective';
    }

    if (generalSkillLevel <= 6) {
      return 'senior';
    }

    return generalSkillLevel <= 8 ? 'specialist' : 'lead';
  }

  private createFallbackBio(input: GenerateDetectiveProfileInput): string {
    return `Detective generado con nivel operativo ${input.generalSkillLevel}.`;
  }

  private clampSkillLevel(level: number): number {
    return Math.min(
      MAX_DETECTIVE_SKILL_LEVEL,
      Math.max(MIN_DETECTIVE_SKILL_LEVEL, Math.round(level)),
    );
  }

  private alignSkillLevelsWithGeneralSkillLevel(
    skills: readonly GeneratedDetectiveSkill[],
    input: GenerateDetectiveProfileInput,
  ): GeneratedDetectiveSkill[] {
    const strongestSkillIndexes = this.findStrongestSkillIndexes(
      skills,
      this.readExceptionalSkillPolicy(input.generalSkillLevel).maximumCount,
    );

    return skills.map((skill, index) =>
      this.alignSkillLevelWithGeneralSkillLevel({
        isExceptionalSkill: strongestSkillIndexes.has(index),
        skill,
        generalSkillLevel: input.generalSkillLevel,
      }),
    );
  }

  private alignSkillLevelWithGeneralSkillLevel(command: {
    readonly generalSkillLevel: number;
    readonly isExceptionalSkill: boolean;
    readonly skill: GeneratedDetectiveSkill;
  }): GeneratedDetectiveSkill {
    const policy = this.readExceptionalSkillPolicy(command.generalSkillLevel);
    const maximumLevel = this.readMaximumSkillLevel(command.generalSkillLevel);
    const allowedLevel = command.isExceptionalSkill
      ? maximumLevel
      : policy.threshold;

    return {
      ...command.skill,
      level: Math.min(command.skill.level, allowedLevel),
    };
  }

  private findStrongestSkillIndexes(
    skills: readonly GeneratedDetectiveSkill[],
    maximumCount: number,
  ): Set<number> {
    return new Set(
      skills
        .map((skill, index) => ({ index, level: skill.level }))
        .sort((left, right) => right.level - left.level)
        .slice(0, maximumCount)
        .map((skill) => skill.index),
    );
  }

  private readExceptionalSkillPolicy(generalSkillLevel: number): {
    readonly maximumCount: number;
    readonly threshold: number;
  } {
    return EXCEPTIONAL_SKILL_POLICY_BY_GENERAL_LEVEL[
      this.clampGeneralSkillLevel(generalSkillLevel)
    ];
  }

  private readMaximumSkillLevel(generalSkillLevel: number): number {
    return MAX_SKILL_LEVEL_BY_GENERAL_LEVEL[
      this.clampGeneralSkillLevel(generalSkillLevel)
    ];
  }

  private clampGeneralSkillLevel(generalSkillLevel: number) {
    return Math.min(10, Math.max(1, Math.round(generalSkillLevel))) as
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
      | 7
      | 8
      | 9
      | 10;
  }

  private limitText(value: string, maximumLength: number): string {
    return value.length > maximumLength ? value.slice(0, maximumLength) : value;
  }
}
