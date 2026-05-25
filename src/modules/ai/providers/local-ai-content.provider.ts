import { Injectable } from '@nestjs/common';
import { createId } from '../../../shared/utils/id.util';
import { Case, Clue, LogEntry, Suspect } from '../../cases/types/case.types';
import {
  InvestigationStepResult,
  SuspectUpdate,
  VerdictResult,
} from '../../investigations/types/investigation.types';
import {
  AiContentGenerationResult,
  CaseContradictionGenerationStatementContext,
  CaseEvidenceGenerationSuspectContext,
  CaseStatementGenerationEvidenceContext,
  GeneratedCaseContradiction,
  GeneratedCaseContradictionsContent,
  GeneratedCaseEvidence,
  GeneratedCaseEvidencesContent,
  GeneratedAdminCaseBase,
  GeneratedCaseSuspect,
  GeneratedCaseSuspectsContent,
  GeneratedActionPrerequisite,
  GeneratedCaseInvestigationAction,
  GeneratedCaseInvestigationGraphContent,
  GeneratedContradictionUnlockRule,
  GeneratedEvidenceUnlockRule,
  GeneratedCaseSolveRequirement,
  GeneratedCaseSolveRequirementsContent,
  GeneratedCaseSolution,
  GeneratedStatementUnlockRule,
  GeneratedCaseStatement,
  GeneratedCaseStatementsContent,
  GenerateAdminCaseBaseInput,
  GenerateCaseContradictionsInput,
  GenerateCaseInput,
  GenerateCaseEvidencesInput,
  GenerateCaseInvestigationGraphInput,
  GenerateCaseSolveRequirementsInput,
  GenerateCaseSolutionInput,
  GenerateCaseStatementsInput,
  GenerateCaseSuspectsInput,
  InvestigationStepInput,
  VerdictInput,
} from '../types/ai.types';
import { createInvestigationGraphActionBudget } from '../openai-compatible/investigation-graph-action-budget';
import { AiContentProvider } from './ai-content-provider.interface';

const DEFAULT_CASE_LOCATION = 'Distrito Central, DEP City';
const DEFAULT_ADMIN_CASE_THEME = 'un sabotaje interno en un archivo policial';
const MAX_ADMIN_CASE_TITLE_LENGTH = 160;
const MINIMUM_REASONING_LENGTH = 15;
const MINIMUM_INVESTIGATION_SKILL_LEVEL = 50;
type LocalSuspectRole = 'principal' | 'testigo' | 'beneficiaria';

interface LocalSuspectProfile {
  readonly role: LocalSuspectRole;
  readonly name: string;
  readonly age: number;
}

interface LocalAdminSuspectProfile {
  readonly age: number;
  readonly background: string;
  readonly name: string;
  readonly occupation: string;
  readonly personality: string;
  readonly publicNotes: string;
  readonly relationshipToVictim: string;
}

interface LocalClueProfile {
  readonly name: string;
  readonly category: Clue['category'];
  readonly relevance: Clue['relevance'];
}

interface LogDraft {
  readonly title: string;
  readonly text: string;
  readonly type: LogEntry['type'];
}

interface GeneratedEvidenceDraft {
  readonly description: string;
  readonly discoveryHint?: string;
  readonly importance: GeneratedCaseEvidence['importance'];
  readonly input: GenerateCaseEvidencesInput;
  readonly isDecoy?: boolean;
  readonly isInitiallyVisible?: boolean;
  readonly location?: string;
  readonly proves: readonly string[];
  readonly relatedSuspect?: CaseEvidenceGenerationSuspectContext;
  readonly title: string;
  readonly type: GeneratedCaseEvidence['type'];
  readonly weight: number;
}

interface GeneratedStatementCommand {
  readonly input: GenerateCaseStatementsInput;
  readonly suspect: CaseEvidenceGenerationSuspectContext;
  readonly suspectIndex: number;
}

interface LocalInvestigationActionDraft {
  readonly actionType: GeneratedCaseInvestigationAction['actionType'];
  readonly description: string;
  readonly isInitiallyAvailable?: boolean;
  readonly requiredSkill: NonNullable<
    GeneratedCaseInvestigationAction['requiredSkill']
  >;
  readonly tempId: string;
  readonly title: string;
}

const LOCAL_SUSPECT_PROFILES: readonly LocalSuspectProfile[] = [
  { role: 'principal', name: 'Valeria Montes', age: 38 },
  { role: 'testigo', name: 'Rafael Cardenas', age: 31 },
  { role: 'beneficiaria', name: 'Iris Duarte', age: 31 },
];

const OCCUPATIONS_BY_ROLE: Record<LocalSuspectRole, string> = {
  principal: 'Gerente de operaciones',
  testigo: 'Tecnico de seguridad',
  beneficiaria: 'Consultora independiente',
};

const RELATIONS_BY_ROLE: Record<LocalSuspectRole, string> = {
  principal: 'Tuvo acceso directo al lugar de los hechos',
  testigo: 'Reporto movimientos inusuales antes de la llamada',
  beneficiaria: 'Podria obtener ventaja si el caso queda sin resolver',
};

const LOCAL_ADMIN_SUSPECT_PROFILES: readonly LocalAdminSuspectProfile[] = [
  {
    age: 38,
    background: 'Controlaba procesos internos y tenia acceso rutinario.',
    name: 'Valeria Montes',
    occupation: 'Gerente de operaciones',
    personality: 'Metodica, reservada y acostumbrada a controlar detalles.',
    publicNotes: 'Su coartada requiere contraste con registros internos.',
    relationshipToVictim: 'Trabajaba directamente con la victima',
  },
  {
    age: 31,
    background: 'Conocia los turnos, accesos y puntos ciegos del lugar.',
    name: 'Rafael Cardenas',
    occupation: 'Tecnico de seguridad',
    personality: 'Observador, practico y defensivo bajo presion.',
    publicNotes: 'Reporto movimientos inusuales antes del incidente.',
    relationshipToVictim: 'Supervisaba accesos cercanos a la victima',
  },
  {
    age: 42,
    background: 'Tenia una disputa profesional documentada en el expediente.',
    name: 'Iris Duarte',
    occupation: 'Consultora independiente',
    personality: 'Persuasiva, calculadora y cuidadosa con su reputacion.',
    publicNotes: 'Podria beneficiarse si el caso queda sin resolver.',
    relationshipToVictim: 'Mantenia un conflicto economico con la victima',
  },
  {
    age: 47,
    background: 'Gestionaba documentos sensibles y rutas de aprobacion.',
    name: 'Tomas Arce',
    occupation: 'Coordinador administrativo',
    personality: 'Formal, evasivo y muy atento a las jerarquias.',
    publicNotes: 'Su firma aparece cerca de tramites relevantes.',
    relationshipToVictim: 'Compartia responsabilidades administrativas',
  },
  {
    age: 29,
    background: 'Conocia detalles personales que no estaban en el informe.',
    name: 'Nadia Rios',
    occupation: 'Asistente de direccion',
    personality: 'Aguda, nerviosa y protectora con informacion sensible.',
    publicNotes: 'Fue una de las ultimas personas en ver a la victima.',
    relationshipToVictim: 'Asistia directamente a la victima',
  },
  {
    age: 53,
    background: 'Tenia historial de roces con la unidad investigada.',
    name: 'Esteban Lira',
    occupation: 'Auditor externo',
    personality: 'Rigido, suspicaz y poco colaborativo.',
    publicNotes: 'Aparece en comunicaciones previas al incidente.',
    relationshipToVictim: 'Auditaba decisiones de la victima',
  },
];

@Injectable()
export class LocalAiContentProvider implements AiContentProvider {
  async generateCase(
    input: GenerateCaseInput,
  ): Promise<AiContentGenerationResult<Case>> {
    return this.createLocalResult(this.createCase(input));
  }

  async generateAdminCaseBase(
    input: GenerateAdminCaseBaseInput,
  ): Promise<AiContentGenerationResult<GeneratedAdminCaseBase>> {
    return this.createLocalResult(this.createAdminCaseBase(input));
  }

  async generateCaseEvidences(
    input: GenerateCaseEvidencesInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseEvidencesContent>> {
    return this.createLocalResult(this.createCaseEvidences(input));
  }

  async generateCaseSuspects(
    input: GenerateCaseSuspectsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSuspectsContent>> {
    return this.createLocalResult({
      suspects: this.createAdminCaseSuspects(input),
    });
  }

  async generateCaseContradictions(
    input: GenerateCaseContradictionsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseContradictionsContent>> {
    return this.createLocalResult(this.createCaseContradictions(input));
  }

  async generateCaseSolveRequirements(
    input: GenerateCaseSolveRequirementsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSolveRequirementsContent>> {
    return this.createLocalResult(this.createCaseSolveRequirements(input));
  }

  async generateCaseInvestigationGraph(
    input: GenerateCaseInvestigationGraphInput,
  ): Promise<
    AiContentGenerationResult<GeneratedCaseInvestigationGraphContent>
  > {
    return this.createLocalResult(this.createCaseInvestigationGraph(input));
  }

  async generateCaseSolution(
    input: GenerateCaseSolutionInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseSolution>> {
    return this.createLocalResult(this.createCaseSolution(input));
  }

  async generateCaseStatements(
    input: GenerateCaseStatementsInput,
  ): Promise<AiContentGenerationResult<GeneratedCaseStatementsContent>> {
    return this.createLocalResult(this.createCaseStatements(input));
  }

  async generateInvestigationStep(
    input: InvestigationStepInput,
  ): Promise<AiContentGenerationResult<InvestigationStepResult>> {
    if (input.actionType === 'clue') {
      return this.createLocalResult(this.createClueAnalysis(input));
    }

    if (input.actionType === 'suspect') {
      return this.createLocalResult(this.createInterrogation(input));
    }

    return this.createLocalResult(this.createGeneralAdvance(input));
  }

  async generateVerdict(
    input: VerdictInput,
  ): Promise<AiContentGenerationResult<VerdictResult>> {
    return this.createLocalResult(this.createVerdict(input));
  }

  private createLocalResult<TContent>(
    content: TContent,
  ): AiContentGenerationResult<TContent> {
    return {
      content,
      usedFallback: true,
    };
  }

  private createCase(input: GenerateCaseInput): Case {
    return {
      id: createId('case'),
      title: `Caso ${input.theme}`,
      codeName: this.createCodeName(input),
      description: this.createDescription(input),
      category: input.category,
      severity: input.severity,
      status: 'pending',
      location: DEFAULT_CASE_LOCATION,
      dateCreated: new Date().toISOString(),
      assignedDetectiveId: null,
      suspects: this.createSuspects(),
      clues: this.createInitialClues(input),
      logs: [this.createOpeningLog(input)],
    };
  }

  private createAdminCaseBase(
    input: GenerateAdminCaseBaseInput,
  ): GeneratedAdminCaseBase {
    const theme = input.theme ?? DEFAULT_ADMIN_CASE_THEME;
    const title = this.createUniqueAdminCaseTitle(theme, input.forbiddenTitles);

    return {
      difficulty: input.difficulty,
      publicBriefing: `La unidad recibe un expediente inicial sobre ${theme}. El briefing presenta suficientes preguntas abiertas para iniciar entrevistas, revisar evidencias y construir una teoria verificable.`,
      summary: `Caso generado localmente sobre ${theme}. El expediente base define el conflicto, la victima principal y una linea de investigacion adecuada para dificultad ${input.difficulty}.`,
      title,
      victimName: 'Victima pendiente de identificar',
    };
  }

  private createUniqueAdminCaseTitle(
    theme: string,
    forbiddenTitles: readonly string[],
  ): string {
    const baseTitle = this.truncateTitle(`Caso ${theme}`);
    const forbiddenTitleSet = new Set(
      forbiddenTitles.map((title) => this.normalizeTitle(title)),
    );

    if (!forbiddenTitleSet.has(this.normalizeTitle(baseTitle))) {
      return baseTitle;
    }

    return this.truncateTitle(
      `${baseTitle} ${Date.now().toString(36).toUpperCase()}`,
    );
  }

  private truncateTitle(title: string): string {
    return title.trim().slice(0, MAX_ADMIN_CASE_TITLE_LENGTH);
  }

  private normalizeTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private createCaseEvidences(
    input: GenerateCaseEvidencesInput,
  ): GeneratedCaseEvidencesContent {
    const culprit = this.findGeneratedCulprit(input);

    return {
      evidences: Array.from({ length: input.evidenceCount }, (_, index) =>
        this.createGeneratedEvidence(input, culprit, index),
      ),
      selectedCulpritSuspectId: culprit.id,
      solution: input.generateSolution
        ? this.createGeneratedSolution(input, culprit)
        : undefined,
    };
  }

  private createAdminCaseSuspects(
    input: GenerateCaseSuspectsInput,
  ): GeneratedCaseSuspect[] {
    return LOCAL_ADMIN_SUSPECT_PROFILES.slice(0, input.suspectCount).map(
      (profile) => this.createAdminCaseSuspect(input, profile),
    );
  }

  private createAdminCaseSuspect(
    input: GenerateCaseSuspectsInput,
    profile: LocalAdminSuspectProfile,
  ): GeneratedCaseSuspect {
    return {
      age: profile.age,
      background: `${profile.background} Caso vinculado: ${input.caseData.title}.`,
      name: profile.name,
      occupation: profile.occupation,
      personality: profile.personality,
      publicNotes: `${profile.publicNotes} Dificultad narrativa: ${input.difficulty}.`,
      relationshipToVictim: profile.relationshipToVictim,
    };
  }

  private createCaseStatements(
    input: GenerateCaseStatementsInput,
  ): GeneratedCaseStatementsContent {
    return {
      culpritSuspectId: input.culpritSuspectId,
      statements: input.suspects.map((suspect, suspectIndex) =>
        this.createGeneratedStatement({
          input,
          suspect,
          suspectIndex,
        }),
      ),
    };
  }

  private createCaseContradictions(
    input: GenerateCaseContradictionsInput,
  ): GeneratedCaseContradictionsContent {
    return {
      contradictions: [this.createLocalContradiction(input)],
      culpritSuspectId: input.culpritSuspectId,
      difficulty: input.difficulty,
    };
  }

  private createCaseSolution(
    input: GenerateCaseSolutionInput,
  ): GeneratedCaseSolution {
    const culprit = this.findCaseSolutionCulprit(input);
    const contradiction = this.findCaseSolutionContradiction(input, culprit.id);
    const evidence = this.findCaseSolutionEvidence(input, contradiction);

    return {
      culpritSuspectId: input.culpritSuspectId,
      fullExplanation: `${culprit.name} es el culpable porque el expediente conecta su motivo, su acceso y la contradiccion "${contradiction.title}" con la evidencia "${evidence.title}". La solucion se sostiene sin agregar pruebas nuevas al caso.`,
      methodSummary: `El metodo queda respaldado por "${evidence.title}" y por la contradiccion "${contradiction.title}".`,
      motiveSummary: `${culprit.name} tenia una presion directa relacionada con ${input.caseData.title}.`,
      opportunitySummary: `${culprit.name} tuvo una ventana practica que queda debilitada por su propia declaracion y la contradiccion registrada.`,
    };
  }

  private createCaseSolveRequirements(
    input: GenerateCaseSolveRequirementsInput,
  ): GeneratedCaseSolveRequirementsContent {
    return {
      culpritSuspectId: input.culpritSuspectId,
      difficulty: input.difficulty,
      requirements: this.createLocalSolveRequirements(input),
    };
  }

  private createCaseInvestigationGraph(
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedCaseInvestigationGraphContent {
    const actions = this.createLocalInvestigationActions(input);

    return {
      actionPrerequisites: this.createLocalActionPrerequisites(actions),
      actions,
      contradictionUnlockRules: this.createLocalContradictionUnlockRules(input),
      culpritSuspectId: input.culpritSuspectId,
      difficulty: input.difficulty,
      evidenceUnlockRules: this.createLocalEvidenceUnlockRules(input),
      statementUnlockRules: this.createLocalStatementUnlockRules(input),
    };
  }

  private createLocalInvestigationActions(
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedCaseInvestigationAction[] {
    const actions = this.createCoreInvestigationActions();
    const actionBudget = createInvestigationGraphActionBudget(input);

    while (actions.length < actionBudget.min) {
      actions.push(this.createFollowUpAction(actions.length));
    }

    return actions;
  }

  private createCoreInvestigationActions(): GeneratedCaseInvestigationAction[] {
    return [
      this.createInvestigationAction({
        actionType: 'inspect_scene',
        description:
          'Revisar el expediente, la escena principal y los materiales ya catalogados.',
        isInitiallyAvailable: true,
        requiredSkill: 'crime_scene_analysis',
        tempId: 'inspect_case_files',
        title: 'Revisar expediente y escena',
      }),
      this.createInvestigationAction({
        actionType: 'interview',
        description:
          'Tomar declaraciones formales a sospechosos y testigos clave.',
        isInitiallyAvailable: true,
        requiredSkill: 'interrogation',
        tempId: 'interview_case_circle',
        title: 'Entrevistar circulo del caso',
      }),
      this.createInvestigationAction({
        actionType: 'custom',
        description:
          'Cruzar declaraciones con evidencias para detectar inconsistencias utiles.',
        requiredSkill: 'psychology',
        tempId: 'compare_versions',
        title: 'Contrastar versiones y pruebas',
      }),
    ];
  }

  private createFollowUpAction(
    actionIndex: number,
  ): GeneratedCaseInvestigationAction {
    const actionNumber = actionIndex + 1;

    return this.createInvestigationAction({
      actionType: 'background_check',
      description:
        'Profundizar una linea secundaria para completar el expediente operativo.',
      requiredSkill: 'field_investigation',
      tempId: `follow_up_line_${actionNumber}`,
      title: `Seguimiento operativo ${actionNumber}`,
    });
  }

  private createInvestigationAction(
    action: LocalInvestigationActionDraft,
  ): GeneratedCaseInvestigationAction {
    return {
      actionType: action.actionType,
      baseDurationMinutes: 45,
      description: action.description,
      isInitiallyAvailable: action.isInitiallyAvailable ?? false,
      metadata: {
        narrativePurpose: action.title,
      },
      minimumSkillLevel: MINIMUM_INVESTIGATION_SKILL_LEVEL,
      requiredSkill: action.requiredSkill,
      requiresDetective: true,
      tempId: action.tempId,
      title: action.title,
    };
  }

  private createLocalEvidenceUnlockRules(
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedEvidenceUnlockRule[] {
    return input.evidences
      .filter((evidence) => !evidence.isInitiallyVisible)
      .map((evidence) => ({
        actionTempId: 'inspect_case_files',
        durationModifierMinutes: 0,
        evidenceId: evidence.id,
        isGuaranteed: true,
        minimumSkillLevel: MINIMUM_INVESTIGATION_SKILL_LEVEL,
        requiredSkill: 'crime_scene_analysis',
        successChance: 1,
      }));
  }

  private createLocalStatementUnlockRules(
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedStatementUnlockRule[] {
    return input.statements
      .filter((statement) => !statement.isInitiallyVisible)
      .map((statement) => ({
        actionTempId: 'interview_case_circle',
        isGuaranteed: true,
        minimumSkillLevel: MINIMUM_INVESTIGATION_SKILL_LEVEL,
        requiredSkill: 'interrogation',
        statementId: statement.id,
        successChance: 1,
      }));
  }

  private createLocalContradictionUnlockRules(
    input: GenerateCaseInvestigationGraphInput,
  ): GeneratedContradictionUnlockRule[] {
    return input.contradictions
      .filter((contradiction) => !contradiction.isInitiallyVisible)
      .map((contradiction) => ({
        actionTempId: 'compare_versions',
        contradictionId: contradiction.id,
        isGuaranteed: true,
        minimumSkillLevel: MINIMUM_INVESTIGATION_SKILL_LEVEL,
        requiredSkill: 'psychology',
        successChance: 1,
      }));
  }

  private createLocalActionPrerequisites(
    actions: readonly GeneratedCaseInvestigationAction[],
  ): GeneratedActionPrerequisite[] {
    return [
      ...this.createComparisonPrerequisites(actions),
      ...this.createFollowUpPrerequisites(actions),
    ];
  }

  private createComparisonPrerequisites(
    actions: readonly GeneratedCaseInvestigationAction[],
  ): GeneratedActionPrerequisite[] {
    const hasComparisonAction = actions.some(
      (action) => action.tempId === 'compare_versions',
    );

    return hasComparisonAction
      ? [
          {
            actionTempId: 'compare_versions',
            prerequisiteActionTempId: 'inspect_case_files',
          },
          {
            actionTempId: 'compare_versions',
            prerequisiteActionTempId: 'interview_case_circle',
          },
        ]
      : [];
  }

  private createFollowUpPrerequisites(
    actions: readonly GeneratedCaseInvestigationAction[],
  ): GeneratedActionPrerequisite[] {
    return actions
      .filter((action) => action.tempId.startsWith('follow_up_line_'))
      .map((action, actionIndex) => ({
        actionTempId: action.tempId,
        prerequisiteActionTempId:
          actionIndex === 0
            ? 'compare_versions'
            : `follow_up_line_${actionIndex + 3}`,
      }));
  }

  private createLocalSolveRequirements(
    input: GenerateCaseSolveRequirementsInput,
  ): GeneratedCaseSolveRequirement[] {
    const evidence =
      input.evidences[0] ?? this.createUnknownStatementEvidence();
    const contradiction =
      input.contradictions[0] ??
      this.createUnknownRequirementContradiction(input);
    const baseRequirements: GeneratedCaseSolveRequirement[] = [
      {
        description:
          'Identificar al culpable correcto segun la solucion privada.',
        isMandatory: true,
        proofRole: 'identity',
        requiredSuspectId: input.culpritSuspectId,
        requirementType: 'culprit',
        weight: 5,
      },
      {
        description: `Vincular la teoria del caso con la evidencia "${evidence.title}".`,
        isMandatory: true,
        proofRole: 'identity',
        requiredEvidenceId: evidence.id,
        requirementType: 'identity',
        weight: 3,
      },
      {
        description: `Detectar la contradiccion clave "${contradiction.title}".`,
        isMandatory: true,
        proofRole: 'contradiction',
        requiredContradictionId: contradiction.id,
        requirementType: 'contradiction',
        weight: 4,
      },
      {
        description: 'Explicar el motivo real usando la solucion privada.',
        isMandatory: input.difficulty !== 'easy',
        proofRole: 'motive',
        requiredSuspectId: input.culpritSuspectId,
        requirementType: 'motive',
        weight: 3,
      },
      {
        description: 'Explicar la oportunidad real con una prueba existente.',
        isMandatory:
          input.difficulty === 'hard' || input.difficulty === 'expert',
        proofRole: 'opportunity',
        requiredEvidenceId: evidence.id,
        requirementType: 'opportunity',
        weight: 3,
      },
      {
        description: 'Reconstruir el metodo real con la evidencia disponible.',
        isMandatory:
          input.difficulty === 'hard' || input.difficulty === 'expert',
        proofRole: 'method',
        requiredEvidenceId: evidence.id,
        requirementType: 'method',
        weight: 3,
      },
      {
        description: 'Usar la contradiccion para romper una version falsa.',
        isMandatory: input.difficulty === 'expert',
        proofRole: 'false_alibi',
        requiredContradictionId: contradiction.id,
        requirementType: 'false_alibi',
        weight: 4,
      },
      {
        description: 'Aportar una prueba de apoyo para completar la teoria.',
        isMandatory: false,
        proofRole: 'support',
        requiredEvidenceId: evidence.id,
        requirementType: 'custom',
        weight: 1,
      },
    ];

    return baseRequirements.slice(0, this.getLocalRequirementCount(input));
  }

  private getLocalRequirementCount(
    input: GenerateCaseSolveRequirementsInput,
  ): number {
    const counts = {
      easy: 3,
      medium: 4,
      hard: 6,
      expert: 8,
    } satisfies Record<
      GenerateCaseSolveRequirementsInput['difficulty'],
      number
    >;

    return counts[input.difficulty];
  }

  private createLocalContradiction(
    input: GenerateCaseContradictionsInput,
  ): GeneratedCaseContradiction {
    const statement = this.findLocalContradictionStatement(input);
    const evidence = this.findLocalContradictionEvidence(input);

    return {
      explanation: `La evidencia "${evidence.title}" contradice una parte verificable de la declaracion de ${statement.speakerName}.`,
      isInitiallyVisible: false,
      proves: 'contradiction',
      refutingEvidenceId: evidence.id,
      statementId: statement.id,
      suspectId: statement.suspectId,
      title: `Contradiccion sobre ${evidence.title}`,
    };
  }

  private findLocalContradictionStatement(
    input: GenerateCaseContradictionsInput,
  ): CaseContradictionGenerationStatementContext {
    return (
      input.statements.find(
        (candidate) => candidate.suspectId === input.culpritSuspectId,
      ) ??
      input.statements[0] ??
      this.createUnknownContradictionStatement(input)
    );
  }

  private findLocalContradictionEvidence(
    input: GenerateCaseContradictionsInput,
  ): CaseStatementGenerationEvidenceContext {
    return (
      input.evidences.find((candidate) => !candidate.isDecoy) ??
      input.evidences[0] ??
      this.createUnknownStatementEvidence()
    );
  }

  private findCaseSolutionCulprit(
    input: GenerateCaseSolutionInput,
  ): CaseEvidenceGenerationSuspectContext {
    return (
      this.findSuspectById(input.suspects, input.culpritSuspectId) ??
      input.suspects[0] ??
      this.createUnknownGeneratedSuspect()
    );
  }

  private findCaseSolutionContradiction(
    input: GenerateCaseSolutionInput,
    culpritSuspectId: string,
  ): GenerateCaseSolutionInput['contradictions'][number] {
    return (
      input.contradictions.find(
        (contradiction) => contradiction.suspectId === culpritSuspectId,
      ) ??
      input.contradictions[0] ?? {
        explanation: 'Contradiccion pendiente de catalogar.',
        id: 'unknown-contradiction',
        isInitiallyVisible: false,
        proves: 'contradiction',
        refutingEvidenceId: 'unknown-evidence',
        statementId: 'unknown-statement',
        suspectId: culpritSuspectId,
        title: 'contradiccion disponible',
      }
    );
  }

  private findCaseSolutionEvidence(
    input: GenerateCaseSolutionInput,
    contradiction: GenerateCaseSolutionInput['contradictions'][number],
  ): CaseStatementGenerationEvidenceContext {
    return (
      input.evidences.find(
        (evidence) => evidence.id === contradiction.refutingEvidenceId,
      ) ??
      input.evidences[0] ??
      this.createUnknownStatementEvidence()
    );
  }

  private createUnknownRequirementContradiction(
    input: GenerateCaseSolveRequirementsInput,
  ): GenerateCaseSolveRequirementsInput['contradictions'][number] {
    return {
      explanation: 'Contradiccion pendiente de catalogar.',
      id: 'unknown-contradiction',
      isInitiallyVisible: false,
      proves: 'contradiction',
      refutingEvidenceId: 'unknown-evidence',
      statementId: 'unknown-statement',
      suspectId: input.culpritSuspectId,
      title: 'contradiccion disponible',
    };
  }

  private createUnknownContradictionStatement(
    input: GenerateCaseContradictionsInput,
  ): CaseContradictionGenerationStatementContext {
    return {
      content: 'Declaracion pendiente de catalogar.',
      id: 'unknown-statement',
      isInitiallyVisible: true,
      speakerName: 'Declarante sin identificar',
      suspectId: input.culpritSuspectId,
    };
  }

  private createGeneratedStatement(
    command: GeneratedStatementCommand,
  ): GeneratedCaseStatement {
    return this.isCulpritStatement(command)
      ? this.createCulpritStatement(command)
      : this.createInnocentStatement(command);
  }

  private createCulpritStatement(
    command: GeneratedStatementCommand,
  ): GeneratedCaseStatement {
    const evidence = this.findStatementEvidence(command);

    return {
      content: `Si, conozco detalles de ${command.input.caseData.title}, pero eso no significa que haya hecho nada. Sobre ${evidence.title.toLowerCase()}, lo unico que puedo decir es que pase por esa zona durante mi rutina normal. No toque nada importante y no tengo motivos para ocultar informacion.`,
      context: `Declaracion evasiva conectada con ${evidence.title}.`,
      isInitiallyVisible: command.suspectIndex === 0,
      speakerName: command.suspect.name,
      suspectId: command.suspect.id,
    };
  }

  private createInnocentStatement(
    command: GeneratedStatementCommand,
  ): GeneratedCaseStatement {
    const evidence = this.findStatementEvidence(command);

    return {
      content: `Esa noche segui mi horario habitual. Recuerdo haber visto algo relacionado con ${evidence.title.toLowerCase()}, pero en ese momento no me parecio importante. Si sirve de algo, puedo repetir exactamente por donde pase y con quien hable antes de irme.`,
      context: `Declaracion contextual contrastable con ${evidence.title}.`,
      isInitiallyVisible: command.suspectIndex === 0,
      speakerName: command.suspect.name,
      suspectId: command.suspect.id,
    };
  }

  private isCulpritStatement(command: GeneratedStatementCommand): boolean {
    return command.suspect.id === command.input.culpritSuspectId;
  }

  private findStatementEvidence(
    command: GeneratedStatementCommand,
  ): CaseStatementGenerationEvidenceContext {
    return (
      command.input.evidences[command.suspectIndex] ??
      command.input.evidences[0] ??
      this.createUnknownStatementEvidence()
    );
  }

  private createUnknownStatementEvidence(): CaseStatementGenerationEvidenceContext {
    return {
      description: 'Evidencia pendiente de catalogar.',
      id: 'unknown-evidence',
      importance: 'contextual',
      isDecoy: false,
      isInitiallyVisible: true,
      metadata: {},
      title: 'la evidencia disponible',
      type: 'document',
      weight: 1,
    };
  }

  private createGeneratedEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
    evidenceIndex: number,
  ): GeneratedCaseEvidence {
    const builders = [
      () => this.createAccessEvidence(input, culprit),
      () => this.createMotiveEvidence(input, culprit),
      () => this.createMethodEvidence(input, culprit),
      () => this.createOpportunityEvidence(input, culprit),
      () => this.createContextEvidence(input, culprit),
      () => this.createDecoyEvidence(input, culprit),
    ];

    return builders[evidenceIndex % builders.length]();
  }

  private createAccessEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseEvidence {
    return this.createGeneratedEvidenceDraft({
      description: `Un registro de acceso ubica a ${culprit.name} cerca de la escena durante una ventana que no aparece en su version publica.`,
      discoveryHint:
        'Revisar bitacoras de entrada, camaras o registros digitales.',
      importance: 'critical',
      input,
      location: 'Control de acceso principal',
      proves: ['identity', 'opportunity'],
      title: `Registro de acceso de ${culprit.name}`,
      type: 'digital',
      weight: 10,
    });
  }

  private createMotiveEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseEvidence {
    return this.createGeneratedEvidenceDraft({
      description: `Un documento vincula a ${culprit.name} con una presion personal o profesional relacionada con ${input.caseData.title}.`,
      discoveryHint:
        'Contrastar archivos privados, comunicaciones y antecedentes.',
      importance: 'supporting',
      input,
      location: 'Archivo administrativo',
      proves: ['motive'],
      title: `Documento de presion sobre ${culprit.name}`,
      type: 'document',
      weight: 7,
    });
  }

  private createMethodEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseEvidence {
    return this.createGeneratedEvidenceDraft({
      description: `El analisis tecnico encuentra un procedimiento compatible con el acceso y conocimientos atribuidos a ${culprit.name}.`,
      discoveryHint:
        'Solicitar analisis forense del objeto o sistema intervenido.',
      importance: 'critical',
      input,
      location: 'Laboratorio forense',
      proves: ['method'],
      title: 'Patron tecnico del metodo usado',
      type: 'forensic',
      weight: 9,
    });
  }

  private createOpportunityEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseEvidence {
    return this.createGeneratedEvidenceDraft({
      description: `La linea temporal deja una ventana breve en la que ${culprit.name} pudo actuar sin testigos directos.`,
      discoveryHint:
        'Reconstruir horarios con entrevistas y datos de ubicacion.',
      importance: 'supporting',
      input,
      location: 'Mapa de movimientos',
      proves: ['opportunity'],
      title: 'Ventana temporal sin supervision',
      type: 'location',
      weight: 6,
    });
  }

  private createContextEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseEvidence {
    return this.createGeneratedEvidenceDraft({
      description: `Una nota inicial describe tensiones alrededor de ${input.caseData.victimName ?? input.caseData.title} sin senalar todavia a un responsable.`,
      importance: 'contextual',
      input,
      isInitiallyVisible: true,
      location: 'Expediente inicial',
      proves: ['support'],
      title: 'Nota contextual del expediente',
      type: 'document',
      weight: 3,
    });
  }

  private createDecoyEvidence(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseEvidence {
    const decoySuspect = this.findDecoySuspect(input, culprit);

    return this.createGeneratedEvidenceDraft({
      description: `Una pista apunta inicialmente hacia ${decoySuspect.name}, pero su valor probatorio depende de contrastarla con otros hallazgos.`,
      discoveryHint: 'Validar si la pista tiene una explicacion inocente.',
      importance: 'misleading',
      input,
      isDecoy: true,
      location: 'Escena secundaria',
      proves: ['support'],
      relatedSuspect: decoySuspect,
      title: `Pista ambigua sobre ${decoySuspect.name}`,
      type: 'physical',
      weight: 2,
    });
  }

  private createGeneratedEvidenceDraft(
    draft: GeneratedEvidenceDraft,
  ): GeneratedCaseEvidence {
    const relatedSuspect =
      draft.relatedSuspect ?? this.findGeneratedCulprit(draft.input);

    return {
      description: draft.description,
      discoveryHint: draft.discoveryHint,
      importance: draft.importance,
      isDecoy: draft.isDecoy ?? draft.importance === 'misleading',
      isInitiallyVisible: draft.isInitiallyVisible ?? false,
      location: draft.location,
      metadata: {
        narrativePurpose: `Conecta el caso ${draft.input.caseData.title} con ${draft.proves.join(', ')}.`,
        proves: draft.proves,
        relatedSuspectIds: [relatedSuspect.id],
        relatedSuspectNames: [relatedSuspect.name],
        suggestedUnlockAction:
          draft.discoveryHint ??
          'Asignar una accion investigativa relacionada.',
      },
      title: draft.title,
      type: draft.type,
      weight: draft.weight,
    };
  }

  private createGeneratedSolution(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): GeneratedCaseSolution {
    return {
      culpritSuspectId: culprit.id,
      fullExplanation: `${culprit.name} es la persona que mejor encaja con motivo, metodo y oportunidad dentro de ${input.caseData.title}. Las evidencias criticas conectan su acceso con la ventana temporal y el procedimiento usado.`,
      methodSummary:
        'El metodo queda respaldado por la evidencia tecnica y documental generada.',
      motiveSummary: `${culprit.name} tenia una presion directa o beneficio plausible conectado con el caso.`,
      opportunitySummary: `${culprit.name} tuvo acceso durante una ventana temporal verificable.`,
    };
  }

  private findGeneratedCulprit(
    input: GenerateCaseEvidencesInput,
  ): CaseEvidenceGenerationSuspectContext {
    return (
      this.findSuspectById(input.suspects, input.culpritSuspectId) ??
      [...input.suspects].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      )[0] ??
      this.createUnknownGeneratedSuspect()
    );
  }

  private findDecoySuspect(
    input: GenerateCaseEvidencesInput,
    culprit: CaseEvidenceGenerationSuspectContext,
  ): CaseEvidenceGenerationSuspectContext {
    return (
      input.suspects.find((suspect) => suspect.id !== culprit.id) ?? culprit
    );
  }

  private findSuspectById(
    suspects: readonly CaseEvidenceGenerationSuspectContext[],
    suspectId?: string,
  ): CaseEvidenceGenerationSuspectContext | undefined {
    return suspectId
      ? suspects.find((suspect) => suspect.id === suspectId)
      : undefined;
  }

  private createUnknownGeneratedSuspect(): CaseEvidenceGenerationSuspectContext {
    return {
      createdAt: new Date().toISOString(),
      id: 'unknown-suspect',
      name: 'Sospechoso sin identificar',
    };
  }

  private createSuspects(): Suspect[] {
    return LOCAL_SUSPECT_PROFILES.map((profile) => this.createSuspect(profile));
  }

  private createSuspect(profile: LocalSuspectProfile): Suspect {
    return {
      id: createId('suspect'),
      name: profile.name,
      status: 'suspect',
      age: profile.age,
      occupation: OCCUPATIONS_BY_ROLE[profile.role],
      alibi: 'Afirma tener una coartada parcial durante el incidente.',
      relationToCase: RELATIONS_BY_ROLE[profile.role],
      notes:
        'El expediente recomienda contrastar su declaracion con evidencia fisica.',
    };
  }

  private createInitialClues(input: GenerateCaseInput): Clue[] {
    return [
      this.createClue({
        name: 'Registro de camaras',
        category: 'Digital',
        relevance: input.severity,
      }),
      this.createClue({
        name: 'Declaracion vecinal',
        category: 'Testimonio',
        relevance: 'Media',
      }),
      this.createClue({
        name: 'Informe preliminar',
        category: 'Documental',
        relevance: input.severity,
      }),
    ];
  }

  private createClue(profile: LocalClueProfile): Clue {
    return {
      id: createId('clue'),
      name: profile.name,
      description: `${profile.name} agregado como evidencia del caso.`,
      category: profile.category,
      dateFound: new Date().toISOString(),
      relevance: profile.relevance,
    };
  }

  private createOpeningLog(input: GenerateCaseInput): LogEntry {
    return this.createLog({
      title: 'Expediente abierto',
      text: `La central registra un caso de ${input.category.toLowerCase()} vinculado a ${input.theme}. La prioridad operativa queda marcada como ${input.severity}.`,
      type: 'narrative',
    });
  }

  private createClueAnalysis(
    input: InvestigationStepInput,
  ): InvestigationStepResult {
    const clue = this.findClue(input);

    return {
      log: this.createLog({
        title: 'Analisis de pista',
        text: `${input.detectiveData.name} revisa ${clue.name}. El patron encontrado conecta la evidencia con una ventana horaria mas precisa.`,
        type: 'clue_analyzed',
      }),
      newClue: this.createClue({
        name: 'Coincidencia de horario',
        category: 'Documental',
        relevance: 'Alta',
      }),
    };
  }

  private createInterrogation(
    input: InvestigationStepInput,
  ): InvestigationStepResult {
    const suspect = this.findSuspect(input);

    return {
      log: this.createLog({
        title: 'Interrogatorio registrado',
        text: `${suspect.name} evita responder una pregunta clave. Su declaracion abre una contradiccion con la evidencia disponible.`,
        type: 'interrogation',
      }),
      suspectUpdate: this.createSuspectUpdate(suspect),
    };
  }

  private createGeneralAdvance(
    input: InvestigationStepInput,
  ): InvestigationStepResult {
    return {
      log: this.createLog({
        title: 'Nuevo avance operativo',
        text: `${input.detectiveData.name} coordina una busqueda de campo. La investigacion descubre una ruta secundaria relacionada con el caso.`,
        type: 'discovery',
      }),
      newClue: this.createClue({
        name: 'Mapa de ruta secundaria',
        category: 'Documental',
        relevance: 'Media',
      }),
    };
  }

  private createLog(draft: LogDraft): LogEntry {
    return {
      id: createId('log'),
      timestamp: new Date().toISOString(),
      title: draft.title,
      text: draft.text,
      type: draft.type,
    };
  }

  private createSuspectUpdate(suspect: Suspect): SuspectUpdate {
    return {
      suspectId: suspect.id,
      status: 'suspect',
      notes:
        'La coartada requiere verificacion adicional por inconsistencias menores.',
    };
  }

  private createVerdict(input: VerdictInput): VerdictResult {
    const hasEnoughReasoning = this.hasEnoughReasoning(input.reasoning);

    return {
      success: hasEnoughReasoning,
      verdictText: hasEnoughReasoning
        ? this.createAcceptedVerdict(input)
        : this.createRejectedVerdict(input),
    };
  }

  private hasEnoughReasoning(reasoning: string): boolean {
    return reasoning.trim().length > MINIMUM_REASONING_LENGTH;
  }

  private createAcceptedVerdict(input: VerdictInput): string {
    return `El tribunal acepta la acusacion contra ${input.accusedSuspect.name}. La exposicion del detective ${input.detectiveData.name} conecta evidencia, motivo y oportunidad con suficiente claridad. Se autoriza la orden de arresto y el caso queda elevado a fiscalia.`;
  }

  private createRejectedVerdict(input: VerdictInput): string {
    return `El tribunal rechaza la acusacion contra ${input.accusedSuspect.name}. La narrativa presentada no alcanza el umbral probatorio: faltan conexiones claras entre pistas, oportunidad y motivo. La investigacion debe continuar antes de solicitar una orden de arresto.`;
  }

  private createCodeName(input: GenerateCaseInput): string {
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    return `OPERACION-${input.category.toUpperCase()}-${uniqueSuffix}`;
  }

  private createDescription(input: GenerateCaseInput): string {
    return `Una llamada prioritaria alerta a DEP City sobre ${input.theme}. El caso exige revisar evidencia, contrastar coartadas y decidir si la acusacion final puede sostenerse ante el tribunal.`;
  }

  private findClue(input: InvestigationStepInput): Clue {
    return (
      input.caseData.clues.find((clue) => clue.id === input.targetId) ??
      input.caseData.clues[0] ??
      this.createClue({
        name: 'Pista sin catalogar',
        category: 'Documental',
        relevance: 'Media',
      })
    );
  }

  private findSuspect(input: InvestigationStepInput): Suspect {
    return (
      input.caseData.suspects.find(
        (suspect) => suspect.id === input.targetId,
      ) ??
      input.caseData.suspects[0] ??
      this.createUnknownSuspect()
    );
  }

  private createUnknownSuspect(): Suspect {
    return {
      id: createId('suspect'),
      name: 'Sospechoso sin identificar',
      status: 'suspect',
      age: 34,
      occupation: 'Ciudadano vinculado',
      alibi: 'Declara no estar cerca de la escena.',
      relationToCase: 'Relacion indirecta con el expediente',
      notes: 'Pendiente de entrevista formal.',
    };
  }
}
