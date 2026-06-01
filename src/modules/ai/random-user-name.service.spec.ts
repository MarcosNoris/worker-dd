import { ServiceUnavailableException } from '@nestjs/common';
import { RandomUserNameService } from './random-user-name.service';

describe('RandomUserNameService', () => {
  let fetchMock: jest.Mock;
  let service: RandomUserNameService;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new RandomUserNameService();
  });

  it('returns unique full names from Random User Generator', async () => {
    fetchMock.mockResolvedValue(
      createFetchResponse({
        results: [
          { name: { first: 'Alicia', last: 'Mora' } },
          { name: { first: 'Bruno', last: 'Rivas' } },
          { name: { first: 'Alicia', last: 'Mora' } },
        ],
      }),
    );

    const names = await service.getNames({
      count: 2,
      purpose: 'suspect',
    });

    expect(names).toEqual(['Alicia Mora', 'Bruno Rivas']);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('results=7'),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('throws when Random User Generator does not provide enough names', async () => {
    fetchMock.mockResolvedValue(
      createFetchResponse({
        results: [{ name: { first: 'Alicia', last: 'Mora' } }],
      }),
    );

    await expect(
      service.getNames({
        count: 2,
        purpose: 'suspect',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when Random User Generator returns an HTTP error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(
      service.getNames({
        count: 1,
        purpose: 'victim',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  function createFetchResponse(payload: unknown): Response {
    return {
      json: jest.fn().mockResolvedValue(payload),
      ok: true,
      status: 200,
    } as unknown as Response;
  }
});
