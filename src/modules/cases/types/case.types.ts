import {
  CASE_CATEGORIES,
  CASE_SEVERITIES,
  CASE_STATUSES,
  CLUE_CATEGORIES,
  DETECTIVE_RANKS,
  LOG_ENTRY_TYPES,
  SUSPECT_STATUSES,
} from '../../../shared/constants/domain.constants';

export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export type CaseSeverity = (typeof CASE_SEVERITIES)[number];

export type CaseStatus = (typeof CASE_STATUSES)[number];

export type LogEntryType = (typeof LOG_ENTRY_TYPES)[number];

export type SuspectStatus = (typeof SUSPECT_STATUSES)[number];

export type DetectiveRank = (typeof DETECTIVE_RANKS)[number];

export type ClueCategory = (typeof CLUE_CATEGORIES)[number];

export interface Detective {
  id: string;
  name: string;
  badgeNumber: string;
  rank: DetectiveRank;
  specialty: string;
  avatarColor: string;
  activeCaseId: string | null;
  casesCompleted: number;
  efficiency: number;
  bio: string;
}

export interface Suspect {
  id: string;
  name: string;
  status: SuspectStatus;
  age: number;
  occupation: string;
  alibi: string;
  relationToCase: string;
  notes?: string;
}

export interface Clue {
  id: string;
  name: string;
  description: string;
  category: ClueCategory;
  dateFound: string;
  relevance: CaseSeverity;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  title: string;
  text: string;
  type: LogEntryType;
}

export interface Case {
  id: string;
  title: string;
  codeName: string;
  description: string;
  category: CaseCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  location: string;
  dateCreated: string;
  assignedDetectiveId: string | null;
  suspects: Suspect[];
  clues: Clue[];
  logs: LogEntry[];
  resolutionDetails?: string;
  culpritId?: string;
}
