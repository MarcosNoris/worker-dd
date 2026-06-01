import { Injectable } from '@nestjs/common';
import {
  ADMIN_ACTION_TYPES,
  ADMIN_SKILL_TYPES,
  AdminActionType,
  AdminSkillType,
  normalizeAdminActionType,
} from '../../cases/constants/admin-case.constants';
import {
  ACTION_OPERATIONAL_CATEGORIES,
  INVESTIGATION_ACCELERATION_TYPES,
  ActionOperationalCategory,
  InvestigationAccelerationType,
} from '../../rules/investigation-acceleration-rule.service';
import {
  INSTITUTIONAL_ACCESSES,
  InstitutionalAccess,
} from '../../rules/institutional-access-rule.service';
import {
  readArray,
  readBoolean,
  readNumber,
} from '../../../shared/utils/value.util';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import {
  GeneratedActionPrerequisite,
  ActionOperationalMetadata,
  ActionOperationalProfile,
  GeneratedCaseInvestigationAction,
  GeneratedCaseInvestigationGraphContent,
  GeneratedContradictionUnlockRule,
  GeneratedEvidenceUnlockRule,
  GeneratedStatementUnlockRule,
  GenerateCaseInvestigationGraphInput,
} from '../types/ai.types';
import {
  createInvestigationGraphAliasCatalog,
  findAliasById,
  formatAllowedAliases,
  InvestigationGraphAliasCatalog,
  InvestigationGraphAliasReference,
  resolveIdFromAliasOrId,
} from './investigation-graph-aliases';
import {
  createInvestigationGraphActionBudget,
  describeInvestigationGraphActionBudget,
} from './investigation-graph-action-budget';

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TEMP_ID_LENGTH = 80;
const MIN_ACTION_BASE_DURATION_SECONDS = 60;
const MAX_ACTION_BASE_DURATION_SECONDS = 600;
const MINIMUM_SKILL_LEVEL = 50;
const MAXIMUM_SKILL_LEVEL = 100;
const MIN_SUCCESS_CHANCE = 0;
const MAX_SUCCESS_CHANCE = 1;
const DEFAULT_ACTION_BASE_DURATION_SECONDS = 210;
const DEFAULT_OPTIONAL_SUCCESS_CHANCE = 0.7;
const OPERATIONAL_SENSITIVITIES = ['low', 'medium', 'high'] as const;
const RISK_PROFILES = ['standard', 'aggressive', 'political'] as const;
export interface GeneratedCaseInvestigationGraphPayload {
  readonly actionPrerequisites?: unknown;
  readonly actions?: unknown;
  readonly contradictionUnlockRules?: unknown;
  readonly evidenceUnlockRules?: unknown;
  readonly statementUnlockRules?: unknown;
}

interface ActionPayload {
  readonly actionType?: unknown;
  /** Legacy name expected from generated payloads; value is seconds. */
  readonly baseDurationMinutes?: unknown;
  readonly description?: unknown;
  readonly isInitiallyAvailable?: unknown;
  readonly metadata?: unknown;
  readonly minimumSkillLevel?: unknown;
  readonly requiredSkill?: unknown;
  readonly requiresDetective?: unknown;
  readonly tempId?: unknown;
  readonly title?: unknown;
}

interface EvidenceUnlockRulePayload {
  readonly actionTempId?: unknown;
  readonly durationModifierMinutes?: unknown;
  readonly evidenceAlias?: unknown;
  readonly evidenceId?: unknown;
  readonly isGuaranteed?: unknown;
  readonly minimumSkillLevel?: unknown;
  readonly requiredSkill?: unknown;
  readonly successChance?: unknown;
}

interface StatementUnlockRulePayload {
  readonly actionTempId?: unknown;
  readonly isGuaranteed?: unknown;
  readonly minimumSkillLevel?: unknown;
  readonly requiredSkill?: unknown;
  readonly statementAlias?: unknown;
  readonly statementId?: unknown;
  readonly successChance?: unknown;
}

interface ContradictionUnlockRulePayload {
  readonly actionTempId?: unknown;
  readonly contradictionAlias?: unknown;
  readonly contradictionId?: unknown;
  readonly isGuaranteed?: unknown;
  readonly minimumSkillLevel?: unknown;
  readonly requiredSkill?: unknown;
  readonly successChance?: unknown;
}

interface ActionPrerequisitePayload {
  readonly actionTempId?: unknown;
  readonly prerequisiteActionTempId?: unknown;
  readonly prerequisiteContradictionAlias?: unknown;
  readonly prerequisiteContradictionId?: unknown;
  readonly prerequisiteEvidenceAlias?: unknown;
  readonly prerequisiteEvidenceId?: unknown;
}

interface ReachableGraphState {
  readonly actionTempIds: ReadonlySet<string>;
  readonly contradictionIds: ReadonlySet<string>;
  readonly evidenceIds: ReadonlySet<string>;
  readonly statementIds: ReadonlySet<string>;
}

export type InvestigationGraphValidationIssueCode =
  | 'contradiction_external_evidence'
  | 'contradiction_external_statement'
  | 'duplicate_unlock_rule'
  | 'action_count_outside_budget'
  | 'initial_action_with_prerequisite'
  | 'interview_action_without_single_suspect'
  | 'invalid_prerequisite_target'
  | 'mandatory_contradiction_not_guaranteed'
  | 'mandatory_evidence_not_guaranteed'
  | 'missing_initial_suspect_interview'
  | 'non_initial_action_without_prerequisite'
  | 'self_referencing_prerequisite'
  | 'unreachable_action'
  | 'unreachable_contradiction'
  | 'unreachable_evidence'
  | 'unreachable_statement';

export interface InvestigationGraphValidationIssue {
  readonly code: InvestigationGraphValidationIssueCode;
  readonly message: string;
  readonly path?: string;
}

export interface InvestigationGraphValidationReport {
  readonly isValid: boolean;
  readonly issues: readonly InvestigationGraphValidationIssue[];
}

@Injectable()
export class GeneratedCaseInvestigationGraphNormalizer {
  createContentFromPayload(
    payload: GeneratedCaseInvestigationGraphPayload,
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedCaseInvestigationGraphContent {
    const content = this.createNormalizedContentFromPayload(payload, input);

    this.assertValidContent(content, input);

    return content;
  }

  createNormalizedContentFromPayload(
    payload: GeneratedCaseInvestigationGraphPayload,
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedCaseInvestigationGraphContent {
    const aliases = createInvestigationGraphAliasCatalog(input);

    return this.createContent(payload, input, aliases);
  }

  validateContent(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
  ): InvestigationGraphValidationReport {
    const aliases = createInvestigationGraphAliasCatalog(input);
    const issues = [
      ...this.validateGraphIntegrity(content, input, aliases),
      ...this.validateContentCanBeDiscovered(content, input, aliases),
      ...this.validateMandatoryRequirementsAreGuaranteed(
        content,
        input,
        aliases,
      ),
    ];

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  assertValidContent(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
  ): void {
    this.throwWhenValidationFails(this.validateContent(content, input));
  }

  private createContent(
    payload: GeneratedCaseInvestigationGraphPayload,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): GeneratedCaseInvestigationGraphContent {
    const actions = this.createActions(payload.actions);
    const actionTempIds = new Set(actions.map((action) => action.tempId));

    return {
      actionPrerequisites: this.createActionPrerequisites(
        payload.actionPrerequisites,
        actionTempIds,
        aliases,
      ),
      actions,
      contradictionUnlockRules: this.createContradictionUnlockRules(
        payload.contradictionUnlockRules,
        actionTempIds,
        aliases,
      ),
      culpritSuspectId: input.culpritSuspectId,
      difficulty: input.difficulty,
      evidenceUnlockRules: this.createEvidenceUnlockRules(
        payload.evidenceUnlockRules,
        actionTempIds,
        aliases,
      ),
      statementUnlockRules: this.createStatementUnlockRules(
        payload.statementUnlockRules,
        actionTempIds,
        aliases,
      ),
    };
  }

  private createActions(
    value: unknown,
  ): readonly GeneratedCaseInvestigationAction[] {
    const payloadActions = readArray(value).map((action, actionIndex) =>
      this.readActionPayload(action, actionIndex),
    );

    const actions = payloadActions.map((action, actionIndex) =>
      this.createAction(action, actionIndex),
    );
    this.ensureUniqueActionTempIds(actions);
    this.ensureInitialActionExists(actions);

    return actions;
  }

  private createAction(
    payload: ActionPayload,
    actionIndex: number,
  ): GeneratedCaseInvestigationAction {
    return {
      actionType: this.readActionType(payload.actionType),
      // Legacy field name: generated value is seconds.
      baseDurationMinutes: this.readActionBaseDurationSeconds(
        payload.baseDurationMinutes,
      ),
      description: this.readText(
        payload.description,
        `actions[${actionIndex}].description`,
        MAX_DESCRIPTION_LENGTH,
      ),
      isInitiallyAvailable: readBoolean(payload.isInitiallyAvailable, false),
      metadata: this.readMetadata(
        payload.metadata,
        `actions[${actionIndex}].metadata`,
      ),
      minimumSkillLevel: this.readMinimumSkillLevel(payload.minimumSkillLevel),
      requiredSkill: this.readOptionalSkill(payload.requiredSkill),
      requiresDetective: readBoolean(payload.requiresDetective, true),
      tempId: this.readText(
        payload.tempId,
        `actions[${actionIndex}].tempId`,
        MAX_TEMP_ID_LENGTH,
      ),
      title: this.readText(
        payload.title,
        `actions[${actionIndex}].title`,
        MAX_TITLE_LENGTH,
      ),
    };
  }

  private createEvidenceUnlockRules(
    value: unknown,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly GeneratedEvidenceUnlockRule[] {
    return readArray(value).map((rule, ruleIndex) =>
      this.createEvidenceUnlockRule(
        this.readEvidenceRulePayload(rule, ruleIndex),
        ruleIndex,
        actionTempIds,
        aliases,
      ),
    );
  }

  private createEvidenceUnlockRule(
    payload: EvidenceUnlockRulePayload,
    ruleIndex: number,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): GeneratedEvidenceUnlockRule {
    const isGuaranteed = readBoolean(payload.isGuaranteed, false);

    return {
      actionTempId: this.readKnownActionTempId(
        payload.actionTempId,
        actionTempIds,
        `evidenceUnlockRules[${ruleIndex}].actionTempId`,
      ),
      durationModifierMinutes: this.readInteger(
        payload.durationModifierMinutes,
        0,
      ),
      evidenceId: this.readKnownEvidenceReference(
        this.readAliasOrLegacyId(payload.evidenceAlias, payload.evidenceId),
        aliases,
        `evidenceUnlockRules[${ruleIndex}].evidenceAlias`,
      ),
      isGuaranteed,
      minimumSkillLevel: this.readMinimumSkillLevel(payload.minimumSkillLevel),
      requiredSkill: this.readOptionalSkill(payload.requiredSkill),
      successChance: this.readSuccessChance(
        payload.successChance,
        isGuaranteed,
      ),
    };
  }

  private createStatementUnlockRules(
    value: unknown,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly GeneratedStatementUnlockRule[] {
    return readArray(value).map((rule, ruleIndex) =>
      this.createStatementUnlockRule(
        this.readStatementRulePayload(rule, ruleIndex),
        ruleIndex,
        actionTempIds,
        aliases,
      ),
    );
  }

  private createStatementUnlockRule(
    payload: StatementUnlockRulePayload,
    ruleIndex: number,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): GeneratedStatementUnlockRule {
    const isGuaranteed = readBoolean(payload.isGuaranteed, false);

    return {
      actionTempId: this.readKnownActionTempId(
        payload.actionTempId,
        actionTempIds,
        `statementUnlockRules[${ruleIndex}].actionTempId`,
      ),
      isGuaranteed,
      minimumSkillLevel: this.readMinimumSkillLevel(payload.minimumSkillLevel),
      requiredSkill: this.readOptionalSkill(payload.requiredSkill),
      statementId: this.readKnownStatementReference(
        this.readAliasOrLegacyId(payload.statementAlias, payload.statementId),
        aliases,
        `statementUnlockRules[${ruleIndex}].statementAlias`,
      ),
      successChance: this.readSuccessChance(
        payload.successChance,
        isGuaranteed,
      ),
    };
  }

  private createContradictionUnlockRules(
    value: unknown,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly GeneratedContradictionUnlockRule[] {
    return readArray(value).map((rule, ruleIndex) =>
      this.createContradictionUnlockRule(
        this.readContradictionRulePayload(rule, ruleIndex),
        ruleIndex,
        actionTempIds,
        aliases,
      ),
    );
  }

  private createContradictionUnlockRule(
    payload: ContradictionUnlockRulePayload,
    ruleIndex: number,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): GeneratedContradictionUnlockRule {
    const isGuaranteed = readBoolean(payload.isGuaranteed, false);

    return {
      actionTempId: this.readKnownActionTempId(
        payload.actionTempId,
        actionTempIds,
        `contradictionUnlockRules[${ruleIndex}].actionTempId`,
      ),
      contradictionId: this.readKnownContradictionReference(
        this.readAliasOrLegacyId(
          payload.contradictionAlias,
          payload.contradictionId,
        ),
        aliases,
        `contradictionUnlockRules[${ruleIndex}].contradictionAlias`,
      ),
      isGuaranteed,
      minimumSkillLevel: this.readMinimumSkillLevel(payload.minimumSkillLevel),
      requiredSkill: this.readOptionalSkill(payload.requiredSkill),
      successChance: this.readSuccessChance(
        payload.successChance,
        isGuaranteed,
      ),
    };
  }

  private createActionPrerequisites(
    value: unknown,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly GeneratedActionPrerequisite[] {
    return readArray(value).map((prerequisite, prerequisiteIndex) =>
      this.createActionPrerequisite(
        this.readPrerequisitePayload(prerequisite, prerequisiteIndex),
        prerequisiteIndex,
        actionTempIds,
        aliases,
      ),
    );
  }

  private createActionPrerequisite(
    payload: ActionPrerequisitePayload,
    prerequisiteIndex: number,
    actionTempIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): GeneratedActionPrerequisite {
    const prerequisite: GeneratedActionPrerequisite = {
      actionTempId: this.readKnownActionTempId(
        payload.actionTempId,
        actionTempIds,
        `actionPrerequisites[${prerequisiteIndex}].actionTempId`,
      ),
      prerequisiteActionTempId: this.readOptionalKnownActionTempId(
        payload.prerequisiteActionTempId,
        actionTempIds,
        `actionPrerequisites[${prerequisiteIndex}].prerequisiteActionTempId`,
      ),
      prerequisiteContradictionId: this.readOptionalKnownContradictionId(
        this.readAliasOrLegacyId(
          payload.prerequisiteContradictionAlias,
          payload.prerequisiteContradictionId,
        ),
        aliases,
        `actionPrerequisites[${prerequisiteIndex}].prerequisiteContradictionAlias`,
      ),
      prerequisiteEvidenceId: this.readOptionalKnownEvidenceId(
        this.readAliasOrLegacyId(
          payload.prerequisiteEvidenceAlias,
          payload.prerequisiteEvidenceId,
        ),
        aliases,
        `actionPrerequisites[${prerequisiteIndex}].prerequisiteEvidenceAlias`,
      ),
    };

    return prerequisite;
  }

  private validateGraphIntegrity(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    return [
      ...this.validateActionCount(content, input),
      ...this.validateUniqueUnlockRules(content),
      ...this.validateInterviewActionsTargetOneSuspect(content, input, aliases),
      ...this.validateEverySuspectHasInitialInterview(content, input, aliases),
      ...this.validateActionPrerequisiteTargets(content),
      ...this.validateNonInitialActionsHavePrerequisites(content),
      ...this.validateInitialActionsHaveNoPrerequisites(content),
      ...this.validateContradictionsReferenceKnownPieces(input, aliases),
    ];
  }

  private validateContentCanBeDiscovered(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    const reachableState = this.createReachableState(content, input, false);

    return [
      ...this.validateAllActionsCanBeReached(content, reachableState),
      ...this.validateAllEvidencesCanBeReached(input, reachableState, aliases),
      ...this.validateAllStatementsCanBeReached(input, reachableState, aliases),
      ...this.validateAllContradictionsCanBeReached(
        input,
        reachableState,
        aliases,
      ),
    ];
  }

  private validateMandatoryRequirementsAreGuaranteed(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    const reachableState = this.createReachableState(content, input, true);

    return input.requirements
      .filter((requirement) => requirement.isMandatory)
      .flatMap((requirement) => [
        ...this.validateRequiredEvidenceIsGuaranteed(
          requirement,
          reachableState,
          aliases,
        ),
        ...this.validateRequiredContradictionIsGuaranteed(
          requirement,
          reachableState,
          aliases,
        ),
      ]);
  }

  private createReachableState(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    guaranteedOnly: boolean,
  ): ReachableGraphState {
    const actionTempIds = new Set(
      content.actions
        .filter((action) => action.isInitiallyAvailable)
        .map((action) => action.tempId),
    );
    const evidenceIds = new Set(
      input.evidences
        .filter((evidence) => evidence.isInitiallyVisible)
        .map((evidence) => evidence.id),
    );
    const statementIds = new Set(
      input.statements
        .filter((statement) => statement.isInitiallyVisible)
        .map((statement) => statement.id),
    );
    const contradictionIds = new Set(
      input.contradictions
        .filter((contradiction) => contradiction.isInitiallyVisible)
        .map((contradiction) => contradiction.id),
    );

    let changed = true;
    while (changed) {
      changed = [
        this.addReachableEvidences(
          content,
          evidenceIds,
          actionTempIds,
          guaranteedOnly,
        ),
        this.addReachableStatements(
          content,
          statementIds,
          actionTempIds,
          guaranteedOnly,
        ),
        this.addReachableContradictions({
          actionTempIds,
          content,
          contradictionIds,
          evidenceIds,
          guaranteedOnly,
          input,
          statementIds,
        }),
        this.addReachableActions({
          actionTempIds,
          content,
          contradictionIds,
          evidenceIds,
        }),
      ].some(Boolean);
    }

    return {
      actionTempIds,
      contradictionIds,
      evidenceIds,
      statementIds,
    };
  }

  private addReachableEvidences(
    content: GeneratedCaseInvestigationGraphContent,
    evidenceIds: Set<string>,
    actionTempIds: ReadonlySet<string>,
    guaranteedOnly: boolean,
  ): boolean {
    return this.addReachableIds(
      content.evidenceUnlockRules,
      evidenceIds,
      actionTempIds,
      guaranteedOnly,
      (rule) => rule.evidenceId,
    );
  }

  private addReachableStatements(
    content: GeneratedCaseInvestigationGraphContent,
    statementIds: Set<string>,
    actionTempIds: ReadonlySet<string>,
    guaranteedOnly: boolean,
  ): boolean {
    return this.addReachableIds(
      content.statementUnlockRules,
      statementIds,
      actionTempIds,
      guaranteedOnly,
      (rule) => rule.statementId,
    );
  }

  private addReachableContradictions(
    command: AddReachableContradictionsCommand,
  ): boolean {
    let changed = false;

    command.content.contradictionUnlockRules.forEach((rule) => {
      if (
        !this.canApplyUnlockRule(
          rule,
          command.actionTempIds,
          command.guaranteedOnly,
        )
      ) {
        return;
      }

      if (!this.canDiscoverContradiction(rule.contradictionId, command)) {
        return;
      }

      if (!command.contradictionIds.has(rule.contradictionId)) {
        command.contradictionIds.add(rule.contradictionId);
        changed = true;
      }
    });

    return changed;
  }

  private addReachableActions(command: AddReachableActionsCommand): boolean {
    let changed = false;

    command.content.actions.forEach((action) => {
      if (command.actionTempIds.has(action.tempId)) {
        return;
      }

      if (!this.arePrerequisitesMet(action.tempId, command)) {
        return;
      }

      command.actionTempIds.add(action.tempId);
      changed = true;
    });

    return changed;
  }

  private addReachableIds<
    TRule extends {
      readonly actionTempId: string;
      readonly isGuaranteed: boolean;
    },
  >(
    rules: readonly TRule[],
    targetIds: Set<string>,
    actionTempIds: ReadonlySet<string>,
    guaranteedOnly: boolean,
    readTargetId: (rule: TRule) => string,
  ): boolean {
    let changed = false;

    rules.forEach((rule) => {
      if (!this.canApplyUnlockRule(rule, actionTempIds, guaranteedOnly)) {
        return;
      }

      const targetId = readTargetId(rule);
      if (!targetIds.has(targetId)) {
        targetIds.add(targetId);
        changed = true;
      }
    });

    return changed;
  }

  private canApplyUnlockRule(
    rule: { readonly actionTempId: string; readonly isGuaranteed: boolean },
    actionTempIds: ReadonlySet<string>,
    guaranteedOnly: boolean,
  ): boolean {
    return (
      actionTempIds.has(rule.actionTempId) &&
      (!guaranteedOnly || rule.isGuaranteed)
    );
  }

  private canDiscoverContradiction(
    contradictionId: string,
    command: AddReachableContradictionsCommand,
  ): boolean {
    const contradiction = command.input.contradictions.find(
      (candidate) => candidate.id === contradictionId,
    );

    return Boolean(
      contradiction &&
      command.statementIds.has(contradiction.statementId) &&
      command.evidenceIds.has(contradiction.refutingEvidenceId),
    );
  }

  private arePrerequisitesMet(
    actionTempId: string,
    command: AddReachableActionsCommand,
  ): boolean {
    const prerequisites = command.content.actionPrerequisites.filter(
      (prerequisite) => prerequisite.actionTempId === actionTempId,
    );

    if (prerequisites.length === 0) {
      return false;
    }

    return prerequisites.every((prerequisite) =>
      this.isPrerequisiteMet(prerequisite, command),
    );
  }

  private isPrerequisiteMet(
    prerequisite: GeneratedActionPrerequisite,
    command: AddReachableActionsCommand,
  ): boolean {
    if (prerequisite.prerequisiteActionTempId) {
      return command.actionTempIds.has(prerequisite.prerequisiteActionTempId);
    }

    if (prerequisite.prerequisiteEvidenceId) {
      return command.evidenceIds.has(prerequisite.prerequisiteEvidenceId);
    }

    if (prerequisite.prerequisiteContradictionId) {
      return command.contradictionIds.has(
        prerequisite.prerequisiteContradictionId,
      );
    }

    return false;
  }

  private validateRequiredEvidenceIsGuaranteed(
    requirement: GenerateCaseInvestigationGraphInput['requirements'][number],
    reachableState: ReachableGraphState,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    if (!requirement.requiredEvidenceId) {
      return [];
    }

    if (reachableState.evidenceIds.has(requirement.requiredEvidenceId)) {
      return [];
    }

    const evidenceAlias = this.findAliasOrId(
      aliases.evidences,
      requirement.requiredEvidenceId,
    );

    return [
      this.createValidationIssue(
        'mandatory_evidence_not_guaranteed',
        `La evidencia obligatoria ${evidenceAlias} no tiene una ruta garantizada. Aliases permitidos: ${formatAllowedAliases(aliases.evidences)}.`,
        `requirements.${this.findAliasOrId(aliases.requirements, requirement.id)}`,
      ),
    ];
  }

  private validateRequiredContradictionIsGuaranteed(
    requirement: GenerateCaseInvestigationGraphInput['requirements'][number],
    reachableState: ReachableGraphState,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    if (!requirement.requiredContradictionId) {
      return [];
    }

    if (
      reachableState.contradictionIds.has(requirement.requiredContradictionId)
    ) {
      return [];
    }

    const contradictionAlias = this.findAliasOrId(
      aliases.contradictions,
      requirement.requiredContradictionId,
    );

    return [
      this.createValidationIssue(
        'mandatory_contradiction_not_guaranteed',
        `La contradiccion obligatoria ${contradictionAlias} no tiene una ruta garantizada. Aliases permitidos: ${formatAllowedAliases(aliases.contradictions)}.`,
        `requirements.${this.findAliasOrId(aliases.requirements, requirement.id)}`,
      ),
    ];
  }

  private validateAllActionsCanBeReached(
    content: GeneratedCaseInvestigationGraphContent,
    reachableState: ReachableGraphState,
  ): readonly InvestigationGraphValidationIssue[] {
    return content.actions
      .filter((action) => !reachableState.actionTempIds.has(action.tempId))
      .map((action) =>
        this.createValidationIssue(
          'unreachable_action',
          `La accion ${action.tempId} no es alcanzable desde el inicio.`,
          `actions.${action.tempId}`,
        ),
      );
  }

  private validateAllEvidencesCanBeReached(
    input: GenerateCaseInvestigationGraphInput,
    reachableState: ReachableGraphState,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    return input.evidences
      .filter((evidence) => !reachableState.evidenceIds.has(evidence.id))
      .map((evidence) =>
        this.createValidationIssue(
          'unreachable_evidence',
          `La evidencia ${this.findAliasOrId(
            aliases.evidences,
            evidence.id,
          )} no queda descubierta por el grafo. Aliases permitidos: ${formatAllowedAliases(aliases.evidences)}.`,
          `evidences.${this.findAliasOrId(aliases.evidences, evidence.id)}`,
        ),
      );
  }

  private validateAllStatementsCanBeReached(
    input: GenerateCaseInvestigationGraphInput,
    reachableState: ReachableGraphState,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    return input.statements
      .filter((statement) => !reachableState.statementIds.has(statement.id))
      .map((statement) =>
        this.createValidationIssue(
          'unreachable_statement',
          `La declaracion ${this.findAliasOrId(
            aliases.statements,
            statement.id,
          )} no queda descubierta por el grafo. Aliases permitidos: ${formatAllowedAliases(aliases.statements)}.`,
          `statements.${this.findAliasOrId(aliases.statements, statement.id)}`,
        ),
      );
  }

  private validateAllContradictionsCanBeReached(
    input: GenerateCaseInvestigationGraphInput,
    reachableState: ReachableGraphState,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    return input.contradictions
      .filter(
        (contradiction) =>
          !reachableState.contradictionIds.has(contradiction.id),
      )
      .map((contradiction) =>
        this.createValidationIssue(
          'unreachable_contradiction',
          `La contradiccion ${this.findAliasOrId(
            aliases.contradictions,
            contradiction.id,
          )} no queda descubierta por el grafo. Aliases permitidos: ${formatAllowedAliases(aliases.contradictions)}.`,
          `contradictions.${this.findAliasOrId(
            aliases.contradictions,
            contradiction.id,
          )}`,
        ),
      );
  }

  private validateUniqueUnlockRules(
    content: GeneratedCaseInvestigationGraphContent,
  ): readonly InvestigationGraphValidationIssue[] {
    return [
      ...this.validateUniquePairs(
        content.evidenceUnlockRules,
        (rule) => `${rule.actionTempId}:${rule.evidenceId}`,
        'evidencia',
        'evidenceUnlockRules',
      ),
      ...this.validateUniquePairs(
        content.statementUnlockRules,
        (rule) => `${rule.actionTempId}:${rule.statementId}`,
        'declaracion',
        'statementUnlockRules',
      ),
      ...this.validateUniquePairs(
        content.contradictionUnlockRules,
        (rule) => `${rule.actionTempId}:${rule.contradictionId}`,
        'contradiccion',
        'contradictionUnlockRules',
      ),
    ];
  }

  private validateActionCount(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
  ): readonly InvestigationGraphValidationIssue[] {
    const budget = createInvestigationGraphActionBudget(input);

    if (
      content.actions.length >= budget.min &&
      content.actions.length <= budget.max
    ) {
      return [];
    }

    return [
      this.createValidationIssue(
        'action_count_outside_budget',
        `La IA devolvio ${content.actions.length} acciones para dificultad ${input.difficulty} y densidad del caso; el rango permitido es ${budget.min}-${budget.max}. ${describeInvestigationGraphActionBudget(budget)}`,
        'actions',
      ),
    ];
  }

  private validateInterviewActionsTargetOneSuspect(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    return content.actions
      .filter((action) => action.actionType === 'interview')
      .flatMap((action) =>
        this.validateInterviewActionTarget(action, content, input, aliases),
      );
  }

  private validateInterviewActionTarget(
    action: GeneratedCaseInvestigationAction,
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    const suspectIds = this.findInterviewActionSuspectIds(
      action.tempId,
      content,
      input,
    );

    if (suspectIds.size === 1) {
      return [];
    }

    return [
      this.createValidationIssue(
        'interview_action_without_single_suspect',
        this.createInterviewActionTargetMessage(action.tempId, suspectIds, aliases),
        `actions.${action.tempId}`,
      ),
    ];
  }

  private validateEverySuspectHasInitialInterview(
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    return input.suspects.flatMap((suspect) => {
      if (this.hasInitialInterviewForSuspect(suspect.id, content, input)) {
        return [];
      }

      const suspectAlias = this.findAliasOrId(aliases.suspects, suspect.id);

      return [
        this.createValidationIssue(
          'missing_initial_suspect_interview',
          `El sospechoso ${suspectAlias} no tiene una accion interview inicial propia. Debe existir una accion inicial actionType="interview" que desbloquee solo su declaracion.`,
          `suspects.${suspectAlias}`,
        ),
      ];
    });
  }

  private hasInitialInterviewForSuspect(
    suspectId: string,
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
  ): boolean {
    return content.actions
      .filter(
        (action) =>
          action.actionType === 'interview' && action.isInitiallyAvailable,
      )
      .some((action) =>
        this.findInterviewActionSuspectIds(
          action.tempId,
          content,
          input,
        ).has(suspectId),
      );
  }

  private findInterviewActionSuspectIds(
    actionTempId: string,
    content: GeneratedCaseInvestigationGraphContent,
    input: GenerateCaseInvestigationGraphInput,
  ): ReadonlySet<string> {
    const suspectIdByStatementId = this.createSuspectIdByStatementId(input);
    const suspectIds = new Set<string>();

    content.statementUnlockRules
      .filter((rule) => rule.actionTempId === actionTempId)
      .forEach((rule) => {
        const suspectId = suspectIdByStatementId.get(rule.statementId);

        if (suspectId) {
          suspectIds.add(suspectId);
        }
      });

    return suspectIds;
  }

  private createSuspectIdByStatementId(
    input: GenerateCaseInvestigationGraphInput,
  ): ReadonlyMap<string, string> {
    return new Map(
      input.statements
        .filter((statement) => Boolean(statement.suspectId))
        .map((statement) => [statement.id, statement.suspectId as string]),
    );
  }

  private createInterviewActionTargetMessage(
    actionTempId: string,
    suspectIds: ReadonlySet<string>,
    aliases: InvestigationGraphAliasCatalog,
  ): string {
    if (suspectIds.size === 0) {
      return `La accion interview ${actionTempId} debe desbloquear declaraciones de exactamente un sospechoso.`;
    }

    const suspectAliases = [...suspectIds]
      .map((suspectId) => this.findAliasOrId(aliases.suspects, suspectId))
      .join(', ');

    return `La accion interview ${actionTempId} no puede entrevistar a mas de un sospechoso; desbloquea declaraciones de ${suspectAliases}. Crea una accion interview separada por sospechoso.`;
  }

  private validateUniquePairs<TRule>(
    rules: readonly TRule[],
    createKey: (rule: TRule) => string,
    label: string,
    path: string,
  ): readonly InvestigationGraphValidationIssue[] {
    const seenKeys = new Set<string>();
    const issues: InvestigationGraphValidationIssue[] = [];

    rules.forEach((rule, index) => {
      const key = createKey(rule);

      if (seenKeys.has(key)) {
        issues.push(
          this.createValidationIssue(
            'duplicate_unlock_rule',
            `La IA devolvio una regla duplicada de ${label}: ${key}.`,
            `${path}[${index}]`,
          ),
        );
      }

      seenKeys.add(key);
    });

    return issues;
  }

  private validateActionPrerequisiteTargets(
    content: GeneratedCaseInvestigationGraphContent,
  ): readonly InvestigationGraphValidationIssue[] {
    return content.actionPrerequisites.flatMap((prerequisite, index) => [
      ...this.validateActionPrerequisiteHasOneTarget(prerequisite, index),
      ...this.validateActionPrerequisiteDoesNotReferenceItself(
        prerequisite,
        index,
      ),
    ]);
  }

  private validateActionPrerequisiteHasOneTarget(
    prerequisite: GeneratedActionPrerequisite,
    index: number,
  ): readonly InvestigationGraphValidationIssue[] {
    const targetCount = this.countPrerequisiteTargets(prerequisite);

    if (targetCount === 1) {
      return [];
    }

    return [
      this.createValidationIssue(
        'invalid_prerequisite_target',
        `El prerequisito de ${prerequisite.actionTempId} debe tener exactamente un objetivo.`,
        `actionPrerequisites[${index}]`,
      ),
    ];
  }

  private validateActionPrerequisiteDoesNotReferenceItself(
    prerequisite: GeneratedActionPrerequisite,
    index: number,
  ): readonly InvestigationGraphValidationIssue[] {
    if (prerequisite.actionTempId !== prerequisite.prerequisiteActionTempId) {
      return [];
    }

    return [
      this.createValidationIssue(
        'self_referencing_prerequisite',
        `La accion ${prerequisite.actionTempId} no puede depender de si misma.`,
        `actionPrerequisites[${index}]`,
      ),
    ];
  }

  private validateNonInitialActionsHavePrerequisites(
    content: GeneratedCaseInvestigationGraphContent,
  ): readonly InvestigationGraphValidationIssue[] {
    const actionIdsWithPrerequisites = new Set(
      content.actionPrerequisites.map(
        (prerequisite) => prerequisite.actionTempId,
      ),
    );

    return content.actions
      .filter(
        (action) =>
          !action.isInitiallyAvailable &&
          !actionIdsWithPrerequisites.has(action.tempId),
      )
      .map((action) =>
        this.createValidationIssue(
          'non_initial_action_without_prerequisite',
          `La accion no inicial ${action.tempId} no tiene prerequisitos.`,
          `actions.${action.tempId}`,
        ),
      );
  }

  private validateInitialActionsHaveNoPrerequisites(
    content: GeneratedCaseInvestigationGraphContent,
  ): readonly InvestigationGraphValidationIssue[] {
    const initialActionTempIds = new Set(
      content.actions
        .filter((action) => action.isInitiallyAvailable)
        .map((action) => action.tempId),
    );

    return content.actionPrerequisites.flatMap((prerequisite, index) => {
      if (!initialActionTempIds.has(prerequisite.actionTempId)) {
        return [];
      }

      return [
        this.createValidationIssue(
          'initial_action_with_prerequisite',
          `La accion inicial ${prerequisite.actionTempId} no debe tener prerequisitos.`,
          `actionPrerequisites[${index}]`,
        ),
      ];
    });
  }

  private validateContradictionsReferenceKnownPieces(
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly InvestigationGraphValidationIssue[] {
    const evidenceIds = new Set(input.evidences.map((evidence) => evidence.id));
    const statementIds = new Set(
      input.statements.map((statement) => statement.id),
    );
    const issues: InvestigationGraphValidationIssue[] = [];

    input.contradictions.forEach((contradiction) => {
      const contradictionAlias = this.findAliasOrId(
        aliases.contradictions,
        contradiction.id,
      );

      if (!statementIds.has(contradiction.statementId)) {
        issues.push(
          this.createValidationIssue(
            'contradiction_external_statement',
            `La contradiccion ${contradictionAlias} apunta a un statement externo. Aliases permitidos: ${formatAllowedAliases(aliases.statements)}.`,
            `contradictions.${contradictionAlias}`,
          ),
        );
      }

      if (!evidenceIds.has(contradiction.refutingEvidenceId)) {
        issues.push(
          this.createValidationIssue(
            'contradiction_external_evidence',
            `La contradiccion ${contradictionAlias} apunta a una evidencia externa. Aliases permitidos: ${formatAllowedAliases(aliases.evidences)}.`,
            `contradictions.${contradictionAlias}`,
          ),
        );
      }
    });

    return issues;
  }

  private ensureUniqueActionTempIds(
    actions: readonly GeneratedCaseInvestigationAction[],
  ): void {
    const tempIds = new Set<string>();

    actions.forEach((action) => {
      if (tempIds.has(action.tempId)) {
        throw this.createInvalidGraphError(
          `La IA devolvio una accion duplicada con tempId ${action.tempId}.`,
        );
      }

      tempIds.add(action.tempId);
    });
  }

  private ensureInitialActionExists(
    actions: readonly GeneratedCaseInvestigationAction[],
  ): void {
    if (!actions.some((action) => action.isInitiallyAvailable)) {
      throw this.createInvalidGraphError(
        'La IA no devolvio ninguna accion inicial.',
      );
    }
  }

  private countPrerequisiteTargets(
    prerequisite: GeneratedActionPrerequisite,
  ): number {
    return [
      prerequisite.prerequisiteActionTempId,
      prerequisite.prerequisiteContradictionId,
      prerequisite.prerequisiteEvidenceId,
    ].filter(Boolean).length;
  }

  private readActionPayload(
    value: unknown,
    actionIndex: number,
  ): ActionPayload {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidGraphError(
      `La accion ${actionIndex + 1} no es un objeto valido.`,
    );
  }

  private readEvidenceRulePayload(
    value: unknown,
    ruleIndex: number,
  ): EvidenceUnlockRulePayload {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidGraphError(
      `La regla de evidencia ${ruleIndex + 1} no es un objeto valido.`,
    );
  }

  private readStatementRulePayload(
    value: unknown,
    ruleIndex: number,
  ): StatementUnlockRulePayload {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidGraphError(
      `La regla de declaracion ${ruleIndex + 1} no es un objeto valido.`,
    );
  }

  private readContradictionRulePayload(
    value: unknown,
    ruleIndex: number,
  ): ContradictionUnlockRulePayload {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidGraphError(
      `La regla de contradiccion ${ruleIndex + 1} no es un objeto valido.`,
    );
  }

  private readPrerequisitePayload(
    value: unknown,
    prerequisiteIndex: number,
  ): ActionPrerequisitePayload {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidGraphError(
      `El prerequisito ${prerequisiteIndex + 1} no es un objeto valido.`,
    );
  }

  private readActionType(value: unknown): AdminActionType {
    if (typeof value === 'string') {
      const normalizedActionType = normalizeAdminActionType(value);

      if (normalizedActionType) {
        return normalizedActionType;
      }
    }

    throw this.createInvalidGraphError(
      `La IA devolvio un actionType invalido: ${String(value)}. Valores permitidos: ${ADMIN_ACTION_TYPES.join(', ')}.`,
    );
  }

  private readOptionalSkill(value: unknown): AdminSkillType | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (
      typeof value === 'string' &&
      ADMIN_SKILL_TYPES.includes(value as AdminSkillType)
    ) {
      return value as AdminSkillType;
    }

    throw this.createInvalidGraphError(
      `La IA devolvio un requiredSkill invalido: ${String(value)}.`,
    );
  }

  private readKnownActionTempId(
    value: unknown,
    actionTempIds: ReadonlySet<string>,
    fieldPath: string,
  ): string {
    const actionTempId = this.readText(value, fieldPath, MAX_TEMP_ID_LENGTH);

    if (!actionTempIds.has(actionTempId)) {
      throw this.createInvalidGraphError(
        `La IA devolvio un actionTempId desconocido en ${fieldPath}. Valor recibido: ${this.describeInvalidValue(value)}.`,
      );
    }

    return actionTempId;
  }

  private readOptionalKnownActionTempId(
    value: unknown,
    actionTempIds: ReadonlySet<string>,
    fieldPath: string,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return this.readKnownActionTempId(value, actionTempIds, fieldPath);
  }

  private readKnownEvidenceReference(
    value: unknown,
    aliases: InvestigationGraphAliasCatalog,
    fieldPath: string,
  ): string {
    return this.readKnownEntityReference({
      fieldPath,
      label: 'evidencia',
      references: aliases.evidences,
      value,
    });
  }

  private readOptionalKnownEvidenceId(
    value: unknown,
    aliases: InvestigationGraphAliasCatalog,
    fieldPath: string,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return this.readKnownEvidenceReference(value, aliases, fieldPath);
  }

  private readKnownStatementReference(
    value: unknown,
    aliases: InvestigationGraphAliasCatalog,
    fieldPath: string,
  ): string {
    return this.readKnownEntityReference({
      fieldPath,
      label: 'declaracion',
      references: aliases.statements,
      value,
    });
  }

  private readKnownContradictionReference(
    value: unknown,
    aliases: InvestigationGraphAliasCatalog,
    fieldPath: string,
  ): string {
    return this.readKnownEntityReference({
      fieldPath,
      label: 'contradiccion',
      references: aliases.contradictions,
      value,
    });
  }

  private readOptionalKnownContradictionId(
    value: unknown,
    aliases: InvestigationGraphAliasCatalog,
    fieldPath: string,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return this.readKnownContradictionReference(value, aliases, fieldPath);
  }

  private readKnownEntityReference(command: {
    readonly fieldPath: string;
    readonly label: string;
    readonly references: readonly InvestigationGraphAliasReference[];
    readonly value: unknown;
  }): string {
    const aliasOrId = this.readText(
      command.value,
      command.fieldPath,
      MAX_TEMP_ID_LENGTH,
    );
    const id = resolveIdFromAliasOrId(command.references, aliasOrId);

    if (!id) {
      throw this.createInvalidGraphError(
        `La IA devolvio un alias de ${command.label} invalido en ${command.fieldPath}. Valor recibido: ${this.describeInvalidValue(command.value)}. Aliases permitidos: ${formatAllowedAliases(command.references)}.`,
      );
    }

    return id;
  }

  private readAliasOrLegacyId(alias: unknown, legacyId: unknown): unknown {
    return alias ?? legacyId;
  }

  private findAliasOrId(
    references: readonly InvestigationGraphAliasReference[],
    id: string | undefined,
  ): string {
    return findAliasById(references, id) ?? id ?? 'desconocido';
  }

  private readText(
    value: unknown,
    fieldPath: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.createInvalidGraphError(
        `La IA no devolvio un valor valido para ${fieldPath}. Valor recibido: ${this.describeInvalidValue(value)}.`,
      );
    }

    return value.trim().slice(0, maxLength);
  }

  private readActionBaseDurationSeconds(value: unknown): number {
    return Math.min(
      MAX_ACTION_BASE_DURATION_SECONDS,
      Math.max(
        MIN_ACTION_BASE_DURATION_SECONDS,
        this.readInteger(value, DEFAULT_ACTION_BASE_DURATION_SECONDS),
      ),
    );
  }

  private readMinimumSkillLevel(value: unknown): number {
    return Math.min(
      MAXIMUM_SKILL_LEVEL,
      Math.max(
        MINIMUM_SKILL_LEVEL,
        this.readInteger(value, MINIMUM_SKILL_LEVEL),
      ),
    );
  }

  private readSuccessChance(value: unknown, isGuaranteed: boolean): number {
    if (isGuaranteed) {
      return MAX_SUCCESS_CHANCE;
    }

    return Math.min(
      MAX_SUCCESS_CHANCE,
      Math.max(
        MIN_SUCCESS_CHANCE,
        readNumber(value, DEFAULT_OPTIONAL_SUCCESS_CHANCE),
      ),
    );
  }

  private readInteger(value: unknown, fallback: number): number {
    return Math.round(readNumber(value, fallback));
  }

  private readMetadata(
    value: unknown,
    fieldPath: string,
  ): ActionOperationalMetadata {
    const metadata = this.readRecord(value, fieldPath);

    return {
      ...metadata,
      operationalProfile: this.readOperationalProfile(
        metadata.operationalProfile,
        `${fieldPath}.operationalProfile`,
      ),
    };
  }

  private readOperationalProfile(
    value: unknown,
    fieldPath: string,
  ): ActionOperationalProfile {
    const profile = this.readRecord(value, fieldPath);

    return {
      accelerationEligible: this.readAccelerationTypes(
        profile.accelerationEligible,
        `${fieldPath}.accelerationEligible`,
      ),
      category: this.readOperationalCategory(profile.category, fieldPath),
      fatiguePressure: this.readSensitivity(
        profile.fatiguePressure,
        `${fieldPath}.fatiguePressure`,
      ),
      institutionalAccess: this.readOptionalInstitutionalAccess(
        profile.institutionalAccess,
        `${fieldPath}.institutionalAccess`,
      ),
      reportQualitySensitivity: this.readSensitivity(
        profile.reportQualitySensitivity,
        `${fieldPath}.reportQualitySensitivity`,
      ),
      riskProfile: this.readOptionalRiskProfile(
        profile.riskProfile,
        `${fieldPath}.riskProfile`,
      ),
    };
  }

  private readRecord(
    value: unknown,
    fieldPath: string,
  ): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }

    throw this.createInvalidGraphError(
      `La IA no devolvio un objeto valido para ${fieldPath}. Valor recibido: ${this.describeInvalidValue(value)}.`,
    );
  }

  private readOperationalCategory(
    value: unknown,
    fieldPath: string,
  ): ActionOperationalCategory {
    if (
      typeof value === 'string' &&
      ACTION_OPERATIONAL_CATEGORIES.includes(value as ActionOperationalCategory)
    ) {
      return value as ActionOperationalCategory;
    }

    throw this.createInvalidGraphError(
      `La IA devolvio una categoria operativa invalida en ${fieldPath}.category.`,
    );
  }

  private readSensitivity(
    value: unknown,
    fieldPath: string,
  ): ActionOperationalProfile['fatiguePressure'] {
    if (
      typeof value === 'string' &&
      OPERATIONAL_SENSITIVITIES.includes(
        value as ActionOperationalProfile['fatiguePressure'],
      )
    ) {
      return value as ActionOperationalProfile['fatiguePressure'];
    }

    throw this.createInvalidGraphError(
      `La IA devolvio una sensibilidad operativa invalida en ${fieldPath}.`,
    );
  }

  private readAccelerationTypes(
    value: unknown,
    fieldPath: string,
  ): readonly InvestigationAccelerationType[] {
    const types = readArray(value).map((item) =>
      this.readAccelerationType(item, fieldPath),
    );

    return [...new Set(types)];
  }

  private readAccelerationType(
    value: unknown,
    fieldPath: string,
  ): InvestigationAccelerationType {
    if (
      typeof value === 'string' &&
      INVESTIGATION_ACCELERATION_TYPES.includes(
        value as InvestigationAccelerationType,
      )
    ) {
      return value as InvestigationAccelerationType;
    }

    throw this.createInvalidGraphError(
      `La IA devolvio un acelerador invalido en ${fieldPath}.`,
    );
  }

  private readOptionalInstitutionalAccess(
    value: unknown,
    fieldPath: string,
  ): InstitutionalAccess | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (
      typeof value === 'string' &&
      INSTITUTIONAL_ACCESSES.includes(value as InstitutionalAccess)
    ) {
      return value as InstitutionalAccess;
    }

    throw this.createInvalidGraphError(
      `La IA devolvio un acceso institucional invalido en ${fieldPath}.`,
    );
  }

  private readOptionalRiskProfile(
    value: unknown,
    fieldPath: string,
  ): ActionOperationalProfile['riskProfile'] {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (
      typeof value === 'string' &&
      RISK_PROFILES.includes(value as NonNullable<ActionOperationalProfile['riskProfile']>)
    ) {
      return value as ActionOperationalProfile['riskProfile'];
    }

    throw this.createInvalidGraphError(
      `La IA devolvio un perfil de riesgo invalido en ${fieldPath}.`,
    );
  }

  private throwWhenValidationFails(
    report: InvestigationGraphValidationReport,
  ): void {
    if (report.isValid) {
      return;
    }

    throw this.createInvalidGraphError(this.createValidationSummary(report));
  }

  private createValidationSummary(
    report: InvestigationGraphValidationReport,
  ): string {
    if (report.issues.length === 1) {
      return report.issues[0].message;
    }

    return [
      `La IA devolvio un grafo invalido con ${report.issues.length} problemas.`,
      ...report.issues.map((issue) => issue.message),
    ].join(' ');
  }

  private createValidationIssue(
    code: InvestigationGraphValidationIssueCode,
    message: string,
    path?: string,
  ): InvestigationGraphValidationIssue {
    return {
      code,
      message,
      path,
    };
  }

  private createInvalidGraphError(detail: string): AiProviderRequestError {
    return AiProviderRequestError.retryable(
      'invalid_generated_investigation_graph',
      undefined,
      detail,
    );
  }

  private describeInvalidValue(value: unknown): string {
    if (value === undefined) {
      return 'undefined';
    }

    try {
      return JSON.stringify(value)?.slice(0, 500) ?? String(value);
    } catch {
      return String(value);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}

interface AddReachableActionsCommand {
  readonly actionTempIds: Set<string>;
  readonly content: GeneratedCaseInvestigationGraphContent;
  readonly contradictionIds: ReadonlySet<string>;
  readonly evidenceIds: ReadonlySet<string>;
}

interface AddReachableContradictionsCommand {
  readonly actionTempIds: ReadonlySet<string>;
  readonly content: GeneratedCaseInvestigationGraphContent;
  readonly contradictionIds: Set<string>;
  readonly evidenceIds: ReadonlySet<string>;
  readonly guaranteedOnly: boolean;
  readonly input: GenerateCaseInvestigationGraphInput;
  readonly statementIds: ReadonlySet<string>;
}
