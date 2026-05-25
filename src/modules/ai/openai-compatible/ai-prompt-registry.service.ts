import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AiProviderRoute } from '../providers/ai-provider.types';
import { AiChatMessage } from '../providers/ai-text-generation.types';

const PROMPT_REGISTRY_ENABLED_KEY = 'AI_PROMPT_REGISTRY_ENABLED';
const PROMPT_REGISTRY_DIRECTORY = 'registry';
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export interface RegisteredAiPromptCommand {
  readonly maxTokens: number;
  readonly messages: readonly AiChatMessage[];
  readonly operation: string;
  readonly route: AiProviderRoute;
  readonly temperature: number;
}

export interface AiPromptRegistryEntry {
  readonly fileBaseName: string;
  readonly isEnabled: boolean;
}

@Injectable()
export class AiPromptRegistryService {
  private readonly logger = new Logger(AiPromptRegistryService.name);

  constructor(private readonly configService: ConfigService) {}

  async savePrompt(
    command: RegisteredAiPromptCommand,
  ): Promise<AiPromptRegistryEntry> {
    if (!this.isEnabled()) {
      return this.createDisabledEntry();
    }

    const entry = this.createEnabledEntry(command);

    await this.writeRegistryFile(entry, 'prompt', {
      createdAt: new Date().toISOString(),
      maxTokens: command.maxTokens,
      messages: command.messages,
      operation: command.operation,
      provider: command.route.provider,
      model: command.route.model,
      temperature: command.temperature,
    });

    return entry;
  }

  async saveResponse(
    entry: AiPromptRegistryEntry,
    responseText: string,
  ): Promise<void> {
    if (!entry.isEnabled) {
      return;
    }

    await this.writeRegistryFile(entry, 'response', {
      createdAt: new Date().toISOString(),
      responseText,
    });
  }

  private createDisabledEntry(): AiPromptRegistryEntry {
    return {
      fileBaseName: '',
      isEnabled: false,
    };
  }

  private createEnabledEntry(
    command: RegisteredAiPromptCommand,
  ): AiPromptRegistryEntry {
    return {
      fileBaseName: [
        this.createTimestampSegment(),
        this.sanitizeFileSegment(command.operation),
        this.sanitizeFileSegment(command.route.provider),
        this.sanitizeFileSegment(command.route.model),
        this.createRandomSegment(),
      ].join('__'),
      isEnabled: true,
    };
  }

  private async writeRegistryFile(
    entry: AiPromptRegistryEntry,
    suffix: 'prompt' | 'response',
    content: object,
  ): Promise<void> {
    try {
      await mkdir(this.getRegistryDirectory(), { recursive: true });
      await writeFile(
        this.createRegistryFilePath(entry, suffix),
        `${JSON.stringify(content, null, 2)}\n`,
        'utf8',
      );
    } catch (error: unknown) {
      this.logger.warn(
        `No se pudo escribir el archivo de registry ${suffix}: ${this.readErrorMessage(error)}`,
      );
    }
  }

  private createRegistryFilePath(
    entry: AiPromptRegistryEntry,
    suffix: 'prompt' | 'response',
  ): string {
    return join(
      this.getRegistryDirectory(),
      `${entry.fileBaseName}.${suffix}.json`,
    );
  }

  private getRegistryDirectory(): string {
    return join(process.cwd(), PROMPT_REGISTRY_DIRECTORY);
  }

  private isEnabled(): boolean {
    return TRUE_VALUES.has(
      this.configService
        .get<string>(PROMPT_REGISTRY_ENABLED_KEY)
        ?.trim()
        .toLowerCase() ?? '',
    );
  }

  private createTimestampSegment(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  private createRandomSegment(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  private sanitizeFileSegment(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown'
    );
  }

  private readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
