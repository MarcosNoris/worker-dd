import { Injectable } from '@nestjs/common';
import {
  GenerateAdminCaseBaseInput,
  GenerateCaseContradictionsInput,
  GenerateDetectiveProfileInput,
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
import { AiChatMessage } from '../providers/ai-text-generation.types';
import { DETECTIVE_SKILL_TYPES } from '../../../shared/constants/detective-skill.constants';
import {
  ADMIN_CASE_DIFFICULTIES,
  ADMIN_PROOF_ROLES,
  ADMIN_ACTION_TYPES,
  ADMIN_EVIDENCE_IMPORTANCES,
  ADMIN_EVIDENCE_TYPES,
  ADMIN_REQUIREMENT_TYPES,
  ADMIN_SKILL_TYPES,
} from '../../cases/constants/admin-case.constants';
import {
  createInvestigationGraphAliasCatalog,
  findAliasById,
  InvestigationGraphAliasCatalog,
} from './investigation-graph-aliases';
import type {
  GeneratedCaseInvestigationGraphPayload,
  InvestigationGraphValidationReport,
} from './generated-case-investigation-graph.normalizer';
import {
  createInvestigationGraphActionBudget,
  describeInvestigationGraphActionBudget,
} from './investigation-graph-action-budget';

const SYSTEM_PROMPT =
  'Eres el motor narrativo de DEPGame Dispatch Console. Responde exclusivamente con un objeto JSON valido, sin markdown ni texto adicional.';
const ADMIN_CASE_BASE_SYSTEM_PROMPT =
  'Eres la constructora de casos base de DEPGame Dispatch Console. Disenas expedientes policiales jugables para un flujo administrativo. Responde exclusivamente con un objeto JSON valido, sin markdown ni texto adicional.';
const DETECTIVE_SKILL_LEVEL_GUIDE =
  'Respeta estrictamente esta escala de skills: nivel 1 = 3 skills entre 5 y 25, ninguna supera 30; nivel 2 = 3 skills entre 10 y 35, ninguna supera 40; nivel 3 = 3-4 skills entre 15 y 50, ninguna supera 50; nivel 4 = 3-5 skills entre 25 y 60, solo una skill puede superar 50 y las demas deben ser 50 o menos; nivel 5 = 4-5 skills entre 35 y 70, maximo dos skills pueden superar 60; nivel 6 = 4-5 skills entre 45 y 78, maximo tres skills pueden superar 70; nivel 7 = 4-6 skills entre 55 y 85, maximo tres skills pueden superar 80; nivel 8 = 4-6 skills entre 65 y 90, maximo cuatro skills pueden superar 85; nivel 9 = 5-6 skills entre 75 y 96; nivel 10 = 5-6 skills entre 85 y 100. No infles las habilidades por encima del nivel solicitado.';
const DETECTIVE_RANK_LEVEL_GUIDE =
  'El rank tambien debe seguir generalSkillLevel: nivel 1-2 usa rookie; nivel 3-4 usa detective; nivel 5-6 usa senior; nivel 7-8 usa specialist; nivel 9-10 usa lead. No asignes un rank superior al nivel solicitado.';
const CONTRADICTION_LIMITS_BY_DIFFICULTY = {
  easy: '1 o 2',
  medium: '2 o 3',
  hard: '3 a 5',
  expert: '5 a 7',
} as const;
const REQUIREMENT_LIMITS_BY_DIFFICULTY = {
  easy: '3 o 4',
  medium: '4 a 6',
  hard: '6 a 8',
  expert: '8 a 10',
} as const;
interface InvestigationGraphPromptContext {
  readonly case: {
    readonly difficulty: string;
    readonly publicBriefing?: string;
    readonly summary: string;
    readonly title: string;
    readonly victimName?: string;
  };
  readonly closureRequirements: {
    readonly mandatory: readonly InvestigationGraphRequirementPromptContext[];
    readonly optional: readonly InvestigationGraphRequirementPromptContext[];
  };
  readonly contradictions: readonly {
    readonly alias: string;
    readonly explanation: string;
    readonly isInitiallyVisible: boolean;
    readonly proves: string;
    readonly refutingEvidenceAlias: string;
    readonly statementAlias: string;
    readonly suspectAlias?: string;
    readonly title: string;
  }[];
  readonly culpritSuspectAlias: string;
  readonly evidences: readonly {
    readonly alias: string;
    readonly description: string;
    readonly discoveryHint?: string;
    readonly importance: string;
    readonly isDecoy: boolean;
    readonly isInitiallyVisible: boolean;
    readonly location?: string;
    readonly narrativePurpose?: string;
    readonly relatedSuspectAliases?: readonly string[];
    readonly suggestedUnlockAction?: string;
    readonly title: string;
    readonly type: string;
  }[];
  readonly solution: {
    readonly fullExplanation: string;
    readonly methodSummary: string;
    readonly motiveSummary: string;
    readonly opportunitySummary: string;
  };
  readonly statements: readonly {
    readonly alias: string;
    readonly content: string;
    readonly context?: string;
    readonly isInitiallyVisible: boolean;
    readonly speakerName: string;
    readonly suspectAlias?: string;
  }[];
  readonly suspects: readonly {
    readonly alias: string;
    readonly background?: string;
    readonly name: string;
    readonly occupation?: string;
    readonly personality?: string;
    readonly publicNotes?: string;
    readonly relationshipToVictim?: string;
  }[];
}

interface InvestigationGraphRequirementPromptContext {
  readonly alias: string;
  readonly description: string;
  readonly proofRole?: string;
  readonly requiredContradictionAlias?: string;
  readonly requiredEvidenceAlias?: string;
  readonly requiredSuspectAlias?: string;
  readonly requirementType: string;
}

interface InvestigationGraphRepairPromptCommand {
  readonly attempt: number;
  readonly input: GenerateCaseInvestigationGraphInput;
  readonly maxAttempts: number;
  readonly previousPayload: GeneratedCaseInvestigationGraphPayload;
  readonly validationReport: InvestigationGraphValidationReport;
}

@Injectable()
export class AiPromptFactory {
  buildCaseMessages(input: GenerateCaseInput): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        `Genera un caso criminal ficticio en espanol. Devuelve JSON con id, title, codeName, description, location, suspects, clues y logs. Usa category "${input.category}", severity "${input.severity}", status "pending", assignedDetectiveId null y dateCreated ISO. Tema: ${input.theme}. Sospechosos usan status suspect|cleared|arrested. Pistas usan category Fisica|Digital|Testimonio|Biologica|Documental. Logs usan type narrative|discovery|interrogation|clue_analyzed|closing.`,
      ),
    ];
  }

  buildAdminCaseBaseMessages(
    input: GenerateAdminCaseBaseInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(ADMIN_CASE_BASE_SYSTEM_PROMPT),
      this.createUserMessage(
        [
          'Crea la informacion base de un caso criminal ficticio en espanol para guardar en la tabla cases.',
          `La dificultad obligatoria es "${input.difficulty}" y el JSON debe repetir exactamente esa dificultad.`,
          `Dificultades permitidas: ${ADMIN_CASE_DIFFICULTIES.join(', ')}.`,
          this.describeAdminCaseTheme(input),
          'No generes sospechosos, evidencias, declaraciones, solucion ni acciones.',
          'Devuelve solo JSON con title, summary, publicBriefing, victimName y difficulty.',
          'title debe tener 3-160 caracteres y debe sonar como nombre de expediente, no como descripcion generica.',
          'summary debe tener 10-2000 caracteres y resumir conflicto, victima, contexto y gancho investigativo sin resolver el caso.',
          'publicBriefing debe tener 1-5000 caracteres y ser informacion inicial visible para el jugador.',
          'victimName debe tener 1-300 caracteres.',
          'No uses ninguno de estos titulos existentes ni variantes casi iguales:',
          JSON.stringify(input.forbiddenTitles),
        ].join(' '),
      ),
    ];
  }

  buildCaseEvidencesMessages(
    input: GenerateCaseEvidencesInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador narrativo de casos policiales para un juego de investigacion.',
          `Genera exactamente ${input.evidenceCount} evidencias jugables para este caso existente.`,
          this.describeCulpritRule(input),
          this.describeSolutionRule(input),
          'No inventes sospechosos, no cambies el caso base y no reveles toda la solucion en una sola evidencia.',
          `Tipos permitidos: ${ADMIN_EVIDENCE_TYPES.join(', ')}.`,
          `Importancias permitidas: ${ADMIN_EVIDENCE_IMPORTANCES.join(', ')}.`,
          'Debe existir al menos una evidencia critical. Usa misleading solo para pistas distractoras razonables.',
          'Devuelve solo un objeto JSON, no un array raiz, con selectedCulpritSuspectId, evidences y, si se solicita, solution.',
          'Cada evidencia debe incluir title, description, type, importance, location, discoveryHint, weight, isDecoy, isInitiallyVisible y metadata.',
          'metadata debe incluir relatedSuspectIds, relatedSuspectNames, proves, narrativePurpose y suggestedUnlockAction cuando aplique.',
          `Caso: ${JSON.stringify(input.caseData)}.`,
          `Sospechosos: ${JSON.stringify(input.suspects)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseSuspectsMessages(
    input: GenerateCaseSuspectsInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador narrativo de sospechosos para un caso policial jugable.',
          `Genera exactamente ${input.suspectCount} sospechosos para este caso existente.`,
          `La dificultad del caso es ${input.difficulty}; ajusta el nivel de complejidad de motivos, relaciones y notas publicas a esa dificultad.`,
          'No generes evidencias, declaraciones, contradicciones, solucion ni acciones.',
          'Los nombres deben ser unicos, pronunciables y verosimiles dentro del mismo expediente.',
          'Devuelve solo un objeto JSON, no un array raiz, con la forma exacta {"suspects":[]}.',
          'Cada sospechoso debe incluir name y puede incluir age, occupation, relationshipToVictim, background, personality y publicNotes.',
          'No incluyas id, caseId, createdAt, metadata, status, alibi ni campos extra.',
          'name debe tener 2-300 caracteres.',
          'age, si se incluye, debe ser entero entre 1 y 130.',
          'occupation y relationshipToVictim deben tener 1-300 caracteres si se incluyen.',
          'background, personality y publicNotes deben tener 1-1000 caracteres si se incluyen.',
          `Caso: ${JSON.stringify(input.caseData)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseStatementsMessages(
    input: GenerateCaseStatementsInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador narrativo de declaraciones policiales para un juego de investigacion.',
          'Genera exactamente una declaracion por cada sospechoso del caso.',
          `El culpable privado esperado es ${input.culpritSuspectId}; su declaracion puede ocultar, minimizar o desviar hechos sin confesar directamente.`,
          'Los sospechosos inocentes deben sonar creibles, aportar contexto util y no contradecir evidencias criticas de forma artificial.',
          'Usa el caso, los sospechosos y las evidencias existentes; no inventes sospechosos ni nuevas evidencias.',
          'No reveles la solucion completa en una sola declaracion.',
          'El campo content debe ser la declaracion literal en primera persona, como si fuera una transcripcion textual del sospechoso. No describas ni interpretes lo que declara.',
          'El campo context debe ser la nota breve de diseno o investigacion que explique como usar esa declaracion contra las evidencias.',
          'Ejemplo de content valido: "Si, estuve en el atico esa noche, pero fue solo para recoger documentos. Llegue a las 20:10 y me fui antes de las 20:40. No vi nada raro."',
          'Ejemplo de content invalido: "Describe una parte verificable de su rutina y ofrece un detalle contrastable".',
          'Devuelve solo un objeto JSON, no un array raiz, con la forma exacta {"statements":[]}.',
          'Cada statement debe incluir suspectId, speakerName, content, context e isInitiallyVisible.',
          'suspectId debe pertenecer a la lista de sospechosos y debe aparecer exactamente una vez por sospechoso.',
          'No incluyas metadata ni campos extra.',
          `Caso: ${JSON.stringify(input.caseData)}.`,
          `Sospechosos: ${JSON.stringify(input.suspects)}.`,
          `Evidencias: ${JSON.stringify(input.evidences)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseContradictionsMessages(
    input: GenerateCaseContradictionsInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador narrativo de casos policiales para un juego de investigacion.',
          'Genera contradicciones logicas entre statements existentes y evidencias existentes.',
          `Nivel de dificultad: ${input.difficulty}. Genera ${CONTRADICTION_LIMITS_BY_DIFFICULTY[input.difficulty]} contradicciones como maximo narrativo.`,
          `El culpable privado esperado es ${input.culpritSuspectId}. Debe existir al menos una contradiccion valida contra ese sospechoso.`,
          'No inventes sospechosos, evidencias ni statements. No cambies el caso base.',
          'Cada contradiccion debe conectar exactamente un statementId existente con un refutingEvidenceId existente.',
          'suspectId debe coincidir con el suspectId del statement cuando ese statement tenga sospechoso.',
          'No uses evidencias isDecoy true para una contradiccion central contra el culpable.',
          'No reveles directamente que el culpable es culpable en title ni explanation.',
          `Roles permitidos para proves: ${ADMIN_PROOF_ROLES.join(', ')}.`,
          'Devuelve solo un objeto JSON, no un array raiz, con la forma exacta {"contradictions":[]}.',
          'Cada contradiccion debe incluir suspectId, statementId, refutingEvidenceId, title, explanation, proves e isInitiallyVisible.',
          'No incluyas metadata ni campos extra.',
          `Caso: ${JSON.stringify(input.caseData)}.`,
          `Sospechosos: ${JSON.stringify(input.suspects)}.`,
          `Culpable esperado: ${input.culpritSuspectId}.`,
          `Evidencias: ${JSON.stringify(input.evidences)}.`,
          `Statements: ${JSON.stringify(input.statements)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseSolutionMessages(
    input: GenerateCaseSolutionInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador narrativo de casos policiales para un juego de investigacion.',
          'Define la solucion privada oficial de este caso criminal ya creado.',
          `El culpable esperado obligatorio es ${input.culpritSuspectId}; copia exactamente este id en culpritSuspectId.`,
          'La solucion debe explicar quien cometio el crimen, por que lo hizo, como lo hizo y cuando tuvo oportunidad.',
          'No inventes sospechosos, evidencias, statements ni contradicciones. No cambies el caso base.',
          'Apoya motivo, metodo y oportunidad en evidencias, statements y contradicciones existentes.',
          'Usa contradicciones existentes para explicar mentiras, omisiones o coartadas falsas cuando aporten a la solucion.',
          'No escribas una confesion directa si no existe un statement que la sostenga.',
          'No culpes a otro sospechoso ni dejes ambigua la identidad del culpable.',
          'Devuelve solo JSON con culpritSuspectId, motiveSummary, methodSummary, opportunitySummary y fullExplanation.',
          'Cada resumen debe tener entre 5 y 5000 caracteres; fullExplanation entre 10 y 5000 caracteres.',
          'No incluyas metadata, evidenceIds, statementIds, contradictionIds ni campos extra.',
          `Caso: ${JSON.stringify(input.caseData)}.`,
          `Sospechosos: ${JSON.stringify(input.suspects)}.`,
          `Sospechoso culpable esperado: ${input.culpritSuspectId}.`,
          `Evidencias existentes: ${JSON.stringify(input.evidences)}.`,
          `Statements existentes: ${JSON.stringify(input.statements)}.`,
          `Contradicciones existentes: ${JSON.stringify(input.contradictions)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseSolveRequirementsMessages(
    input: GenerateCaseSolveRequirementsInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador narrativo de casos policiales para un juego de investigacion.',
          'Genera requisitos estructurados para que el caso pueda considerarse solucionado.',
          `Nivel de dificultad: ${input.difficulty}. Genera ${REQUIREMENT_LIMITS_BY_DIFFICULTY[input.difficulty]} requisitos.`,
          `El culpable esperado es ${input.culpritSuspectId}; debe existir un requisito culprit obligatorio con requiredSuspectId igual a ese id.`,
          'No inventes sospechosos, evidencias, statements, contradicciones ni cambies la solucion privada.',
          'Cada requisito debe tener al menos un objetivo verificable: requiredSuspectId, requiredEvidenceId o requiredContradictionId.',
          'No uses requiredStatementId porque el DTO no lo permite.',
          `Tipos de requisito permitidos: ${ADMIN_REQUIREMENT_TYPES.join(', ')}.`,
          `Roles probatorios permitidos: ${ADMIN_PROOF_ROLES.join(', ')}.`,
          'Usa solo IDs existentes en el contexto recibido.',
          'No uses evidencias isDecoy true como requisito obligatorio central salvo para descartar una pista enganosa.',
          'Devuelve solo un objeto JSON, no un array raiz, con la forma exacta {"solveRequirements":[]}.',
          'Cada requisito debe incluir requirementType, description, weight e isMandatory; puede incluir proofRole, requiredSuspectId, requiredEvidenceId y requiredContradictionId.',
          'No incluyas metadata ni campos extra.',
          `Caso: ${JSON.stringify(input.caseData)}.`,
          `Sospechosos: ${JSON.stringify(input.suspects)}.`,
          `Sospechoso culpable esperado: ${input.culpritSuspectId}.`,
          `Evidencias existentes: ${JSON.stringify(input.evidences)}.`,
          `Statements existentes: ${JSON.stringify(input.statements)}.`,
          `Contradicciones existentes: ${JSON.stringify(input.contradictions)}.`,
          `Solucion privada: ${JSON.stringify(input.solution)}.`,
          `Acciones existentes: ${JSON.stringify(input.actions)}.`,
          `Reglas de desbloqueo de evidencias: ${JSON.stringify(input.evidenceUnlockRules)}.`,
          `Reglas de desbloqueo de contradicciones: ${JSON.stringify(input.contradictionUnlockRules)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseInvestigationGraphMessages(
    input: GenerateCaseInvestigationGraphInput,
  ): readonly AiChatMessage[] {
    const promptContext = this.createInvestigationGraphPromptContext(input);
    const actionBudget = createInvestigationGraphActionBudget(input);

    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como disenador mecanico de investigaciones policiales para un juego de gestion.',
          'Genera el grafo completo de acciones y reglas de desbloqueo para un caso ya estructurado.',
          `Nivel de dificultad: ${input.difficulty}. ${describeInvestigationGraphActionBudget(actionBudget)} No generes menos de ${actionBudget.min} ni mas de ${actionBudget.max} acciones.`,
          'El contexto es un dossier compacto con la historia completa necesaria y los catalogos de aliases validos.',
          'El dossier no contiene IDs reales: usa solo aliases existentes del dossier como SP1, EV1, ST1, CT1 y REQ1.',
          'No inventes sospechosos, evidencias, statements, contradicciones ni requisitos.',
          'Los actionTempId y prerequisiteActionTempId deben coincidir textualmente con un actions[].tempId generado por ti; nunca uses IDs de evidencia, statement, contradiccion o sospechoso como actionTempId.',
          'No uses actionId ni tempId dentro de reglas; las reglas siempre usan actionTempId.',
          'Usa tempId en snake_case corto y estable, por ejemplo inspect_scene, interview_suspects o analyze_records.',
          'Cada accion debe tener tempId estable, title, description, actionType, requiredSkill, minimumSkillLevel, baseDurationMinutes, isInitiallyAvailable, requiresDetective y metadata.',
          `actionType debe ser uno de: ${ADMIN_ACTION_TYPES.join(', ')}.`,
          `requiredSkill, cuando aplique, debe ser uno de: ${ADMIN_SKILL_TYPES.join(', ')}.`,
          'minimumSkillLevel siempre debe ser un entero entre 50 y 100. Nunca uses valores menores a 50. Usa 50-59 para tareas rutinarias, 60-74 para complejidad media, 75-89 para especialistas y 90-100 solo para acciones expertas.',
          'Debe existir al menos una accion inicial. Toda accion no inicial debe tener al menos un prerequisito.',
          'actionPrerequisites usa actionTempId y exactamente uno entre prerequisiteActionTempId, prerequisiteEvidenceAlias o prerequisiteContradictionAlias.',
          'Cada evidencia no visible inicialmente debe tener una regla en evidenceUnlockRules.',
          'Cada declaracion no visible inicialmente debe tener una regla en statementUnlockRules.',
          'Cada contradiccion no visible inicialmente debe tener una regla en contradictionUnlockRules.',
          'Las evidencias y contradicciones usadas por requisitos obligatorios deben desbloquearse con isGuaranteed true y successChance 1.',
          'Los statements y evidencias que sostienen contradicciones obligatorias tambien deben tener ruta garantizada.',
          'Las contradicciones no deben aparecer magicamente: su accion debe estar disponible solo cuando ya sea posible descubrir la evidencia refutadora y la declaracion relacionada.',
          'Puedes usar successChance menor a 1 solo para hallazgos secundarios, pistas falsas o contenido no obligatorio.',
          'Devuelve solo JSON con esta forma exacta: {"actions":[],"evidenceUnlockRules":[],"statementUnlockRules":[],"contradictionUnlockRules":[],"actionPrerequisites":[]}.',
          'Formato de regla: evidenceUnlockRules[] usa actionTempId, evidenceAlias, requiredSkill, minimumSkillLevel, durationModifierMinutes, isGuaranteed y successChance; statementUnlockRules[] usa actionTempId, statementAlias, requiredSkill, minimumSkillLevel, isGuaranteed y successChance; contradictionUnlockRules[] usa actionTempId, contradictionAlias, requiredSkill, minimumSkillLevel, isGuaranteed y successChance.',
          'Formato de prerequisito: actionPrerequisites[] usa actionTempId y exactamente uno de prerequisiteActionTempId, prerequisiteEvidenceAlias o prerequisiteContradictionAlias.',
          'No incluyas campos extra ni expliques el grafo en texto.',
          `Dossier compacto: ${JSON.stringify(promptContext)}.`,
        ].join(' '),
      ),
    ];
  }

  buildCaseInvestigationGraphRepairMessages(
    command: InvestigationGraphRepairPromptCommand,
  ): readonly AiChatMessage[] {
    const promptContext = this.createInvestigationGraphPromptContext(
      command.input,
    );
    const actionBudget = createInvestigationGraphActionBudget(command.input);
    const previousActionCount = this.countPreviousActions(
      command.previousPayload,
    );

    return [
      this.createSystemMessage(),
      this.createUserMessage(
        [
          'Actua como auditor y reparador de grafos de investigacion policial para un juego de gestion.',
          `Este es el intento de reparacion ${command.attempt} de ${command.maxAttempts}.`,
          'Recibiras el dossier compacto, el JSON anterior generado por IA y los errores exactos encontrados por el backend.',
          'Devuelve el JSON completo corregido con la misma forma exacta: {"actions":[],"evidenceUnlockRules":[],"statementUnlockRules":[],"contradictionUnlockRules":[],"actionPrerequisites":[]}.',
          'No devuelvas diff, markdown, explicaciones ni campos extra.',
          `${describeInvestigationGraphActionBudget(actionBudget)} El JSON anterior tiene ${previousActionCount} acciones. El JSON final debe respetar ese rango exactamente.`,
          'Preserva todo lo valido del JSON anterior y cambia solo lo necesario para corregir los errores.',
          'Prioriza agregar o corregir reglas de unlock sobre acciones existentes antes de crear acciones nuevas.',
          `Solo puedes crear acciones nuevas si el total final sigue entre ${actionBudget.min} y ${actionBudget.max}; si supera el maximo, fusiona acciones relacionadas o reutiliza acciones existentes.`,
          'Si una accion no inicial no tiene prerequisitos, agregale un prerequisito logico o marcala como inicial solo si narrativamente corresponde.',
          'Si una evidencia, declaracion o contradiccion no queda descubierta, agrega o ajusta reglas y prerequisitos hasta que tenga ruta desde acciones iniciales.',
          'Las contradicciones deben desbloquearse solo cuando su statement y evidencia refutadora ya puedan descubrirse.',
          'Las evidencias y contradicciones de requisitos obligatorios deben tener ruta garantizada con isGuaranteed true y successChance 1.',
          'Usa solo aliases existentes del dossier como SP1, EV1, ST1, CT1 y REQ1. No inventes IDs reales.',
          'Los actionTempId y prerequisiteActionTempId deben coincidir textualmente con un actions[].tempId del JSON final.',
          `actionType debe ser uno de: ${ADMIN_ACTION_TYPES.join(', ')}.`,
          `requiredSkill, cuando aplique, debe ser uno de: ${ADMIN_SKILL_TYPES.join(', ')}.`,
          'minimumSkillLevel siempre debe ser un entero entre 50 y 100. Nunca uses valores menores a 50.',
          `Dossier compacto: ${JSON.stringify(promptContext)}.`,
          `Errores detectados: ${JSON.stringify(command.validationReport.issues)}.`,
          `JSON anterior: ${JSON.stringify(command.previousPayload)}.`,
        ].join(' '),
      ),
    ];
  }

  buildInvestigationStepMessages(
    input: InvestigationStepInput,
  ): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        `Continua esta investigacion ficticia en espanol. Devuelve JSON con log obligatorio y opcionalmente newClue y suspectUpdate. Accion: ${input.actionType}. targetId: ${input.targetId ?? 'sin objetivo'}. Caso: ${JSON.stringify(input.caseData)}. Detective: ${JSON.stringify(input.detectiveData)}.`,
      ),
    ];
  }

  buildVerdictMessages(input: VerdictInput): readonly AiChatMessage[] {
    return [
      this.createSystemMessage(),
      this.createUserMessage(
        `Evalua una acusacion final ficticia en espanol. Devuelve JSON con success boolean y verdictText narrativo estilo juez o fiscal. Caso: ${JSON.stringify(input.caseData)}. Detective: ${JSON.stringify(input.detectiveData)}. Acusado: ${JSON.stringify(input.accusedSuspect)}. Razonamiento del jugador: ${input.reasoning}.`,
      ),
    ];
  }

  buildDetectiveProfileMessages(
    input: GenerateDetectiveProfileInput,
  ): readonly AiChatMessage[] {
    const nameGender = this.describeDetectiveNameGender(input);

    return [
      this.createSystemMessage(),
      this.createUserMessage(
        `Genera un perfil de detective ficticio para DEPGame Dispatch Console. Devuelve JSON con name, rank, bio y skills. generalSkillLevel=${input.generalSkillLevel}. El campo name debe ser un nombre ${nameGender}. rank debe ser rookie|detective|senior|specialist|lead. ${DETECTIVE_RANK_LEVEL_GUIDE} skills debe tener entre 3 y 6 objetos con skill y level. skill debe usar solo estos valores: ${DETECTIVE_SKILL_TYPES.join(', ')}. ${DETECTIVE_SKILL_LEVEL_GUIDE} No incluyas id ni avatarUrl.`,
      ),
    ];
  }

  private countPreviousActions(
    payload: GeneratedCaseInvestigationGraphPayload,
  ): number {
    return Array.isArray(payload.actions) ? payload.actions.length : 0;
  }

  private describeDetectiveNameGender(
    input: GenerateDetectiveProfileInput,
  ): string {
    const labels = {
      female: 'femenino',
      male: 'masculino',
    } satisfies Record<GenerateDetectiveProfileInput['gender'], string>;

    return labels[input.gender];
  }

  private describeAdminCaseTheme(input: GenerateAdminCaseBaseInput): string {
    return input.theme
      ? `Tematica sugerida por el admin: ${input.theme}. Usala como inspiracion breve, sin copiarla literalmente si produce un titulo pobre.`
      : 'El admin no dio tematica: inventa una premisa original y jugable.';
  }

  private describeCulpritRule(input: GenerateCaseEvidencesInput): string {
    return input.culpritSuspectId
      ? `El culpable esperado obligatorio es ${input.culpritSuspectId}.`
      : 'Selecciona un culpable esperado entre los sospechosos y devuelve su id en selectedCulpritSuspectId.';
  }

  private describeSolutionRule(input: GenerateCaseEvidencesInput): string {
    return input.generateSolution
      ? 'Incluye solution con culpritSuspectId, motiveSummary, methodSummary, opportunitySummary y fullExplanation.'
      : 'No incluyas solution; solo selecciona culpable y genera evidencias.';
  }

  private createInvestigationGraphPromptContext(
    input: GenerateCaseInvestigationGraphInput,
  ): InvestigationGraphPromptContext {
    const aliases = createInvestigationGraphAliasCatalog(input);

    return {
      case: {
        difficulty: input.caseData.difficulty,
        publicBriefing: this.compactOptionalText(input.caseData.publicBriefing),
        summary: this.compactText(input.caseData.summary),
        title: this.compactText(input.caseData.title),
        victimName: this.compactOptionalText(input.caseData.victimName),
      },
      closureRequirements: this.createClosureRequirementPromptContext(
        input,
        aliases,
      ),
      contradictions: input.contradictions.map((contradiction) => ({
        alias: this.findAliasOrThrow(aliases.contradictions, contradiction.id),
        explanation: this.compactText(contradiction.explanation),
        isInitiallyVisible: contradiction.isInitiallyVisible,
        proves: contradiction.proves,
        refutingEvidenceAlias: this.findAliasOrThrow(
          aliases.evidences,
          contradiction.refutingEvidenceId,
        ),
        statementAlias: this.findAliasOrThrow(
          aliases.statements,
          contradiction.statementId,
        ),
        suspectAlias: findAliasById(aliases.suspects, contradiction.suspectId),
        title: this.compactText(contradiction.title),
      })),
      culpritSuspectAlias: this.findAliasOrThrow(
        aliases.suspects,
        input.culpritSuspectId,
      ),
      evidences: input.evidences.map((evidence) => ({
        alias: this.findAliasOrThrow(aliases.evidences, evidence.id),
        description: this.compactText(evidence.description),
        discoveryHint: this.compactOptionalText(evidence.discoveryHint),
        importance: evidence.importance,
        isDecoy: evidence.isDecoy,
        isInitiallyVisible: evidence.isInitiallyVisible,
        location: this.compactOptionalText(evidence.location),
        narrativePurpose: this.readMetadataText(
          evidence.metadata,
          'narrativePurpose',
        ),
        relatedSuspectAliases: this.readRelatedSuspectAliases(
          evidence.metadata,
          aliases,
        ),
        suggestedUnlockAction: this.readMetadataText(
          evidence.metadata,
          'suggestedUnlockAction',
        ),
        title: this.compactText(evidence.title),
        type: evidence.type,
      })),
      solution: {
        fullExplanation: this.compactText(input.solution.fullExplanation),
        methodSummary: this.compactText(input.solution.methodSummary),
        motiveSummary: this.compactText(input.solution.motiveSummary),
        opportunitySummary: this.compactText(input.solution.opportunitySummary),
      },
      statements: input.statements.map((statement) => ({
        alias: this.findAliasOrThrow(aliases.statements, statement.id),
        content: this.compactText(statement.content),
        context: this.compactOptionalText(statement.context),
        isInitiallyVisible: statement.isInitiallyVisible,
        speakerName: this.compactText(statement.speakerName),
        suspectAlias: findAliasById(aliases.suspects, statement.suspectId),
      })),
      suspects: input.suspects.map((suspect) => ({
        alias: this.findAliasOrThrow(aliases.suspects, suspect.id),
        background: this.compactOptionalText(suspect.background),
        name: this.compactText(suspect.name),
        occupation: this.compactOptionalText(suspect.occupation),
        personality: this.compactOptionalText(suspect.personality),
        publicNotes: this.compactOptionalText(suspect.publicNotes),
        relationshipToVictim: this.compactOptionalText(
          suspect.relationshipToVictim,
        ),
      })),
    };
  }

  private createClosureRequirementPromptContext(
    input: GenerateCaseInvestigationGraphInput,
    aliases: InvestigationGraphAliasCatalog,
  ): InvestigationGraphPromptContext['closureRequirements'] {
    const mandatory: InvestigationGraphRequirementPromptContext[] = [];
    const optional: InvestigationGraphRequirementPromptContext[] = [];

    input.requirements.forEach((requirement) => {
      const promptRequirement =
        this.createInvestigationGraphRequirementPromptContext(
          requirement,
          aliases,
        );

      if (requirement.isMandatory) {
        mandatory.push(promptRequirement);
      } else {
        optional.push(promptRequirement);
      }
    });

    return { mandatory, optional };
  }

  private createInvestigationGraphRequirementPromptContext(
    requirement: GenerateCaseInvestigationGraphInput['requirements'][number],
    aliases: InvestigationGraphAliasCatalog,
  ): InvestigationGraphRequirementPromptContext {
    return {
      alias: this.findAliasOrThrow(aliases.requirements, requirement.id),
      description: this.compactText(requirement.description),
      proofRole: requirement.proofRole,
      requiredContradictionAlias: findAliasById(
        aliases.contradictions,
        requirement.requiredContradictionId,
      ),
      requiredEvidenceAlias: findAliasById(
        aliases.evidences,
        requirement.requiredEvidenceId,
      ),
      requiredSuspectAlias: findAliasById(
        aliases.suspects,
        requirement.requiredSuspectId,
      ),
      requirementType: requirement.requirementType,
    };
  }

  private readRelatedSuspectAliases(
    metadata: Record<string, unknown>,
    aliases: InvestigationGraphAliasCatalog,
  ): readonly string[] | undefined {
    const suspectIds = this.readMetadataTextList(metadata, 'relatedSuspectIds');

    if (!suspectIds) {
      return undefined;
    }

    const suspectAliases = suspectIds
      .map((suspectId) => findAliasById(aliases.suspects, suspectId))
      .filter((alias): alias is string => Boolean(alias));

    return suspectAliases.length > 0 ? suspectAliases : undefined;
  }

  private findAliasOrThrow(
    references: InvestigationGraphAliasCatalog[keyof InvestigationGraphAliasCatalog],
    id: string,
  ): string {
    const alias = findAliasById(references, id);

    if (!alias) {
      throw new Error(`No se pudo crear alias para ${id}.`);
    }

    return alias;
  }

  private readMetadataText(
    metadata: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = metadata[key];

    return typeof value === 'string'
      ? this.compactOptionalText(value)
      : undefined;
  }

  private readMetadataTextList(
    metadata: Record<string, unknown>,
    key: string,
  ): readonly string[] | undefined {
    const value = metadata[key];

    if (!Array.isArray(value)) {
      return undefined;
    }

    const texts = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => this.compactText(item));

    return texts.length > 0 ? texts : undefined;
  }

  private compactText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private compactOptionalText(value?: string): string | undefined {
    const compactedValue = value ? this.compactText(value) : '';

    return compactedValue || undefined;
  }

  private createSystemMessage(content = SYSTEM_PROMPT): AiChatMessage {
    return {
      role: 'system',
      content,
    };
  }

  private createUserMessage(content: string): AiChatMessage {
    return {
      role: 'user',
      content,
    };
  }
}
