import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseClientFactory } from '../supabase/supabase-client.factory';
import {
  ADMIN_CASE_DIFFICULTIES,
  AdminActionType,
  AdminCaseDifficulty,
  AdminEvidenceImportance,
  AdminEvidenceType,
  AdminProofRole,
  AdminRequirementType,
  AdminSkillType,
} from './constants/admin-case.constants';
import {
  CaseAiGenerationAttempts,
  CaseAiGenerationStatus,
  CaseAiGenerationStep,
} from './types/case-ai-generation.types';

const CASE_SELECT = `
  id,
  department_id,
  title,
  summary,
  public_briefing,
  victim_name,
  difficulty,
  status,
  generated_by_ai,
  generation_prompt,
  ai_model,
  ai_generation_metadata,
  created_by,
  created_at,
  updated_at
`;
const SUSPECT_SELECT = `
  id,
  case_id,
  name,
  age,
  occupation,
  relationship_to_victim,
  background,
  personality,
  public_notes,
  created_at
`;
const EVIDENCE_SELECT = `
  id,
  case_id,
  title,
  description,
  type,
  importance,
  location,
  discovery_hint,
  weight,
  is_decoy,
  is_initially_visible,
  metadata,
  created_at
`;
const STATEMENT_SELECT = `
  id,
  case_id,
  suspect_id,
  speaker_name,
  content,
  context,
  is_initially_visible,
  created_at
`;
const CONTRADICTION_SELECT = `
  id,
  case_id,
  suspect_id,
  statement_id,
  refuting_evidence_id,
  title,
  explanation,
  proves,
  is_initially_visible,
  created_at
`;
const SOLUTION_SELECT = `
  id,
  case_id,
  culprit_suspect_id,
  motive_summary,
  method_summary,
  opportunity_summary,
  full_explanation,
  created_at
`;
const REQUIREMENT_SELECT = `
  id,
  case_id,
  requirement_type,
  proof_role,
  required_suspect_id,
  required_evidence_id,
  required_contradiction_id,
  description,
  weight,
  is_mandatory,
  created_at
`;
const ACTION_SELECT = `
  id,
  case_id,
  title,
  description,
  action_type,
  required_skill,
  minimum_skill_level,
  base_duration_minutes,
  is_initially_available,
  requires_detective,
  metadata,
  created_at
`;
const EVIDENCE_UNLOCK_RULE_SELECT = `
  id,
  action_id,
  evidence_id,
  required_skill,
  minimum_skill_level,
  duration_modifier_minutes,
  is_guaranteed,
  success_chance,
  created_at
`;
const STATEMENT_UNLOCK_RULE_SELECT = `
  id,
  action_id,
  statement_id,
  required_skill,
  minimum_skill_level,
  is_guaranteed,
  success_chance,
  created_at
`;
const CONTRADICTION_UNLOCK_RULE_SELECT = `
  id,
  action_id,
  contradiction_id,
  required_skill,
  minimum_skill_level,
  is_guaranteed,
  success_chance,
  created_at
`;
const ACTION_PREREQUISITE_SELECT = `
  id,
  action_id,
  prerequisite_action_id,
  prerequisite_evidence_id,
  prerequisite_contradiction_id,
  created_at
`;
const CASE_AI_GENERATION_RUN_SELECT = `
  id,
  case_id,
  status,
  current_step,
  theme,
  difficulty,
  culprit_suspect_id,
  attempts_by_step,
  generation_options,
  last_error,
  created_by,
  created_at,
  updated_at,
  finished_at
`;
const PLAYABLE_CASE_STATUS = 'playable';

const SENSITIVE_LOG_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'password',
  'token',
]);

interface SupabaseMutationFailureLog {
  readonly error: unknown;
  readonly operation: string;
  readonly payload: Record<string, unknown>;
  readonly tableName: string;
}

export interface AdminCaseRecord {
  readonly aiGenerationMetadata: Record<string, unknown>;
  readonly aiModel?: string;
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly departmentId: string | null;
  readonly difficulty: string;
  readonly generatedByAi: boolean;
  readonly generationPrompt?: string;
  readonly id: string;
  readonly publicBriefing?: string;
  readonly status: string;
  readonly summary: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly victimName?: string;
}

export interface AdminSuspectRecord {
  readonly age?: number;
  readonly background?: string;
  readonly caseId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly occupation?: string;
  readonly personality?: string;
  readonly publicNotes?: string;
  readonly relationshipToVictim?: string;
}

export interface AdminEvidenceRecord {
  readonly caseId: string;
  readonly createdAt: string;
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

export interface AdminStatementRecord {
  readonly caseId: string;
  readonly content: string;
  readonly context?: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isInitiallyVisible: boolean;
  readonly speakerName: string;
  readonly suspectId?: string;
}

export interface AdminContradictionRecord {
  readonly caseId: string;
  readonly createdAt: string;
  readonly explanation: string;
  readonly id: string;
  readonly isInitiallyVisible: boolean;
  readonly proves: string;
  readonly refutingEvidenceId: string;
  readonly statementId: string;
  readonly suspectId?: string;
  readonly title: string;
}

export interface AdminCaseSolutionRecord {
  readonly caseId: string;
  readonly createdAt: string;
  readonly culpritSuspectId: string;
  readonly fullExplanation: string;
  readonly id: string;
  readonly methodSummary: string;
  readonly motiveSummary: string;
  readonly opportunitySummary: string;
}

export interface AdminSolveRequirementRecord {
  readonly caseId: string;
  readonly createdAt: string;
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

export interface AdminInvestigationActionRecord {
  readonly actionType: string;
  readonly baseDurationMinutes: number;
  readonly caseId: string;
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly isInitiallyAvailable: boolean;
  readonly metadata: Record<string, unknown>;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly requiresDetective: boolean;
  readonly title: string;
}

export interface AdminEvidenceUnlockRuleRecord {
  readonly actionId: string;
  readonly createdAt: string;
  readonly durationModifierMinutes: number;
  readonly evidenceId: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly successChance: number;
}

export interface AdminStatementUnlockRuleRecord {
  readonly actionId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly statementId: string;
  readonly successChance: number;
}

export interface AdminContradictionUnlockRuleRecord {
  readonly actionId: string;
  readonly contradictionId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly successChance: number;
}

export interface AdminActionPrerequisiteRecord {
  readonly actionId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly prerequisiteActionId?: string;
  readonly prerequisiteContradictionId?: string;
  readonly prerequisiteEvidenceId?: string;
}

export interface CasePlayabilitySnapshot {
  readonly actionPrerequisites: readonly AdminActionPrerequisiteRecord[];
  readonly actions: readonly AdminInvestigationActionRecord[];
  readonly caseRecord: AdminCaseRecord;
  readonly contradictionUnlockRules: readonly AdminContradictionUnlockRuleRecord[];
  readonly contradictions: readonly AdminContradictionRecord[];
  readonly evidenceUnlockRules: readonly AdminEvidenceUnlockRuleRecord[];
  readonly evidences: readonly AdminEvidenceRecord[];
  readonly requirements: readonly AdminSolveRequirementRecord[];
  readonly solution?: AdminCaseSolutionRecord;
  readonly statementUnlockRules: readonly AdminStatementUnlockRuleRecord[];
  readonly statements: readonly AdminStatementRecord[];
  readonly suspects: readonly AdminSuspectRecord[];
}

export interface RandomPlayableCaseBaseQuery {
  readonly departmentId: string;
  readonly difficulty: AdminCaseDifficulty;
}

export interface AdminCasesListQuery {
  readonly limit: number;
  readonly page: number;
  readonly sort: 'asc' | 'desc';
  readonly status?: 'draft' | 'playable';
}

export interface AdminCasesListPage {
  readonly cases: readonly AdminCaseRecord[];
  readonly total: number;
}

interface PlayableCaseBaseLookup {
  readonly difficulty: AdminCaseDifficulty;
  readonly excludedCaseIds: readonly string[];
}

interface PlayableCaseBaseOffsetLookup extends PlayableCaseBaseLookup {
  readonly offset: number;
}

interface FilterableCasesQuery {
  not(column: string, operator: string, value: string): this;
}

export interface CreateManualCaseRecordCommand {
  readonly aiGenerationMetadata?: Record<string, unknown>;
  readonly aiModel?: string;
  readonly createdBy: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly generationPrompt?: string;
  readonly publicBriefing?: string;
  readonly summary: string;
  readonly title: string;
  readonly victimName?: string;
}

export interface CreateAiGeneratedCaseRecordCommand {
  readonly aiGenerationMetadata?: Record<string, unknown>;
  readonly aiModel?: string;
  readonly createdBy: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly generationPrompt?: string;
  readonly publicBriefing?: string;
  readonly summary: string;
  readonly title: string;
  readonly victimName?: string;
}

interface CreateCaseRecordCommand {
  readonly aiGenerationMetadata?: Record<string, unknown>;
  readonly aiModel?: string;
  readonly createdBy: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly generatedByAi: boolean;
  readonly generationPrompt?: string;
  readonly publicBriefing?: string;
  readonly summary: string;
  readonly title: string;
  readonly victimName?: string;
}

export interface CreateCaseSuspectRecordCommand {
  readonly age?: number;
  readonly background?: string;
  readonly caseId: string;
  readonly name: string;
  readonly occupation?: string;
  readonly personality?: string;
  readonly publicNotes?: string;
  readonly relationshipToVictim?: string;
}

export interface CreateCaseEvidenceRecordCommand {
  readonly caseId: string;
  readonly description: string;
  readonly discoveryHint?: string;
  readonly importance: AdminEvidenceImportance;
  readonly isDecoy?: boolean;
  readonly isInitiallyVisible?: boolean;
  readonly location?: string;
  readonly metadata?: Record<string, unknown>;
  readonly title: string;
  readonly type: AdminEvidenceType;
  readonly weight?: number;
}

export interface CreateCaseStatementRecordCommand {
  readonly caseId: string;
  readonly content: string;
  readonly context?: string;
  readonly isInitiallyVisible?: boolean;
  readonly speakerName: string;
  readonly suspectId?: string;
}

export interface CreateCaseContradictionRecordCommand {
  readonly caseId: string;
  readonly explanation: string;
  readonly isInitiallyVisible?: boolean;
  readonly proves: AdminProofRole;
  readonly refutingEvidenceId: string;
  readonly statementId: string;
  readonly suspectId?: string;
  readonly title: string;
}

export interface CreateCaseSolutionRecordCommand {
  readonly caseId: string;
  readonly culpritSuspectId: string;
  readonly fullExplanation: string;
  readonly methodSummary: string;
  readonly motiveSummary: string;
  readonly opportunitySummary: string;
}

export interface CreateSolveRequirementRecordCommand {
  readonly caseId: string;
  readonly description: string;
  readonly isMandatory?: boolean;
  readonly proofRole?: AdminProofRole;
  readonly requiredContradictionId?: string;
  readonly requiredEvidenceId?: string;
  readonly requiredSuspectId?: string;
  readonly requirementType: AdminRequirementType;
  readonly weight?: number;
}

export interface CreateInvestigationActionRecordCommand {
  readonly actionType: AdminActionType;
  readonly baseDurationMinutes: number;
  readonly caseId: string;
  readonly description: string;
  readonly isInitiallyAvailable?: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly requiresDetective?: boolean;
  readonly title: string;
}

export interface CreateEvidenceUnlockRuleRecordCommand {
  readonly actionId: string;
  readonly durationModifierMinutes?: number;
  readonly evidenceId: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly successChance?: number;
}

export interface CreateStatementUnlockRuleRecordCommand {
  readonly actionId: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly statementId: string;
  readonly successChance?: number;
}

export interface CreateContradictionUnlockRuleRecordCommand {
  readonly actionId: string;
  readonly contradictionId: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly successChance?: number;
}

export interface CreateActionPrerequisiteRecordCommand {
  readonly actionId: string;
  readonly prerequisiteActionId?: string;
  readonly prerequisiteContradictionId?: string;
  readonly prerequisiteEvidenceId?: string;
}

export interface CreateInvestigationGraphActionRecordCommand {
  readonly actionType: AdminActionType;
  readonly baseDurationMinutes: number;
  readonly description: string;
  readonly isInitiallyAvailable?: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly requiresDetective?: boolean;
  readonly tempId: string;
  readonly title: string;
}

export interface CreateInvestigationGraphEvidenceUnlockRuleRecordCommand {
  readonly actionTempId: string;
  readonly durationModifierMinutes?: number;
  readonly evidenceId: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly successChance?: number;
}

export interface CreateInvestigationGraphStatementUnlockRuleRecordCommand {
  readonly actionTempId: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly statementId: string;
  readonly successChance?: number;
}

export interface CreateInvestigationGraphContradictionUnlockRuleRecordCommand {
  readonly actionTempId: string;
  readonly contradictionId: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: AdminSkillType;
  readonly successChance?: number;
}

export interface CreateInvestigationGraphActionPrerequisiteRecordCommand {
  readonly actionTempId: string;
  readonly prerequisiteActionTempId?: string;
  readonly prerequisiteContradictionId?: string;
  readonly prerequisiteEvidenceId?: string;
}

export interface CreateInvestigationGraphRecordCommand {
  readonly actionPrerequisites: readonly CreateInvestigationGraphActionPrerequisiteRecordCommand[];
  readonly actions: readonly CreateInvestigationGraphActionRecordCommand[];
  readonly caseId: string;
  readonly contradictionUnlockRules: readonly CreateInvestigationGraphContradictionUnlockRuleRecordCommand[];
  readonly evidenceUnlockRules: readonly CreateInvestigationGraphEvidenceUnlockRuleRecordCommand[];
  readonly statementUnlockRules: readonly CreateInvestigationGraphStatementUnlockRuleRecordCommand[];
}

export interface CreatedInvestigationGraphRecord {
  readonly actionPrerequisites: readonly AdminActionPrerequisiteRecord[];
  readonly actions: readonly AdminInvestigationActionRecord[];
  readonly contradictionUnlockRules: readonly AdminContradictionUnlockRuleRecord[];
  readonly evidenceUnlockRules: readonly AdminEvidenceUnlockRuleRecord[];
  readonly statementUnlockRules: readonly AdminStatementUnlockRuleRecord[];
}

export interface CaseAiGenerationRunRecord {
  readonly attemptsByStep: CaseAiGenerationAttempts;
  readonly caseId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly culpritSuspectId?: string;
  readonly currentStep: CaseAiGenerationStep;
  readonly difficulty?: AdminCaseDifficulty;
  readonly finishedAt?: string;
  readonly generationOptions: Record<string, unknown>;
  readonly id: string;
  readonly lastError?: string;
  readonly status: CaseAiGenerationStatus;
  readonly theme?: string;
  readonly updatedAt: string;
}

export interface CreateCaseAiGenerationRunRecordCommand {
  readonly attemptsByStep?: CaseAiGenerationAttempts;
  readonly caseId?: string;
  readonly createdBy: string;
  readonly culpritSuspectId?: string;
  readonly currentStep: CaseAiGenerationStep;
  readonly difficulty?: AdminCaseDifficulty;
  readonly generationOptions?: Record<string, unknown>;
  readonly status: CaseAiGenerationStatus;
  readonly theme?: string;
}

export interface UpdateCaseAiGenerationRunRecordCommand {
  readonly attemptsByStep?: CaseAiGenerationAttempts;
  readonly caseId?: string;
  readonly culpritSuspectId?: string;
  readonly currentStep?: CaseAiGenerationStep;
  readonly difficulty?: AdminCaseDifficulty;
  readonly finishedAt?: string;
  readonly generationOptions?: Record<string, unknown>;
  readonly lastError?: string | null;
  readonly status?: CaseAiGenerationStatus;
}

export interface CaseAiGenerationJobLockCommand {
  readonly lockedBy: string;
  readonly lockName: string;
  readonly ttlSeconds: number;
}

export interface ReleaseCaseAiGenerationJobLockCommand {
  readonly lockedBy: string;
  readonly lockName: string;
}

interface CaseRecord {
  readonly ai_generation_metadata?: unknown;
  readonly ai_model?: unknown;
  readonly created_at?: unknown;
  readonly created_by?: unknown;
  readonly department_id?: unknown;
  readonly difficulty?: unknown;
  readonly generated_by_ai?: unknown;
  readonly generation_prompt?: unknown;
  readonly id?: unknown;
  readonly public_briefing?: unknown;
  readonly status?: unknown;
  readonly summary?: unknown;
  readonly title?: unknown;
  readonly updated_at?: unknown;
  readonly victim_name?: unknown;
}

interface CaseTitleRecord {
  readonly title?: unknown;
}

interface InvestigationCaseRecord {
  readonly case_id?: unknown;
}

interface SuspectRecord {
  readonly age?: unknown;
  readonly background?: unknown;
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly id?: unknown;
  readonly name?: unknown;
  readonly occupation?: unknown;
  readonly personality?: unknown;
  readonly public_notes?: unknown;
  readonly relationship_to_victim?: unknown;
}

interface EvidenceRecord {
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly description?: unknown;
  readonly discovery_hint?: unknown;
  readonly id?: unknown;
  readonly importance?: unknown;
  readonly is_decoy?: unknown;
  readonly is_initially_visible?: unknown;
  readonly location?: unknown;
  readonly metadata?: unknown;
  readonly title?: unknown;
  readonly type?: unknown;
  readonly weight?: unknown;
}

interface StatementRecord {
  readonly case_id?: unknown;
  readonly content?: unknown;
  readonly context?: unknown;
  readonly created_at?: unknown;
  readonly id?: unknown;
  readonly is_initially_visible?: unknown;
  readonly speaker_name?: unknown;
  readonly suspect_id?: unknown;
}

interface ContradictionRecord {
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly explanation?: unknown;
  readonly id?: unknown;
  readonly is_initially_visible?: unknown;
  readonly proves?: unknown;
  readonly refuting_evidence_id?: unknown;
  readonly statement_id?: unknown;
  readonly suspect_id?: unknown;
  readonly title?: unknown;
}

interface SolutionRecord {
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly culprit_suspect_id?: unknown;
  readonly full_explanation?: unknown;
  readonly id?: unknown;
  readonly method_summary?: unknown;
  readonly motive_summary?: unknown;
  readonly opportunity_summary?: unknown;
}

interface RequirementRecord {
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly description?: unknown;
  readonly id?: unknown;
  readonly is_mandatory?: unknown;
  readonly proof_role?: unknown;
  readonly required_contradiction_id?: unknown;
  readonly required_evidence_id?: unknown;
  readonly required_suspect_id?: unknown;
  readonly requirement_type?: unknown;
  readonly weight?: unknown;
}

interface ActionRecord {
  readonly action_type?: unknown;
  readonly base_duration_minutes?: unknown;
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly description?: unknown;
  readonly id?: unknown;
  readonly is_initially_available?: unknown;
  readonly metadata?: unknown;
  readonly minimum_skill_level?: unknown;
  readonly required_skill?: unknown;
  readonly requires_detective?: unknown;
  readonly title?: unknown;
}

interface EvidenceUnlockRuleRecord {
  readonly action_id?: unknown;
  readonly created_at?: unknown;
  readonly duration_modifier_minutes?: unknown;
  readonly evidence_id?: unknown;
  readonly id?: unknown;
  readonly is_guaranteed?: unknown;
  readonly minimum_skill_level?: unknown;
  readonly required_skill?: unknown;
  readonly success_chance?: unknown;
}

interface StatementUnlockRuleRecord {
  readonly action_id?: unknown;
  readonly created_at?: unknown;
  readonly id?: unknown;
  readonly is_guaranteed?: unknown;
  readonly minimum_skill_level?: unknown;
  readonly required_skill?: unknown;
  readonly statement_id?: unknown;
  readonly success_chance?: unknown;
}

interface ContradictionUnlockRuleRecord {
  readonly action_id?: unknown;
  readonly contradiction_id?: unknown;
  readonly created_at?: unknown;
  readonly id?: unknown;
  readonly is_guaranteed?: unknown;
  readonly minimum_skill_level?: unknown;
  readonly required_skill?: unknown;
  readonly success_chance?: unknown;
}

interface ActionPrerequisiteRecord {
  readonly action_id?: unknown;
  readonly created_at?: unknown;
  readonly id?: unknown;
  readonly prerequisite_action_id?: unknown;
  readonly prerequisite_contradiction_id?: unknown;
  readonly prerequisite_evidence_id?: unknown;
}

interface CaseAiGenerationRunRow {
  readonly attempts_by_step?: unknown;
  readonly case_id?: unknown;
  readonly created_at?: unknown;
  readonly created_by?: unknown;
  readonly culprit_suspect_id?: unknown;
  readonly current_step?: unknown;
  readonly difficulty?: unknown;
  readonly finished_at?: unknown;
  readonly generation_options?: unknown;
  readonly id?: unknown;
  readonly last_error?: unknown;
  readonly status?: unknown;
  readonly theme?: unknown;
  readonly updated_at?: unknown;
}

@Injectable()
export class CasesRepository {
  private readonly logger = new Logger(CasesRepository.name);

  constructor(private readonly supabaseClientFactory: SupabaseClientFactory) {}

  async createManualCase(
    command: CreateManualCaseRecordCommand,
  ): Promise<AdminCaseRecord> {
    return this.createCase({
      ...command,
      generatedByAi: false,
    });
  }

  async createAiGeneratedCase(
    command: CreateAiGeneratedCaseRecordCommand,
  ): Promise<AdminCaseRecord> {
    return this.createCase({
      ...command,
      generatedByAi: true,
    });
  }

  private async createCase(
    command: CreateCaseRecordCommand,
  ): Promise<AdminCaseRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('cases')
      .insert(this.createCaseInsert(command))
      .select(CASE_SELECT)
      .maybeSingle<CaseRecord>();

    if (error || !data) {
      throw new ServiceUnavailableException('No se pudo crear el caso.');
    }

    return this.toCase(data);
  }

  async createCaseAiGenerationRun(
    command: CreateCaseAiGenerationRunRecordCommand,
  ): Promise<CaseAiGenerationRunRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('case_ai_generation_runs')
      .insert(this.withoutUndefined(this.toCaseAiGenerationRunInsert(command)))
      .select(CASE_AI_GENERATION_RUN_SELECT)
      .maybeSingle<CaseAiGenerationRunRow>();

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudo crear la ejecucion de generacion IA.',
      );
    }

    return this.toCaseAiGenerationRun(data);
  }

  async updateCaseAiGenerationRun(
    runId: string,
    command: UpdateCaseAiGenerationRunRecordCommand,
  ): Promise<CaseAiGenerationRunRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('case_ai_generation_runs')
      .update(this.withoutUndefined(this.toCaseAiGenerationRunUpdate(command)))
      .eq('id', runId)
      .select(CASE_AI_GENERATION_RUN_SELECT)
      .maybeSingle<CaseAiGenerationRunRow>();

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudo actualizar la ejecucion de generacion IA.',
      );
    }

    return this.toCaseAiGenerationRun(data);
  }

  async findLatestCaseAiGenerationRunByCase(
    caseId: string,
  ): Promise<CaseAiGenerationRunRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('case_ai_generation_runs')
      .select(CASE_AI_GENERATION_RUN_SELECT)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar la ejecucion de generacion IA.',
      );
    }

    return this.toCaseAiGenerationRuns(
      (data ?? []) as CaseAiGenerationRunRow[],
    )[0];
  }

  async tryAcquireCaseAiGenerationJobLock(
    command: CaseAiGenerationJobLockCommand,
  ): Promise<boolean> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .rpc('try_acquire_case_ai_generation_job_lock', {
        p_lock_name: command.lockName,
        p_locked_by: command.lockedBy,
        p_ttl_seconds: command.ttlSeconds,
      });

    if (error) {
      throw new ServiceUnavailableException(
        this.createSupabaseFailureMessage(
          error,
          'No se pudo adquirir el lock de generacion IA.',
        ),
      );
    }

    if (typeof data !== 'boolean') {
      throw new ServiceUnavailableException(
        'Supabase no devolvio un resultado valido al adquirir el lock de generacion IA.',
      );
    }

    return data;
  }

  async releaseCaseAiGenerationJobLock(
    command: ReleaseCaseAiGenerationJobLockCommand,
  ): Promise<void> {
    const { error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .rpc('release_case_ai_generation_job_lock', {
        p_lock_name: command.lockName,
        p_locked_by: command.lockedBy,
      });

    if (error) {
      throw new ServiceUnavailableException(
        this.createSupabaseFailureMessage(
          error,
          'No se pudo liberar el lock de generacion IA.',
        ),
      );
    }
  }

  async findRecoverableCaseAiGenerationRuns(
    limit: number,
  ): Promise<CaseAiGenerationRunRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .rpc('get_recoverable_case_ai_generation_runs', {
        p_limit: limit,
      });

    if (error) {
      throw new ServiceUnavailableException(
        this.createSupabaseFailureMessage(
          error,
          'No se pudieron consultar ejecuciones IA recuperables.',
        ),
      );
    }

    return this.toCaseAiGenerationRuns(
      (data ?? []) as CaseAiGenerationRunRow[],
    );
  }

  async markStaleRunningCaseAiGenerationRunsAsFailed(
    staleBefore: string,
  ): Promise<number> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('case_ai_generation_runs')
      .update({
        finished_at: new Date().toISOString(),
        last_error:
          'La ejecucion IA quedo en running mas tiempo que el limite configurado.',
        status: 'failed',
      })
      .eq('status', 'running')
      .lt('updated_at', staleBefore)
      .select('id');

    if (error) {
      throw new ServiceUnavailableException(
        this.createSupabaseFailureMessage(
          error,
          'No se pudieron marcar ejecuciones IA obsoletas.',
        ),
      );
    }

    return Array.isArray(data) ? data.length : 0;
  }

  async createSuspect(
    command: CreateCaseSuspectRecordCommand,
  ): Promise<AdminSuspectRecord> {
    const suspects = await this.createSuspects([command]);
    const suspect = suspects[0];

    if (!suspect) {
      throw new ServiceUnavailableException('No se pudo crear el sospechoso.');
    }

    return suspect;
  }

  async createSuspects(
    commands: readonly CreateCaseSuspectRecordCommand[],
  ): Promise<AdminSuspectRecord[]> {
    if (commands.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('suspects')
      .insert(
        commands.map((command) =>
          this.withoutUndefined(this.toSuspectInsert(command)),
        ),
      )
      .select(SUSPECT_SELECT);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron crear los sospechosos.',
      );
    }

    return this.toSuspects(data as SuspectRecord[]);
  }

  async createEvidence(
    command: CreateCaseEvidenceRecordCommand,
  ): Promise<AdminEvidenceRecord> {
    const evidences = await this.createEvidences([command]);
    const evidence = evidences[0];

    if (!evidence) {
      throw new ServiceUnavailableException('No se pudo crear la evidencia.');
    }

    return evidence;
  }

  async createEvidences(
    commands: readonly CreateCaseEvidenceRecordCommand[],
  ): Promise<AdminEvidenceRecord[]> {
    if (commands.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('evidences')
      .insert(
        commands.map((command) =>
          this.withoutUndefined(this.toEvidenceInsert(command)),
        ),
      )
      .select(EVIDENCE_SELECT);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron crear las evidencias.',
      );
    }

    return this.toEvidences(data as EvidenceRecord[]);
  }

  async createStatement(
    command: CreateCaseStatementRecordCommand,
  ): Promise<AdminStatementRecord> {
    const statements = await this.createStatements([command]);
    const statement = statements[0];

    if (!statement) {
      throw new ServiceUnavailableException('No se pudo crear la declaracion.');
    }

    return statement;
  }

  async createStatements(
    commands: readonly CreateCaseStatementRecordCommand[],
  ): Promise<AdminStatementRecord[]> {
    if (commands.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('statements')
      .insert(
        commands.map((command) =>
          this.withoutUndefined(this.toStatementInsert(command)),
        ),
      )
      .select(STATEMENT_SELECT);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron crear las declaraciones.',
      );
    }

    return this.toStatements(data as StatementRecord[]);
  }

  async createContradiction(
    command: CreateCaseContradictionRecordCommand,
  ): Promise<AdminContradictionRecord> {
    const contradictions = await this.createContradictions([command]);
    const contradiction = contradictions[0];

    if (!contradiction) {
      throw new ServiceUnavailableException(
        'No se pudo crear la contradiccion.',
      );
    }

    return contradiction;
  }

  async createContradictions(
    commands: readonly CreateCaseContradictionRecordCommand[],
  ): Promise<AdminContradictionRecord[]> {
    if (commands.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('contradictions')
      .insert(
        commands.map((command) =>
          this.withoutUndefined(this.toContradictionInsert(command)),
        ),
      )
      .select(CONTRADICTION_SELECT);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron crear las contradicciones.',
      );
    }

    return this.toContradictions(data as ContradictionRecord[]);
  }

  async createSolution(
    command: CreateCaseSolutionRecordCommand,
  ): Promise<AdminCaseSolutionRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('case_solutions')
      .insert(this.toSolutionInsert(command))
      .select(SOLUTION_SELECT)
      .maybeSingle<SolutionRecord>();

    if (error || !data) {
      throw new ServiceUnavailableException('No se pudo crear la solucion.');
    }

    return this.toSolution(data);
  }

  async createSolveRequirement(
    command: CreateSolveRequirementRecordCommand,
  ): Promise<AdminSolveRequirementRecord> {
    const requirements = await this.createSolveRequirements([command]);
    const requirement = requirements[0];

    if (!requirement) {
      throw new ServiceUnavailableException(
        'No se pudo crear el requisito de resolucion.',
      );
    }

    return requirement;
  }

  async createSolveRequirements(
    commands: readonly CreateSolveRequirementRecordCommand[],
  ): Promise<AdminSolveRequirementRecord[]> {
    if (commands.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('solve_requirements')
      .insert(
        commands.map((command) =>
          this.withoutUndefined(this.toRequirementInsert(command)),
        ),
      )
      .select(REQUIREMENT_SELECT);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron crear los requisitos de resolucion.',
      );
    }

    return this.toRequirements(data as RequirementRecord[]);
  }

  async createInvestigationAction(
    command: CreateInvestigationActionRecordCommand,
  ): Promise<AdminInvestigationActionRecord> {
    const insertPayload = this.withoutUndefined(this.toActionInsert(command));
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('investigation_actions')
      .insert(insertPayload)
      .select(ACTION_SELECT)
      .maybeSingle<ActionRecord>();

    if (error || !data) {
      this.logSupabaseMutationFailure({
        error,
        operation: 'createInvestigationAction',
        payload: insertPayload,
        tableName: 'investigation_actions',
      });

      throw new ServiceUnavailableException(
        'No se pudo crear la accion de investigacion.',
      );
    }

    return this.toAction(data);
  }

  async createEvidenceUnlockRule(
    command: CreateEvidenceUnlockRuleRecordCommand,
  ): Promise<AdminEvidenceUnlockRuleRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('evidence_unlock_rules')
      .insert(this.withoutUndefined(this.toEvidenceUnlockRuleInsert(command)))
      .select(EVIDENCE_UNLOCK_RULE_SELECT)
      .maybeSingle<EvidenceUnlockRuleRecord>();

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudo crear la regla de evidencia.',
      );
    }

    return this.toEvidenceUnlockRule(data);
  }

  async createStatementUnlockRule(
    command: CreateStatementUnlockRuleRecordCommand,
  ): Promise<AdminStatementUnlockRuleRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('statement_unlock_rules')
      .insert(this.withoutUndefined(this.toStatementUnlockRuleInsert(command)))
      .select(STATEMENT_UNLOCK_RULE_SELECT)
      .maybeSingle<StatementUnlockRuleRecord>();

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudo crear la regla de declaracion.',
      );
    }

    return this.toStatementUnlockRule(data);
  }

  async createContradictionUnlockRule(
    command: CreateContradictionUnlockRuleRecordCommand,
  ): Promise<AdminContradictionUnlockRuleRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('contradiction_unlock_rules')
      .insert(
        this.withoutUndefined(this.toContradictionUnlockRuleInsert(command)),
      )
      .select(CONTRADICTION_UNLOCK_RULE_SELECT)
      .maybeSingle<ContradictionUnlockRuleRecord>();

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudo crear la regla de contradiccion.',
      );
    }

    return this.toContradictionUnlockRule(data);
  }

  async createActionPrerequisite(
    command: CreateActionPrerequisiteRecordCommand,
  ): Promise<AdminActionPrerequisiteRecord> {
    const prerequisites = await this.createActionPrerequisites([command]);
    const prerequisite = prerequisites[0];

    if (!prerequisite) {
      throw new ServiceUnavailableException(
        'No se pudo crear el prerequisito de accion.',
      );
    }

    return prerequisite;
  }

  async createActionPrerequisites(
    commands: readonly CreateActionPrerequisiteRecordCommand[],
  ): Promise<AdminActionPrerequisiteRecord[]> {
    if (commands.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('action_prerequisites')
      .insert(
        commands.map((command) =>
          this.withoutUndefined(this.toActionPrerequisiteInsert(command)),
        ),
      )
      .select(ACTION_PREREQUISITE_SELECT);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron crear los prerequisitos de acciones.',
      );
    }

    return this.toActionPrerequisites(data as ActionPrerequisiteRecord[]);
  }

  async createInvestigationGraph(
    command: CreateInvestigationGraphRecordCommand,
  ): Promise<CreatedInvestigationGraphRecord> {
    const payload = this.createInvestigationGraphRpcPayload(command);
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .rpc('create_case_investigation_graph', { payload });

    if (error || !data) {
      this.logSupabaseMutationFailure({
        error,
        operation: 'createInvestigationGraph',
        payload,
        tableName: 'create_case_investigation_graph',
      });

      throw new ServiceUnavailableException(
        'No se pudo crear el grafo de investigacion.',
      );
    }

    return this.toCreatedInvestigationGraph(data);
  }

  async publishCase(caseId: string): Promise<AdminCaseRecord> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('cases')
      .update({ status: 'playable' })
      .eq('id', caseId)
      .select(CASE_SELECT)
      .maybeSingle<CaseRecord>();

    if (error || !data) {
      throw new ServiceUnavailableException('No se pudo publicar el caso.');
    }

    return this.toCase(data);
  }

  async findCase(caseId: string): Promise<AdminCaseRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('cases')
      .select(CASE_SELECT)
      .eq('id', caseId)
      .maybeSingle<CaseRecord>();

    if (error) {
      throw new ServiceUnavailableException('No se pudo consultar el caso.');
    }

    return data ? this.toCase(data) : undefined;
  }

  async findRecentCaseTitles(limit: number): Promise<string[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('cases')
      .select('title')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar los titulos de casos recientes.',
      );
    }

    return (data as CaseTitleRecord[]).map((record) =>
      this.readText(record.title, 'El caso no incluye titulo valido.'),
    );
  }

  async findAdminCases(
    query: AdminCasesListQuery,
  ): Promise<AdminCasesListPage> {
    const range = this.createPaginationRange(query);
    let casesQuery = this.supabaseClientFactory
      .createServiceRoleClient()
      .from('cases')
      .select(CASE_SELECT, { count: 'exact' });

    if (query.status) {
      casesQuery = casesQuery.eq('status', query.status);
    }

    const { count, data, error } = await casesQuery
      .order('created_at', { ascending: query.sort === 'asc' })
      .range(range.start, range.end);

    if (error || count === null) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar los casos administrativos.',
      );
    }

    return {
      cases: this.toCases(data ?? []),
      total: count,
    };
  }

  async findRandomPlayableCaseBase(
    query: RandomPlayableCaseBaseQuery,
  ): Promise<AdminCaseRecord | undefined> {
    const excludedCaseIds = await this.findInvestigatedCaseIds(
      query.departmentId,
    );
    const total = await this.countPlayableCaseBases({
      difficulty: query.difficulty,
      excludedCaseIds,
    });

    if (total === 0) {
      return undefined;
    }

    return this.findPlayableCaseBaseAtOffset({
      difficulty: query.difficulty,
      excludedCaseIds,
      offset: Math.floor(Math.random() * total),
    });
  }

  private async countPlayableCaseBases(
    query: PlayableCaseBaseLookup,
  ): Promise<number> {
    const casesQuery = this.excludeCaseIdsFromQuery(
      this.supabaseClientFactory
        .createServiceRoleClient()
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('status', PLAYABLE_CASE_STATUS)
        .eq('difficulty', query.difficulty),
      query.excludedCaseIds,
    );

    const { count, error } = await casesQuery;

    if (error || count === null) {
      throw new ServiceUnavailableException(
        'No se pudieron contar los casos disponibles.',
      );
    }

    return count;
  }

  private async findPlayableCaseBaseAtOffset(
    query: PlayableCaseBaseOffsetLookup,
  ): Promise<AdminCaseRecord | undefined> {
    const casesQuery = this.excludeCaseIdsFromQuery(
      this.supabaseClientFactory
        .createServiceRoleClient()
        .from('cases')
        .select(CASE_SELECT)
        .eq('status', PLAYABLE_CASE_STATUS)
        .eq('difficulty', query.difficulty),
      query.excludedCaseIds,
    );

    const { data, error } = await casesQuery
      .order('created_at', { ascending: true })
      .range(query.offset, query.offset);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar el caso aleatorio.',
      );
    }

    return this.toCases(data ?? [])[0];
  }

  private async findInvestigatedCaseIds(
    departmentId: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('investigations')
      .select('case_id')
      .eq('department_id', departmentId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las investigaciones del departamento.',
      );
    }

    return (data ?? []).map((record) =>
      this.readText(
        (record as InvestigationCaseRecord).case_id,
        'La investigacion no incluye caso valido.',
      ),
    );
  }

  private createPaginationRange(query: {
    readonly limit: number;
    readonly page: number;
  }): {
    readonly end: number;
    readonly start: number;
  } {
    const start = (query.page - 1) * query.limit;

    return {
      end: start + query.limit - 1,
      start,
    };
  }

  private excludeCaseIdsFromQuery<TQuery extends FilterableCasesQuery>(
    casesQuery: TQuery,
    excludedCaseIds: readonly string[],
  ): TQuery {
    if (excludedCaseIds.length === 0) {
      return casesQuery;
    }

    return casesQuery.not(
      'id',
      'in',
      this.createPostgrestInFilter(excludedCaseIds),
    );
  }

  private createPostgrestInFilter(values: readonly string[]): string {
    return `(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(',')})`;
  }

  async findSuspect(
    suspectId: string,
  ): Promise<AdminSuspectRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('suspects')
      .select(SUSPECT_SELECT)
      .eq('id', suspectId)
      .maybeSingle<SuspectRecord>();

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar el sospechoso.',
      );
    }

    return data ? this.toSuspect(data) : undefined;
  }

  async findEvidence(
    evidenceId: string,
  ): Promise<AdminEvidenceRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('evidences')
      .select(EVIDENCE_SELECT)
      .eq('id', evidenceId)
      .maybeSingle<EvidenceRecord>();

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar la evidencia.',
      );
    }

    return data ? this.toEvidence(data) : undefined;
  }

  async findStatement(
    statementId: string,
  ): Promise<AdminStatementRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('statements')
      .select(STATEMENT_SELECT)
      .eq('id', statementId)
      .maybeSingle<StatementRecord>();

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar la declaracion.',
      );
    }

    return data ? this.toStatement(data) : undefined;
  }

  async findContradiction(
    contradictionId: string,
  ): Promise<AdminContradictionRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('contradictions')
      .select(CONTRADICTION_SELECT)
      .eq('id', contradictionId)
      .maybeSingle<ContradictionRecord>();

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar la contradiccion.',
      );
    }

    return data ? this.toContradiction(data) : undefined;
  }

  async findAction(
    actionId: string,
  ): Promise<AdminInvestigationActionRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('investigation_actions')
      .select(ACTION_SELECT)
      .eq('id', actionId)
      .maybeSingle<ActionRecord>();

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar la accion de investigacion.',
      );
    }

    return data ? this.toAction(data) : undefined;
  }

  async findPlayabilitySnapshot(
    caseId: string,
  ): Promise<CasePlayabilitySnapshot | undefined> {
    const caseRecord = await this.findCase(caseId);

    if (!caseRecord) {
      return undefined;
    }

    const [
      suspects,
      evidences,
      statements,
      contradictions,
      requirements,
      actions,
      evidenceUnlockRules,
      statementUnlockRules,
      contradictionUnlockRules,
      actionPrerequisites,
      solution,
    ] = await Promise.all([
      this.findSuspectsByCase(caseId),
      this.findEvidencesByCase(caseId),
      this.findStatementsByCase(caseId),
      this.findContradictionsByCase(caseId),
      this.findRequirementsByCase(caseId),
      this.findActionsByCase(caseId),
      this.findEvidenceUnlockRulesByCase(caseId),
      this.findStatementUnlockRulesByCase(caseId),
      this.findContradictionUnlockRulesByCase(caseId),
      this.findActionPrerequisitesByCase(caseId),
      this.findSolutionByCase(caseId),
    ]);

    return {
      actionPrerequisites,
      actions,
      caseRecord,
      contradictionUnlockRules,
      contradictions,
      evidenceUnlockRules,
      evidences,
      requirements,
      solution,
      statementUnlockRules,
      statements,
      suspects,
    };
  }

  async findSuspectsByCase(caseId: string): Promise<AdminSuspectRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('suspects')
      .select(SUSPECT_SELECT)
      .eq('case_id', caseId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar los sospechosos.',
      );
    }

    return this.toSuspects(data ?? []);
  }

  async findEvidencesByCase(caseId: string): Promise<AdminEvidenceRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('evidences')
      .select(EVIDENCE_SELECT)
      .eq('case_id', caseId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las evidencias.',
      );
    }

    return this.toEvidences(data ?? []);
  }

  async findStatementsByCase(caseId: string): Promise<AdminStatementRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('statements')
      .select(STATEMENT_SELECT)
      .eq('case_id', caseId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las declaraciones.',
      );
    }

    return this.toStatements(data ?? []);
  }

  async findInitialStatementsByCase(
    caseId: string,
  ): Promise<AdminStatementRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('statements')
      .select(STATEMENT_SELECT)
      .eq('case_id', caseId)
      .eq('is_initially_visible', true);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las declaraciones iniciales.',
      );
    }

    return this.toStatements(data ?? []);
  }

  async findContradictionsByCase(
    caseId: string,
  ): Promise<AdminContradictionRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('contradictions')
      .select(CONTRADICTION_SELECT)
      .eq('case_id', caseId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las contradicciones.',
      );
    }

    return this.toContradictions(data ?? []);
  }

  async findRequirementsByCase(
    caseId: string,
  ): Promise<AdminSolveRequirementRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('solve_requirements')
      .select(REQUIREMENT_SELECT)
      .eq('case_id', caseId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar los requisitos de resolucion.',
      );
    }

    return this.toRequirements(data ?? []);
  }

  private async findActionsByCase(
    caseId: string,
  ): Promise<AdminInvestigationActionRecord[]> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('investigation_actions')
      .select(ACTION_SELECT)
      .eq('case_id', caseId);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las acciones de investigacion.',
      );
    }

    return this.toActions(data ?? []);
  }

  private async findEvidenceUnlockRulesByCase(
    caseId: string,
  ): Promise<AdminEvidenceUnlockRuleRecord[]> {
    const actions = await this.findActionsByCase(caseId);
    const actionIds = actions.map((action) => action.id);

    if (actionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('evidence_unlock_rules')
      .select(EVIDENCE_UNLOCK_RULE_SELECT)
      .in('action_id', actionIds);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las reglas de evidencia.',
      );
    }

    return this.toEvidenceUnlockRules(data ?? []);
  }

  private async findStatementUnlockRulesByCase(
    caseId: string,
  ): Promise<AdminStatementUnlockRuleRecord[]> {
    const actions = await this.findActionsByCase(caseId);
    const actionIds = actions.map((action) => action.id);

    if (actionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('statement_unlock_rules')
      .select(STATEMENT_UNLOCK_RULE_SELECT)
      .in('action_id', actionIds);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las reglas de declaracion.',
      );
    }

    return this.toStatementUnlockRules(data ?? []);
  }

  private async findContradictionUnlockRulesByCase(
    caseId: string,
  ): Promise<AdminContradictionUnlockRuleRecord[]> {
    const actions = await this.findActionsByCase(caseId);
    const actionIds = actions.map((action) => action.id);

    if (actionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('contradiction_unlock_rules')
      .select(CONTRADICTION_UNLOCK_RULE_SELECT)
      .in('action_id', actionIds);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar las reglas de contradiccion.',
      );
    }

    return this.toContradictionUnlockRules(data ?? []);
  }

  private async findActionPrerequisitesByCase(
    caseId: string,
  ): Promise<AdminActionPrerequisiteRecord[]> {
    const actions = await this.findActionsByCase(caseId);
    const actionIds = actions.map((action) => action.id);

    if (actionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('action_prerequisites')
      .select(ACTION_PREREQUISITE_SELECT)
      .in('action_id', actionIds);

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudieron consultar los prerequisitos de acciones.',
      );
    }

    return this.toActionPrerequisites(data ?? []);
  }

  async findSolutionByCase(
    caseId: string,
  ): Promise<AdminCaseSolutionRecord | undefined> {
    const { data, error } = await this.supabaseClientFactory
      .createServiceRoleClient()
      .from('case_solutions')
      .select(SOLUTION_SELECT)
      .eq('case_id', caseId)
      .maybeSingle<SolutionRecord>();

    if (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar la solucion.',
      );
    }

    return data ? this.toSolution(data) : undefined;
  }

  private createCaseInsert(
    command: CreateCaseRecordCommand,
  ): Record<string, unknown> {
    return this.withoutUndefined({
      ai_generation_metadata: command.aiGenerationMetadata ?? {},
      ai_model: command.aiModel,
      created_by: command.createdBy,
      department_id: null,
      difficulty: command.difficulty,
      generated_by_ai: command.generatedByAi,
      generation_prompt: command.generationPrompt,
      public_briefing: command.publicBriefing,
      status: 'draft',
      summary: command.summary,
      title: command.title,
      victim_name: command.victimName,
    });
  }

  private toCaseAiGenerationRunInsert(
    command: CreateCaseAiGenerationRunRecordCommand,
  ): Record<string, unknown> {
    return {
      attempts_by_step: command.attemptsByStep ?? {},
      case_id: command.caseId,
      created_by: command.createdBy,
      culprit_suspect_id: command.culpritSuspectId,
      current_step: command.currentStep,
      difficulty: command.difficulty,
      generation_options: command.generationOptions ?? {},
      status: command.status,
      theme: command.theme,
    };
  }

  private toCaseAiGenerationRunUpdate(
    command: UpdateCaseAiGenerationRunRecordCommand,
  ): Record<string, unknown> {
    return {
      attempts_by_step: command.attemptsByStep,
      case_id: command.caseId,
      culprit_suspect_id: command.culpritSuspectId,
      current_step: command.currentStep,
      difficulty: command.difficulty,
      finished_at: command.finishedAt,
      generation_options: command.generationOptions,
      last_error: command.lastError,
      status: command.status,
    };
  }

  private toSuspectInsert(
    command: CreateCaseSuspectRecordCommand,
  ): Record<string, unknown> {
    return {
      age: command.age,
      background: command.background,
      case_id: command.caseId,
      name: command.name,
      occupation: command.occupation,
      personality: command.personality,
      public_notes: command.publicNotes,
      relationship_to_victim: command.relationshipToVictim,
    };
  }

  private toEvidenceInsert(
    command: CreateCaseEvidenceRecordCommand,
  ): Record<string, unknown> {
    return {
      case_id: command.caseId,
      description: command.description,
      discovery_hint: command.discoveryHint,
      importance: command.importance,
      is_decoy: command.isDecoy,
      is_initially_visible: command.isInitiallyVisible,
      location: command.location,
      metadata: command.metadata,
      title: command.title,
      type: command.type,
      weight: command.weight,
    };
  }

  private toStatementInsert(
    command: CreateCaseStatementRecordCommand,
  ): Record<string, unknown> {
    return {
      case_id: command.caseId,
      content: command.content,
      context: command.context,
      is_initially_visible: command.isInitiallyVisible,
      speaker_name: command.speakerName,
      suspect_id: command.suspectId,
    };
  }

  private toContradictionInsert(
    command: CreateCaseContradictionRecordCommand,
  ): Record<string, unknown> {
    return {
      case_id: command.caseId,
      explanation: command.explanation,
      is_initially_visible: command.isInitiallyVisible,
      proves: command.proves,
      refuting_evidence_id: command.refutingEvidenceId,
      statement_id: command.statementId,
      suspect_id: command.suspectId,
      title: command.title,
    };
  }

  private toSolutionInsert(
    command: CreateCaseSolutionRecordCommand,
  ): Record<string, unknown> {
    return {
      case_id: command.caseId,
      culprit_suspect_id: command.culpritSuspectId,
      full_explanation: command.fullExplanation,
      method_summary: command.methodSummary,
      motive_summary: command.motiveSummary,
      opportunity_summary: command.opportunitySummary,
    };
  }

  private toRequirementInsert(
    command: CreateSolveRequirementRecordCommand,
  ): Record<string, unknown> {
    return {
      case_id: command.caseId,
      description: command.description,
      is_mandatory: command.isMandatory,
      proof_role: command.proofRole,
      required_contradiction_id: command.requiredContradictionId,
      required_evidence_id: command.requiredEvidenceId,
      required_suspect_id: command.requiredSuspectId,
      requirement_type: command.requirementType,
      weight: command.weight,
    };
  }

  private toActionInsert(
    command: CreateInvestigationActionRecordCommand,
  ): Record<string, unknown> {
    return {
      action_type: command.actionType,
      base_duration_minutes: command.baseDurationMinutes,
      case_id: command.caseId,
      description: command.description,
      is_initially_available: command.isInitiallyAvailable,
      metadata: command.metadata,
      minimum_skill_level: command.minimumSkillLevel,
      required_skill: command.requiredSkill,
      requires_detective: command.requiresDetective,
      title: command.title,
    };
  }

  private toEvidenceUnlockRuleInsert(
    command: CreateEvidenceUnlockRuleRecordCommand,
  ): Record<string, unknown> {
    return {
      action_id: command.actionId,
      duration_modifier_minutes: command.durationModifierMinutes,
      evidence_id: command.evidenceId,
      is_guaranteed: command.isGuaranteed,
      minimum_skill_level: command.minimumSkillLevel,
      required_skill: command.requiredSkill,
      success_chance: command.successChance,
    };
  }

  private toStatementUnlockRuleInsert(
    command: CreateStatementUnlockRuleRecordCommand,
  ): Record<string, unknown> {
    return {
      action_id: command.actionId,
      is_guaranteed: command.isGuaranteed,
      minimum_skill_level: command.minimumSkillLevel,
      required_skill: command.requiredSkill,
      statement_id: command.statementId,
      success_chance: command.successChance,
    };
  }

  private toContradictionUnlockRuleInsert(
    command: CreateContradictionUnlockRuleRecordCommand,
  ): Record<string, unknown> {
    return {
      action_id: command.actionId,
      contradiction_id: command.contradictionId,
      is_guaranteed: command.isGuaranteed,
      minimum_skill_level: command.minimumSkillLevel,
      required_skill: command.requiredSkill,
      success_chance: command.successChance,
    };
  }

  private toActionPrerequisiteInsert(
    command: CreateActionPrerequisiteRecordCommand,
  ): Record<string, unknown> {
    return {
      action_id: command.actionId,
      prerequisite_action_id: command.prerequisiteActionId,
      prerequisite_contradiction_id: command.prerequisiteContradictionId,
      prerequisite_evidence_id: command.prerequisiteEvidenceId,
    };
  }

  private createInvestigationGraphRpcPayload(
    command: CreateInvestigationGraphRecordCommand,
  ): Record<string, unknown> {
    return {
      actionPrerequisites: this.createActionPrerequisiteRpcPayloads(
        command.actionPrerequisites,
      ),
      actions: this.createActionRpcPayloads(command.actions),
      caseId: command.caseId,
      contradictionUnlockRules: this.createContradictionUnlockRuleRpcPayloads(
        command.contradictionUnlockRules,
      ),
      evidenceUnlockRules: this.createEvidenceUnlockRuleRpcPayloads(
        command.evidenceUnlockRules,
      ),
      statementUnlockRules: this.createStatementUnlockRuleRpcPayloads(
        command.statementUnlockRules,
      ),
    };
  }

  private createActionRpcPayloads(
    actions: CreateInvestigationGraphRecordCommand['actions'],
  ): Record<string, unknown>[] {
    return actions.map((action) =>
      this.withoutUndefined({
        actionType: action.actionType,
        baseDurationMinutes: action.baseDurationMinutes,
        description: action.description,
        isInitiallyAvailable: action.isInitiallyAvailable,
        metadata: action.metadata,
        minimumSkillLevel: action.minimumSkillLevel,
        requiredSkill: action.requiredSkill,
        requiresDetective: action.requiresDetective,
        tempId: action.tempId,
        title: action.title,
      }),
    );
  }

  private createActionPrerequisiteRpcPayloads(
    prerequisites: CreateInvestigationGraphRecordCommand['actionPrerequisites'],
  ): Record<string, unknown>[] {
    return prerequisites.map((prerequisite) =>
      this.withoutUndefined({
        actionTempId: prerequisite.actionTempId,
        prerequisiteActionTempId: prerequisite.prerequisiteActionTempId,
        prerequisiteContradictionId: prerequisite.prerequisiteContradictionId,
        prerequisiteEvidenceId: prerequisite.prerequisiteEvidenceId,
      }),
    );
  }

  private createContradictionUnlockRuleRpcPayloads(
    rules: CreateInvestigationGraphRecordCommand['contradictionUnlockRules'],
  ): Record<string, unknown>[] {
    return rules.map((rule) =>
      this.withoutUndefined({
        actionTempId: rule.actionTempId,
        contradictionId: rule.contradictionId,
        isGuaranteed: rule.isGuaranteed,
        minimumSkillLevel: rule.minimumSkillLevel,
        requiredSkill: rule.requiredSkill,
        successChance: rule.successChance,
      }),
    );
  }

  private createEvidenceUnlockRuleRpcPayloads(
    rules: CreateInvestigationGraphRecordCommand['evidenceUnlockRules'],
  ): Record<string, unknown>[] {
    return rules.map((rule) =>
      this.withoutUndefined({
        actionTempId: rule.actionTempId,
        durationModifierMinutes: rule.durationModifierMinutes,
        evidenceId: rule.evidenceId,
        isGuaranteed: rule.isGuaranteed,
        minimumSkillLevel: rule.minimumSkillLevel,
        requiredSkill: rule.requiredSkill,
        successChance: rule.successChance,
      }),
    );
  }

  private createStatementUnlockRuleRpcPayloads(
    rules: CreateInvestigationGraphRecordCommand['statementUnlockRules'],
  ): Record<string, unknown>[] {
    return rules.map((rule) =>
      this.withoutUndefined({
        actionTempId: rule.actionTempId,
        isGuaranteed: rule.isGuaranteed,
        minimumSkillLevel: rule.minimumSkillLevel,
        requiredSkill: rule.requiredSkill,
        statementId: rule.statementId,
        successChance: rule.successChance,
      }),
    );
  }

  private withoutUndefined(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined),
    );
  }

  private toCaseAiGenerationRuns(
    records: CaseAiGenerationRunRow[],
  ): CaseAiGenerationRunRecord[] {
    return records.map((record) => this.toCaseAiGenerationRun(record));
  }

  private toCaseAiGenerationRun(
    record: CaseAiGenerationRunRow,
  ): CaseAiGenerationRunRecord {
    return {
      attemptsByStep: this.readCaseAiGenerationAttempts(
        record.attempts_by_step,
      ),
      caseId: this.readOptionalText(
        record.case_id,
        'La ejecucion IA no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La ejecucion IA no incluye fecha de creacion valida.',
      ),
      createdBy: this.readText(
        record.created_by,
        'La ejecucion IA no incluye creador valido.',
      ),
      culpritSuspectId: this.readOptionalText(
        record.culprit_suspect_id,
        'La ejecucion IA no incluye culpable valido.',
      ),
      currentStep: this.readCaseAiGenerationStep(record.current_step),
      difficulty: this.readOptionalCaseDifficulty(record.difficulty),
      finishedAt: this.readOptionalText(
        record.finished_at,
        'La ejecucion IA no incluye fecha final valida.',
      ),
      generationOptions: this.readObject(
        record.generation_options,
        'La ejecucion IA no incluye opciones validas.',
      ),
      id: this.readText(
        record.id,
        'La ejecucion IA no incluye identificador valido.',
      ),
      lastError: this.readOptionalText(
        record.last_error,
        'La ejecucion IA no incluye error valido.',
      ),
      status: this.readCaseAiGenerationStatus(record.status),
      theme: this.readOptionalText(
        record.theme,
        'La ejecucion IA no incluye tema valido.',
      ),
      updatedAt: this.readText(
        record.updated_at,
        'La ejecucion IA no incluye fecha de actualizacion valida.',
      ),
    };
  }

  private toCases(records: CaseRecord[]): AdminCaseRecord[] {
    return records.map((record) => this.toCase(record));
  }

  private toCase(record: CaseRecord): AdminCaseRecord {
    return {
      aiGenerationMetadata: this.readObject(
        record.ai_generation_metadata,
        'El caso no incluye metadata valida.',
      ),
      aiModel: this.readOptionalText(
        record.ai_model,
        'El caso no incluye modelo IA valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'El caso no incluye fecha de creacion valida.',
      ),
      createdBy: this.readOptionalText(
        record.created_by,
        'El caso no incluye creador valido.',
      ),
      departmentId: this.readOptionalNullableText(
        record.department_id,
        'El caso no incluye departamento valido.',
      ),
      difficulty: this.readText(
        record.difficulty,
        'El caso no incluye dificultad valida.',
      ),
      generatedByAi: this.readBoolean(
        record.generated_by_ai,
        'El caso no incluye origen valido.',
      ),
      generationPrompt: this.readOptionalText(
        record.generation_prompt,
        'El caso no incluye prompt valido.',
      ),
      id: this.readText(record.id, 'El caso no incluye identificador valido.'),
      publicBriefing: this.readOptionalText(
        record.public_briefing,
        'El caso no incluye briefing valido.',
      ),
      status: this.readText(record.status, 'El caso no incluye estado valido.'),
      summary: this.readText(
        record.summary,
        'El caso no incluye resumen valido.',
      ),
      title: this.readText(record.title, 'El caso no incluye titulo valido.'),
      updatedAt: this.readText(
        record.updated_at,
        'El caso no incluye fecha de actualizacion valida.',
      ),
      victimName: this.readOptionalText(
        record.victim_name,
        'El caso no incluye victima valida.',
      ),
    };
  }

  private toSuspects(records: SuspectRecord[]): AdminSuspectRecord[] {
    return records.map((record) => this.toSuspect(record));
  }

  private toSuspect(record: SuspectRecord): AdminSuspectRecord {
    return {
      age: this.readOptionalNumber(
        record.age,
        'El sospechoso no incluye edad valida.',
      ),
      background: this.readOptionalText(
        record.background,
        'El sospechoso no incluye trasfondo valido.',
      ),
      caseId: this.readText(
        record.case_id,
        'El sospechoso no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'El sospechoso no incluye fecha valida.',
      ),
      id: this.readText(
        record.id,
        'El sospechoso no incluye identificador valido.',
      ),
      name: this.readText(
        record.name,
        'El sospechoso no incluye nombre valido.',
      ),
      occupation: this.readOptionalText(
        record.occupation,
        'El sospechoso no incluye ocupacion valida.',
      ),
      personality: this.readOptionalText(
        record.personality,
        'El sospechoso no incluye personalidad valida.',
      ),
      publicNotes: this.readOptionalText(
        record.public_notes,
        'El sospechoso no incluye notas validas.',
      ),
      relationshipToVictim: this.readOptionalText(
        record.relationship_to_victim,
        'El sospechoso no incluye relacion valida.',
      ),
    };
  }

  private toEvidences(records: EvidenceRecord[]): AdminEvidenceRecord[] {
    return records.map((record) => this.toEvidence(record));
  }

  private toEvidence(record: EvidenceRecord): AdminEvidenceRecord {
    return {
      caseId: this.readText(
        record.case_id,
        'La evidencia no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La evidencia no incluye fecha valida.',
      ),
      description: this.readText(
        record.description,
        'La evidencia no incluye descripcion valida.',
      ),
      discoveryHint: this.readOptionalText(
        record.discovery_hint,
        'La evidencia no incluye pista valida.',
      ),
      id: this.readText(
        record.id,
        'La evidencia no incluye identificador valido.',
      ),
      importance: this.readText(
        record.importance,
        'La evidencia no incluye importancia valida.',
      ),
      isDecoy: this.readBoolean(
        record.is_decoy,
        'La evidencia no incluye bandera distractora valida.',
      ),
      isInitiallyVisible: this.readBoolean(
        record.is_initially_visible,
        'La evidencia no incluye visibilidad valida.',
      ),
      location: this.readOptionalText(
        record.location,
        'La evidencia no incluye ubicacion valida.',
      ),
      metadata: this.readObject(
        record.metadata,
        'La evidencia no incluye metadata valida.',
      ),
      title: this.readText(
        record.title,
        'La evidencia no incluye titulo valido.',
      ),
      type: this.readText(record.type, 'La evidencia no incluye tipo valido.'),
      weight: this.readNumber(
        record.weight,
        'La evidencia no incluye peso valido.',
      ),
    };
  }

  private toStatements(records: StatementRecord[]): AdminStatementRecord[] {
    return records.map((record) => this.toStatement(record));
  }

  private toStatement(record: StatementRecord): AdminStatementRecord {
    return {
      caseId: this.readText(
        record.case_id,
        'La declaracion no incluye caso valido.',
      ),
      content: this.readText(
        record.content,
        'La declaracion no incluye contenido valido.',
      ),
      context: this.readOptionalText(
        record.context,
        'La declaracion no incluye contexto valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La declaracion no incluye fecha valida.',
      ),
      id: this.readText(
        record.id,
        'La declaracion no incluye identificador valido.',
      ),
      isInitiallyVisible: this.readBoolean(
        record.is_initially_visible,
        'La declaracion no incluye visibilidad valida.',
      ),
      speakerName: this.readText(
        record.speaker_name,
        'La declaracion no incluye hablante valido.',
      ),
      suspectId: this.readOptionalText(
        record.suspect_id,
        'La declaracion no incluye sospechoso valido.',
      ),
    };
  }

  private toContradictions(
    records: ContradictionRecord[],
  ): AdminContradictionRecord[] {
    return records.map((record) => this.toContradiction(record));
  }

  private toContradiction(
    record: ContradictionRecord,
  ): AdminContradictionRecord {
    return {
      caseId: this.readText(
        record.case_id,
        'La contradiccion no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La contradiccion no incluye fecha valida.',
      ),
      explanation: this.readText(
        record.explanation,
        'La contradiccion no incluye explicacion valida.',
      ),
      id: this.readText(
        record.id,
        'La contradiccion no incluye identificador valido.',
      ),
      isInitiallyVisible: this.readBoolean(
        record.is_initially_visible,
        'La contradiccion no incluye visibilidad valida.',
      ),
      proves: this.readText(
        record.proves,
        'La contradiccion no incluye rol valido.',
      ),
      refutingEvidenceId: this.readText(
        record.refuting_evidence_id,
        'La contradiccion no incluye evidencia valida.',
      ),
      statementId: this.readText(
        record.statement_id,
        'La contradiccion no incluye declaracion valida.',
      ),
      suspectId: this.readOptionalText(
        record.suspect_id,
        'La contradiccion no incluye sospechoso valido.',
      ),
      title: this.readText(
        record.title,
        'La contradiccion no incluye titulo valido.',
      ),
    };
  }

  private toSolution(record: SolutionRecord): AdminCaseSolutionRecord {
    return {
      caseId: this.readText(
        record.case_id,
        'La solucion no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La solucion no incluye fecha valida.',
      ),
      culpritSuspectId: this.readText(
        record.culprit_suspect_id,
        'La solucion no incluye culpable valido.',
      ),
      fullExplanation: this.readText(
        record.full_explanation,
        'La solucion no incluye explicacion valida.',
      ),
      id: this.readText(
        record.id,
        'La solucion no incluye identificador valido.',
      ),
      methodSummary: this.readText(
        record.method_summary,
        'La solucion no incluye metodo valido.',
      ),
      motiveSummary: this.readText(
        record.motive_summary,
        'La solucion no incluye motivo valido.',
      ),
      opportunitySummary: this.readText(
        record.opportunity_summary,
        'La solucion no incluye oportunidad valida.',
      ),
    };
  }

  private toRequirements(
    records: RequirementRecord[],
  ): AdminSolveRequirementRecord[] {
    return records.map((record) => this.toRequirement(record));
  }

  private toRequirement(
    record: RequirementRecord,
  ): AdminSolveRequirementRecord {
    return {
      caseId: this.readText(
        record.case_id,
        'El requisito no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'El requisito no incluye fecha valida.',
      ),
      description: this.readText(
        record.description,
        'El requisito no incluye descripcion valida.',
      ),
      id: this.readText(
        record.id,
        'El requisito no incluye identificador valido.',
      ),
      isMandatory: this.readBoolean(
        record.is_mandatory,
        'El requisito no incluye obligatoriedad valida.',
      ),
      proofRole: this.readOptionalText(
        record.proof_role,
        'El requisito no incluye rol valido.',
      ),
      requiredContradictionId: this.readOptionalText(
        record.required_contradiction_id,
        'El requisito no incluye contradiccion valida.',
      ),
      requiredEvidenceId: this.readOptionalText(
        record.required_evidence_id,
        'El requisito no incluye evidencia valida.',
      ),
      requiredSuspectId: this.readOptionalText(
        record.required_suspect_id,
        'El requisito no incluye sospechoso valido.',
      ),
      requirementType: this.readText(
        record.requirement_type,
        'El requisito no incluye tipo valido.',
      ),
      weight: this.readNumber(
        record.weight,
        'El requisito no incluye peso valido.',
      ),
    };
  }

  private toActions(records: ActionRecord[]): AdminInvestigationActionRecord[] {
    return records.map((record) => this.toAction(record));
  }

  private toCreatedInvestigationGraph(
    record: unknown,
  ): CreatedInvestigationGraphRecord {
    const graph = this.readObject(
      record,
      'El grafo de investigacion no incluye respuesta valida.',
    );

    return {
      actionPrerequisites: this.toActionPrerequisites(
        this.readRecordArray(
          graph.actionPrerequisites,
          'El grafo no incluye prerequisitos validos.',
        ) as ActionPrerequisiteRecord[],
      ),
      actions: this.toActions(
        this.readRecordArray(
          graph.actions,
          'El grafo no incluye acciones validas.',
        ) as ActionRecord[],
      ),
      contradictionUnlockRules: this.toContradictionUnlockRules(
        this.readRecordArray(
          graph.contradictionUnlockRules,
          'El grafo no incluye reglas de contradiccion validas.',
        ) as ContradictionUnlockRuleRecord[],
      ),
      evidenceUnlockRules: this.toEvidenceUnlockRules(
        this.readRecordArray(
          graph.evidenceUnlockRules,
          'El grafo no incluye reglas de evidencia validas.',
        ) as EvidenceUnlockRuleRecord[],
      ),
      statementUnlockRules: this.toStatementUnlockRules(
        this.readRecordArray(
          graph.statementUnlockRules,
          'El grafo no incluye reglas de declaracion validas.',
        ) as StatementUnlockRuleRecord[],
      ),
    };
  }

  private toAction(record: ActionRecord): AdminInvestigationActionRecord {
    return {
      actionType: this.readText(
        record.action_type,
        'La accion no incluye tipo valido.',
      ),
      baseDurationMinutes: this.readNumber(
        record.base_duration_minutes,
        'La accion no incluye duracion valida.',
      ),
      caseId: this.readText(
        record.case_id,
        'La accion no incluye caso valido.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La accion no incluye fecha valida.',
      ),
      description: this.readText(
        record.description,
        'La accion no incluye descripcion valida.',
      ),
      id: this.readText(
        record.id,
        'La accion no incluye identificador valido.',
      ),
      isInitiallyAvailable: this.readBoolean(
        record.is_initially_available,
        'La accion no incluye disponibilidad inicial valida.',
      ),
      metadata: this.readObject(
        record.metadata,
        'La accion no incluye metadata valida.',
      ),
      minimumSkillLevel: this.readNumber(
        record.minimum_skill_level,
        'La accion no incluye nivel minimo valido.',
      ),
      requiredSkill: this.readOptionalText(
        record.required_skill,
        'La accion no incluye habilidad valida.',
      ),
      requiresDetective: this.readBoolean(
        record.requires_detective,
        'La accion no incluye requisito de detective valido.',
      ),
      title: this.readText(record.title, 'La accion no incluye titulo valido.'),
    };
  }

  private toEvidenceUnlockRules(
    records: EvidenceUnlockRuleRecord[],
  ): AdminEvidenceUnlockRuleRecord[] {
    return records.map((record) => this.toEvidenceUnlockRule(record));
  }

  private toEvidenceUnlockRule(
    record: EvidenceUnlockRuleRecord,
  ): AdminEvidenceUnlockRuleRecord {
    return {
      actionId: this.readText(
        record.action_id,
        'La regla no incluye accion valida.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La regla no incluye fecha valida.',
      ),
      durationModifierMinutes: this.readNumber(
        record.duration_modifier_minutes,
        'La regla no incluye modificador de duracion valido.',
      ),
      evidenceId: this.readText(
        record.evidence_id,
        'La regla no incluye evidencia valida.',
      ),
      id: this.readText(record.id, 'La regla no incluye identificador valido.'),
      isGuaranteed: this.readBoolean(
        record.is_guaranteed,
        'La regla no incluye garantia valida.',
      ),
      minimumSkillLevel: this.readNumber(
        record.minimum_skill_level,
        'La regla no incluye nivel minimo valido.',
      ),
      requiredSkill: this.readOptionalText(
        record.required_skill,
        'La regla no incluye habilidad valida.',
      ),
      successChance: this.readNumber(
        record.success_chance,
        'La regla no incluye probabilidad valida.',
      ),
    };
  }

  private toStatementUnlockRules(
    records: StatementUnlockRuleRecord[],
  ): AdminStatementUnlockRuleRecord[] {
    return records.map((record) => this.toStatementUnlockRule(record));
  }

  private toStatementUnlockRule(
    record: StatementUnlockRuleRecord,
  ): AdminStatementUnlockRuleRecord {
    return {
      actionId: this.readText(
        record.action_id,
        'La regla no incluye accion valida.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La regla no incluye fecha valida.',
      ),
      id: this.readText(record.id, 'La regla no incluye identificador valido.'),
      isGuaranteed: this.readBoolean(
        record.is_guaranteed,
        'La regla no incluye garantia valida.',
      ),
      minimumSkillLevel: this.readNumber(
        record.minimum_skill_level,
        'La regla no incluye nivel minimo valido.',
      ),
      requiredSkill: this.readOptionalText(
        record.required_skill,
        'La regla no incluye habilidad valida.',
      ),
      statementId: this.readText(
        record.statement_id,
        'La regla no incluye declaracion valida.',
      ),
      successChance: this.readNumber(
        record.success_chance,
        'La regla no incluye probabilidad valida.',
      ),
    };
  }

  private toActionPrerequisites(
    records: ActionPrerequisiteRecord[],
  ): AdminActionPrerequisiteRecord[] {
    return records.map((record) => this.toActionPrerequisite(record));
  }

  private toActionPrerequisite(
    record: ActionPrerequisiteRecord,
  ): AdminActionPrerequisiteRecord {
    return {
      actionId: this.readText(
        record.action_id,
        'El prerequisito no incluye accion valida.',
      ),
      createdAt: this.readText(
        record.created_at,
        'El prerequisito no incluye fecha valida.',
      ),
      id: this.readText(
        record.id,
        'El prerequisito no incluye identificador valido.',
      ),
      prerequisiteActionId: this.readOptionalText(
        record.prerequisite_action_id,
        'El prerequisito no incluye accion previa valida.',
      ),
      prerequisiteContradictionId: this.readOptionalText(
        record.prerequisite_contradiction_id,
        'El prerequisito no incluye contradiccion previa valida.',
      ),
      prerequisiteEvidenceId: this.readOptionalText(
        record.prerequisite_evidence_id,
        'El prerequisito no incluye evidencia previa valida.',
      ),
    };
  }

  private toContradictionUnlockRules(
    records: ContradictionUnlockRuleRecord[],
  ): AdminContradictionUnlockRuleRecord[] {
    return records.map((record) => this.toContradictionUnlockRule(record));
  }

  private toContradictionUnlockRule(
    record: ContradictionUnlockRuleRecord,
  ): AdminContradictionUnlockRuleRecord {
    return {
      actionId: this.readText(
        record.action_id,
        'La regla no incluye accion valida.',
      ),
      contradictionId: this.readText(
        record.contradiction_id,
        'La regla no incluye contradiccion valida.',
      ),
      createdAt: this.readText(
        record.created_at,
        'La regla no incluye fecha valida.',
      ),
      id: this.readText(record.id, 'La regla no incluye identificador valido.'),
      isGuaranteed: this.readBoolean(
        record.is_guaranteed,
        'La regla no incluye garantia valida.',
      ),
      minimumSkillLevel: this.readNumber(
        record.minimum_skill_level,
        'La regla no incluye nivel minimo valido.',
      ),
      requiredSkill: this.readOptionalText(
        record.required_skill,
        'La regla no incluye habilidad valida.',
      ),
      successChance: this.readNumber(
        record.success_chance,
        'La regla no incluye probabilidad valida.',
      ),
    };
  }

  private readText(value: unknown, message: string): string {
    if (typeof value !== 'string') {
      throw new ServiceUnavailableException(message);
    }

    return value;
  }

  private readOptionalText(
    value: unknown,
    message: string,
  ): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return this.readText(value, message);
  }

  private readOptionalNullableText(
    value: unknown,
    message: string,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.readText(value, message);
  }

  private readNumber(value: unknown, message: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ServiceUnavailableException(message);
    }

    return value;
  }

  private readOptionalNumber(
    value: unknown,
    message: string,
  ): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return this.readNumber(value, message);
  }

  private readBoolean(value: unknown, message: string): boolean {
    if (typeof value !== 'boolean') {
      throw new ServiceUnavailableException(message);
    }

    return value;
  }

  private readCaseAiGenerationAttempts(
    value: unknown,
  ): CaseAiGenerationAttempts {
    return this.readObject(
      value,
      'La ejecucion IA no incluye intentos validos.',
    ) as CaseAiGenerationAttempts;
  }

  private readCaseAiGenerationStatus(value: unknown): CaseAiGenerationStatus {
    const status = this.readText(
      value,
      'La ejecucion IA no incluye estado valido.',
    );

    if (['running', 'failed', 'completed', 'needs_review'].includes(status)) {
      return status as CaseAiGenerationStatus;
    }

    throw new ServiceUnavailableException(
      'La ejecucion IA no incluye estado valido.',
    );
  }

  private readCaseAiGenerationStep(value: unknown): CaseAiGenerationStep {
    const step = this.readText(
      value,
      'La ejecucion IA no incluye paso valido.',
    );

    if (
      [
        'generate_case_base',
        'generate_suspects',
        'generate_evidences',
        'generate_statements',
        'generate_contradictions',
        'generate_solution',
        'generate_solve_requirements',
        'generate_investigation_graph',
        'validate_playability',
      ].includes(step)
    ) {
      return step as CaseAiGenerationStep;
    }

    throw new ServiceUnavailableException(
      'La ejecucion IA no incluye paso valido.',
    );
  }

  private readOptionalCaseDifficulty(
    value: unknown,
  ): AdminCaseDifficulty | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const difficulty = this.readText(
      value,
      'La ejecucion IA no incluye dificultad valida.',
    );

    if (ADMIN_CASE_DIFFICULTIES.includes(difficulty as AdminCaseDifficulty)) {
      return difficulty as AdminCaseDifficulty;
    }

    throw new ServiceUnavailableException(
      'La ejecucion IA no incluye dificultad valida.',
    );
  }

  private readObject(value: unknown, message: string): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }

    throw new ServiceUnavailableException(message);
  }

  private readRecordArray(
    value: unknown,
    message: string,
  ): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      throw new ServiceUnavailableException(message);
    }

    return value.map((item) => this.readObject(item, message));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private logSupabaseMutationFailure(
    failure: SupabaseMutationFailureLog,
  ): void {
    this.logger.error(
      `Supabase mutation failed: ${JSON.stringify(
        {
          error: this.createLoggableSupabaseError(failure.error),
          operation: failure.operation,
          payload: this.createSafeLogValue(failure.payload),
          tableName: failure.tableName,
        },
        null,
        2,
      )}`,
    );
  }

  private createLoggableSupabaseError(error: unknown): Record<string, unknown> {
    if (!this.isRecord(error)) {
      return {
        message: this.createFallbackSupabaseErrorMessage(error),
      };
    }

    return {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    };
  }

  private createFallbackSupabaseErrorMessage(error: unknown): string {
    return error === null ? 'Supabase did not return data.' : String(error);
  }

  private createSupabaseFailureMessage(
    error: unknown,
    fallbackMessage: string,
  ): string {
    const loggableError = this.createLoggableSupabaseError(error);
    const message =
      typeof loggableError.message === 'string' ? loggableError.message : '';

    if (message.length === 0) {
      return fallbackMessage;
    }

    const code =
      typeof loggableError.code === 'string' ? ` (${loggableError.code})` : '';

    return `${fallbackMessage}${code}: ${message}`;
  }

  private createSafeLogValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.createSafeLogValue(item));
    }

    if (!this.isRecord(value)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        this.createSafeLogEntryValue(key, nestedValue),
      ]),
    );
  }

  private createSafeLogEntryValue(key: string, value: unknown): unknown {
    if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
      return '[redacted]';
    }

    return this.createSafeLogValue(value);
  }
}
