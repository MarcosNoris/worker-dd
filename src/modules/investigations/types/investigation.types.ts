import {
  INVESTIGATION_ACTION_TYPES,
  SUSPECT_STATUSES,
} from '../../../shared/constants/domain.constants';
import { Clue, LogEntry } from '../../cases/types/case.types';

export type InvestigationActionType =
  (typeof INVESTIGATION_ACTION_TYPES)[number];

export type InvestigationSuspectStatus = (typeof SUSPECT_STATUSES)[number];

export interface SuspectUpdate {
  readonly suspectId: string;
  readonly status: InvestigationSuspectStatus;
  readonly notes?: string;
}

export interface InvestigationStepResult {
  readonly log: LogEntry;
  readonly newClue?: Clue;
  readonly suspectUpdate?: SuspectUpdate;
}

export interface InvestigationStepResponse {
  readonly success: boolean;
  readonly log?: LogEntry;
  readonly newClue?: Clue;
  readonly suspectUpdate?: SuspectUpdate;
  readonly error?: string;
}

export interface SubmitSolutionResponse {
  readonly success: boolean;
  readonly result?: VerdictResult;
  readonly error?: string;
}

export interface VerdictResult {
  readonly success: boolean;
  readonly verdictText: string;
}
