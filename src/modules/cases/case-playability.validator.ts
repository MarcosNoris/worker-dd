import { Injectable } from '@nestjs/common';
import {
  AdminActionPrerequisiteRecord,
  AdminContradictionRecord,
  AdminEvidenceRecord,
  AdminInvestigationActionRecord,
  AdminSolveRequirementRecord,
  CasePlayabilitySnapshot,
} from './cases.repository';

const MINIMUM_SUSPECTS = 2;

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
  validate(snapshot: CasePlayabilitySnapshot): CasePlayabilityValidation {
    const blockingIssues = [
      ...this.validateSolution(snapshot),
      ...this.validateMinimumContent(snapshot),
      ...this.validateContradictions(snapshot),
      ...this.validateActionPrerequisites(snapshot),
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

  private hasAction(
    snapshot: CasePlayabilitySnapshot,
    actionId: string,
  ): boolean {
    return snapshot.actions.some((action) => action.id === actionId);
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
