import type {
  AdminActionPrerequisiteRecord,
  AdminContradictionRecord,
  AdminContradictionUnlockRuleRecord,
  AdminEvidenceRecord,
  AdminEvidenceUnlockRuleRecord,
  AdminInvestigationActionRecord,
  AdminStatementRecord,
  AdminStatementUnlockRuleRecord,
  CasePlayabilitySnapshot,
} from '../cases.repository';

export type AdminInvestigationGraphNodeType =
  | 'action'
  | 'contradiction'
  | 'evidence'
  | 'statement';

export type AdminInvestigationGraphEdgeType =
  | 'action_prerequisite'
  | 'contradiction_prerequisite'
  | 'evidence_prerequisite'
  | 'invalid_prerequisite'
  | 'unlock_contradiction'
  | 'unlock_evidence'
  | 'unlock_statement';

export interface AdminInvestigationGraphNodeDto {
  readonly description?: string;
  readonly id: string;
  readonly isInitial: boolean;
  readonly label: string;
  readonly metadata: Record<string, unknown>;
  readonly nodeType: AdminInvestigationGraphNodeType;
}

export interface AdminInvestigationGraphActionDto extends AdminInvestigationGraphNodeDto {
  readonly actionType: string;
  readonly baseDurationMinutes: number;
  readonly caseId: string;
  readonly createdAt: string;
  readonly minimumSkillLevel: number;
  readonly prerequisiteIds: readonly string[];
  readonly requiredSkill?: string;
  readonly requiresDetective: boolean;
  readonly unlockIds: readonly string[];
}

export interface AdminInvestigationGraphResourceDto extends AdminInvestigationGraphNodeDto {
  readonly caseId: string;
  readonly createdAt: string;
  readonly resourceType: 'contradiction' | 'evidence' | 'statement';
}

export interface AdminInvestigationGraphEdgeDto {
  readonly edgeType: AdminInvestigationGraphEdgeType;
  readonly fromId: string;
  readonly fromNodeType: AdminInvestigationGraphNodeType;
  readonly id: string;
  readonly isGuaranteed?: boolean;
  readonly minimumSkillLevel?: number;
  readonly requiredSkill?: string;
  readonly successChance?: number;
  readonly toId: string;
  readonly toNodeType: AdminInvestigationGraphNodeType;
}

export interface AdminInvestigationGraphUnlockRulesDto {
  readonly contradictions: readonly AdminContradictionUnlockRuleDto[];
  readonly evidences: readonly AdminEvidenceUnlockRuleDto[];
  readonly statements: readonly AdminStatementUnlockRuleDto[];
}

export interface AdminEvidenceUnlockRuleDto {
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

export interface AdminStatementUnlockRuleDto {
  readonly actionId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly statementId: string;
  readonly successChance: number;
}

export interface AdminContradictionUnlockRuleDto {
  readonly actionId: string;
  readonly contradictionId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isGuaranteed: boolean;
  readonly minimumSkillLevel: number;
  readonly requiredSkill?: string;
  readonly successChance: number;
}

export interface AdminActionPrerequisiteDto {
  readonly actionId: string;
  readonly createdAt: string;
  readonly id: string;
  readonly prerequisiteActionId?: string;
  readonly prerequisiteContradictionId?: string;
  readonly prerequisiteEvidenceId?: string;
}

export interface AdminCaseInvestigationGraphResourcesDto {
  readonly contradictions: readonly AdminInvestigationGraphResourceDto[];
  readonly evidences: readonly AdminInvestigationGraphResourceDto[];
  readonly statements: readonly AdminInvestigationGraphResourceDto[];
}

export interface AdminCaseInvestigationGraphResponseDto {
  readonly actionPrerequisites: readonly AdminActionPrerequisiteDto[];
  readonly actions: readonly AdminInvestigationGraphActionDto[];
  readonly caseId: string;
  readonly edges: readonly AdminInvestigationGraphEdgeDto[];
  readonly resources: AdminCaseInvestigationGraphResourcesDto;
  readonly status: string;
  readonly unlockRules: AdminInvestigationGraphUnlockRulesDto;
}

interface ActionGraphRelations {
  readonly prerequisitesByActionId: ReadonlyMap<string, readonly string[]>;
  readonly unlocksByActionId: ReadonlyMap<string, readonly string[]>;
}

export function createAdminCaseInvestigationGraphResponse(
  snapshot: CasePlayabilitySnapshot,
): AdminCaseInvestigationGraphResponseDto {
  const edges = createGraphEdges(snapshot);
  const relations = createActionGraphRelations(edges);

  return {
    actionPrerequisites: snapshot.actionPrerequisites.map(
      createActionPrerequisite,
    ),
    actions: snapshot.actions.map((action) =>
      createActionNode(action, relations),
    ),
    caseId: snapshot.caseRecord.id,
    edges,
    resources: {
      contradictions: snapshot.contradictions.map(createContradictionNode),
      evidences: snapshot.evidences.map(createEvidenceNode),
      statements: snapshot.statements.map(createStatementNode),
    },
    status: snapshot.caseRecord.status,
    unlockRules: {
      contradictions: snapshot.contradictionUnlockRules.map(
        createContradictionUnlockRule,
      ),
      evidences: snapshot.evidenceUnlockRules.map(createEvidenceUnlockRule),
      statements: snapshot.statementUnlockRules.map(createStatementUnlockRule),
    },
  };
}

function createActionNode(
  action: AdminInvestigationActionRecord,
  relations: ActionGraphRelations,
): AdminInvestigationGraphActionDto {
  return {
    actionType: action.actionType,
    baseDurationMinutes: action.baseDurationMinutes,
    caseId: action.caseId,
    createdAt: action.createdAt,
    description: action.description,
    id: action.id,
    isInitial: action.isInitiallyAvailable,
    label: action.title,
    metadata: action.metadata,
    minimumSkillLevel: action.minimumSkillLevel,
    nodeType: 'action',
    prerequisiteIds: relations.prerequisitesByActionId.get(action.id) ?? [],
    requiredSkill: action.requiredSkill,
    requiresDetective: action.requiresDetective,
    unlockIds: relations.unlocksByActionId.get(action.id) ?? [],
  };
}

function createEvidenceNode(
  evidence: AdminEvidenceRecord,
): AdminInvestigationGraphResourceDto {
  return {
    caseId: evidence.caseId,
    createdAt: evidence.createdAt,
    description: evidence.description,
    id: evidence.id,
    isInitial: evidence.isInitiallyVisible,
    label: evidence.title,
    metadata: evidence.metadata,
    nodeType: 'evidence',
    resourceType: 'evidence',
  };
}

function createStatementNode(
  statement: AdminStatementRecord,
): AdminInvestigationGraphResourceDto {
  return {
    caseId: statement.caseId,
    createdAt: statement.createdAt,
    description: statement.content,
    id: statement.id,
    isInitial: statement.isInitiallyVisible,
    label: statement.speakerName,
    metadata: {},
    nodeType: 'statement',
    resourceType: 'statement',
  };
}

function createContradictionNode(
  contradiction: AdminContradictionRecord,
): AdminInvestigationGraphResourceDto {
  return {
    caseId: contradiction.caseId,
    createdAt: contradiction.createdAt,
    description: contradiction.explanation,
    id: contradiction.id,
    isInitial: contradiction.isInitiallyVisible,
    label: contradiction.title,
    metadata: {
      proves: contradiction.proves,
      refutingEvidenceId: contradiction.refutingEvidenceId,
      statementId: contradiction.statementId,
      suspectId: contradiction.suspectId,
    },
    nodeType: 'contradiction',
    resourceType: 'contradiction',
  };
}

function createGraphEdges(
  snapshot: CasePlayabilitySnapshot,
): readonly AdminInvestigationGraphEdgeDto[] {
  return [
    ...snapshot.actionPrerequisites.map(createPrerequisiteEdge),
    ...snapshot.evidenceUnlockRules.map(createEvidenceUnlockEdge),
    ...snapshot.statementUnlockRules.map(createStatementUnlockEdge),
    ...snapshot.contradictionUnlockRules.map(createContradictionUnlockEdge),
  ];
}

function createPrerequisiteEdge(
  prerequisite: AdminActionPrerequisiteRecord,
): AdminInvestigationGraphEdgeDto {
  if (prerequisite.prerequisiteActionId) {
    return createActionPrerequisiteEdge({
      prerequisite,
      prerequisiteActionId: prerequisite.prerequisiteActionId,
    });
  }

  if (prerequisite.prerequisiteEvidenceId) {
    return createEvidencePrerequisiteEdge({
      prerequisite,
      prerequisiteEvidenceId: prerequisite.prerequisiteEvidenceId,
    });
  }

  if (prerequisite.prerequisiteContradictionId) {
    return createContradictionPrerequisiteEdge({
      prerequisite,
      prerequisiteContradictionId: prerequisite.prerequisiteContradictionId,
    });
  }

  return createInvalidPrerequisiteEdge(prerequisite);
}

function createInvalidPrerequisiteEdge(
  prerequisite: AdminActionPrerequisiteRecord,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'invalid_prerequisite',
    fromId: prerequisite.id,
    fromNodeType: 'action',
    id: prerequisite.id,
    toId: prerequisite.actionId,
    toNodeType: 'action',
  };
}

interface CreateActionPrerequisiteEdgeCommand {
  readonly prerequisite: AdminActionPrerequisiteRecord;
  readonly prerequisiteActionId: string;
}

interface CreateEvidencePrerequisiteEdgeCommand {
  readonly prerequisite: AdminActionPrerequisiteRecord;
  readonly prerequisiteEvidenceId: string;
}

interface CreateContradictionPrerequisiteEdgeCommand {
  readonly prerequisite: AdminActionPrerequisiteRecord;
  readonly prerequisiteContradictionId: string;
}

function createActionPrerequisiteEdge(
  command: CreateActionPrerequisiteEdgeCommand,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'action_prerequisite',
    fromId: command.prerequisiteActionId,
    fromNodeType: 'action',
    id: command.prerequisite.id,
    toId: command.prerequisite.actionId,
    toNodeType: 'action',
  };
}

function createEvidencePrerequisiteEdge(
  command: CreateEvidencePrerequisiteEdgeCommand,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'evidence_prerequisite',
    fromId: command.prerequisiteEvidenceId,
    fromNodeType: 'evidence',
    id: command.prerequisite.id,
    toId: command.prerequisite.actionId,
    toNodeType: 'action',
  };
}

function createContradictionPrerequisiteEdge(
  command: CreateContradictionPrerequisiteEdgeCommand,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'contradiction_prerequisite',
    fromId: command.prerequisiteContradictionId,
    fromNodeType: 'contradiction',
    id: command.prerequisite.id,
    toId: command.prerequisite.actionId,
    toNodeType: 'action',
  };
}

function createEvidenceUnlockEdge(
  rule: AdminEvidenceUnlockRuleRecord,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'unlock_evidence',
    fromId: rule.actionId,
    fromNodeType: 'action',
    id: rule.id,
    isGuaranteed: rule.isGuaranteed,
    minimumSkillLevel: rule.minimumSkillLevel,
    requiredSkill: rule.requiredSkill,
    successChance: rule.successChance,
    toId: rule.evidenceId,
    toNodeType: 'evidence',
  };
}

function createStatementUnlockEdge(
  rule: AdminStatementUnlockRuleRecord,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'unlock_statement',
    fromId: rule.actionId,
    fromNodeType: 'action',
    id: rule.id,
    isGuaranteed: rule.isGuaranteed,
    minimumSkillLevel: rule.minimumSkillLevel,
    requiredSkill: rule.requiredSkill,
    successChance: rule.successChance,
    toId: rule.statementId,
    toNodeType: 'statement',
  };
}

function createContradictionUnlockEdge(
  rule: AdminContradictionUnlockRuleRecord,
): AdminInvestigationGraphEdgeDto {
  return {
    edgeType: 'unlock_contradiction',
    fromId: rule.actionId,
    fromNodeType: 'action',
    id: rule.id,
    isGuaranteed: rule.isGuaranteed,
    minimumSkillLevel: rule.minimumSkillLevel,
    requiredSkill: rule.requiredSkill,
    successChance: rule.successChance,
    toId: rule.contradictionId,
    toNodeType: 'contradiction',
  };
}

function createActionGraphRelations(
  edges: readonly AdminInvestigationGraphEdgeDto[],
): ActionGraphRelations {
  return {
    prerequisitesByActionId: createPrerequisitesByActionId(edges),
    unlocksByActionId: createUnlocksByActionId(edges),
  };
}

function createPrerequisitesByActionId(
  edges: readonly AdminInvestigationGraphEdgeDto[],
): ReadonlyMap<string, readonly string[]> {
  const prerequisitesByActionId = new Map<string, string[]>();

  edges
    .filter((edge) => edge.toNodeType === 'action')
    .forEach((edge) =>
      appendMapValue(prerequisitesByActionId, edge.toId, edge.fromId),
    );

  return prerequisitesByActionId;
}

function createUnlocksByActionId(
  edges: readonly AdminInvestigationGraphEdgeDto[],
): ReadonlyMap<string, readonly string[]> {
  const unlocksByActionId = new Map<string, string[]>();

  edges
    .filter(
      (edge) => edge.fromNodeType === 'action' && edge.toNodeType !== 'action',
    )
    .forEach((edge) =>
      appendMapValue(unlocksByActionId, edge.fromId, edge.toId),
    );

  return unlocksByActionId;
}

function appendMapValue(
  map: Map<string, string[]>,
  key: string,
  value: string,
): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function createEvidenceUnlockRule(
  rule: AdminEvidenceUnlockRuleRecord,
): AdminEvidenceUnlockRuleDto {
  return {
    actionId: rule.actionId,
    createdAt: rule.createdAt,
    durationModifierMinutes: rule.durationModifierMinutes,
    evidenceId: rule.evidenceId,
    id: rule.id,
    isGuaranteed: rule.isGuaranteed,
    minimumSkillLevel: rule.minimumSkillLevel,
    requiredSkill: rule.requiredSkill,
    successChance: rule.successChance,
  };
}

function createStatementUnlockRule(
  rule: AdminStatementUnlockRuleRecord,
): AdminStatementUnlockRuleDto {
  return {
    actionId: rule.actionId,
    createdAt: rule.createdAt,
    id: rule.id,
    isGuaranteed: rule.isGuaranteed,
    minimumSkillLevel: rule.minimumSkillLevel,
    requiredSkill: rule.requiredSkill,
    statementId: rule.statementId,
    successChance: rule.successChance,
  };
}

function createContradictionUnlockRule(
  rule: AdminContradictionUnlockRuleRecord,
): AdminContradictionUnlockRuleDto {
  return {
    actionId: rule.actionId,
    contradictionId: rule.contradictionId,
    createdAt: rule.createdAt,
    id: rule.id,
    isGuaranteed: rule.isGuaranteed,
    minimumSkillLevel: rule.minimumSkillLevel,
    requiredSkill: rule.requiredSkill,
    successChance: rule.successChance,
  };
}

function createActionPrerequisite(
  prerequisite: AdminActionPrerequisiteRecord,
): AdminActionPrerequisiteDto {
  return {
    actionId: prerequisite.actionId,
    createdAt: prerequisite.createdAt,
    id: prerequisite.id,
    prerequisiteActionId: prerequisite.prerequisiteActionId,
    prerequisiteContradictionId: prerequisite.prerequisiteContradictionId,
    prerequisiteEvidenceId: prerequisite.prerequisiteEvidenceId,
  };
}
