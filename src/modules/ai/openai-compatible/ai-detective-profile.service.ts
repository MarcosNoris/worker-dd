import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { parseJsonObject } from './json-object.parser';
import { AiPromptFactory } from './ai-prompt.factory';
import { AiPromptRegistryService } from './ai-prompt-registry.service';
import { DetectiveProfileNormalizer } from './detective-profile.normalizer';
import { AiProviderRotator } from '../providers/ai-provider-rotator.service';
import { AiProviderRoute } from '../providers/ai-provider.types';
import { AiTextGenerationClient } from '../providers/ai-text-generation-client.service';
import {
  GeneratedDetectiveProfile,
  GenerateDetectiveProfileInput,
} from '../types/ai.types';

const DETECTIVE_PROFILE_MAX_TOKENS = 900;
const DETECTIVE_PROFILE_TEMPERATURE = 0.8;

interface GeneratedDetectiveProfilePayload {
  readonly bio?: unknown;
  readonly name?: unknown;
  readonly rank?: unknown;
  readonly skills?: unknown;
}

@Injectable()
export class AiDetectiveProfileService {
  constructor(
    private readonly providerRotator: AiProviderRotator,
    private readonly textGenerationClient: AiTextGenerationClient,
    private readonly promptFactory: AiPromptFactory,
    private readonly promptRegistry: AiPromptRegistryService,
    private readonly profileNormalizer: DetectiveProfileNormalizer,
  ) {}

  async generateDetectiveProfile(
    input: GenerateDetectiveProfileInput,
  ): Promise<GeneratedDetectiveProfile> {
    const profile = await this.providerRotator.execute((route) =>
      this.generateDetectiveProfileWithRoute(route, input),
    );

    if (profile) {
      return profile;
    }

    throw new ServiceUnavailableException(
      'No se pudo generar el perfil del detective con IA.',
    );
  }

  private async generateDetectiveProfileWithRoute(
    route: AiProviderRoute,
    input: GenerateDetectiveProfileInput,
  ): Promise<GeneratedDetectiveProfile> {
    const messages = this.promptFactory.buildDetectiveProfileMessages(input);
    const registryEntry = await this.promptRegistry.savePrompt({
      maxTokens: DETECTIVE_PROFILE_MAX_TOKENS,
      messages,
      operation: 'detective-profile',
      route,
      temperature: DETECTIVE_PROFILE_TEMPERATURE,
    });
    const responseText = await this.textGenerationClient.createTextCompletion(
      route,
      {
        messages,
        maxTokens: DETECTIVE_PROFILE_MAX_TOKENS,
        temperature: DETECTIVE_PROFILE_TEMPERATURE,
      },
    );
    await this.promptRegistry.saveResponse(registryEntry, responseText);

    const payload =
      parseJsonObject<GeneratedDetectiveProfilePayload>(responseText);

    return this.profileNormalizer.createProfileFromPayload(payload, input);
  }
}
