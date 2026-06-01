import { AiService } from './ai.service';
import { AiDetectiveProfileService } from './openai-compatible/ai-detective-profile.service';
import { AiContentProvider } from './providers/ai-content-provider.interface';
import { RandomUserNameService } from './random-user-name.service';

describe('AiService', () => {
  let contentProvider: jest.Mocked<AiContentProvider>;
  let randomUserNameService: jest.Mocked<RandomUserNameService>;
  let service: AiService;

  beforeEach(() => {
    contentProvider = createContentProviderMock();
    randomUserNameService = createRandomUserNameServiceMock();
    service = new AiService(
      contentProvider,
      {} as AiDetectiveProfileService,
      randomUserNameService,
    );
  });

  it('gets a Random User victim name before generating the admin case base', async () => {
    randomUserNameService.getNames.mockResolvedValue(['Victor Ramos']);
    contentProvider.generateAdminCaseBase.mockResolvedValue({
      content: {
        difficulty: 'medium',
        summary: 'Resumen del caso.',
        title: 'El Archivo Roto',
        victimName: 'Victor Ramos',
      },
      usedFallback: false,
    });

    await service.generateAdminCaseBase({
      difficulty: 'medium',
      forbiddenTitles: [],
    });

    expect(randomUserNameService.getNames).toHaveBeenCalledWith({
      count: 1,
      purpose: 'victim',
    });
    expect(contentProvider.generateAdminCaseBase).toHaveBeenCalledWith(
      expect.objectContaining({
        victimNamePool: ['Victor Ramos'],
      }),
    );
  });

  it('gets Random User suspect names before generating suspects', async () => {
    randomUserNameService.getNames.mockResolvedValue([
      'Alicia Mora',
      'Bruno Rivas',
    ]);
    contentProvider.generateCaseSuspects.mockResolvedValue({
      content: {
        suspects: [{ name: 'Alicia Mora' }, { name: 'Bruno Rivas' }],
      },
      usedFallback: false,
    });

    await service.generateCaseSuspects({
      caseData: {
        difficulty: 'medium',
        id: 'case-1',
        summary: 'Resumen del caso.',
        title: 'Caso',
      },
      difficulty: 'medium',
      suspectCount: 2,
    });

    expect(randomUserNameService.getNames).toHaveBeenCalledWith({
      count: 2,
      purpose: 'suspect',
    });
    expect(contentProvider.generateCaseSuspects).toHaveBeenCalledWith(
      expect.objectContaining({
        suspectNamePool: ['Alicia Mora', 'Bruno Rivas'],
      }),
    );
  });

  function createContentProviderMock(): jest.Mocked<AiContentProvider> {
    return {
      generateAdminCaseBase: jest.fn(),
      generateCase: jest.fn(),
      generateCaseContradictions: jest.fn(),
      generateCaseEvidences: jest.fn(),
      generateCaseInvestigationGraph: jest.fn(),
      generateCaseSolution: jest.fn(),
      generateCaseSolveRequirements: jest.fn(),
      generateCaseStatements: jest.fn(),
      generateCaseSuspects: jest.fn(),
      generateInvestigationStep: jest.fn(),
      generateVerdict: jest.fn(),
    };
  }

  function createRandomUserNameServiceMock(): jest.Mocked<RandomUserNameService> {
    return {
      getNames: jest.fn(),
    } as unknown as jest.Mocked<RandomUserNameService>;
  }
});
