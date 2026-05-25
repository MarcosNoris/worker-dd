export interface AiChatMessage {
  readonly role: 'assistant' | 'system' | 'user';
  readonly content: string;
}

export interface AiTextGenerationCommand {
  readonly maxTokens: number;
  readonly messages: readonly AiChatMessage[];
  readonly temperature: number;
}
