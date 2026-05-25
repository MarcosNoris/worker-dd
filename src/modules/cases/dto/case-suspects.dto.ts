import type {
  AdminStatementRecord,
  AdminSuspectRecord,
} from '../cases.repository';

export interface CaseSuspectStatementDto {
  readonly caseId: string;
  readonly content: string;
  readonly context?: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isInitiallyVisible: boolean;
  readonly speakerName: string;
  readonly suspectId?: string;
}

export interface CaseSuspectDto {
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
  readonly statements: readonly CaseSuspectStatementDto[];
}

export interface CaseSuspectsResponseDto {
  readonly suspects: readonly CaseSuspectDto[];
}

interface CaseSuspectsResponseSource {
  readonly statements: readonly AdminStatementRecord[];
  readonly suspects: readonly AdminSuspectRecord[];
}

export function createCaseSuspectsResponse(
  source: CaseSuspectsResponseSource,
): CaseSuspectsResponseDto {
  const statementsBySuspectId = groupStatementsBySuspectId(source.statements);

  return {
    suspects: source.suspects.map((suspect) =>
      createCaseSuspectResponse({
        statements: statementsBySuspectId.get(suspect.id) ?? [],
        suspect,
      }),
    ),
  };
}

interface CaseSuspectResponseSource {
  readonly statements: readonly AdminStatementRecord[];
  readonly suspect: AdminSuspectRecord;
}

function groupStatementsBySuspectId(
  statements: readonly AdminStatementRecord[],
): Map<string, AdminStatementRecord[]> {
  return statements.reduce((groups, statement) => {
    if (statement.suspectId) {
      groups.set(statement.suspectId, [
        ...(groups.get(statement.suspectId) ?? []),
        statement,
      ]);
    }

    return groups;
  }, new Map<string, AdminStatementRecord[]>());
}

function createCaseSuspectResponse({
  statements,
  suspect,
}: CaseSuspectResponseSource): CaseSuspectDto {
  return {
    age: suspect.age,
    background: suspect.background,
    caseId: suspect.caseId,
    createdAt: suspect.createdAt,
    id: suspect.id,
    name: suspect.name,
    occupation: suspect.occupation,
    personality: suspect.personality,
    publicNotes: suspect.publicNotes,
    relationshipToVictim: suspect.relationshipToVictim,
    statements: statements.map((statement) =>
      createCaseSuspectStatementResponse(statement),
    ),
  };
}

function createCaseSuspectStatementResponse(
  statement: AdminStatementRecord,
): CaseSuspectStatementDto {
  return {
    caseId: statement.caseId,
    content: statement.content,
    context: statement.context,
    createdAt: statement.createdAt,
    id: statement.id,
    isInitiallyVisible: statement.isInitiallyVisible,
    speakerName: statement.speakerName,
    suspectId: statement.suspectId,
  };
}
