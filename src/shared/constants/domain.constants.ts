export const CASE_CATEGORIES = [
  'Robo',
  'Falsificación',
  'Homicidio',
  'Desaparición',
  'Narcóticos',
  'Cibercrimen',
] as const;

export const CASE_SEVERITIES = ['Baja', 'Media', 'Alta', 'Crítica'] as const;

export const CASE_STATUSES = ['pending', 'active', 'solved', 'closed'] as const;

export const INVESTIGATION_ACTION_TYPES = [
  'clue',
  'suspect',
  'general',
] as const;

export const LOG_ENTRY_TYPES = [
  'narrative',
  'discovery',
  'interrogation',
  'clue_analyzed',
  'closing',
] as const;

export const SUSPECT_STATUSES = ['suspect', 'cleared', 'arrested'] as const;

export const DETECTIVE_RANKS = [
  'Detective',
  'Sargento',
  'Inspector',
  'Oficial de Enlace',
] as const;

export const CLUE_CATEGORIES = [
  'Física',
  'Digital',
  'Testimonio',
  'Biológica',
  'Documental',
] as const;
