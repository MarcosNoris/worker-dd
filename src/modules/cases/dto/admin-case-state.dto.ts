import type { CasePlayabilityValidation } from '../case-playability.validator';
import type { CasePlayabilitySnapshot } from '../cases.repository';

export type AdminCaseProcessCode =
  | 'add_suspects'
  | 'add_evidences'
  | 'add_statements'
  | 'add_contradictions'
  | 'add_solution'
  | 'add_solve_requirements'
  | 'add_actions'
  | 'configure_evidence_unlock_rules'
  | 'configure_statement_unlock_rules'
  | 'configure_contradiction_unlock_rules'
  | 'configure_action_prerequisites'
  | 'resolve_blocking_issues'
  | 'ready_to_publish'
  | 'playable';

export interface AdminCaseProcessDto {
  readonly code: AdminCaseProcessCode;
  readonly label: string;
}

export interface AdminCaseProgressItemDto {
  readonly count: number;
  readonly hasItems: boolean;
}

export interface AdminCaseUnlockRulesProgressDto {
  readonly actionPrerequisites: AdminCaseProgressItemDto;
  readonly contradictions: AdminCaseProgressItemDto;
  readonly evidences: AdminCaseProgressItemDto;
  readonly statements: AdminCaseProgressItemDto;
}

export interface AdminCaseProgressDto {
  readonly actions: AdminCaseProgressItemDto;
  readonly contradictions: AdminCaseProgressItemDto;
  readonly evidences: AdminCaseProgressItemDto;
  readonly solution: AdminCaseProgressItemDto;
  readonly solveRequirements: AdminCaseProgressItemDto;
  readonly statements: AdminCaseProgressItemDto;
  readonly suspects: AdminCaseProgressItemDto;
  readonly unlockRules: AdminCaseUnlockRulesProgressDto;
}

export interface AdminCasePublishabilityDto {
  readonly blockingIssues: readonly string[];
  readonly canPublish: boolean;
  readonly warnings: readonly string[];
}

export interface AdminCaseStateResponseDto {
  readonly caseId: string;
  readonly currentProcess: AdminCaseProcessDto;
  readonly progress: AdminCaseProgressDto;
  readonly publishability: AdminCasePublishabilityDto;
  readonly status: string;
}

interface PendingCaseProcess {
  readonly code: AdminCaseProcessCode;
  readonly isPending: boolean;
}

const PLAYABLE_CASE_STATUS = 'playable';
const PROCESS_LABELS = {
  add_actions: 'Crear acciones de investigacion',
  add_contradictions: 'Cargar contradicciones',
  add_evidences: 'Cargar evidencias',
  add_solution: 'Definir solucion privada',
  add_solve_requirements: 'Definir requisitos de resolucion',
  add_statements: 'Cargar declaraciones',
  add_suspects: 'Cargar sospechosos',
  configure_action_prerequisites: 'Configurar prerequisitos de acciones',
  configure_contradiction_unlock_rules:
    'Configurar reglas de desbloqueo de contradicciones',
  configure_evidence_unlock_rules:
    'Configurar reglas de desbloqueo de evidencias',
  configure_statement_unlock_rules:
    'Configurar reglas de desbloqueo de declaraciones',
  playable: 'Caso publicado y jugable',
  ready_to_publish: 'Listo para publicar',
  resolve_blocking_issues: 'Resolver bloqueos de publicacion',
} as const satisfies Record<AdminCaseProcessCode, string>;

export function createAdminCaseStateResponse(
  snapshot: CasePlayabilitySnapshot,
  validation: CasePlayabilityValidation,
): AdminCaseStateResponseDto {
  return {
    caseId: snapshot.caseRecord.id,
    currentProcess: createCurrentProcess(snapshot, validation),
    progress: createProgress(snapshot),
    publishability: {
      blockingIssues: validation.blockingIssues,
      canPublish: validation.canPublish,
      warnings: validation.warnings,
    },
    status: snapshot.caseRecord.status,
  };
}

function createCurrentProcess(
  snapshot: CasePlayabilitySnapshot,
  validation: CasePlayabilityValidation,
): AdminCaseProcessDto {
  const pendingProcess = findPendingProcess(snapshot);

  if (pendingProcess) {
    return createProcess(pendingProcess);
  }

  if (!validation.canPublish) {
    return createProcess('resolve_blocking_issues');
  }

  if (snapshot.caseRecord.status === PLAYABLE_CASE_STATUS) {
    return createProcess('playable');
  }

  return createProcess('ready_to_publish');
}

function findPendingProcess(
  snapshot: CasePlayabilitySnapshot,
): AdminCaseProcessCode | undefined {
  return createPendingProcesses(snapshot).find((process) => process.isPending)
    ?.code;
}

function createPendingProcesses(
  snapshot: CasePlayabilitySnapshot,
): readonly PendingCaseProcess[] {
  return [
    createPendingProcess('add_suspects', snapshot.suspects.length === 0),
    createPendingProcess('add_evidences', snapshot.evidences.length === 0),
    createPendingProcess('add_statements', snapshot.statements.length === 0),
    createPendingProcess(
      'add_contradictions',
      snapshot.contradictions.length === 0,
    ),
    createPendingProcess('add_solution', !snapshot.solution),
    createPendingProcess(
      'add_solve_requirements',
      snapshot.requirements.length === 0,
    ),
    createPendingProcess('add_actions', snapshot.actions.length === 0),
    createPendingProcess(
      'configure_evidence_unlock_rules',
      hasLockedEvidences(snapshot) && snapshot.evidenceUnlockRules.length === 0,
    ),
    createPendingProcess(
      'configure_statement_unlock_rules',
      hasHiddenStatementsWithoutUnlockRule(snapshot),
    ),
    createPendingProcess(
      'configure_contradiction_unlock_rules',
      hasLockedContradictions(snapshot) &&
        snapshot.contradictionUnlockRules.length === 0,
    ),
    createPendingProcess(
      'configure_action_prerequisites',
      hasLockedActions(snapshot) && snapshot.actionPrerequisites.length === 0,
    ),
  ];
}

function createPendingProcess(
  code: AdminCaseProcessCode,
  isPending: boolean,
): PendingCaseProcess {
  return {
    code,
    isPending,
  };
}

function hasLockedEvidences(snapshot: CasePlayabilitySnapshot): boolean {
  return snapshot.evidences.some((evidence) => !evidence.isInitiallyVisible);
}

function hasHiddenStatementsWithoutUnlockRule(
  snapshot: CasePlayabilitySnapshot,
): boolean {
  const statementIdsWithUnlockRule = createStatementIdsWithUnlockRule(snapshot);

  return snapshot.statements.some(
    (statement) =>
      !statement.isInitiallyVisible &&
      !statementIdsWithUnlockRule.has(statement.id),
  );
}

function createStatementIdsWithUnlockRule(
  snapshot: CasePlayabilitySnapshot,
): ReadonlySet<string> {
  return new Set(
    snapshot.statementUnlockRules.map((rule) => rule.statementId),
  );
}

function hasLockedContradictions(snapshot: CasePlayabilitySnapshot): boolean {
  return snapshot.contradictions.some(
    (contradiction) => !contradiction.isInitiallyVisible,
  );
}

function hasLockedActions(snapshot: CasePlayabilitySnapshot): boolean {
  return snapshot.actions.some((action) => !action.isInitiallyAvailable);
}

function createProcess(code: AdminCaseProcessCode): AdminCaseProcessDto {
  return {
    code,
    label: PROCESS_LABELS[code],
  };
}

function createProgress(
  snapshot: CasePlayabilitySnapshot,
): AdminCaseProgressDto {
  return {
    actions: createProgressItem(snapshot.actions.length),
    contradictions: createProgressItem(snapshot.contradictions.length),
    evidences: createProgressItem(snapshot.evidences.length),
    solution: createProgressItem(snapshot.solution ? 1 : 0),
    solveRequirements: createProgressItem(snapshot.requirements.length),
    statements: createProgressItem(snapshot.statements.length),
    suspects: createProgressItem(snapshot.suspects.length),
    unlockRules: {
      actionPrerequisites: createProgressItem(
        snapshot.actionPrerequisites.length,
      ),
      contradictions: createProgressItem(
        snapshot.contradictionUnlockRules.length,
      ),
      evidences: createProgressItem(snapshot.evidenceUnlockRules.length),
      statements: createProgressItem(snapshot.statementUnlockRules.length),
    },
  };
}

function createProgressItem(count: number): AdminCaseProgressItemDto {
  return {
    count,
    hasItems: count > 0,
  };
}
