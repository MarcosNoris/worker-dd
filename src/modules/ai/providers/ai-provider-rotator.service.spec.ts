import { AiProviderRegistry } from './ai-provider-registry.service';
import { AiProviderRequestError } from './ai-provider-request.error';
import { AiProviderRotator } from './ai-provider-rotator.service';
import { AiProviderRoute } from './ai-provider.types';

describe('AiProviderRotator', () => {
  const nvidiaRoute: AiProviderRoute = {
    provider: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia-model',
    apiKey: 'nvidia-key',
    transport: 'openai-compatible',
  };
  const cohereRoute: AiProviderRoute = {
    provider: 'cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    model: 'command-a',
    apiKey: 'cohere-key',
    transport: 'openai-compatible',
  };
  const cerebrasRoute: AiProviderRoute = {
    provider: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.1-8b',
    apiKey: 'cerebras-key',
    transport: 'openai-compatible',
  };

  it('rotates to Cerebras when NVIDIA fails with a rate limit error', async () => {
    const rotator = createRotator([nvidiaRoute, cerebrasRoute, cohereRoute]);
    const operation = jest
      .fn()
      .mockRejectedValueOnce(
        AiProviderRequestError.retryable('http_error', 429),
      )
      .mockResolvedValueOnce('cerebras-response');

    await expect(rotator.execute(operation)).resolves.toBe('cerebras-response');

    expect(operation).toHaveBeenNthCalledWith(1, nvidiaRoute);
    expect(operation).toHaveBeenNthCalledWith(2, cerebrasRoute);
    expect(rotator.isRouteInCooldown(nvidiaRoute)).toBe(true);
  });

  it('skips a route while it is in cooldown', async () => {
    const rotator = createRotator([nvidiaRoute, cohereRoute]);
    const operation = jest
      .fn()
      .mockRejectedValueOnce(
        AiProviderRequestError.retryable('http_error', 429),
      )
      .mockResolvedValue('cohere-response');

    await rotator.execute(operation);
    await rotator.execute(operation);

    expect(operation).toHaveBeenCalledTimes(3);
    expect(operation).toHaveBeenNthCalledWith(3, cohereRoute);
  });

  it('returns undefined when every route fails', async () => {
    const rotator = createRotator([nvidiaRoute, cohereRoute]);
    const operation = jest
      .fn()
      .mockRejectedValue(AiProviderRequestError.retryable('network_error'));

    await expect(rotator.execute(operation)).resolves.toBeUndefined();
  });

  it('throws the last provider error in strict execution mode', async () => {
    const rotator = createRotator([nvidiaRoute, cohereRoute]);
    const operation = jest
      .fn()
      .mockRejectedValueOnce(AiProviderRequestError.retryable('network_error'))
      .mockRejectedValueOnce(
        AiProviderRequestError.retryable('http_error', 429),
      );

    await expect(rotator.executeOrThrow(operation)).rejects.toThrow(
      'AI provider failed with http_error (429)',
    );
  });

  it('reports strict execution route failures', async () => {
    const rotator = createRotator([nvidiaRoute]);
    const onFailure = jest.fn();
    const operation = jest
      .fn()
      .mockRejectedValue(AiProviderRequestError.retryable('invalid_json'));

    await expect(rotator.executeOrThrow(operation, onFailure)).rejects.toThrow(
      'AI provider failed with invalid_json',
    );

    expect(onFailure).toHaveBeenCalledWith({
      error: expect.any(AiProviderRequestError),
      route: nvidiaRoute,
    });
  });

  it('puts a route in cooldown when generated JSON is invalid', async () => {
    const rotator = createRotator([nvidiaRoute]);
    const operation = jest
      .fn()
      .mockRejectedValue(AiProviderRequestError.retryable('invalid_json'));

    await rotator.execute(operation);

    expect(rotator.isRouteInCooldown(nvidiaRoute)).toBe(true);
  });

  function createRotator(
    routes: readonly AiProviderRoute[],
  ): AiProviderRotator {
    return new AiProviderRotator({
      getCooldownDurationInMs: jest.fn().mockReturnValue(300000),
      getProviderRoutes: jest.fn().mockReturnValue(routes),
    } as unknown as AiProviderRegistry);
  }
});
