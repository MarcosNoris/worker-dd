export const CASE_AI_GENERATION_STEPS = [
  'generate_case_base',
  'generate_suspects',
  'generate_evidences',
  'generate_statements',
  'generate_contradictions',
  'generate_solution',
  'generate_solve_requirements',
  'generate_investigation_graph',
  'validate_playability',
] as const;

export type CaseAiGenerationStep = (typeof CASE_AI_GENERATION_STEPS)[number];

export const CASE_AI_GENERATION_STATUSES = [
  'running',
  'failed',
  'completed',
  'needs_review',
] as const;

export type CaseAiGenerationStatus =
  (typeof CASE_AI_GENERATION_STATUSES)[number];

export type CaseAiGenerationAttempts = Partial<
  Record<CaseAiGenerationStep, number>
>;
