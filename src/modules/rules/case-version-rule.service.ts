import { Injectable } from '@nestjs/common';

export const CURRENT_CASE_VERSION = 2;

@Injectable()
export class CaseVersionRuleService {
  currentVersion(): number {
    return CURRENT_CASE_VERSION;
  }
}
