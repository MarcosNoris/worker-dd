import { Injectable } from '@nestjs/common';
import {
  CASE_SEVERITIES,
  CLUE_CATEGORIES,
  LOG_ENTRY_TYPES,
  SUSPECT_STATUSES,
} from '../../../shared/constants/domain.constants';
import { createId } from '../../../shared/utils/id.util';
import {
  readArray,
  readBoolean,
  readEnumValue,
  readNumber,
  readString,
} from '../../../shared/utils/value.util';
import { Case, Clue, LogEntry, Suspect } from '../../cases/types/case.types';
import {
  InvestigationStepResult,
  SuspectUpdate,
  VerdictResult,
} from '../../investigations/types/investigation.types';
import { InvestigationStepInput } from '../types/ai.types';

export interface GeneratedCasePayload {
  readonly id?: unknown;
  readonly title?: unknown;
  readonly codeName?: unknown;
  readonly description?: unknown;
  readonly location?: unknown;
  readonly suspects?: unknown;
  readonly clues?: unknown;
  readonly logs?: unknown;
}

export interface GeneratedInvestigationStepPayload {
  readonly log?: unknown;
  readonly newClue?: unknown;
  readonly suspectUpdate?: unknown;
}

export interface GeneratedVerdictPayload {
  readonly success?: unknown;
  readonly verdictText?: unknown;
}

@Injectable()
export class GeneratedContentNormalizer {
  createCaseFromPayload(
    payload: GeneratedCasePayload,
    fallbackCase: Case,
  ): Case {
    return {
      ...fallbackCase,
      id: readString(payload.id, fallbackCase.id),
      title: readString(payload.title, fallbackCase.title),
      codeName: readString(payload.codeName, fallbackCase.codeName),
      description: readString(payload.description, fallbackCase.description),
      location: readString(payload.location, fallbackCase.location),
      suspects: this.createSuspectsFromPayload(
        payload.suspects,
        fallbackCase.suspects,
      ),
      clues: this.createCluesFromPayload(payload.clues, fallbackCase.clues),
      logs: this.createLogsFromPayload(payload.logs, fallbackCase.logs),
    };
  }

  createInvestigationStepFromPayload(
    payload: GeneratedInvestigationStepPayload,
    input: InvestigationStepInput,
    fallbackStep: InvestigationStepResult,
  ): InvestigationStepResult {
    return {
      log: this.createLogFromPayload(
        payload.log,
        fallbackStep.log,
        this.logTypeFor(input),
      ),
      newClue: this.createOptionalClue(payload.newClue),
      suspectUpdate: this.createOptionalSuspectUpdate(payload.suspectUpdate),
    };
  }

  createVerdictFromPayload(
    payload: GeneratedVerdictPayload,
    fallbackVerdict: VerdictResult,
  ): VerdictResult {
    return {
      success: readBoolean(payload.success, fallbackVerdict.success),
      verdictText: readString(payload.verdictText, fallbackVerdict.verdictText),
    };
  }

  private createSuspectsFromPayload(
    value: unknown,
    fallbackSuspects: readonly Suspect[],
  ): Suspect[] {
    const suspects = readArray(value).map((suspect, suspectIndex) =>
      this.createSuspectFromPayload(suspect, suspectIndex),
    );

    return suspects.length > 0 ? suspects : [...fallbackSuspects];
  }

  private createCluesFromPayload(
    value: unknown,
    fallbackClues: readonly Clue[],
  ): Clue[] {
    const clues = readArray(value).map((clue, clueIndex) =>
      this.createClueFromPayload(clue, clueIndex),
    );

    return clues.length > 0 ? clues : [...fallbackClues];
  }

  private createLogsFromPayload(
    value: unknown,
    fallbackLogs: readonly LogEntry[],
  ): LogEntry[] {
    const logs = readArray(value).map((log, logIndex) =>
      this.createLogFromPayload(log, fallbackLogs[0], 'narrative', logIndex),
    );

    return logs.length > 0 ? logs : [...fallbackLogs];
  }

  private createOptionalClue(value: unknown): Clue | undefined {
    return value ? this.createClueFromPayload(value, 0) : undefined;
  }

  private createOptionalSuspectUpdate(
    value: unknown,
  ): SuspectUpdate | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const payload = value as Record<string, unknown>;
    const suspectId = readString(payload.suspectId, '');

    if (!suspectId) {
      return undefined;
    }

    return {
      suspectId,
      status: readEnumValue(payload.status, SUSPECT_STATUSES, 'suspect'),
      notes: readString(payload.notes, 'Sin notas adicionales.'),
    };
  }

  private createSuspectFromPayload(
    value: unknown,
    suspectIndex: number,
  ): Suspect {
    const payload = this.readPayload(value);

    return {
      id: readString(payload.id, createId('suspect')),
      name: readString(payload.name, `Persona de interes ${suspectIndex + 1}`),
      status: readEnumValue(payload.status, SUSPECT_STATUSES, 'suspect'),
      age: readNumber(payload.age, 34 + suspectIndex),
      occupation: readString(payload.occupation, 'Sin ocupacion confirmada'),
      alibi: readString(payload.alibi, 'Declara no estar cerca de la escena.'),
      relationToCase: readString(
        payload.relationToCase,
        'Vinculo bajo revision',
      ),
      notes: readString(payload.notes, 'Pendiente de entrevista formal.'),
    };
  }

  private createClueFromPayload(value: unknown, clueIndex: number): Clue {
    const payload = this.readPayload(value);

    return {
      id: readString(payload.id, createId('clue')),
      name: readString(payload.name, `Indicio ${clueIndex + 1}`),
      description: readString(
        payload.description,
        'Evidencia registrada en acta.',
      ),
      category: readEnumValue(payload.category, CLUE_CATEGORIES, 'Documental'),
      dateFound: readString(payload.dateFound, new Date().toISOString()),
      relevance: readEnumValue(payload.relevance, CASE_SEVERITIES, 'Media'),
    };
  }

  private createLogFromPayload(
    value: unknown,
    fallbackLog: LogEntry | undefined,
    fallbackType: LogEntry['type'],
    logIndex = 0,
  ): LogEntry {
    const payload = this.readPayload(value);

    return {
      id: readString(payload.id, fallbackLog?.id ?? createId('log')),
      timestamp: readString(
        payload.timestamp,
        fallbackLog?.timestamp ?? new Date().toISOString(),
      ),
      title: readString(
        payload.title,
        fallbackLog?.title ?? `Actualizacion ${logIndex + 1}`,
      ),
      text: readString(
        payload.text,
        fallbackLog?.text ?? 'La investigacion registra un nuevo avance.',
      ),
      type: readEnumValue(payload.type, LOG_ENTRY_TYPES, fallbackType),
    };
  }

  private logTypeFor(input: InvestigationStepInput): LogEntry['type'] {
    const logTypes: Record<
      InvestigationStepInput['actionType'],
      LogEntry['type']
    > = {
      clue: 'clue_analyzed',
      suspect: 'interrogation',
      general: 'discovery',
    };

    return logTypes[input.actionType];
  }

  private readPayload(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
