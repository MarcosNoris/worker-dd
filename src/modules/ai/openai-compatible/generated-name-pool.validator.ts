import {
  AiProviderFailureReason,
  AiProviderRequestError,
} from '../providers/ai-provider-request.error';

interface GeneratedNamePoolCommand {
  readonly errorCode: AiProviderFailureReason;
  readonly fieldName: string;
  readonly name: string;
  readonly namePool?: readonly string[];
}

export function readGeneratedNameFromPool(
  command: GeneratedNamePoolCommand,
): string {
  if (!command.namePool || command.namePool.length === 0) {
    return command.name;
  }

  const matchedName = command.namePool.find(
    (name) =>
      normalizeGeneratedName(name) === normalizeGeneratedName(command.name),
  );

  if (matchedName) {
    return matchedName;
  }

  throw AiProviderRequestError.retryable(
    command.errorCode,
    undefined,
    `La IA devolvio ${command.fieldName} fuera de la lista obligatoria de Random User Generator.`,
  );
}

function normalizeGeneratedName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
