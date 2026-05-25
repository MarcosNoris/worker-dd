import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './modules/ai/ai.module';
import { CasesModule } from './modules/cases/cases.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { CaseAiGenerationWorkerService } from './case-ai-generation-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AiModule,
    SupabaseModule,
    CasesModule,
  ],
  providers: [CaseAiGenerationWorkerService],
})
export class WorkerModule {}
