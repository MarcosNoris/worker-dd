# AI Module

Este modulo encapsula la generacion de contenido narrativo del juego mediante proveedores de contenido de IA.

No expone endpoints HTTP directamente. Lo consumen `CasesModule` e `InvestigationsModule`.

## Responsabilidad del modulo

`AiModule` responde esta pregunta:

```text
Que proveedor genera contenido jugable para casos base, casos demo, avances y veredictos?
```

Genera:

- Casos criminales iniciales.
- Casos base administrativos para la tabla `cases`.
- Sospechosos administrativos para casos estructurados.
- Evidencias administrativas para casos estructurados.
- Declaraciones administrativas para sospechosos de casos estructurados.
- Contradicciones administrativas entre statements y evidencias de casos estructurados.
- Soluciones privadas administrativas para casos estructurados.
- Requisitos administrativos de resolucion para casos estructurados.
- Grafos administrativos de acciones y reglas de desbloqueo para casos estructurados.
- Avances de investigacion.
- Veredictos narrativos para acusaciones finales.
- Perfiles administrativos de detectives.

## Consumidores

- `CasesService`: usa `generateCase`, `generateAdminCaseBase`, `generateCaseSuspects`, `generateCaseEvidences`, `generateCaseStatements`, `generateCaseContradictions`, `generateCaseSolution`, `generateCaseSolveRequirements` y `generateCaseInvestigationGraph`.
- `InvestigationsService`: usa `generateInvestigationStep` y `generateVerdict`.
- `DetectiveService`: usa `generateDetectiveProfile` para creacion administrativa asistida por IA.

## Servicios expuestos

### `AiService.generateCase(input)`

Entrada:

```ts
{
  theme: string;
  category: CaseCategory;
  severity: CaseSeverity;
}
```

Salida:

```ts
{
  caseData: Case;
  usedFallback: boolean;
}
```

### `AiService.generateAdminCaseBase(input)`

Entrada:

```ts
{
  theme?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  forbiddenTitles: readonly string[];
}
```

Salida:

```ts
{
  title: string;
  summary: string;
  publicBriefing?: string;
  victimName?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  usedFallback: boolean;
}
```

Reglas:

- Usa un prompt de sistema especializado para construir la informacion base de un caso administrativo.
- Usa la dificultad ya resuelta por el backend y exige que la IA devuelva esa misma dificultad.
- Incluye la tematica cuando el admin la envia; si no existe, pide a la IA inventar una premisa.
- Incluye `forbiddenTitles` para evitar titulos ya usados recientemente.
- Exige JSON estricto con `title`, `summary`, `publicBriefing`, `victimName` y `difficulty`.
- El normalizador rechaza titulo vacio, dificultad invalida, dificultad distinta a la solicitada y textos fuera de los limites del DTO manual.
- En el proveedor OpenAI-compatible este flujo no usa fallback local. Si ningun proveedor externo devuelve un payload valido, lanza `ServiceUnavailableException`.

### `AiService.generateCaseSuspects(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  suspectCount: number;
}
```

Salida:

```ts
{
  suspects: {
    name: string;
    age?: number;
    occupation?: string;
    relationshipToVictim?: string;
    background?: string;
    personality?: string;
    publicNotes?: string;
  }[];
  usedFallback: boolean;
}
```

Reglas:

- Usa la dificultad real del caso y exige generar exactamente `suspectCount` sospechosos.
- Exige JSON estricto con una unica propiedad `suspects`.
- No permite campos de persistencia ni referencias a ids inexistentes.
- El normalizador exige array, cantidad exacta, nombres no vacios, nombres no duplicados normalizados y `age` entero entre `1` y `130` cuando existe.
- Los textos se recortan con los mismos limites del DTO manual de sospechosos.
- En el proveedor OpenAI-compatible este flujo no usa fallback local. Si todos los proveedores externos fallan o el JSON no cumple el contrato, lanza `ServiceUnavailableException` y el consumidor no debe persistir nada.

### `AiService.generateCaseEvidences(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  suspects: {
    id: string;
    name: string;
    createdAt: string;
    age?: number;
    occupation?: string;
    relationshipToVictim?: string;
    background?: string;
    personality?: string;
    publicNotes?: string;
  }[];
  evidenceCount: number;
  culpritSuspectId?: string;
  generateSolution: boolean;
}
```

Salida:

```ts
{
  selectedCulpritSuspectId: string;
  evidences: {
    title: string;
    description: string;
    type: 'physical' | 'digital' | 'testimonial' | 'document' | 'forensic' | 'financial' | 'location' | 'biological';
    importance: 'critical' | 'supporting' | 'misleading' | 'contextual';
    location?: string;
    discoveryHint?: string;
    weight: number;
    isDecoy: boolean;
    isInitiallyVisible: boolean;
    metadata: Record<string, unknown>;
  }[];
  solution?: {
    culpritSuspectId: string;
    motiveSummary: string;
    methodSummary: string;
    opportunitySummary: string;
    fullExplanation: string;
  };
  usedFallback: boolean;
}
```

El proveedor externo debe devolver JSON estricto. El normalizador recorta al numero solicitado, completa faltantes con fallback local, valida que el culpable pertenezca a los sospechosos recibidos y fuerza `solution.culpritSuspectId` al culpable seleccionado.

### `AiService.generateCaseStatements(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  suspects: {
    id: string;
    name: string;
    createdAt: string;
    age?: number;
    occupation?: string;
    relationshipToVictim?: string;
    background?: string;
    personality?: string;
    publicNotes?: string;
  }[];
  evidences: {
    id: string;
    title: string;
    description: string;
    type: string;
    importance: string;
    location?: string;
    discoveryHint?: string;
    weight: number;
    isDecoy: boolean;
    isInitiallyVisible: boolean;
    metadata: Record<string, unknown>;
  }[];
  culpritSuspectId: string;
}
```

Salida:

```ts
{
  culpritSuspectId: string;
  statements: {
    suspectId: string;
    speakerName: string;
    content: string;
    context?: string;
    isInitiallyVisible: boolean;
  }[];
  usedFallback: boolean;
}
```

El prompt se basa en `utils_prompts/case-statements-generation-prompt.md`, pero la salida runtime se ajusta al DTO real de base de datos: no incluye `metadata`. El campo `content` debe ser una declaracion textual en primera persona; `context` queda para la interpretacion investigativa. Si un proveedor devuelve un array raiz valido de statements en vez de `{ "statements": [] }`, el parser lo envuelve bajo `statements` antes de normalizarlo. Este flujo no usa fallback local: si el proveedor externo falla, devuelve JSON invalido, omite sospechosos o inventa `suspectId`, el modulo registra el error y lanza `ServiceUnavailableException` con el mensaje recibido.

### `AiService.generateCaseContradictions(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  suspects: { id: string; name: string; createdAt: string }[];
  evidences: {
    id: string;
    title: string;
    description: string;
    type: string;
    importance: string;
    isDecoy: boolean;
    isInitiallyVisible: boolean;
    metadata: Record<string, unknown>;
  }[];
  statements: {
    id: string;
    suspectId?: string;
    speakerName: string;
    content: string;
    context?: string;
    isInitiallyVisible: boolean;
  }[];
  culpritSuspectId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}
```

Salida:

```ts
{
  culpritSuspectId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  contradictions: {
    suspectId?: string;
    statementId: string;
    refutingEvidenceId: string;
    title: string;
    explanation: string;
    proves: 'motive' | 'method' | 'opportunity' | 'identity' | 'false_alibi' | 'contradiction' | 'support';
    isInitiallyVisible: boolean;
  }[];
  usedFallback: boolean;
}
```

El prompt se basa en `utils_prompts/case-contradictions-generation-prompt.md`. Este flujo no usa fallback local: si el proveedor falla, devuelve ids que no pertenecen al caso, excede el maximo de la dificultad u omite una contradiccion contra el culpable esperado, el modulo registra el error y lanza `ServiceUnavailableException`.

### `AiService.generateCaseSolution(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  suspects: { id: string; name: string; createdAt: string }[];
  evidences: {
    id: string;
    title: string;
    description: string;
    type: string;
    importance: string;
    isDecoy: boolean;
    isInitiallyVisible: boolean;
    metadata: Record<string, unknown>;
  }[];
  statements: {
    id: string;
    suspectId?: string;
    speakerName: string;
    content: string;
    context?: string;
    isInitiallyVisible: boolean;
  }[];
  contradictions: {
    id: string;
    suspectId?: string;
    statementId: string;
    refutingEvidenceId: string;
    title: string;
    explanation: string;
    proves: string;
    isInitiallyVisible: boolean;
  }[];
  culpritSuspectId: string;
}
```

Salida:

```ts
{
  culpritSuspectId: string;
  motiveSummary: string;
  methodSummary: string;
  opportunitySummary: string;
  fullExplanation: string;
  usedFallback: boolean;
}
```

El prompt se basa en `utils_prompts/case-solution-generation-prompt.md`. Este flujo no usa fallback local: si el proveedor falla, devuelve JSON invalido, cambia el culpable esperado o devuelve textos fuera de los limites del DTO, el modulo registra el error y lanza `ServiceUnavailableException`.

### `AiService.generateCaseSolveRequirements(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  suspects: { id: string; name: string; createdAt: string }[];
  evidences: {
    id: string;
    title: string;
    description: string;
    type: string;
    importance: string;
    isDecoy: boolean;
    isInitiallyVisible: boolean;
    metadata: Record<string, unknown>;
  }[];
  statements: {
    id: string;
    suspectId?: string;
    speakerName: string;
    content: string;
    context?: string;
    isInitiallyVisible: boolean;
  }[];
  contradictions: {
    id: string;
    suspectId?: string;
    statementId: string;
    refutingEvidenceId: string;
    title: string;
    explanation: string;
    proves: string;
    isInitiallyVisible: boolean;
  }[];
  solution: {
    id: string;
    caseId: string;
    culpritSuspectId: string;
    motiveSummary: string;
    methodSummary: string;
    opportunitySummary: string;
    fullExplanation: string;
    createdAt: string;
  };
  actions: unknown[];
  evidenceUnlockRules: unknown[];
  contradictionUnlockRules: unknown[];
  culpritSuspectId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}
```

Salida:

```ts
{
  culpritSuspectId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  requirements: {
    requirementType: 'culprit' | 'motive' | 'method' | 'opportunity' | 'identity' | 'false_alibi' | 'contradiction' | 'custom';
    proofRole?: 'motive' | 'method' | 'opportunity' | 'identity' | 'false_alibi' | 'contradiction' | 'support';
    requiredSuspectId?: string;
    requiredEvidenceId?: string;
    requiredContradictionId?: string;
    description: string;
    weight: number;
    isMandatory: boolean;
  }[];
  usedFallback: boolean;
}
```

El prompt se basa en `utils_prompts/case-solve-requirements-generation-prompt.md`. Este flujo no usa fallback local en el proveedor externo: si la IA falla, devuelve JSON invalido, referencia ids ajenos al caso, omite el requisito `culprit` obligatorio o devuelve una cantidad fuera del rango de la dificultad, el modulo registra el error y lanza `ServiceUnavailableException`.

### `AiService.generateCaseInvestigationGraph(input)`

Entrada:

```ts
{
  caseData: {
    id: string;
    title: string;
    summary: string;
    publicBriefing?: string;
    victimName?: string;
    difficulty: string;
  };
  suspects: { id: string; name: string; createdAt: string }[];
  evidences: {
    id: string;
    title: string;
    description: string;
    type: string;
    importance: string;
    isDecoy: boolean;
    isInitiallyVisible: boolean;
    metadata: Record<string, unknown>;
    weight: number;
  }[];
  statements: {
    id: string;
    suspectId?: string;
    speakerName: string;
    content: string;
    context?: string;
    isInitiallyVisible: boolean;
  }[];
  contradictions: {
    id: string;
    suspectId?: string;
    statementId: string;
    refutingEvidenceId: string;
    title: string;
    explanation: string;
    proves: string;
    isInitiallyVisible: boolean;
  }[];
  solution: {
    id: string;
    caseId: string;
    culpritSuspectId: string;
    motiveSummary: string;
    methodSummary: string;
    opportunitySummary: string;
    fullExplanation: string;
    createdAt: string;
  };
  requirements: {
    id: string;
    requirementType: string;
    proofRole?: string;
    requiredSuspectId?: string;
    requiredEvidenceId?: string;
    requiredContradictionId?: string;
    description: string;
    weight: number;
    isMandatory: boolean;
  }[];
  culpritSuspectId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}
```

Salida:

```ts
{
  culpritSuspectId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  actions: {
    tempId: string;
    title: string;
    description: string;
    actionType: 'interview' | 'inspect_scene' | 'analyze_forensic_sample' | 'review_security_camera' | 'check_financial_records' | 'perform_surveillance' | 'search_digital_devices' | 'request_autopsy' | 'compare_fingerprints' | 'background_check' | 'canvass_area' | 'custom';
    requiredSkill?: 'forensics' | 'interrogation' | 'digital_forensics' | 'financial_crimes' | 'surveillance' | 'field_investigation' | 'psychology' | 'ballistics' | 'crime_scene_analysis' | 'medical_examiner';
    minimumSkillLevel: number;
    baseDurationMinutes: number;
    isInitiallyAvailable: boolean;
    requiresDetective: boolean;
    metadata: Record<string, unknown>;
  }[];
  evidenceUnlockRules: {
    actionTempId: string;
    evidenceId: string;
    requiredSkill?: string;
    minimumSkillLevel: number;
    durationModifierMinutes: number;
    isGuaranteed: boolean;
    successChance: number;
  }[];
  statementUnlockRules: {
    actionTempId: string;
    statementId: string;
    requiredSkill?: string;
    minimumSkillLevel: number;
    isGuaranteed: boolean;
    successChance: number;
  }[];
  contradictionUnlockRules: {
    actionTempId: string;
    contradictionId: string;
    requiredSkill?: string;
    minimumSkillLevel: number;
    isGuaranteed: boolean;
    successChance: number;
  }[];
  actionPrerequisites: {
    actionTempId: string;
    prerequisiteActionTempId?: string;
    prerequisiteEvidenceId?: string;
    prerequisiteContradictionId?: string;
  }[];
  usedFallback: boolean;
}
```

`actionType` usa los valores canonicos del enum `action_type` en Supabase. El normalizador acepta aliases historicos como `inspection`, `forensic_analysis`, `camera_review`, `financial_review`, `surveillance`, `digital_search`, `autopsy`, `fingerprint` y `area_canvass`, y los traduce antes de persistir.

`minimumSkillLevel` en acciones y reglas de desbloqueo representa la dificultad operativa para detectives, no un porcentaje de progreso. El rango jugable es `50` a `100`; si el proveedor devuelve un valor menor, el normalizador lo eleva a `50` antes de persistir.

La cantidad de acciones ya no depende solo de la dificultad. `AiPromptFactory` y `GeneratedCaseInvestigationGraphNormalizer` calculan un presupuesto dinamico con `createInvestigationGraphActionBudget`: parten del rango base de dificultad y lo expanden cuando el caso tiene muchas evidencias, declaraciones o contradicciones ocultas. Asi un caso `medium` compacto sigue esperando `6-9` acciones, pero un caso `medium` denso puede aceptar un rango mayor, por ejemplo `9-12`, si ese volumen es necesario para cubrir el contenido real.

El normalizador separa la normalizacion del payload y la validacion de jugabilidad. La validacion acumula problemas como acciones no iniciales sin prerequisitos, acciones inalcanzables, evidencias/declaraciones/contradicciones sin ruta, reglas duplicadas y requisitos obligatorios sin ruta garantizada. Este flujo no usa fallback local en el proveedor externo: si la IA falla, devuelve JSON invalido o no logra reparar un grafo imposible, el modulo registra el error y lanza `ServiceUnavailableException`.

Para reducir timeouts y errores de referencias, el prompt de este flujo no serializa los registros completos ni expone UUIDs reales. `AiPromptFactory` transforma el input en un dossier compacto con historia del caso, solucion privada, culpable, catalogos de sospechosos/evidencias/statements/contradicciones y requisitos obligatorios/opcionales usando aliases deterministas como `SP1`, `EV1`, `ST1`, `CT1` y `REQ1`. El dossier omite ruido de persistencia como `createdAt`, `caseId`, `weight`, `metadata` completo y los IDs reales, pero conserva los textos narrativos necesarios para que la IA pueda construir el grafo. `GeneratedCaseInvestigationGraphNormalizer` traduce esos aliases a IDs reales antes de devolver el resultado a `CasesService`.

Si el JSON inicial es parseable y normalizable pero falla la validacion de jugabilidad, incluyendo una cantidad de acciones fuera del presupuesto dinamico, el provider hace hasta 2 llamadas adicionales con operation `case-investigation-graph-repair` usando la misma ruta. El prompt de reparacion envia el dossier compacto, el JSON anterior completo, el presupuesto final de acciones y los errores exactos del backend, y exige devolver el JSON completo corregido. Si ambas reparaciones fallan, esa ruta falla y el rotador prueba la siguiente disponible. Nada se persiste hasta que el grafo final pase validacion completa.

Cuando la IA devuelve un alias o `actionTempId` invalido, el normalizador incluye en el error la ruta del campo, el valor recibido y los aliases permitidos para esa entidad. Ese detalle aparece en el warning del provider para diagnosticar si el modelo omitio el campo, uso `actionId`, envio un objeto, referencio una accion inexistente o eligio un alias fuera del catalogo.

### `AiService.generateInvestigationStep(input)`

Entrada:

```ts
{
  caseData: Case;
  detectiveData: Detective;
  actionType: 'clue' | 'suspect' | 'general';
  targetId?: string;
}
```

Salida:

```ts
{
  step: InvestigationStepResult;
  usedFallback: boolean;
}
```

### `AiService.generateVerdict(input)`

Entrada:

```ts
{
  caseData: Case;
  detectiveData: Detective;
  culpritId: string;
  reasoning: string;
  accusedSuspect: Suspect;
}
```

Salida:

```ts
{
  result: VerdictResult;
  usedFallback: boolean;
}
```

### `AiService.generateDetectiveProfile(input)`

Entrada:

```ts
{
  gender: 'female' | 'male';
  generalSkillLevel: number; // 1..10
}
```

Salida:

```ts
{
  name: string;
  rank: 'rookie' | 'detective' | 'senior' | 'specialist' | 'lead';
  bio: string;
  skills: {
    skill: string;
    level: number;
  }
  [];
}
```

Este flujo no usa fallback local. Si ningun proveedor externo devuelve un perfil valido, lanza `ServiceUnavailableException`.

`gender` se usa para indicar si el modelo debe generar un nombre femenino o masculino. La imagen del detective no se envia a la IA en esta version.
Las habilidades se normalizan a los valores canonicos del juego: `forensics`, `interrogation`, `digital_forensics`, `financial_crimes`, `surveillance`, `field_investigation`, `psychology`, `ballistics`, `crime_scene_analysis` y `medical_examiner`.
`generalSkillLevel` controla la potencia real del perfil. Por ejemplo, con nivel `4` solo una habilidad puede superar `50` puntos y ninguna puede superar `60`; el normalizador reduce niveles inflados si el proveedor no respeta la escala.
El rango tambien se deriva de `generalSkillLevel`: `1-2 rookie`, `3-4 detective`, `5-6 senior`, `7-8 specialist` y `9-10 lead`.

## Proveedores de contenido y rotacion

`AiService` no conoce proveedores concretos. Recibe un `AiContentProvider` mediante el token `AI_CONTENT_PROVIDER`.

El proveedor activo es `ExternalAiContentProvider`. Intenta rutas externas configuradas por variables de entorno y rota entre proveedores/modelos cuando una ruta falla por limite, timeout, error de red, respuesta vacia o JSON invalido. Google usa Gemini Developer API mediante `@google/genai`; los demas proveedores actuales usan transporte OpenAI-compatible.

`LocalAiContentProvider` queda como fallback final para los flujos que lo admiten, como `generateCase` y `generateCaseEvidences`. Cuando se usa, `usedFallback` vuelve como `true`.

Los flujos administrativos estrictos (`generateAdminCaseBase`, `generateCaseSuspects`, `generateCaseStatements`, `generateCaseContradictions`, `generateCaseSolution`, `generateCaseSolveRequirements`, `generateCaseInvestigationGraph` y `generateDetectiveProfile`) no persisten contenido si todos los proveedores externos fallan o devuelven payloads invalidos.

Antes de normalizar una respuesta externa, el parser extrae el JSON desde texto extra o fences de Markdown. En los flujos cuyo contrato es un objeto con un array principal (`evidences`, `suspects`, `statements`, `contradictions` o `solveRequirements`), si el proveedor devuelve un array raiz valido, el modulo lo adapta al objeto esperado y mantiene las validaciones de negocio posteriores. No se inventan campos faltantes ni ids: cualquier item incompleto o ajeno al caso sigue fallando y rota al siguiente proveedor.

Rutas soportadas en v1:

- `google`: usa `GOOGLE_GENAI_MODELS` y `GOOGLE_GENAI_API_KEY`.
- `nvidia`: usa `NVIDIA_AI_BASE_URL`, `NVIDIA_AI_MODELS` y `NVIDIA_API_KEY`.
- `cerebras`: usa `CEREBRAS_AI_BASE_URL`, `CEREBRAS_AI_MODELS` y `CEREBRAS_API_KEY`.
- `cohere`: usa `COHERE_AI_BASE_URL`, `COHERE_AI_MODELS` y `COHERE_API_KEY`.
- `zai`: usa `ZAI_AI_BASE_URL`, `ZAI_AI_MODELS` y `ZAI_API_KEY`.

Cada modelo configurado crea una ruta independiente. El orden se define con `AI_PROVIDER_ORDER` y luego con el orden de modelos dentro de cada variable de modelos del proveedor.

## Variables de entorno

```env
AI_PROVIDER_ORDER="google,nvidia,cerebras,cohere,zai"
AI_PROVIDER_COOLDOWN_SECONDS=300
AI_PROVIDER_TIMEOUT_MS=30000
AI_PROMPT_REGISTRY_ENABLED=false
GOOGLE_GENAI_MODELS="gemini-2.5-flash,gemini-2.5-pro"
GOOGLE_GENAI_API_KEY="GOOGLE_GENAI_API_KEY"
NVIDIA_AI_BASE_URL="https://integrate.api.nvidia.com/v1"
NVIDIA_AI_MODELS="modelo-nvidia-1,modelo-nvidia-2"
NVIDIA_API_KEY="NVIDIA_API_KEY"
CEREBRAS_AI_BASE_URL="https://api.cerebras.ai/v1"
CEREBRAS_AI_MODELS="modelo-cerebras-1,modelo-cerebras-2"
CEREBRAS_API_KEY="CEREBRAS_API_KEY"
COHERE_AI_BASE_URL="https://api.cohere.ai/compatibility/v1"
COHERE_AI_MODELS="modelo-cohere-1,modelo-cohere-2"
COHERE_API_KEY="COHERE_API_KEY"
ZAI_AI_BASE_URL="https://api.z.ai/api/paas/v4"
ZAI_AI_MODELS="glm-5.1"
ZAI_API_KEY="ZAI_API_KEY"
```

Si una ruta Google no tiene modelos o API key, se descarta. Si una ruta OpenAI-compatible no tiene base URL, modelos o API key, tambien se descarta. Si no queda ninguna ruta externa valida, el modulo usa contenido local para los flujos que admiten fallback.

`AI_PROMPT_REGISTRY_ENABLED=true` activa el registro local de diagnostico para desarrollo. Cuando esta activo, cada llamada al proveedor externo crea un archivo `*.prompt.json` en `registry/` con los mensajes enviados a la IA y, si el proveedor responde, un archivo `*.response.json` con la respuesta cruda. La carpeta `registry/` esta ignorada por Git porque puede contener prompts con solucion privada y respuestas del proveedor.

## Como agregar un nuevo proveedor

Si el proveedor nuevo expone una API compatible con OpenAI `chat/completions`, no hace falta crear un cliente nuevo. Solo debe agregarse al registry de proveedores.

Pasos:

1. Agregar el identificador del proveedor en `providers/ai-provider.types.ts`.

```ts
export const AI_PROVIDER_NAMES = [
  'google',
  'nvidia',
  'cerebras',
  'cohere',
  'zai',
  'nuevoProveedor',
] as const;
```

2. Agregar sus variables en `CONFIG_KEYS_BY_PROVIDER` dentro de `providers/ai-provider-registry.service.ts`.

```ts
nuevoProveedor: {
  transport: 'openai-compatible',
  apiKey: 'NUEVO_PROVEEDOR_API_KEY',
  baseUrl: 'NUEVO_PROVEEDOR_AI_BASE_URL',
  models: 'NUEVO_PROVEEDOR_AI_MODELS',
},
```

3. Agregarlo al orden por defecto si debe participar automaticamente.

```ts
const DEFAULT_PROVIDER_ORDER = [
  'google',
  'nvidia',
  'cerebras',
  'cohere',
  'zai',
  'nuevoProveedor',
] as const;
```

4. Documentar y configurar sus variables de entorno.

```env
NUEVO_PROVEEDOR_AI_BASE_URL="https://provider.example.com/v1"
NUEVO_PROVEEDOR_AI_MODELS="modelo-1,modelo-2"
NUEVO_PROVEEDOR_API_KEY="..."
```

5. Agregarlo a `AI_PROVIDER_ORDER` cuando se quiera usar.

```env
AI_PROVIDER_ORDER="google,nvidia,cerebras,cohere,zai,nuevoProveedor"
```

6. Actualizar tests del registry para validar que la ruta se crea y que se descarta cuando falta API key.

Reglas importantes:

- `*_AI_BASE_URL` debe apuntar a la base del API; el cliente agrega `/chat/completions` si no viene incluido.
- `GOOGLE_GENAI_MODELS` y `*_AI_MODELS` pueden tener uno o varios modelos separados por coma. Cada modelo cuenta como una ruta independiente.
- `*_API_KEY` no debe guardarse en Supabase ni exponerse al frontend.
- Si el proveedor no es compatible con OpenAI `chat/completions`, debe crearse un cliente propio y conectarlo detras de `AiTextGenerationClient` para que participe en la misma rotacion.

## Seguridad

Este modulo no recibe requests HTTP ni valida usuarios. La seguridad se aplica en los controllers consumidores.

Las API keys de proveedores externos no deben exponerse al frontend.

## Archivos principales

- `ai.module.ts`: registra el proveedor activo y exporta `AiService`.
- `ai.service.ts`: fachada estable para los consumidores del modulo.
- `providers/ai-content-provider.interface.ts`: contrato comun para proveedores de contenido.
- `providers/external-ai-content.provider.ts`: proveedor externo con rotacion entre rutas Google GenAI y OpenAI-compatible.
- `providers/ai-text-generation-client.service.ts`: despacha cada ruta al cliente de texto correspondiente.
- `google-genai/google-gen-ai-client.service.ts`: ejecuta generaciones mediante `@google/genai`.
- `openai-compatible/ai-detective-profile.service.ts`: genera perfiles administrativos de detectives.
- `openai-compatible/ai-prompt-registry.service.ts`: guarda prompts y respuestas crudas en `registry/` cuando `AI_PROMPT_REGISTRY_ENABLED=true`.
- `openai-compatible/json-object.parser.ts`: extrae y parsea respuestas JSON de proveedores; adapta arrays raiz solo en contratos de colecciones donde existe una propiedad esperada.
- `openai-compatible/generated-admin-case-base.normalizer.ts`: normaliza casos base administrativos y valida dificultad, titulos y limites de texto.
- `openai-compatible/generated-case-contradiction.normalizer.ts`: normaliza contradicciones generadas y valida referencias existentes.
- `openai-compatible/generated-case-evidence.normalizer.ts`: normaliza evidencias y soluciones generadas para casos estructurados.
- `openai-compatible/generated-case-investigation-graph.normalizer.ts`: normaliza acciones, reglas de desbloqueo y prerequisitos generados, y valida que el grafo sea alcanzable.
- `openai-compatible/generated-case-solve-requirement.normalizer.ts`: normaliza requisitos de resolucion generados y valida cantidades, enums e IDs existentes.
- `openai-compatible/generated-case-solution.normalizer.ts`: normaliza soluciones privadas generadas y exige que el culpable coincida con el solicitado.
- `openai-compatible/generated-case-statement.normalizer.ts`: normaliza declaraciones generadas y garantiza una por sospechoso.
- `openai-compatible/generated-case-suspect.normalizer.ts`: normaliza sospechosos generados y valida cantidad exacta, nombres unicos, edad y limites de texto.
- `openai-compatible/detective-profile.normalizer.ts`: normaliza perfiles de detectives generados.
- `providers/ai-provider-registry.service.ts`: lee rutas desde variables de entorno.
- `providers/ai-provider-rotator.service.ts`: aplica prioridad y cooldown en memoria.
- `openai-compatible/open-ai-compatible-client.service.ts`: ejecuta `POST /chat/completions` para rutas OpenAI-compatible.
- `providers/local-ai-content.provider.ts`: generador local usado por la demo.
- `types/ai.types.ts`: define contratos internos de generacion.

## Pendiente

- Mover metadata no secreta de proveedores a Supabase si se necesita administracion desde panel.
- Reemplazar prompts demo por prompts alineados al modelo persistente final del juego.
- Validar casos contra reglas estructuradas antes de persistirlos.
- Separar solucion privada de informacion publica del caso.
