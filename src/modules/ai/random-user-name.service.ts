import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const RANDOM_USER_API_URL = 'https://randomuser.me/api/1.4/';
const RANDOM_USER_TIMEOUT_MS = 5000;
const RANDOM_USER_EXTRA_RESULTS = 5;
const RANDOM_USER_MAX_RESULTS = 50;
const RANDOM_USER_NATIONALITIES = ['us', 'gb', 'ca', 'au', 'nz', 'es'] as const;

type RandomUserNamePurpose = 'suspect' | 'victim';

interface RandomUserNameRequest {
  readonly count: number;
  readonly purpose: RandomUserNamePurpose;
}

interface RandomUserApiResponse {
  readonly error?: unknown;
  readonly results?: unknown;
}

interface RandomUserResultPayload {
  readonly name?: unknown;
}

interface RandomUserNamePayload {
  readonly first?: unknown;
  readonly last?: unknown;
}

interface RandomUserFullName {
  readonly first: string;
  readonly last: string;
}

@Injectable()
export class RandomUserNameService {
  async getNames(request: RandomUserNameRequest): Promise<readonly string[]> {
    this.ensureValidRequestedCount(request);

    const response = await this.fetchRandomUsers(request.count);
    const names = this.readUniqueNames(response).slice(0, request.count);

    if (names.length < request.count) {
      throw this.createUnavailableError(
        `Random User Generator no devolvio suficientes nombres para ${request.purpose}.`,
      );
    }

    return names;
  }

  private ensureValidRequestedCount(request: RandomUserNameRequest): void {
    if (Number.isInteger(request.count) && request.count > 0) {
      return;
    }

    throw this.createUnavailableError(
      `Cantidad invalida de nombres para ${request.purpose}.`,
    );
  }

  private async fetchRandomUsers(
    count: number,
  ): Promise<RandomUserApiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      RANDOM_USER_TIMEOUT_MS,
    );

    try {
      return await this.requestRandomUsers(count, controller.signal);
    } catch (error: unknown) {
      throw this.createUnavailableError(this.readFetchErrorMessage(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestRandomUsers(
    count: number,
    signal: AbortSignal,
  ): Promise<RandomUserApiResponse> {
    const response = await fetch(this.createRequestUrl(count), { signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as RandomUserApiResponse;
  }

  private createRequestUrl(count: number): string {
    const url = new URL(RANDOM_USER_API_URL);

    url.searchParams.set('results', String(this.calculateResultCount(count)));
    url.searchParams.set('inc', 'name');
    url.searchParams.set('nat', RANDOM_USER_NATIONALITIES.join(','));
    url.searchParams.set('noinfo', 'true');

    return url.toString();
  }

  private calculateResultCount(count: number): number {
    return Math.min(count + RANDOM_USER_EXTRA_RESULTS, RANDOM_USER_MAX_RESULTS);
  }

  private readUniqueNames(response: RandomUserApiResponse): string[] {
    this.ensureSuccessfulResponse(response);

    if (!Array.isArray(response.results)) {
      throw this.createUnavailableError(
        'Random User Generator devolvio un payload sin results.',
      );
    }

    return Array.from(
      new Set(response.results.map((result) => this.readFullName(result))),
    );
  }

  private ensureSuccessfulResponse(response: RandomUserApiResponse): void {
    if (typeof response.error !== 'string' || response.error.trim() === '') {
      return;
    }

    throw this.createUnavailableError(
      `Random User Generator respondio error: ${response.error.trim()}.`,
    );
  }

  private readFullName(value: unknown): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw this.createUnavailableError(
        'Random User Generator devolvio un usuario invalido.',
      );
    }

    const payload = value as RandomUserResultPayload;
    const name = this.readNamePayload(payload.name);

    return this.compactName(`${name.first} ${name.last}`);
  }

  private readNamePayload(value: unknown): RandomUserFullName {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw this.createUnavailableError(
        'Random User Generator devolvio un nombre invalido.',
      );
    }

    const name = value as RandomUserNamePayload;

    if (typeof name.first === 'string' && typeof name.last === 'string') {
      return {
        first: name.first,
        last: name.last,
      };
    }

    throw this.createUnavailableError(
      'Random User Generator devolvio un nombre incompleto.',
    );
  }

  private compactName(name: string): string {
    const compactedName = name.replace(/\s+/g, ' ').trim();

    if (compactedName.length > 0) {
      return compactedName;
    }

    throw this.createUnavailableError(
      'Random User Generator devolvio un nombre vacio.',
    );
  }

  private readFetchErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return `No se pudieron obtener nombres desde Random User Generator: ${error.message}`;
    }

    return 'No se pudieron obtener nombres desde Random User Generator.';
  }

  private createUnavailableError(message: string): ServiceUnavailableException {
    return new ServiceUnavailableException(message);
  }
}
