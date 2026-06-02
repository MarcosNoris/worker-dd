import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CaseAiGenerationWorkflowService } from './case-ai-generation-workflow.service';
import { CasePlayabilityValidator } from './case-playability.validator';
import { CaseSolveRequirementLogicValidator } from './case-solve-requirement-logic.validator';
import { CasesRepository } from './cases.repository';
import { CasesService } from './cases.service';

@Module({
  imports: [AiModule, SupabaseModule],
  exports: [
    CaseAiGenerationWorkflowService,
    CasePlayabilityValidator,
    CaseSolveRequirementLogicValidator,
    CasesRepository,
    CasesService,
  ],
  providers: [
    CaseAiGenerationWorkflowService,
    CasePlayabilityValidator,
    CaseSolveRequirementLogicValidator,
    CasesRepository,
    CasesService,
  ],
})
export class CasesModule {}
