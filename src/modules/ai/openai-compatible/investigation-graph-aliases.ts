import { GenerateCaseInvestigationGraphInput } from '../types/ai.types';

export interface InvestigationGraphAliasReference {
  readonly alias: string;
  readonly id: string;
}

export interface InvestigationGraphAliasCatalog {
  readonly contradictions: readonly InvestigationGraphAliasReference[];
  readonly evidences: readonly InvestigationGraphAliasReference[];
  readonly requirements: readonly InvestigationGraphAliasReference[];
  readonly statements: readonly InvestigationGraphAliasReference[];
  readonly suspects: readonly InvestigationGraphAliasReference[];
}

const ENTITY_ALIAS_PREFIXES = {
  contradiction: 'CT',
  evidence: 'EV',
  requirement: 'REQ',
  statement: 'ST',
  suspect: 'SP',
} as const;

export function createInvestigationGraphAliasCatalog(
  input: GenerateCaseInvestigationGraphInput,
): InvestigationGraphAliasCatalog {
  return {
    contradictions: createAliasReferences(
      input.contradictions,
      ENTITY_ALIAS_PREFIXES.contradiction,
    ),
    evidences: createAliasReferences(
      input.evidences,
      ENTITY_ALIAS_PREFIXES.evidence,
    ),
    requirements: createAliasReferences(
      input.requirements,
      ENTITY_ALIAS_PREFIXES.requirement,
    ),
    statements: createAliasReferences(
      input.statements,
      ENTITY_ALIAS_PREFIXES.statement,
    ),
    suspects: createAliasReferences(
      input.suspects,
      ENTITY_ALIAS_PREFIXES.suspect,
    ),
  };
}

export function findAliasById(
  references: readonly InvestigationGraphAliasReference[],
  id: string | undefined,
): string | undefined {
  return references.find((reference) => reference.id === id)?.alias;
}

export function formatAllowedAliases(
  references: readonly InvestigationGraphAliasReference[],
): string {
  return references.map((reference) => reference.alias).join(', ');
}

export function resolveIdFromAliasOrId(
  references: readonly InvestigationGraphAliasReference[],
  value: string,
): string | undefined {
  const trimmedValue = value.trim();
  const normalizedAlias = normalizeInvestigationGraphAlias(trimmedValue);

  return references.find(
    (reference) =>
      reference.alias === normalizedAlias || reference.id === trimmedValue,
  )?.id;
}

function createAliasReferences(
  records: readonly { readonly id: string }[],
  prefix: string,
): readonly InvestigationGraphAliasReference[] {
  return records.map((record, index) => ({
    alias: `${prefix}${index + 1}`,
    id: record.id,
  }));
}

function normalizeInvestigationGraphAlias(value: string): string {
  return replaceAliasWords(
    value
      .trim()
      .toUpperCase()
      .replace(/[\s_-]+/g, ''),
  );
}

function replaceAliasWords(value: string): string {
  return [
    [/^EVIDENCE(?=\d+$)/, ENTITY_ALIAS_PREFIXES.evidence],
    [/^EVIDENCIA(?=\d+$)/, ENTITY_ALIAS_PREFIXES.evidence],
    [/^STATEMENT(?=\d+$)/, ENTITY_ALIAS_PREFIXES.statement],
    [/^DECLARACION(?=\d+$)/, ENTITY_ALIAS_PREFIXES.statement],
    [/^CONTRADICTION(?=\d+$)/, ENTITY_ALIAS_PREFIXES.contradiction],
    [/^CONTRADICCION(?=\d+$)/, ENTITY_ALIAS_PREFIXES.contradiction],
    [/^SUSPECT(?=\d+$)/, ENTITY_ALIAS_PREFIXES.suspect],
    [/^SOSPECHOSO(?=\d+$)/, ENTITY_ALIAS_PREFIXES.suspect],
    [/^REQUIREMENT(?=\d+$)/, ENTITY_ALIAS_PREFIXES.requirement],
    [/^REQUISITO(?=\d+$)/, ENTITY_ALIAS_PREFIXES.requirement],
  ].reduce(
    (normalizedValue, [pattern, replacement]) =>
      normalizedValue.replace(pattern, replacement as string),
    value,
  );
}
