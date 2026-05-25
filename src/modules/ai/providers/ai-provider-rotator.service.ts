import { Injectable } from '@nestjs/common';
import { AiProviderRegistry } from './ai-provider-registry.service';
import { AiProviderRequestError } from './ai-provider-request.error';
import { AiProviderRoute, createAiProviderRouteKey } from './ai-provider.types';

export interface AiProviderRouteFailure {
  readonly error: unknown;
  readonly route: AiProviderRoute;
}

@Injectable()
export class AiProviderRotator {
  private readonly cooldownExpiresAtByRoute = new Map<string, number>();

  constructor(private readonly providerRegistry: AiProviderRegistry) {}

  async execute<TResult>(
    operation: (route: AiProviderRoute) => Promise<TResult>,
  ): Promise<TResult | undefined> {
    for (const route of this.providerRegistry.getProviderRoutes()) {
      if (this.isRouteInCooldown(route)) {
        continue;
      }

      try {
        return await operation(route);
      } catch (error: unknown) {
        this.cooldownRouteWhenRetryable(route, error);
      }
    }

    return undefined;
  }

  async executeOrThrow<TResult>(
    operation: (route: AiProviderRoute) => Promise<TResult>,
    onFailure?: (failure: AiProviderRouteFailure) => void,
  ): Promise<TResult> {
    let lastError: unknown;
    let attemptedRouteCount = 0;

    for (const route of this.providerRegistry.getProviderRoutes()) {
      if (this.isRouteInCooldown(route)) {
        continue;
      }

      try {
        attemptedRouteCount += 1;
        return await operation(route);
      } catch (error: unknown) {
        lastError = error;
        onFailure?.({ error, route });
        this.cooldownRouteWhenRetryable(route, error);
      }
    }

    throw this.createExecutionError(lastError, attemptedRouteCount);
  }

  isRouteInCooldown(route: AiProviderRoute): boolean {
    return this.getRouteCooldownExpiration(route) > Date.now();
  }

  private createExecutionError(
    lastError: unknown,
    attemptedRouteCount: number,
  ): Error {
    if (lastError instanceof Error) {
      return lastError;
    }

    return AiProviderRequestError.nonRetryable(
      attemptedRouteCount > 0 ? 'network_error' : 'no_available_provider',
    );
  }

  private cooldownRouteWhenRetryable(
    route: AiProviderRoute,
    error: unknown,
  ): void {
    if (this.shouldCooldownRoute(error)) {
      this.cooldownRoute(route);
    }
  }

  private shouldCooldownRoute(error: unknown): boolean {
    return error instanceof AiProviderRequestError && error.retryable;
  }

  private cooldownRoute(route: AiProviderRoute): void {
    this.cooldownExpiresAtByRoute.set(
      createAiProviderRouteKey(route),
      Date.now() + this.providerRegistry.getCooldownDurationInMs(),
    );
  }

  private getRouteCooldownExpiration(route: AiProviderRoute): number {
    return (
      this.cooldownExpiresAtByRoute.get(createAiProviderRouteKey(route)) ?? 0
    );
  }
}
