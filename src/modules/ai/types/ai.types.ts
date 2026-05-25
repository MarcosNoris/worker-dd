import {
  Case,
  CaseCategory,
  CaseSeverity,
  Detective,
  Suspect,
} from '../../cases/types/case.types';
import type {
  AdminActionType,
  AdminCaseDifficulty,
  AdminEvidenceImportance,
  AdminEvidenceType,
  AdminProofRole,
  AdminRequirementType,
  AdminSkillType,
} from '../../cases/constants/admin-case.constants';
import {
  InvestigationActionType,
  InvestigationStepResult,
  VerdictResult,
} from '../../investigations/types/investigation.types';

export interface GenerateCaseInput {
  theme: string;
  category: CaseCategory;
  severity: CaseSeverity;
}

export interface GenerateCaseResult {
  caseData: Case;
  usedFallback: boolean;
}

export interface GenerateAdminCaseBaseInput {
  readonly difficulty: AdminCaseDifficulty;
  readonly forbiddenTitles: readonly string[];
  readonly theme?: string;
}

export interface GeneratedAdminCaseBase {
  readonly difficulty: AdminCaseDifficulty;
  readonly publicBriefing?: string;
  readonly summary: string;
  readonly title: string;
  readonly victimName?: string;
}

export interface GenerateAdminCaseBaseResult extends GeneratedAdminCaseBase {
  readonly usedFallback: boolean;
}

export interface CaseEvidenceGenerationCaseContext {
  readonly difficulty: string;
  readonly id: string;
  readonly publicBriefing?: string;
  readonly summary: string;
  readonly title: string;
  readonly victimName?: string;
}

export interface GenerateCaseSuspectsInput {
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly difficulty: AdminCaseDifficulty;
  readonly suspectCount: number;
}

export interface GeneratedCaseSuspect {
  readonly age?: number;
  readonly background?: string;
  readonly name: string;
  readonly occupation?: string;
  readonly personality?: string;
  readonly publicNotes?: string;
  readonly relationshipToVictim?: string;
}

export interface GeneratedCaseSuspectsContent {
  readonly suspects: readonly GeneratedCaseSuspect[];
}

export interface GenerateCaseSuspectsResult extends GeneratedCaseSuspectsContent {
  readonly usedFallback: boolean;
}

export interface CaseEvidenceGenerationSuspectContext {
  readonly age?: number;
  readonly background?: string;
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly occupation?: string;
  readonly personality?: string;
  readonly publicNotes?: string;
  readonly relationshipToVictim?: string;
}

export interface GenerateCaseEvidencesInput {
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly culpritSuspectId?: string;
  readonly evidenceCount: number;
  readonly generateSolution: boolean;
  readonly suspects: readonly CaseEvidenceGenerationSuspectContext[];
}

export interface GeneratedCaseEvidence {
  readonly description: string;
  readonly discoveryHint?: string;
  readonly importance: AdminEvidenceImportance;
  readonly isDecoy: boolean;
  readonly isInitiallyVisible: boolean;
  readonly location?: string;
  readonly metadata: Record<string, unknown>;
  readonly title: string;
  readonly type: AdminEvidenceType;
  readonly weight: number;
}

export interface GeneratedCaseSolution {
  readonly culpritSuspectId: string;
  readonly fullExplanation: string;
  readonly methodSummary: string;
  readonly motiveSummary: string;
  readonly opportunitySummary: string;
}

export interface GeneratedCaseEvidencesContent {
  readonly evidences: readonly GeneratedCaseEvidence[];
  readonly selectedCulpritSuspectId: string;
  readonly solution?: GeneratedCaseSolution;
}

export interface GenerateCaseEvidencesResult extends GeneratedCaseEvidencesContent {
  readonly usedFallback: boolean;
}

export interface CaseStatementGenerationEvidenceContext {
  readonly description: string;
  readonly discoveryHint?: string;
  readonly id: string;
  readonly importance: string;
  readonly isDecoy: boolean;
  readonly isInitiallyVisible: boolean;
  readonly location?: string;
  readonly metadata: Record<string, unknown>;
  readonly title: string;
  readonly type: string;
  readonly weight: number;
}

export interface GenerateCaseStatementsInput {
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly culpritSuspectId: string;
  readonly evidences: readonly CaseStatementGenerationEvidenceContext[];
  readonly suspects: readonly CaseEvidenceGenerationSuspectContext[];
}

export interface GeneratedCaseStatement {
  readonly content: string;
  readonly context?: string;
  readonly isInitiallyVisible: boolean;
  readonly speakerName: string;
  readonly suspectId: string;
}

export interface GeneratedCaseStatementsContent {
  readonly culpritSuspectId: string;
  readonly statements: readonly GeneratedCaseStatement[];
}

export interface GenerateCaseStatementsResult extends GeneratedCaseStatementsContent {
  readonly usedFallback: boolean;
}

export interface CaseContradictionGenerationStatementContext {
  readonly content: string;
  readonly context?: string;
  readonly id: string;
  readonly isInitiallyVisible: boolean;
  readonly speakerName: string;
  readonly suspectId?: string;
}

export interface GenerateCaseContradictionsInput {
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly evidences: readonly CaseStatementGenerationEvidenceContext[];
  readonly statements: readonly CaseContradictionGenerationStatementContext[];
  readonly suspects: readonly CaseEvidenceGenerationSuspectContext[];
}

export interface GeneratedCaseContradiction {
  readonly explanation: string;
  readonly isInitiallyVisible: boolean;
  readonly proves: AdminProofRole;
  readonly refutingEvidenceId: string;
  readonly statementId: string;
  readonly suspectId?: string;
  readonly title: string;
}

export interface GeneratedCaseContradictionsContent {
  readonly contradictions: readonly GeneratedCaseContradiction[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
}

export interface GenerateCaseContradictionsResult extends GeneratedCaseContradictionsContent {
  readonly usedFallback: boolean;
}

export interface CaseSolutionGenerationContradictionContext {
  readonly explanation: string;
  readonly id: string;
  readonly isInitiallyVisible: boolean;
  readonly proves: string;
  readonly refutingEvidenceId: string;
  readonly statementId: string;
  readonly suspectId?: string;
  readonly title: string;
}

export interface GenerateCaseSolutionInput {
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly contradictions: readonly CaseSolutionGenerationContradictionContext[];
  readonly culpritSuspectId: string;
  readonly evidences: readonly CaseStatementGenerationEvidenceContext[];
  readonly statements: readonly CaseContradictionGenerationStatementContext[];
  readonly suspects: readonly CaseEvidenceGenerationSuspectContext[];
}

export interface GenerateCaseSolutionResult extends GeneratedCaseSolution {
  readonly usedFallback: boolean;
}

export interface CaseSolveRequirementGenerationSolutionContext extends GeneratedCaseSolution {
  readonly caseId: string;
  readonly createdAt: string;
  readonly id: string;
}

export interface CaseSolveRequirementGenerationActionContext {
  readonly actionType: string;
  readonly baseDurationMinutes: number;
  readonly description: string;
  readonly id: string;
  readonly isInitiallyAvailable: boolean;
  readonly metadata: Record<string, unknown>;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly requiresDetective: boolean;
  readonly title: string;
}

export interface CaseSolveRequirementGenerationEvidenceUnlockRuleContext {
  readonly actionId: string;
  readonly durationModifierMinutes: number;
  readonly evidenceId: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly successChance: number;
}

export interface CaseSolveRequirementGenerationContradictionUnlockRuleContext {
  readonly actionId: string;
  readonly contradictionId: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly successChance: number;
}

export interface GenerateCaseSolveRequirementsInput {
  readonly actions: readonly CaseSolveRequirementGenerationActionContext[];
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly contradictionUnlockRules: readonly CaseSolveRequirementGenerationContradictionUnlockRuleContext[];
  readonly contradictions: readonly CaseSolutionGenerationContradictionContext[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly evidenceUnlockRules: readonly CaseSolveRequirementGenerationEvidenceUnlockRuleContext[];
  readonly evidences: readonly CaseStatementGenerationEvidenceContext[];
  readonly solution: CaseSolveRequirementGenerationSolutionContext;
  readonly statements: readonly CaseContradictionGenerationStatementContext[];
  readonly suspects: readonly CaseEvidenceGenerationSuspectContext[];
}

export interface GeneratedCaseSolveRequirement {
  readonly description: string;
  readonly isMandatory: boolean;
  readonly proofRole?: AdminProofRole;
  readonly requiredContradictionId?: string;
  readonly requiredEvidenceId?: string;
  readonly requiredSuspectId?: string;
  readonly requirementType: AdminRequirementType;
  readonly weight: number;
}

export interface GeneratedCaseSolveRequirementsContent {
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly requirements: readonly GeneratedCaseSolveRequirement[];
}

export interface GenerateCaseSolveRequirementsResult extends GeneratedCaseSolveRequirementsContent {
  readonly usedFallback: boolean;
}

export interface CaseInvestigationGraphGenerationRequirementContext {
  readonly description: string;
  readonly id: string;
  readonly isMandatory: boolean;
  readonly proofRole?: string;
  readonly requiredContradictionId?: string;
  readonly requiredEvidenceId?: string;
  readonly requiredSuspectId?: string;
  readonly requirementType: string;
  readonly weight: number;
}

export interface GenerateCaseInvestigationGraphInput {
  readonly caseData: CaseEvidenceGenerationCaseContext;
  readonly contradictions: readonly CaseSolutionGenerationContradictionContext[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly evidences: readonly CaseStatementGenerationEvidenceContext[];
  readonly requirements: readonly CaseInvestigationGraphGenerationRequirementContext[];
  readonly solution: CaseSolveRequirementGenerationSolutionContext;
  readonly statements: readonly CaseContradictionGenerationStatementContext[];
  readonly suspects: readonly CaseEvidenceGenerationSuspectContext[];
}

export interface GeneratedCaseInvestigationAction {
  readonly actionType: AdminActionType;
  readonly baseDurationMinutes: number;
  readonly description: string;
  readonly isInitiallyAvailable: boolean;
  readonly metadata: Record<string, unknown>;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: AdminSkillType;
  readonly requiresDetective: boolean;
  readonly tempId: string;
  readonly title: string;
}

export interface GeneratedEvidenceUnlockRule {
  readonly actionTempId: string;
  readonly durationModifierMinutes: number;
  readonly evidenceId: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: AdminSkillType;
  readonly successChance: number;
}

export interface GeneratedStatementUnlockRule {
  readonly actionTempId: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: AdminSkillType;
  readonly statementId: string;
  readonly successChance: number;
}

export interface GeneratedContradictionUnlockRule {
  readonly actionTempId: string;
  readonly contradictionId: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: AdminSkillType;
  readonly successChance: number;
}

export interface GeneratedActionPrerequisite {
  readonly actionTempId: string;
  readonly prerequisiteActionTempId?: string;
  readonly prerequisiteContradictionId?: string;
  readonly prerequisiteEvidenceId?: string;
}

export interface GeneratedCaseInvestigationGraphContent {
  readonly actionPrerequisites: readonly GeneratedActionPrerequisite[];
  readonly actions: readonly GeneratedCaseInvestigationAction[];
  readonly contradictionUnlockRules: readonly GeneratedContradictionUnlockRule[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly evidenceUnlockRules: readonly GeneratedEvidenceUnlockRule[];
  readonly statementUnlockRules: readonly GeneratedStatementUnlockRule[];
}

export interface GenerateCaseInvestigationGraphResult extends GeneratedCaseInvestigationGraphContent {
  readonly usedFallback: boolean;
}

export interface InvestigationStepInput {
  caseData: Case;
  detectiveData: Detective;
  actionType: InvestigationActionType;
  targetId?: string;
}

export interface InvestigationStepGenerationResult {
  step: InvestigationStepResult;
  usedFallback: boolean;
}

export interface VerdictInput {
  caseData: Case;
  detectiveData: Detective;
  culpritId: string;
  reasoning: string;
  accusedSuspect: Suspect;
}

export interface VerdictGenerationResult {
  result: VerdictResult;
  usedFallback: boolean;
}

export interface AiContentGenerationResult<TContent> {
  content: TContent;
  usedFallback: boolean;
}

export type GeneratedDetectiveRank =
  | 'rookie'
  | 'detective'
  | 'senior'
  | 'specialist'
  | 'lead';

export const GENERATED_DETECTIVE_GENDERS = ['female', 'male'] as const;

export type GeneratedDetectiveGender =
  (typeof GENERATED_DETECTIVE_GENDERS)[number];

export interface GenerateDetectiveProfileInput {
  gender: GeneratedDetectiveGender;
  generalSkillLevel: number;
}

export interface GeneratedDetectiveSkill {
  readonly level: number;
  readonly skill: string;
}

export interface GeneratedDetectiveProfile {
  readonly bio: string;
  readonly name: string;
  readonly rank: GeneratedDetectiveRank;
  readonly skills: readonly GeneratedDetectiveSkill[];
}
