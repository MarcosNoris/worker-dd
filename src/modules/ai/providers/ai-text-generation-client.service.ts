import { Injectable } from '@nestjs/common';
import { GoogleGenAiClient } from '../google-genai/google-gen-ai-client.service';
import { OpenAiCompatibleClient } from '../openai-compatible/open-ai-compatible-client.service';
import { AiProviderRoute } from './ai-provider.types';
import { AiTextGenerationCommand } from './ai-text-generation.types';

@Injectable()
export class AiTextGenerationClient {
  constructor(
    private readonly googleGenAiClient: GoogleGenAiClient,
    private readonly openAiCompatibleClient: OpenAiCompatibleClient,
  ) {}

  createTextCompletion(
    route: AiProviderRoute,
    command: AiTextGenerationCommand,
  ): Promise<string> {
    return route.transport === 'google-genai'
      ? this.googleGenAiClient.createTextCompletion(route, command)
      : this.openAiCompatibleClient.createChatCompletion(route, command);
  }
}
