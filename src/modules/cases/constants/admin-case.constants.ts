import { DETECTIVE_SKILL_TYPES } from '../../../shared/constants/detective-skill.constants';

export const ADMIN_CASE_DIFFICULTIES = [
  'easy',
  'medium',
  'hard',
  'expert',
] as const;

export const ADMIN_EVIDENCE_TYPES = [
  'physical',
  'digital',
  'testimonial',
  'document',
  'forensic',
  'financial',
  'location',
  'biological',
] as const;

export const ADMIN_EVIDENCE_IMPORTANCES = [
  'critical',
  'supporting',
  'misleading',
  'contextual',
] as const;

export const ADMIN_PROOF_ROLES = [
  'motive',
  'method',
  'opportunity',
  'identity',
  'false_alibi',
  'contradiction',
  'support',
] as const;

export const ADMIN_REQUIREMENT_TYPES = [
  'culprit',
  'motive',
  'method',
  'opportunity',
  'identity',
  'false_alibi',
  'contradiction',
  'custom',
] as const;

export const ADMIN_ACTION_TYPES = [
  'interview',
  'inspect_scene',
  'analyze_forensic_sample',
  'review_security_camera',
  'check_financial_records',
  'perform_surveillance',
  'search_digital_devices',
  'request_autopsy',
  'compare_fingerprints',
  'background_check',
  'canvass_area',
  'custom',
] as const;

export const ADMIN_SKILL_TYPES = DETECTIVE_SKILL_TYPES;

export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];
export type AdminCaseDifficulty = (typeof ADMIN_CASE_DIFFICULTIES)[number];
export type AdminEvidenceImportance =
  (typeof ADMIN_EVIDENCE_IMPORTANCES)[number];
export type AdminEvidenceType = (typeof ADMIN_EVIDENCE_TYPES)[number];
export type AdminProofRole = (typeof ADMIN_PROOF_ROLES)[number];
export type AdminRequirementType = (typeof ADMIN_REQUIREMENT_TYPES)[number];
export type AdminSkillType = (typeof ADMIN_SKILL_TYPES)[number];

const LEGACY_ADMIN_ACTION_TYPE_ALIASES: Readonly<
  Record<string, AdminActionType>
> = {
  area_canvass: 'canvass_area',
  autopsy: 'request_autopsy',
  camera_review: 'review_security_camera',
  digital_search: 'search_digital_devices',
  financial_review: 'check_financial_records',
  fingerprint: 'compare_fingerprints',
  forensic_analysis: 'analyze_forensic_sample',
  inspection: 'inspect_scene',
  surveillance: 'perform_surveillance',
};

const ADMIN_ACTION_TYPE_ALIASES: Readonly<Record<string, AdminActionType>> = {
  ...Object.fromEntries(
    ADMIN_ACTION_TYPES.map((actionType) => [actionType, actionType]),
  ),
  ...LEGACY_ADMIN_ACTION_TYPE_ALIASES,
};

export function normalizeAdminActionType(
  value: string,
): AdminActionType | undefined {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return ADMIN_ACTION_TYPE_ALIASES[normalizedValue];
}
