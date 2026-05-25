import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiProviderRoute } from '../providers/ai-provider.types';
import { AiPromptRegistryService } from './ai-prompt-registry.service';

describe('AiPromptRegistryService', () => {
  const route: AiProviderRoute = {
    provider: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia/model:name',
    apiKey: 'secret-api-key',
    transport: 'openai-compatible',
  };

  let temporaryDirectory: string;
  let cwdSpy: jest.SpyInstance<string, []>;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'ai-registry-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(temporaryDirectory);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  it('writes paired prompt and response files when the registry is enabled', async () => {
    const service = createService('true');

    const entry = await service.savePrompt({
      maxTokens: 500,
      messages: [{ role: 'user', content: 'Genera acciones' }],
      operation: 'case investigation graph',
      route,
      temperature: 0.2,
    });
    await service.saveResponse(entry, '{"actions":[]}');

    const registryFiles = await readdir(join(temporaryDirectory, 'registry'));
    const promptFileName = registryFiles.find((fileName) =>
      fileName.endsWith('.prompt.json'),
    );
    const responseFileName = registryFiles.find((fileName) =>
      fileName.endsWith('.response.json'),
    );

    expect(promptFileName).toBeDefined();
    expect(responseFileName).toBeDefined();
    expect(promptFileName?.replace('.prompt.json', '')).toBe(
      responseFileName?.replace('.response.json', ''),
    );
    expect(promptFileName).toContain('case-investigation-graph__nvidia');
    expect(promptFileName).toContain('nvidia-model-name');

    const promptContent = await readJsonFile(promptFileName);
    const responseContent = await readJsonFile(responseFileName);

    expect(promptContent).toEqual(
      expect.objectContaining({
        maxTokens: 500,
        messages: [{ role: 'user', content: 'Genera acciones' }],
        model: 'nvidia/model:name',
        operation: 'case investigation graph',
        provider: 'nvidia',
        temperature: 0.2,
      }),
    );
    expect(JSON.stringify(promptContent)).not.toContain('secret-api-key');
    expect(responseContent).toEqual(
      expect.objectContaining({
        responseText: '{"actions":[]}',
      }),
    );
  });

  it('does not create registry files when the registry is disabled', async () => {
    const service = createService('false');

    const entry = await service.savePrompt({
      maxTokens: 500,
      messages: [{ role: 'user', content: 'Genera acciones' }],
      operation: 'case',
      route,
      temperature: 0.2,
    });
    await service.saveResponse(entry, '{"title":"Caso"}');

    await expect(readdir(join(temporaryDirectory, 'registry'))).rejects.toThrow(
      /ENOENT/,
    );
  });

  function createService(isEnabled: string): AiPromptRegistryService {
    return new AiPromptRegistryService({
      get: jest.fn().mockReturnValue(isEnabled),
    } as unknown as ConfigService);
  }

  async function readJsonFile(fileName: string | undefined): Promise<unknown> {
    if (!fileName) {
      throw new Error('Missing registry file name.');
    }

    const fileContent = await readFile(
      join(temporaryDirectory, 'registry', fileName),
      'utf8',
    );

    return JSON.parse(fileContent) as unknown;
  }
});
