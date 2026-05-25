export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export function readEnumValue<TAllowedValues extends readonly string[]>(
  value: unknown,
  allowedValues: TAllowedValues,
  fallback: TAllowedValues[number],
): TAllowedValues[number] {
  return typeof value === 'string' && allowedValues.includes(value)
    ? value
    : fallback;
}
