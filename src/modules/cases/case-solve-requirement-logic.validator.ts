import { Injectable } from '@nestjs/common';
import {
  AdminCaseDifficulty,
  AdminProofRole,
  AdminRequirementType,
} from './constants/admin-case.constants';
import {
  AdminContradictionRecord,
  AdminEvidenceRecord,
  AdminStatementRecord,
} from './cases.repository';

const REQUIRED_MANDATORY_PROOF_KEYS = [
  'culprit',
  'method',
  'motive',
  'opportunity',
  'identity',
] as const;
const CULPRIT_REQUIREMENT_TYPE = 'culprit';
const INNOCENT_EXCLUSION_METADATA_KEY = 'logicValidation';
const MOTIVE_PROOF_KEY = 'motive';

type MandatoryProofKey = (typeof REQUIRED_MANDATORY_PROOF_KEYS)[number];

export interface SolveRequirementLogicRecord {
  readonly description: string;
  readonly isMandatory: boolean;
  readonly proofRole?: string;
  readonly requiredContradictionId?: string;
  readonly requiredEvidenceId?: string;
  readonly requiredSuspectId?: string;
  readonly requirementType: string;
}

export interface SolveRequirementLogicValidationInput {
  readonly contradictions: readonly AdminContradictionRecord[];
  readonly culpritSuspectId: string;
  readonly difficulty: AdminCaseDifficulty;
  readonly evidences: readonly AdminEvidenceRecord[];
  readonly requirements: readonly SolveRequirementLogicRecord[];
  readonly statements: readonly AdminStatementRecord[];
}

@Injectable()
export class CaseSolveRequirementLogicValidator {
  validate(input: SolveRequirementLogicValidationInput): readonly string[] {
    const mandatoryRequirements = this.findMandatoryRequirements(
      input.requirements,
    );

    return [
      ...this.validateMandatoryProofCoverage(input, mandatoryRequirements),
      ...this.validateDuplicateMandatoryProofKeys(mandatoryRequirements),
      ...this.validateUniqueMandatoryProofTargets(mandatoryRequirements),
      ...mandatoryRequirements.flatMap((requirement) =>
        this.validateMandatoryRequirement(input, requirement),
      ),
    ];
  }

  private findMandatoryRequirements(
    requirements: readonly SolveRequirementLogicRecord[],
  ): readonly SolveRequirementLogicRecord[] {
    return requirements.filter((requirement) => requirement.isMandatory);
  }

  private validateMandatoryProofCoverage(
    input: SolveRequirementLogicValidationInput,
    requirements: readonly SolveRequirementLogicRecord[],
  ): readonly string[] {
    const coveredProofKeys = new Set(
      requirements.map((requirement) => this.createProofKey(requirement)),
    );
    const issues = REQUIRED_MANDATORY_PROOF_KEYS.filter(
      (proofKey) => !coveredProofKeys.has(proofKey),
    ).map(
      (proofKey) =>
        `El caso necesita un requisito obligatorio que pruebe "${proofKey}".`,
    );

    return [...issues, ...this.validateCulpritRequirement(input, requirements)];
  }

  private validateCulpritRequirement(
    input: SolveRequirementLogicValidationInput,
    requirements: readonly SolveRequirementLogicRecord[],
  ): readonly string[] {
    const hasCulpritRequirement = requirements.some(
      (requirement) =>
        requirement.requirementType === CULPRIT_REQUIREMENT_TYPE &&
        requirement.requiredSuspectId === input.culpritSuspectId,
    );

    return hasCulpritRequirement
      ? []
      : [
          'El caso necesita un requisito culprit obligatorio para el culpable definido en la solucion.',
        ];
  }

  private validateDuplicateMandatoryProofKeys(
    requirements: readonly SolveRequirementLogicRecord[],
  ): readonly string[] {
    const proofKeyCounts = this.countMandatoryProofKeys(requirements);

    return [...proofKeyCounts.entries()]
      .filter(([proofKey, count]) => proofKey !== 'culprit' && count > 1)
      .map(
        ([proofKey]) =>
          `El caso no puede exigir mas de un requisito obligatorio para "${proofKey}". Convierte las pruebas extra en opcionales.`,
      );
  }

  private countMandatoryProofKeys(
    requirements: readonly SolveRequirementLogicRecord[],
  ): Map<MandatoryProofKey | string, number> {
    return requirements.reduce((counts, requirement) => {
      const proofKey = this.createProofKey(requirement);
      counts.set(proofKey, (counts.get(proofKey) ?? 0) + 1);

      return counts;
    }, new Map<MandatoryProofKey | string, number>());
  }

  private validateUniqueMandatoryProofTargets(
    requirements: readonly SolveRequirementLogicRecord[],
  ): readonly string[] {
    const targetOwners = new Map<string, SolveRequirementLogicRecord>();
    const issues: string[] = [];

    for (const requirement of requirements) {
      const targetKey = this.createProofTargetKey(requirement);

      if (!targetKey) {
        continue;
      }

      const previousRequirement = targetOwners.get(targetKey);

      if (previousRequirement) {
        issues.push(
          `La misma evidencia o contradiccion obligatoria no puede probar "${this.createProofKey(previousRequirement)}" y "${this.createProofKey(requirement)}". Usa una relacion 1 a 1 entre prueba obligatoria y solve requirement.`,
        );
        continue;
      }

      targetOwners.set(targetKey, requirement);
    }

    return issues;
  }

  private validateMandatoryRequirement(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): readonly string[] {
    return [
      ...this.validateMandatoryEvidence(input, requirement),
      ...this.validateMandatoryContradiction(input, requirement),
      ...this.validateMandatoryMotive(input, requirement),
      ...this.validateMandatoryOpportunity(input, requirement),
    ];
  }

  private validateMandatoryMotive(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): readonly string[] {
    if (this.createProofKey(requirement) !== MOTIVE_PROOF_KEY) {
      return [];
    }

    if (
      !requirement.requiredEvidenceId &&
      !requirement.requiredContradictionId
    ) {
      return [
        `El requisito motive "${requirement.description}" debe apuntar a una evidencia o contradiccion que pruebe el motivo del culpable.`,
      ];
    }

    return this.validateMotiveEvidenceTargetsCulprit(input, requirement);
  }

  private validateMotiveEvidenceTargetsCulprit(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): readonly string[] {
    const evidence = this.findEvidence(input, requirement.requiredEvidenceId);

    if (!evidence || this.evidenceTargetsCulprit(evidence, input)) {
      return [];
    }

    return [
      `El requisito motive "${requirement.description}" debe usar una evidencia relacionada con el culpable.`,
    ];
  }

  private validateMandatoryEvidence(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): readonly string[] {
    const evidence = this.findEvidence(input, requirement.requiredEvidenceId);

    if (!evidence) {
      return [];
    }

    return [
      ...this.validateMandatoryEvidenceIsNotDecoy(requirement, evidence),
      ...this.validateMandatoryEvidenceProofRole(requirement, evidence),
      ...this.validateMandatoryEvidenceTargetsCulprit(
        input,
        requirement,
        evidence,
      ),
    ];
  }

  private validateMandatoryEvidenceIsNotDecoy(
    requirement: SolveRequirementLogicRecord,
    evidence: AdminEvidenceRecord,
  ): readonly string[] {
    return evidence.isDecoy
      ? [
          `El requisito "${requirement.description}" no puede usar la evidencia distractora "${evidence.title}" como obligatoria.`,
        ]
      : [];
  }

  private validateMandatoryEvidenceProofRole(
    requirement: SolveRequirementLogicRecord,
    evidence: AdminEvidenceRecord,
  ): readonly string[] {
    if (requirement.requirementType === CULPRIT_REQUIREMENT_TYPE) {
      return [];
    }

    const proofKey = this.createProofKey(requirement);

    return this.readEvidenceProofRoles(evidence).includes(proofKey)
      ? []
      : [
          `El requisito "${requirement.description}" usa la evidencia "${evidence.title}", pero su metadata no declara primaryProofRole/proofRoles="${proofKey}".`,
        ];
  }

  private validateMandatoryEvidenceTargetsCulprit(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
    evidence: AdminEvidenceRecord,
  ): readonly string[] {
    if (!this.targetsOnlyInnocentSuspects(evidence, input.culpritSuspectId)) {
      return [];
    }

    if (
      input.difficulty !== 'easy' &&
      this.allowsMandatoryInnocentExclusion(evidence)
    ) {
      return [];
    }

    return [
      `El requisito "${requirement.description}" usa una evidencia enfocada solo en sospechosos inocentes.`,
    ];
  }

  private validateMandatoryContradiction(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): readonly string[] {
    const contradiction = this.findContradiction(
      input,
      requirement.requiredContradictionId,
    );

    if (!contradiction) {
      return [];
    }

    return [
      ...this.validateMandatoryContradictionTargetsCulprit(
        input,
        requirement,
        contradiction,
      ),
      ...this.validateMandatoryContradictionProofRole(
        requirement,
        contradiction,
      ),
      ...this.validateMandatoryContradictionDoesNotUseDecoyEvidence(
        input,
        requirement,
        contradiction,
      ),
    ];
  }

  private validateMandatoryContradictionTargetsCulprit(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
    contradiction: AdminContradictionRecord,
  ): readonly string[] {
    return this.contradictionTargetsCulprit(input, contradiction)
      ? []
      : [
          `El requisito "${requirement.description}" exige una contradiccion que no esta asociada al culpable.`,
        ];
  }

  private validateMandatoryContradictionDoesNotUseDecoyEvidence(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
    contradiction: AdminContradictionRecord,
  ): readonly string[] {
    const refutingEvidence = this.findEvidence(
      input,
      contradiction.refutingEvidenceId,
    );

    return refutingEvidence?.isDecoy
      ? [
          `El requisito "${requirement.description}" exige una contradiccion sostenida por una evidencia distractora.`,
        ]
      : [];
  }

  private validateMandatoryContradictionProofRole(
    requirement: SolveRequirementLogicRecord,
    contradiction: AdminContradictionRecord,
  ): readonly string[] {
    if (requirement.requirementType === CULPRIT_REQUIREMENT_TYPE) {
      return [];
    }

    const proofKey = this.createProofKey(requirement);

    return contradiction.proves === proofKey
      ? []
      : [
          `El requisito "${requirement.description}" usa la contradiccion "${contradiction.title}", pero su proves es "${contradiction.proves}" y no "${proofKey}".`,
        ];
  }

  private validateMandatoryOpportunity(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): readonly string[] {
    if (this.createProofKey(requirement) !== 'opportunity') {
      return [];
    }

    return this.requirementTargetsCulprit(input, requirement)
      ? []
      : [
          `El requisito opportunity "${requirement.description}" debe probar oportunidad del culpable, no la coartada de otro sospechoso.`,
        ];
  }

  private requirementTargetsCulprit(
    input: SolveRequirementLogicValidationInput,
    requirement: SolveRequirementLogicRecord,
  ): boolean {
    if (requirement.requiredSuspectId === input.culpritSuspectId) {
      return true;
    }

    const evidence = this.findEvidence(input, requirement.requiredEvidenceId);
    if (evidence && this.evidenceTargetsCulprit(evidence, input)) {
      return true;
    }

    const contradiction = this.findContradiction(
      input,
      requirement.requiredContradictionId,
    );

    return Boolean(
      contradiction && this.contradictionTargetsCulprit(input, contradiction),
    );
  }

  private contradictionTargetsCulprit(
    input: SolveRequirementLogicValidationInput,
    contradiction: AdminContradictionRecord,
  ): boolean {
    if (contradiction.suspectId === input.culpritSuspectId) {
      return true;
    }

    const statement = input.statements.find(
      (candidate) => candidate.id === contradiction.statementId,
    );

    return statement?.suspectId === input.culpritSuspectId;
  }

  private evidenceTargetsCulprit(
    evidence: AdminEvidenceRecord,
    input: SolveRequirementLogicValidationInput,
  ): boolean {
    const relatedSuspectIds = this.readRelatedSuspectIds(evidence);

    return relatedSuspectIds.includes(input.culpritSuspectId);
  }

  private targetsOnlyInnocentSuspects(
    evidence: AdminEvidenceRecord,
    culpritSuspectId: string,
  ): boolean {
    const relatedSuspectIds = this.readRelatedSuspectIds(evidence);

    return (
      relatedSuspectIds.length > 0 &&
      !relatedSuspectIds.includes(culpritSuspectId)
    );
  }

  private allowsMandatoryInnocentExclusion(
    evidence: AdminEvidenceRecord,
  ): boolean {
    const logicValidation = evidence.metadata[INNOCENT_EXCLUSION_METADATA_KEY];

    if (!this.isRecord(logicValidation)) {
      return false;
    }

    return (
      logicValidation.allowsMandatoryInnocentExclusion === true &&
      typeof logicValidation.reason === 'string' &&
      logicValidation.reason.trim().length > 0
    );
  }

  private createProofKey(
    requirement: SolveRequirementLogicRecord,
  ): AdminProofRole | AdminRequirementType | string {
    if (requirement.requirementType === CULPRIT_REQUIREMENT_TYPE) {
      return CULPRIT_REQUIREMENT_TYPE;
    }

    return requirement.proofRole ?? requirement.requirementType;
  }

  private readRelatedSuspectIds(evidence: AdminEvidenceRecord): string[] {
    const value = evidence.metadata.relatedSuspectIds;

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private readEvidenceProofRoles(evidence: AdminEvidenceRecord): string[] {
    const primaryProofRole = evidence.metadata.primaryProofRole;
    const proofRoles = evidence.metadata.proofRoles;
    const roles = Array.isArray(proofRoles)
      ? proofRoles.filter((item): item is string => typeof item === 'string')
      : [];

    return typeof primaryProofRole === 'string'
      ? [primaryProofRole, ...roles]
      : roles;
  }

  private createProofTargetKey(
    requirement: SolveRequirementLogicRecord,
  ): string | undefined {
    if (requirement.requiredEvidenceId) {
      return `evidence:${requirement.requiredEvidenceId}`;
    }

    if (requirement.requiredContradictionId) {
      return `contradiction:${requirement.requiredContradictionId}`;
    }

    return undefined;
  }

  private findEvidence(
    input: SolveRequirementLogicValidationInput,
    evidenceId?: string,
  ): AdminEvidenceRecord | undefined {
    if (!evidenceId) {
      return undefined;
    }

    return input.evidences.find((evidence) => evidence.id === evidenceId);
  }

  private findContradiction(
    input: SolveRequirementLogicValidationInput,
    contradictionId?: string,
  ): AdminContradictionRecord | undefined {
    if (!contradictionId) {
      return undefined;
    }

    return input.contradictions.find(
      (contradiction) => contradiction.id === contradictionId,
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
