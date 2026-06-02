import { Injectable } from '@nestjs/common';
import {
  ADMIN_CASE_DIFFICULTIES,
  AdminCaseDifficulty,
  AdminProofRole,
} from './constants/admin-case.constants';
import { CaseSolveRequirementLogicValidator } from './case-solve-requirement-logic.validator';
import {
  AdminActionPrerequisiteRecord,
  AdminContradictionRecord,
  AdminEvidenceRecord,
  AdminInvestigationActionRecord,
  AdminSolveRequirementRecord,
  AdminStatementRecord,
  AdminStatementUnlockRuleRecord,
  CasePlayabilitySnapshot,
} from './cases.repository';

const MINIMUM_SUSPECTS = 2;
const CORE_EVIDENCE_PROOF_ROLES = [
  'identity',
  'motive',
  'method',
  'opportunity',
] as const satisfies readonly AdminProofRole[];

export interface CasePlayabilityValidation {
  readonly blockingIssues: readonly string[];
  readonly canPublish: boolean;
  readonly warnings: readonly string[];
}

interface ReachableCaseState {
  readonly actionIds: ReadonlySet<string>;
  readonly contradictionIds: ReadonlySet<string>;
  readonly evidenceIds: ReadonlySet<string>;
  readonly statementIds: ReadonlySet<string>;
}

interface MutableReachableCaseState {
  readonly actionIds: Set<string>;
  readonly contradictionIds: Set<string>;
  readonly evidenceIds: Set<string>;
  readonly statementIds: Set<string>;
}

@Injectable()
export class CasePlayabilityValidator {
  constructor(
    private readonly caseSolveRequirementLogicValidator: CaseSolveRequirementLogicValidator,
  ) {}

  validate(snapshot: CasePlayabilitySnapshot): CasePlayabilityValidation {
    const blockingIssues = [
      ...this.validateSolution(snapshot),
      ...this.validateMinimumContent(snapshot),
      ...this.validateRequirementLogic(snapshot),
      ...this.validateContradictions(snapshot),
      ...this.validateActionPrerequisites(snapshot),
      ...this.validateInvestigationGraphMechanics(snapshot),
      ...this.validateMandatoryRequirements(snapshot),
      ...this.validateReachableActions(snapshot),
      ...this.validateReachableContent(snapshot),
    ];

    return {
      blockingIssues,
      canPublish: blockingIssues.length === 0,
      warnings: [],
    };
  }

  private validateSolution(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    if (!snapshot.solution) {
      return ['El caso no tiene solucion privada en case_solutions.'];
    }

    if (!this.hasSuspect(snapshot, snapshot.solution.culpritSuspectId)) {
      return ['El culpable definido en la solucion no pertenece al caso.'];
    }

    return [];
  }

  private validateMinimumContent(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return [
      ...this.validateMinimumSuspects(snapshot),
      ...this.validateCriticalEvidence(snapshot),
      ...this.validateEvidenceProofMatrix(snapshot),
      ...this.validateInitialActions(snapshot),
      ...this.validateRequirements(snapshot),
    ];
  }

  private validateMinimumSuspects(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return snapshot.suspects.length >= MINIMUM_SUSPECTS
      ? []
      : ['El caso necesita al menos dos sospechosos.'];
  }

  private validateCriticalEvidence(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return this.getCriticalEvidences(snapshot).length > 0
      ? []
      : ['El caso necesita al menos una evidencia critica.'];
  }

  private validateEvidenceProofMatrix(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return [
      ...this.validateEvidenceCoreRoleDeclarations(snapshot.evidences),
      ...this.validatePrimaryEvidenceCoreRoles(snapshot.evidences),
    ];
  }

  private validateEvidenceCoreRoleDeclarations(
    evidences: readonly AdminEvidenceRecord[],
  ): readonly string[] {
    return evidences.flatMap((evidence) =>
      this.validateEvidenceCoreRoleDeclaration(evidence),
    );
  }

  private validateEvidenceCoreRoleDeclaration(
    evidence: AdminEvidenceRecord,
  ): readonly string[] {
    const declaredCoreRoles = this.readDeclaredEvidenceCoreRoles(evidence);
    const primaryCoreRole = this.readPrimaryEvidenceCoreRole(evidence);

    return [
      ...this.validateEvidenceHasSingleCoreRole(evidence, declaredCoreRoles),
      ...this.validateExtraEvidenceHasNoCoreRole(
        evidence,
        declaredCoreRoles,
        primaryCoreRole,
      ),
      ...this.validateMandatoryCandidateMatchesCoreRole(
        evidence,
        primaryCoreRole,
      ),
      ...this.validateDecoyHasNoCoreRole(evidence, primaryCoreRole),
    ];
  }

  private validateEvidenceHasSingleCoreRole(
    evidence: AdminEvidenceRecord,
    declaredCoreRoles: readonly AdminProofRole[],
  ): readonly string[] {
    return declaredCoreRoles.length <= 1
      ? []
      : [
          `La evidencia "${evidence.title}" declara multiples roles core (${declaredCoreRoles.join(', ')}). Cada evidencia debe conservar como maximo un rol core.`,
        ];
  }

  private validateExtraEvidenceHasNoCoreRole(
    evidence: AdminEvidenceRecord,
    declaredCoreRoles: readonly AdminProofRole[],
    primaryCoreRole?: AdminProofRole,
  ): readonly string[] {
    return primaryCoreRole || declaredCoreRoles.length === 0
      ? []
      : [
          `La evidencia "${evidence.title}" declara un rol core en proofRoles/proves, pero su primaryProofRole no ocupa la matriz. Las evidencias extra deben quedar como support o false_alibi.`,
        ];
  }

  private validateMandatoryCandidateMatchesCoreRole(
    evidence: AdminEvidenceRecord,
    primaryCoreRole?: AdminProofRole,
  ): readonly string[] {
    return this.isMandatoryCandidateEvidence(evidence) && !primaryCoreRole
      ? [
          `La evidencia "${evidence.title}" tiene mandatoryCandidate=true pero no ocupa un rol core unico; las evidencias extra deben quedar como support o false_alibi.`,
        ]
      : [];
  }

  private validateDecoyHasNoCoreRole(
    evidence: AdminEvidenceRecord,
    primaryCoreRole?: AdminProofRole,
  ): readonly string[] {
    return evidence.isDecoy && primaryCoreRole
      ? [
          `La evidencia distractora "${evidence.title}" no puede ocupar el rol core "${primaryCoreRole}". Debe quedar como false_alibi o support.`,
        ]
      : [];
  }

  private validatePrimaryEvidenceCoreRoles(
    evidences: readonly AdminEvidenceRecord[],
  ): readonly string[] {
    const primaryEvidencesByRole =
      this.groupPrimaryEvidencesByCoreRole(evidences);

    return CORE_EVIDENCE_PROOF_ROLES.flatMap((coreRole) =>
      this.validatePrimaryEvidenceCoreRole(
        coreRole,
        primaryEvidencesByRole.get(coreRole) ?? [],
      ),
    );
  }

  private validatePrimaryEvidenceCoreRole(
    coreRole: AdminProofRole,
    primaryEvidences: readonly AdminEvidenceRecord[],
  ): readonly string[] {
    if (primaryEvidences.length === 0) {
      return [
        `La matriz probatoria del estado no tiene una evidencia principal para "${coreRole}".`,
      ];
    }

    return primaryEvidences.length === 1
      ? []
      : [
          `La matriz probatoria declara ${primaryEvidences.length} evidencias principales para "${coreRole}": ${primaryEvidences.map((evidence) => `"${evidence.title}"`).join(', ')}. Solo una evidencia puede ocupar cada rol core; las restantes deben ser support o false_alibi.`,
        ];
  }

  private groupPrimaryEvidencesByCoreRole(
    evidences: readonly AdminEvidenceRecord[],
  ): ReadonlyMap<AdminProofRole, readonly AdminEvidenceRecord[]> {
    return evidences.reduce(
      (groups, evidence) =>
        this.addPrimaryEvidenceToCoreRoleGroup(groups, evidence),
      new Map<AdminProofRole, AdminEvidenceRecord[]>(),
    );
  }

  private addPrimaryEvidenceToCoreRoleGroup(
    groups: Map<AdminProofRole, AdminEvidenceRecord[]>,
    evidence: AdminEvidenceRecord,
  ): Map<AdminProofRole, AdminEvidenceRecord[]> {
    const primaryCoreRole = this.readPrimaryEvidenceCoreRole(evidence);

    if (!primaryCoreRole) {
      return groups;
    }

    groups.set(primaryCoreRole, [
      ...(groups.get(primaryCoreRole) ?? []),
      evidence,
    ]);

    return groups;
  }

  private readDeclaredEvidenceCoreRoles(
    evidence: AdminEvidenceRecord,
  ): readonly AdminProofRole[] {
    return this.uniqueProofRoles([
      this.readCoreProofRole(evidence.metadata.primaryProofRole),
      ...this.readCoreProofRoles(evidence.metadata.proofRoles),
      ...this.readCoreProofRoles(evidence.metadata.proves),
    ]);
  }

  private readPrimaryEvidenceCoreRole(
    evidence: AdminEvidenceRecord,
  ): AdminProofRole | undefined {
    return this.readCoreProofRole(evidence.metadata.primaryProofRole);
  }

  private readCoreProofRoles(value: unknown): readonly AdminProofRole[] {
    return Array.isArray(value)
      ? value
          .map((item) => this.readCoreProofRole(item))
          .filter((item): item is AdminProofRole => Boolean(item))
      : [this.readCoreProofRole(value)].filter(
          (item): item is AdminProofRole => Boolean(item),
        );
  }

  private readCoreProofRole(value: unknown): AdminProofRole | undefined {
    return typeof value === 'string' &&
      this.isCoreEvidenceProofRole(value)
      ? value
      : undefined;
  }

  private uniqueProofRoles(
    proofRoles: readonly (AdminProofRole | undefined)[],
  ): readonly AdminProofRole[] {
    return [...new Set(proofRoles.filter(Boolean))] as readonly AdminProofRole[];
  }

  private isCoreEvidenceProofRole(
    proofRole: string,
  ): proofRole is AdminProofRole {
    return (CORE_EVIDENCE_PROOF_ROLES as readonly string[]).includes(
      proofRole,
    );
  }

  private isMandatoryCandidateEvidence(evidence: AdminEvidenceRecord): boolean {
    return evidence.metadata.mandatoryCandidate === true;
  }

  private validateInitialActions(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return this.getInitialActions(snapshot).length > 0
      ? []
      : ['El caso necesita al menos una accion inicial disponible.'];
  }

  private validateRequirements(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return this.getMandatoryRequirements(snapshot).length > 0
      ? []
      : ['El caso necesita al menos un requisito obligatorio de resolucion.'];
  }

  private validateRequirementLogic(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    if (!snapshot.solution) {
      return [];
    }

    return this.caseSolveRequirementLogicValidator.validate({
      contradictions: snapshot.contradictions,
      culpritSuspectId: snapshot.solution.culpritSuspectId,
      difficulty: this.readCaseDifficulty(snapshot.caseRecord.difficulty),
      evidences: snapshot.evidences,
      requirements: snapshot.requirements,
      statements: snapshot.statements,
    });
  }

  private validateContradictions(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return snapshot.contradictions.flatMap((contradiction) =>
      this.validateContradiction(snapshot, contradiction),
    );
  }

  private validateContradiction(
    snapshot: CasePlayabilitySnapshot,
    contradiction: AdminContradictionRecord,
  ): readonly string[] {
    return [
      ...this.validateContradictionStatement(snapshot, contradiction),
      ...this.validateContradictionEvidence(snapshot, contradiction),
    ];
  }

  private validateContradictionStatement(
    snapshot: CasePlayabilitySnapshot,
    contradiction: AdminContradictionRecord,
  ): readonly string[] {
    return this.hasStatement(snapshot, contradiction.statementId)
      ? []
      : [
          `La contradiccion "${contradiction.title}" apunta a una declaracion fuera del caso.`,
        ];
  }

  private validateContradictionEvidence(
    snapshot: CasePlayabilitySnapshot,
    contradiction: AdminContradictionRecord,
  ): readonly string[] {
    return this.hasEvidence(snapshot, contradiction.refutingEvidenceId)
      ? []
      : [
          `La contradiccion "${contradiction.title}" apunta a una evidencia fuera del caso.`,
        ];
  }

  private validateActionPrerequisites(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return [
      ...this.validatePrerequisiteTargets(snapshot),
      ...this.validateNonInitialActionsHavePrerequisites(snapshot),
      ...this.validateInitialActionsHaveNoPrerequisites(snapshot),
    ];
  }

  private validatePrerequisiteTargets(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return snapshot.actionPrerequisites.flatMap((prerequisite) =>
      this.validatePrerequisite(snapshot, prerequisite),
    );
  }

  private validatePrerequisite(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    return [
      ...this.validatePrerequisiteAction(snapshot, prerequisite),
      ...this.validatePrerequisiteTargetCount(prerequisite),
      ...this.validatePrerequisiteTargetReferences(snapshot, prerequisite),
      ...this.validatePrerequisiteSelfReference(prerequisite),
      ...this.validatePrerequisiteDoesNotDependOnUnlockedContradiction(
        snapshot,
        prerequisite,
      ),
    ];
  }

  private validatePrerequisiteAction(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    return this.hasAction(snapshot, prerequisite.actionId)
      ? []
      : [
          `El prerequisito "${prerequisite.id}" apunta a una accion fuera del caso.`,
        ];
  }

  private validatePrerequisiteTargetCount(
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    const targetCount = [
      prerequisite.prerequisiteActionId,
      prerequisite.prerequisiteContradictionId,
      prerequisite.prerequisiteEvidenceId,
    ].filter(Boolean).length;

    return targetCount === 1
      ? []
      : [
          `El prerequisito "${prerequisite.id}" debe tener exactamente un objetivo.`,
        ];
  }

  private validatePrerequisiteTargetReferences(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    return [
      ...this.validatePrerequisiteActionTarget(snapshot, prerequisite),
      ...this.validatePrerequisiteEvidenceTarget(snapshot, prerequisite),
      ...this.validatePrerequisiteContradictionTarget(snapshot, prerequisite),
    ];
  }

  private validatePrerequisiteActionTarget(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    if (!prerequisite.prerequisiteActionId) {
      return [];
    }

    return this.hasAction(snapshot, prerequisite.prerequisiteActionId)
      ? []
      : [
          `El prerequisito "${prerequisite.id}" apunta a una accion previa fuera del caso.`,
        ];
  }

  private validatePrerequisiteEvidenceTarget(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    if (!prerequisite.prerequisiteEvidenceId) {
      return [];
    }

    return this.hasEvidence(snapshot, prerequisite.prerequisiteEvidenceId)
      ? []
      : [
          `El prerequisito "${prerequisite.id}" apunta a una evidencia fuera del caso.`,
        ];
  }

  private validatePrerequisiteContradictionTarget(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    if (!prerequisite.prerequisiteContradictionId) {
      return [];
    }

    return this.hasContradiction(
      snapshot,
      prerequisite.prerequisiteContradictionId,
    )
      ? []
      : [
          `El prerequisito "${prerequisite.id}" apunta a una contradiccion fuera del caso.`,
        ];
  }

  private validatePrerequisiteSelfReference(
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    return prerequisite.actionId === prerequisite.prerequisiteActionId
      ? [`La accion "${prerequisite.actionId}" no puede depender de si misma.`]
      : [];
  }

  private validatePrerequisiteDoesNotDependOnUnlockedContradiction(
    snapshot: CasePlayabilitySnapshot,
    prerequisite: AdminActionPrerequisiteRecord,
  ): readonly string[] {
    if (!prerequisite.prerequisiteContradictionId) {
      return [];
    }

    const actionUnlocksContradiction = snapshot.contradictionUnlockRules.some(
      (rule) =>
        rule.actionId === prerequisite.actionId &&
        rule.contradictionId === prerequisite.prerequisiteContradictionId,
    );

    if (!actionUnlocksContradiction) {
      return [];
    }

    const action = this.findAction(snapshot, prerequisite.actionId);
    const contradiction = this.findContradiction(
      snapshot,
      prerequisite.prerequisiteContradictionId,
    );

    return [
      `La accion "${action?.title ?? prerequisite.actionId}" no puede depender de la contradiccion "${contradiction?.title ?? prerequisite.prerequisiteContradictionId}" porque esa misma accion la desbloquea.`,
    ];
  }

  private validateInvestigationGraphMechanics(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return [
      ...this.validateStatementUnlockRules(snapshot),
      ...this.validateInterviewActions(snapshot),
      ...this.validateInitialInterviewsForSuspects(snapshot),
    ];
  }

  private validateStatementUnlockRules(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return snapshot.statementUnlockRules.flatMap((rule) => [
      ...this.validateStatementUnlockRuleReferences(snapshot, rule),
      ...this.validateStatementUnlockRuleUsesInterview(snapshot, rule),
      ...this.validateStatementUnlockRuleIsGuaranteed(snapshot, rule),
    ]);
  }

  private validateStatementUnlockRuleReferences(
    snapshot: CasePlayabilitySnapshot,
    rule: AdminStatementUnlockRuleRecord,
  ): readonly string[] {
    return [
      ...this.validateStatementUnlockRuleAction(snapshot, rule),
      ...this.validateStatementUnlockRuleStatement(snapshot, rule),
    ];
  }

  private validateStatementUnlockRuleAction(
    snapshot: CasePlayabilitySnapshot,
    rule: AdminStatementUnlockRuleRecord,
  ): readonly string[] {
    return this.hasAction(snapshot, rule.actionId)
      ? []
      : [
          `La regla de declaracion "${rule.id}" apunta a una accion fuera del caso.`,
        ];
  }

  private validateStatementUnlockRuleStatement(
    snapshot: CasePlayabilitySnapshot,
    rule: AdminStatementUnlockRuleRecord,
  ): readonly string[] {
    return this.hasStatement(snapshot, rule.statementId)
      ? []
      : [
          `La regla de declaracion "${rule.id}" apunta a una declaracion fuera del caso.`,
        ];
  }

  private validateStatementUnlockRuleUsesInterview(
    snapshot: CasePlayabilitySnapshot,
    rule: AdminStatementUnlockRuleRecord,
  ): readonly string[] {
    const action = this.findAction(snapshot, rule.actionId);

    if (!action || action.actionType === 'interview') {
      return [];
    }

    return [
      `La regla de declaracion "${rule.id}" debe desbloquearse desde una accion interview; la accion "${action.title}" usa "${action.actionType}".`,
    ];
  }

  private validateStatementUnlockRuleIsGuaranteed(
    snapshot: CasePlayabilitySnapshot,
    rule: AdminStatementUnlockRuleRecord,
  ): readonly string[] {
    if (rule.isGuaranteed && rule.successChance === 1) {
      return [];
    }

    const statement = this.findStatement(snapshot, rule.statementId);

    return [
      `La regla de declaracion "${statement?.speakerName ?? rule.statementId}" debe ser garantizada con isGuaranteed=true y successChance=1.`,
    ];
  }

  private validateInterviewActions(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return snapshot.actions
      .filter((action) => action.actionType === 'interview')
      .flatMap((action) => [
        ...this.validateInterviewActionIsInitial(action),
        ...this.validateInterviewActionTargetsOneSuspect(snapshot, action),
      ]);
  }

  private validateInterviewActionIsInitial(
    action: AdminInvestigationActionRecord,
  ): readonly string[] {
    return action.isInitiallyAvailable
      ? []
      : [
          `La accion "${action.title}" usa actionType="interview", pero interview solo se permite para entrevistas iniciales a sospechosos.`,
        ];
  }

  private validateInterviewActionTargetsOneSuspect(
    snapshot: CasePlayabilitySnapshot,
    action: AdminInvestigationActionRecord,
  ): readonly string[] {
    const suspectIds = this.findStatementSuspectIdsForAction(
      snapshot,
      action.id,
    );

    if (suspectIds.size === 1) {
      return [];
    }

    return [
      `La accion interview "${action.title}" debe desbloquear statements de exactamente un sospechoso.`,
    ];
  }

  private validateInitialInterviewsForSuspects(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    return snapshot.suspects.flatMap((suspect) =>
      this.hasGuaranteedInitialInterviewForSuspect(snapshot, suspect.id)
        ? []
        : [
            `El sospechoso "${suspect.name}" necesita una accion inicial interview que desbloquee su declaracion de forma garantizada.`,
          ],
    );
  }

  private hasGuaranteedInitialInterviewForSuspect(
    snapshot: CasePlayabilitySnapshot,
    suspectId: string,
  ): boolean {
    return snapshot.actions
      .filter(
        (action) =>
          action.actionType === 'interview' && action.isInitiallyAvailable,
      )
      .some((action) =>
        this.hasGuaranteedStatementUnlockForSuspect(
          snapshot,
          action.id,
          suspectId,
        ),
      );
  }

  private hasGuaranteedStatementUnlockForSuspect(
    snapshot: CasePlayabilitySnapshot,
    actionId: string,
    suspectId: string,
  ): boolean {
    return snapshot.statementUnlockRules.some((rule) => {
      const statement = this.findStatement(snapshot, rule.statementId);

      return (
        rule.actionId === actionId &&
        rule.isGuaranteed &&
        rule.successChance === 1 &&
        statement?.suspectId === suspectId
      );
    });
  }

  private findStatementSuspectIdsForAction(
    snapshot: CasePlayabilitySnapshot,
    actionId: string,
  ): ReadonlySet<string> {
    const suspectIds = new Set<string>();

    snapshot.statementUnlockRules
      .filter((rule) => rule.actionId === actionId)
      .forEach((rule) => {
        const statement = this.findStatement(snapshot, rule.statementId);

        if (statement?.suspectId) {
          suspectIds.add(statement.suspectId);
        }
      });

    return suspectIds;
  }

  private validateNonInitialActionsHavePrerequisites(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    const actionIdsWithPrerequisites = new Set(
      snapshot.actionPrerequisites.map((prerequisite) => prerequisite.actionId),
    );

    return snapshot.actions
      .filter((action) => !action.isInitiallyAvailable)
      .filter((action) => !actionIdsWithPrerequisites.has(action.id))
      .map(
        (action) =>
          `La accion no inicial "${action.title}" no tiene prerequisitos.`,
      );
  }

  private validateInitialActionsHaveNoPrerequisites(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    const initialActionIds = new Set(
      this.getInitialActions(snapshot).map((action) => action.id),
    );

    return snapshot.actionPrerequisites
      .filter((prerequisite) => initialActionIds.has(prerequisite.actionId))
      .map(
        (prerequisite) =>
          `La accion inicial "${prerequisite.actionId}" no debe tener prerequisitos.`,
      );
  }

  private validateMandatoryRequirements(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    const guaranteedState = this.createReachableState(snapshot, true);

    return this.getMandatoryRequirements(snapshot).flatMap((requirement) =>
      this.validateMandatoryRequirement(snapshot, requirement, guaranteedState),
    );
  }

  private validateMandatoryRequirement(
    snapshot: CasePlayabilitySnapshot,
    requirement: AdminSolveRequirementRecord,
    guaranteedState: ReachableCaseState,
  ): readonly string[] {
    return [
      ...this.validateRequirementHasStructuredTarget(requirement),
      ...this.validateRequiredSuspect(snapshot, requirement),
      ...this.validateRequiredEvidence(snapshot, requirement, guaranteedState),
      ...this.validateRequiredContradiction(
        snapshot,
        requirement,
        guaranteedState,
      ),
    ];
  }

  private validateRequirementHasStructuredTarget(
    requirement: AdminSolveRequirementRecord,
  ): readonly string[] {
    if (
      requirement.requiredSuspectId ||
      requirement.requiredEvidenceId ||
      requirement.requiredContradictionId
    ) {
      return [];
    }

    return [
      `El requisito "${requirement.description}" no apunta a ningun dato verificable.`,
    ];
  }

  private validateRequiredSuspect(
    snapshot: CasePlayabilitySnapshot,
    requirement: AdminSolveRequirementRecord,
  ): readonly string[] {
    if (!requirement.requiredSuspectId) {
      return [];
    }

    return this.hasSuspect(snapshot, requirement.requiredSuspectId)
      ? []
      : [
          `El requisito "${requirement.description}" apunta a un sospechoso fuera del caso.`,
        ];
  }

  private validateRequiredEvidence(
    snapshot: CasePlayabilitySnapshot,
    requirement: AdminSolveRequirementRecord,
    guaranteedState: ReachableCaseState,
  ): readonly string[] {
    if (!requirement.requiredEvidenceId) {
      return [];
    }

    if (!this.hasEvidence(snapshot, requirement.requiredEvidenceId)) {
      return [
        `El requisito "${requirement.description}" apunta a una evidencia fuera del caso.`,
      ];
    }

    return guaranteedState.evidenceIds.has(requirement.requiredEvidenceId)
      ? []
      : [
          `La evidencia requerida por "${requirement.description}" no tiene ruta inicial garantizada de desbloqueo.`,
        ];
  }

  private validateRequiredContradiction(
    snapshot: CasePlayabilitySnapshot,
    requirement: AdminSolveRequirementRecord,
    guaranteedState: ReachableCaseState,
  ): readonly string[] {
    if (!requirement.requiredContradictionId) {
      return [];
    }

    if (!this.hasContradiction(snapshot, requirement.requiredContradictionId)) {
      return [
        `El requisito "${requirement.description}" apunta a una contradiccion fuera del caso.`,
      ];
    }

    return guaranteedState.contradictionIds.has(
      requirement.requiredContradictionId,
    )
      ? []
      : [
          `La contradiccion requerida por "${requirement.description}" no tiene ruta inicial garantizada de desbloqueo.`,
        ];
  }

  private validateReachableActions(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    const reachableState = this.createReachableState(snapshot, false);

    return snapshot.actions
      .filter((action) => !reachableState.actionIds.has(action.id))
      .map(
        (action) =>
          `La accion "${action.title}" no es alcanzable desde acciones iniciales.`,
      );
  }

  private validateReachableContent(
    snapshot: CasePlayabilitySnapshot,
  ): readonly string[] {
    const reachableState = this.createReachableState(snapshot, false);

    return [
      ...this.validateReachableEvidences(snapshot, reachableState),
      ...this.validateReachableStatements(snapshot, reachableState),
      ...this.validateReachableContradictions(snapshot, reachableState),
    ];
  }

  private validateReachableEvidences(
    snapshot: CasePlayabilitySnapshot,
    reachableState: ReachableCaseState,
  ): readonly string[] {
    return snapshot.evidences
      .filter((evidence) => !reachableState.evidenceIds.has(evidence.id))
      .map(
        (evidence) =>
          `La evidencia "${evidence.title}" no tiene ruta de descubrimiento.`,
      );
  }

  private validateReachableStatements(
    snapshot: CasePlayabilitySnapshot,
    reachableState: ReachableCaseState,
  ): readonly string[] {
    return snapshot.statements
      .filter((statement) => !reachableState.statementIds.has(statement.id))
      .map(
        (statement) =>
          `La declaracion de "${statement.speakerName}" no tiene ruta de descubrimiento.`,
      );
  }

  private validateReachableContradictions(
    snapshot: CasePlayabilitySnapshot,
    reachableState: ReachableCaseState,
  ): readonly string[] {
    return snapshot.contradictions
      .filter(
        (contradiction) =>
          !reachableState.contradictionIds.has(contradiction.id),
      )
      .map(
        (contradiction) =>
          `La contradiccion "${contradiction.title}" no tiene ruta de descubrimiento.`,
      );
  }

  private createReachableState(
    snapshot: CasePlayabilitySnapshot,
    guaranteedOnly: boolean,
  ): ReachableCaseState {
    const state: MutableReachableCaseState = {
      actionIds: new Set(
        this.getInitialActions(snapshot).map((action) => action.id),
      ),
      contradictionIds: new Set(
        snapshot.contradictions
          .filter((contradiction) => contradiction.isInitiallyVisible)
          .map((contradiction) => contradiction.id),
      ),
      evidenceIds: new Set(
        snapshot.evidences
          .filter((evidence) => evidence.isInitiallyVisible)
          .map((evidence) => evidence.id),
      ),
      statementIds: new Set(
        snapshot.statements
          .filter((statement) => statement.isInitiallyVisible)
          .map((statement) => statement.id),
      ),
    };

    let changed = true;
    while (changed) {
      changed = [
        this.addReachableEvidences(snapshot, state, guaranteedOnly),
        this.addReachableStatements(snapshot, state, guaranteedOnly),
        this.addReachableContradictions(snapshot, state, guaranteedOnly),
        this.addReachableActions(snapshot, state),
      ].some(Boolean);
    }

    return state;
  }

  private addReachableEvidences(
    snapshot: CasePlayabilitySnapshot,
    state: MutableReachableCaseState,
    guaranteedOnly: boolean,
  ): boolean {
    let changed = false;

    snapshot.evidenceUnlockRules.forEach((rule) => {
      if (!this.canApplyUnlockRule(rule, state, guaranteedOnly)) {
        return;
      }

      if (!state.evidenceIds.has(rule.evidenceId)) {
        state.evidenceIds.add(rule.evidenceId);
        changed = true;
      }
    });

    return changed;
  }

  private addReachableStatements(
    snapshot: CasePlayabilitySnapshot,
    state: MutableReachableCaseState,
    guaranteedOnly: boolean,
  ): boolean {
    let changed = false;

    snapshot.statementUnlockRules.forEach((rule) => {
      if (!this.canApplyUnlockRule(rule, state, guaranteedOnly)) {
        return;
      }

      if (!state.statementIds.has(rule.statementId)) {
        state.statementIds.add(rule.statementId);
        changed = true;
      }
    });

    return changed;
  }

  private addReachableContradictions(
    snapshot: CasePlayabilitySnapshot,
    state: MutableReachableCaseState,
    guaranteedOnly: boolean,
  ): boolean {
    let changed = false;

    snapshot.contradictionUnlockRules.forEach((rule) => {
      if (!this.canApplyUnlockRule(rule, state, guaranteedOnly)) {
        return;
      }

      if (
        !this.canDiscoverContradiction(snapshot, state, rule.contradictionId)
      ) {
        return;
      }

      if (!state.contradictionIds.has(rule.contradictionId)) {
        state.contradictionIds.add(rule.contradictionId);
        changed = true;
      }
    });

    return changed;
  }

  private addReachableActions(
    snapshot: CasePlayabilitySnapshot,
    state: MutableReachableCaseState,
  ): boolean {
    let changed = false;

    snapshot.actions.forEach((action) => {
      if (state.actionIds.has(action.id)) {
        return;
      }

      if (!this.areActionPrerequisitesMet(snapshot, state, action.id)) {
        return;
      }

      state.actionIds.add(action.id);
      changed = true;
    });

    return changed;
  }

  private canApplyUnlockRule(
    rule: { readonly actionId: string; readonly isGuaranteed: boolean },
    state: ReachableCaseState,
    guaranteedOnly: boolean,
  ): boolean {
    return (
      state.actionIds.has(rule.actionId) &&
      (!guaranteedOnly || rule.isGuaranteed)
    );
  }

  private canDiscoverContradiction(
    snapshot: CasePlayabilitySnapshot,
    state: ReachableCaseState,
    contradictionId: string,
  ): boolean {
    const contradiction = this.findContradiction(snapshot, contradictionId);

    return Boolean(
      contradiction &&
      state.statementIds.has(contradiction.statementId) &&
      state.evidenceIds.has(contradiction.refutingEvidenceId),
    );
  }

  private areActionPrerequisitesMet(
    snapshot: CasePlayabilitySnapshot,
    state: ReachableCaseState,
    actionId: string,
  ): boolean {
    const prerequisites = snapshot.actionPrerequisites.filter(
      (prerequisite) => prerequisite.actionId === actionId,
    );

    if (prerequisites.length === 0) {
      return false;
    }

    return prerequisites.every((prerequisite) =>
      this.isPrerequisiteMet(prerequisite, state),
    );
  }

  private isPrerequisiteMet(
    prerequisite: AdminActionPrerequisiteRecord,
    state: ReachableCaseState,
  ): boolean {
    if (prerequisite.prerequisiteActionId) {
      return state.actionIds.has(prerequisite.prerequisiteActionId);
    }

    if (prerequisite.prerequisiteEvidenceId) {
      return state.evidenceIds.has(prerequisite.prerequisiteEvidenceId);
    }

    if (prerequisite.prerequisiteContradictionId) {
      return state.contradictionIds.has(
        prerequisite.prerequisiteContradictionId,
      );
    }

    return false;
  }

  private getCriticalEvidences(
    snapshot: CasePlayabilitySnapshot,
  ): readonly AdminEvidenceRecord[] {
    return snapshot.evidences.filter(
      (evidence) => evidence.importance === 'critical',
    );
  }

  private getInitialActions(
    snapshot: CasePlayabilitySnapshot,
  ): readonly AdminInvestigationActionRecord[] {
    return snapshot.actions.filter((action) => action.isInitiallyAvailable);
  }

  private getMandatoryRequirements(
    snapshot: CasePlayabilitySnapshot,
  ): readonly AdminSolveRequirementRecord[] {
    return snapshot.requirements.filter(
      (requirement) => requirement.isMandatory,
    );
  }

  private readCaseDifficulty(difficulty: string): AdminCaseDifficulty {
    return ADMIN_CASE_DIFFICULTIES.includes(difficulty as AdminCaseDifficulty)
      ? (difficulty as AdminCaseDifficulty)
      : 'medium';
  }

  private hasAction(
    snapshot: CasePlayabilitySnapshot,
    actionId: string,
  ): boolean {
    return snapshot.actions.some((action) => action.id === actionId);
  }

  private findAction(
    snapshot: CasePlayabilitySnapshot,
    actionId: string,
  ): AdminInvestigationActionRecord | undefined {
    return snapshot.actions.find((action) => action.id === actionId);
  }

  private hasSuspect(
    snapshot: CasePlayabilitySnapshot,
    suspectId: string,
  ): boolean {
    return snapshot.suspects.some((suspect) => suspect.id === suspectId);
  }

  private hasStatement(
    snapshot: CasePlayabilitySnapshot,
    statementId: string,
  ): boolean {
    return snapshot.statements.some(
      (statement) => statement.id === statementId,
    );
  }

  private findStatement(
    snapshot: CasePlayabilitySnapshot,
    statementId: string,
  ): AdminStatementRecord | undefined {
    return snapshot.statements.find((statement) => statement.id === statementId);
  }

  private hasEvidence(
    snapshot: CasePlayabilitySnapshot,
    evidenceId: string,
  ): boolean {
    return snapshot.evidences.some((evidence) => evidence.id === evidenceId);
  }

  private hasContradiction(
    snapshot: CasePlayabilitySnapshot,
    contradictionId: string,
  ): boolean {
    return snapshot.contradictions.some(
      (contradiction) => contradiction.id === contradictionId,
    );
  }

  private findContradiction(
    snapshot: CasePlayabilitySnapshot,
    contradictionId: string,
  ): AdminContradictionRecord | undefined {
    return snapshot.contradictions.find(
      (contradiction) => contradiction.id === contradictionId,
    );
  }
}
