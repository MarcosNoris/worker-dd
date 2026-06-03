# Cases Module

## Proposito

`CasesModule` concentra la persistencia, validacion y generacion administrativa de casos. Exporta servicios para crear casos manuales o generados por IA, agregar recursos del caso, validar jugabilidad y recuperar generaciones IA interrumpidas.

Este modulo no declara controllers propios en este worker. Sus consumidores actuales son servicios internos como `CaseAiGenerationWorkerService` y otros modulos que importan `CasesModule`.

## Servicios exportados

- `CasesService`: operaciones de caso, sospechosos, evidencias, declaraciones, contradicciones, solucion privada, requisitos y grafo de investigacion.
- `CaseAiGenerationWorkflowService`: orquesta la generacion completa por pasos y permite recuperar runs fallidos.
- `CasesRepository`: acceso a Supabase para casos y recursos relacionados.
- `CasePlayabilityValidator`: valida si el caso generado cumple las reglas de jugabilidad.
- `CaseSolveRequirementLogicValidator`: valida coherencia de requisitos de resolucion.

## Workflow de generacion IA

`CaseAiGenerationWorkflowService.createFullAiCase()` crea un `case_ai_generation_runs` y ejecuta los pasos en orden:

1. `generate_case_base`
2. `generate_suspects`
3. `generate_evidences`
4. `generate_statements`
5. `generate_contradictions`
6. `generate_solution`
7. `generate_solve_requirements`
8. `generate_investigation_graph`
9. `validate_playability`

Cada paso se intenta como maximo dos veces. Si el proveedor IA falla o devuelve datos invalidos, el run queda `failed` con `lastError`, `currentStep` y `attemptsByStep` suficientes para que el recuperador pueda continuar despues.

Al completar la validacion, el run queda `completed`, pero el caso permanece en `draft`. El workflow no llama `publishCase()` ni cambia el caso a `playable` automaticamente.

## DTOs

### `CreateFullAiCaseDto`

```ts
export class CreateFullAiCaseDto {
  theme?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  suspectCount?: number;
  evidenceCount?: number;
}
```

### `CaseAiGenerationRunDto`

```ts
export interface CaseAiGenerationRunDto {
  readonly attemptsByStep: Partial<Record<CaseAiGenerationStep, number>>;
  readonly caseId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly culpritSuspectId?: string;
  readonly currentStep: CaseAiGenerationStep;
  readonly difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  readonly finishedAt?: string;
  readonly generationOptions: Record<string, unknown>;
  readonly id: string;
  readonly lastError?: string;
  readonly status: 'running' | 'completed' | 'failed' | 'needs_review';
  readonly theme?: string;
  readonly updatedAt: string;
}
```

### `CaseAiGenerationWorkflowResponseDto`

```ts
export interface CaseAiGenerationWorkflowResponseDto {
  readonly run: CaseAiGenerationRunDto;
  readonly state?: AdminCaseStateResponseDto;
}
```

## Recuperacion

`recoverAiCaseGeneration()` busca el ultimo run del caso. Si existe un run no ejecutable, crea uno nuevo copiando `caseId`, `culpritSuspectId`, `currentStep`, `difficulty`, `generationOptions` y `theme`. Si no existe run previo, arranca desde el caso persistido y continua desde el primer recurso faltante.

## Seguridad y persistencia

Las tablas de Supabase tienen RLS habilitado y el worker usa credenciales de servicio a traves de `CasesRepository`. Las operaciones de generacion estricta no deben persistir contenido parcial cuando falla la IA; el error queda registrado en el run para recuperacion posterior.

## Archivos principales

- `case-ai-generation-workflow.service.ts`: orquestacion y recuperacion de generacion IA.
- `cases.service.ts`: reglas de negocio para crear y mutar recursos de caso.
- `cases.repository.ts`: mapeo entre dominio y Supabase.
- `case-playability.validator.ts`: validacion final de jugabilidad.
- `dto/admin-case-ai-generation.dto.ts`: contratos del workflow IA.
