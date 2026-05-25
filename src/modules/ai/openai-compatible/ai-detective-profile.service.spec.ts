import { ServiceUnavailableException } from '@nestjs/common';
import { AiProviderRegistry } from '../providers/ai-provider-registry.service';
import { AiProviderRequestError } from '../providers/ai-provider-request.error';
import { AiProviderRotator } from '../providers/ai-provider-rotator.service';
import { AiProviderRoute } from '../providers/ai-provider.types';
import { AiTextGenerationClient } from '../providers/ai-text-generation-client.service';
import { AiPromptFactory } from './ai-prompt.factory';
import {
  AiPromptRegistryEntry,
  AiPromptRegistryService,
} from './ai-prompt-registry.service';
import { AiDetectiveProfileService } from './ai-detective-profile.service';
import { DetectiveProfileNormalizer } from './detective-profile.normalizer';

describe('AiDetectiveProfileService', () => {
  const googleRoute: AiProviderRoute = {
    provider: 'google',
    model: 'gemini-2.5-flash',
    apiKey: 'google-key',
    transport: 'google-genai',
  };
  const nvidiaRoute: AiProviderRoute = {
    provider: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia-model',
    apiKey: 'nvidia-key',
    transport: 'openai-compatible',
  };
  const cerebrasRoute: AiProviderRoute = {
    provider: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.1-8b',
    apiKey: 'cerebras-key',
    transport: 'openai-compatible',
  };

  it('converts a valid AI response into a detective profile', async () => {
    const service = createService(
      [nvidiaRoute],
      createClientMock([
        JSON.stringify({
          name: 'Elena Vargas',
          rank: 'specialist',
          bio: 'Perfil generado por IA.',
          skills: [
            {
              skill: 'interrogatorio',
              level: 88,
            },
          ],
        }),
      ]),
    );

    await expect(
      service.generateDetectiveProfile({
        gender: 'female',
        generalSkillLevel: 8,
      }),
    ).resolves.toEqual({
      name: 'Elena Vargas',
      rank: 'specialist',
      bio: 'Perfil generado por IA.',
      skills: [
        {
          skill: 'interrogation',
          level: 88,
        },
      ],
    });
  });

  it('registers detective profile prompts and raw responses', async () => {
    const client = createClientMock([
      JSON.stringify({
        name: 'Elena Vargas',
        rank: 'specialist',
        bio: 'Perfil generado por IA.',
        skills: [{ skill: 'interrogation', level: 88 }],
      }),
    ]);
    const promptRegistry = createPromptRegistryMock();
    const service = createService([nvidiaRoute], client, promptRegistry);

    await service.generateDetectiveProfile({
      gender: 'female',
      generalSkillLevel: 8,
    });

    expect(promptRegistry.savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'detective-profile',
        route: nvidiaRoute,
      }),
    );
    expect(promptRegistry.saveResponse).toHaveBeenCalledWith(
      expect.objectContaining({ fileBaseName: 'registry-entry' }),
      expect.stringContaining('Elena Vargas'),
    );
  });

  it('rotates when a provider returns invalid JSON', async () => {
    const client = createClientMock([
      'respuesta invalida',
      JSON.stringify({
        name: 'Marco Reyes',
        rank: 'lead',
        bio: 'Especialista tactico.',
        skills: [{ skill: 'forensics', level: 97 }],
      }),
    ]);
    const service = createService([nvidiaRoute, cerebrasRoute], client);

    const profile = await service.generateDetectiveProfile({
      gender: 'male',
      generalSkillLevel: 10,
    });

    expect(profile.name).toBe('Marco Reyes');
    expect(client.createTextCompletion).toHaveBeenNthCalledWith(
      1,
      nvidiaRoute,
      expect.any(Object),
    );
    expect(client.createTextCompletion).toHaveBeenNthCalledWith(
      2,
      cerebrasRoute,
      expect.any(Object),
    );
  });

  it('uses Google routes in detective profile rotation', async () => {
    const client = createClientMock([
      'respuesta invalida',
      JSON.stringify({
        name: 'Marco Reyes',
        rank: 'lead',
        bio: 'Especialista tactico.',
        skills: [{ skill: 'forensics', level: 97 }],
      }),
    ]);
    const service = createService([googleRoute, nvidiaRoute], client);

    const profile = await service.generateDetectiveProfile({
      gender: 'male',
      generalSkillLevel: 10,
    });

    expect(profile.name).toBe('Marco Reyes');
    expect(client.createTextCompletion).toHaveBeenNthCalledWith(
      1,
      googleRoute,
      expect.any(Object),
    );
    expect(client.createTextCompletion).toHaveBeenNthCalledWith(
      2,
      nvidiaRoute,
      expect.any(Object),
    );
  });

  it('throws ServiceUnavailableException when every provider fails', async () => {
    const service = createService([nvidiaRoute], {
      createTextCompletion: jest
        .fn()
        .mockRejectedValue(AiProviderRequestError.retryable('http_error', 429)),
    } as unknown as jest.Mocked<AiTextGenerationClient>);

    await expect(
      service.generateDetectiveProfile({
        gender: 'female',
        generalSkillLevel: 7,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects profiles without valid skills', async () => {
    const service = createService(
      [nvidiaRoute],
      createClientMock([
        JSON.stringify({
          name: 'Perfil incompleto',
          rank: 'detective',
          bio: 'Sin habilidades validas.',
          skills: [],
        }),
      ]),
    );

    await expect(
      service.generateDetectiveProfile({
        gender: 'male',
        generalSkillLevel: 4,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('asks the provider for a name matching the requested gender', async () => {
    const client = createClientMock([
      JSON.stringify({
        name: 'Elena Vargas',
        rank: 'specialist',
        bio: 'Perfil generado por IA.',
        skills: [{ skill: 'interrogation', level: 88 }],
      }),
    ]);
    const service = createService([nvidiaRoute], client);

    await service.generateDetectiveProfile({
      gender: 'female',
      generalSkillLevel: 8,
    });

    expect(client.createTextCompletion).toHaveBeenCalledWith(
      nvidiaRoute,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('nombre femenino'),
          }),
        ]),
      }),
    );
  });

  it('keeps level 4 profiles from looking too skilled', async () => {
    const service = createService(
      [nvidiaRoute],
      createClientMock([
        JSON.stringify({
          name: 'Lucia Torres',
          rank: 'lead',
          bio: 'Detective con experiencia irregular.',
          skills: [
            { skill: 'interrogation', level: 94 },
            { skill: 'forensics', level: 82 },
            { skill: 'surveillance', level: 47 },
          ],
        }),
      ]),
    );

    await expect(
      service.generateDetectiveProfile({
        gender: 'female',
        generalSkillLevel: 4,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        rank: 'detective',
        skills: [
          { skill: 'interrogation', level: 60 },
          { skill: 'forensics', level: 50 },
          { skill: 'surveillance', level: 47 },
        ],
      }),
    );
  });

  it('asks the provider to align rank with general skill level', async () => {
    const client = createClientMock([
      JSON.stringify({
        name: 'Marco Reyes',
        rank: 'detective',
        bio: 'Detective regular.',
        skills: [{ skill: 'surveillance', level: 48 }],
      }),
    ]);
    const service = createService([nvidiaRoute], client);

    await service.generateDetectiveProfile({
      gender: 'male',
      generalSkillLevel: 4,
    });

    expect(client.createTextCompletion).toHaveBeenCalledWith(
      nvidiaRoute,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('nivel 3-4 usa detective'),
          }),
        ]),
      }),
    );
  });

  function createService(
    routes: readonly AiProviderRoute[],
    client: jest.Mocked<AiTextGenerationClient>,
    promptRegistry = createPromptRegistryMock(),
  ): AiDetectiveProfileService {
    return new AiDetectiveProfileService(
      new AiProviderRotator(createRegistry(routes)),
      client,
      new AiPromptFactory(),
      promptRegistry,
      new DetectiveProfileNormalizer(),
    );
  }

  function createPromptRegistryMock(): jest.Mocked<AiPromptRegistryService> {
    const entry: AiPromptRegistryEntry = {
      fileBaseName: 'registry-entry',
      isEnabled: true,
    };

    return {
      savePrompt: jest.fn().mockResolvedValue(entry),
      saveResponse: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AiPromptRegistryService>;
  }

  function createRegistry(
    routes: readonly AiProviderRoute[],
  ): AiProviderRegistry {
    return {
      getCooldownDurationInMs: jest.fn().mockReturnValue(300000),
      getProviderRoutes: jest.fn().mockReturnValue(routes),
    } as unknown as AiProviderRegistry;
  }

  function createClientMock(
    responses: readonly string[],
  ): jest.Mocked<AiTextGenerationClient> {
    const pendingResponses = [...responses];

    return {
      createTextCompletion: jest.fn(() => {
        const response = pendingResponses.shift();
        return response
          ? Promise.resolve(response)
          : Promise.reject(AiProviderRequestError.retryable('network_error'));
      }),
    } as unknown as jest.Mocked<AiTextGenerationClient>;
  }
});
