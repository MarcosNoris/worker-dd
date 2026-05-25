import { Case } from './case.types';

export interface GenerateCaseResponse {
  success: boolean;
  case?: Case;
  alertMessage?: string;
  error?: string;
}
