import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiDetectiveProfileService } from './openai-compatible/ai-detective-profile.service';
import { AiPromptFactory } from './openai-compatible/ai-prompt.factory';
import { AiPromptRegistryService } from './openai-compatible/ai-prompt-registry.service';
import { DetectiveProfileNormalizer } from './openai-compatible/detective-profile.normalizer';
import { GeneratedAdminCaseBaseNormalizer } from './openai-compatible/generated-admin-case-base.normalizer';
import { GeneratedCaseContradictionNormalizer } from './openai-compatible/generated-case-contradiction.normalizer';
import { GeneratedCaseEvidenceNormalizer } from './openai-compatible/generated-case-evidence.normalizer';
import { GeneratedCaseInvestigationGraphNormalizer } from './openai-compatible/generated-case-investigation-graph.normalizer';
import { GeneratedCaseSolveRequirementNormalizer } from './openai-compatible/generated-case-solve-requirement.normalizer';
import { GeneratedCaseSolutionNormalizer } from './openai-compatible/generated-case-solution.normalizer';
import { GeneratedCaseStatementNormalizer } from './openai-compatible/generated-case-statement.normalizer';
import { GeneratedCaseSuspectNormalizer } from './openai-compatible/generated-case-suspect.normalizer';
import { GeneratedContentNormalizer } from './openai-compatible/generated-content.normalizer';
import { OpenAiCompatibleClient } from './openai-compatible/open-ai-compatible-client.service';
import {
  GoogleGenAiClient,
  GoogleGenAiClientFactory,
} from './google-genai/google-gen-ai-client.service';
import { AI_CONTENT_PROVIDER } from './providers/ai-content-provider.interface';
import { AiProviderRegistry } from './providers/ai-provider-registry.service';
import { AiProviderRotator } from './providers/ai-provider-rotator.service';
import { AiTextGenerationClient } from './providers/ai-text-generation-client.service';
import { ExternalAiContentProvider } from './providers/external-ai-content.provider';
import { LocalAiContentProvider } from './providers/local-ai-content.provider';

@Module({
  providers: [
    AiService,
    AiDetectiveProfileService,
    AiPromptFactory,
    AiPromptRegistryService,
    AiProviderRegistry,
    AiProviderRotator,
    DetectiveProfileNormalizer,
    GeneratedAdminCaseBaseNormalizer,
    GeneratedCaseContradictionNormalizer,
    GeneratedCaseEvidenceNormalizer,
    GeneratedCaseInvestigationGraphNormalizer,
    GeneratedCaseSolveRequirementNormalizer,
    GeneratedCaseSolutionNormalizer,
    GeneratedCaseStatementNormalizer,
    GeneratedCaseSuspectNormalizer,
    GeneratedContentNormalizer,
    GoogleGenAiClient,
    GoogleGenAiClientFactory,
    AiTextGenerationClient,
    LocalAiContentProvider,
    OpenAiCompatibleClient,
    ExternalAiContentProvider,
    {
      provide: AI_CONTENT_PROVIDER,
      useExisting: ExternalAiContentProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
