export const DETECTIVE_SKILL_TYPES = [
  'forensics',
  'interrogation',
  'digital_forensics',
  'financial_crimes',
  'surveillance',
  'field_investigation',
  'psychology',
  'ballistics',
  'crime_scene_analysis',
  'medical_examiner',
] as const;

export type DetectiveSkillType = (typeof DETECTIVE_SKILL_TYPES)[number];

const DETECTIVE_SKILL_ALIASES: Readonly<Record<string, DetectiveSkillType>> = {
  analisis_de_escena: 'crime_scene_analysis',
  analisis_digital: 'digital_forensics',
  analisis_forense: 'forensics',
  antecedentes: 'field_investigation',
  autopsia: 'medical_examiner',
  balistica: 'ballistics',
  ballistics: 'ballistics',
  campo: 'field_investigation',
  camaras: 'surveillance',
  crime_scene_analysis: 'crime_scene_analysis',
  digital: 'digital_forensics',
  digital_forensics: 'digital_forensics',
  entrevistas: 'interrogation',
  escena_crimen: 'crime_scene_analysis',
  field_investigation: 'field_investigation',
  financial_crimes: 'financial_crimes',
  finanzas: 'financial_crimes',
  forense: 'forensics',
  forensics: 'forensics',
  huellas: 'forensics',
  interrogation: 'interrogation',
  interrogatorio: 'interrogation',
  medical_examiner: 'medical_examiner',
  medico_forense: 'medical_examiner',
  psychology: 'psychology',
  psicologia: 'psychology',
  surveillance: 'surveillance',
  vigilancia: 'surveillance',
};

export function normalizeDetectiveSkillType(
  value: string,
): DetectiveSkillType | undefined {
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, '_');

  return DETECTIVE_SKILL_ALIASES[normalizedValue];
}
