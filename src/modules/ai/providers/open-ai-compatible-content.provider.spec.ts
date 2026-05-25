import { ServiceUnavailableException } from '@nestjs/common';
import { AiPromptFactory } from '../openai-compatible/ai-prompt.factory';
import {
  AiPromptRegistryEntry,
  AiPromptRegistryService,
} from '../openai-compatible/ai-prompt-registry.service';
import { GeneratedAdminCaseBaseNormalizer } from '../openai-compatible/generated-admin-case-base.normalizer';
import { GeneratedCaseContradictionNormalizer } from '../openai-compatible/generated-case-contradiction.normalizer';
import { GeneratedCaseEvidenceNormalizer } from '../openai-compatible/generated-case-evidence.normalizer';
import { GeneratedCaseInvestigationGraphNormalizer } from '../openai-compatible/generated-case-investigation-graph.normalizer';
import { GeneratedCaseSolveRequirementNormalizer } from '../openai-compatible/generated-case-solve-requirement.normalizer';
import { GeneratedCaseSolutionNormalizer } from '../openai-compatible/generated-case-solution.normalizer';
import { GeneratedCaseStatementNormalizer } from '../openai-compatible/generated-case-statement.normalizer';
import { GeneratedCaseSuspectNormalizer } from '../openai-compatible/generated-case-suspect.normalizer';
import { GeneratedContentNormalizer } from '../openai-compatible/generated-content.normalizer';
import {
  GenerateCaseContradictionsInput,
  GenerateAdminCaseBaseInput,
  GenerateCaseInput,
  GenerateCaseEvidencesInput,
  GenerateCaseInvestigationGraphInput,
  GenerateCaseSolveRequirementsInput,
  GenerateCaseSolutionInput,
  GenerateCaseStatementsInput,
  GenerateCaseSuspectsInput,
} from '../types/ai.types';
import { AiProviderRegistry } from './ai-provider-registry.service';
import { AiProviderRequestError } from './ai-provider-request.error';
import { AiProviderRotator } from './ai-provider-rotator.service';
import { AiProviderRoute } from './ai-provider.types';
import { AiTextGenerationClient } from './ai-text-generation-client.service';
import { ExternalAiContentProvider } from './external-ai-content.provider';
import { LocalAiContentProvider } from './local-ai-content.provider';

describe('ExternalAiContentProvider', () => {
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

  it('converts a valid provider response into a case domain object', async () => {
    const client = createClientMock([
      JSON.stringify({
        title: 'Caso del proveedor externo',
        codeName: 'OPERACION-EXTERNA',
        description: 'Caso generado fuera del fallback local.',
        location: 'Sector Norte',
        suspects: [
          {
            name: 'Alicia Mora',
            status: 'suspect',
            age: 42,
            occupation: 'Directora financiera',
            alibi: 'Estaba en reunion.',
            relationToCase: 'Tenia acceso al sistema.',
          },
        ],
        clues: [
          {
            name: 'Registro bancario',
            description: 'Movimiento fuera de horario.',
            category: 'Documental',
            relevance: 'Alta',
          },
        ],
        logs: [
          {
            title: 'Informe recibido',
            text: 'La unidad abre el expediente.',
            type: 'narrative',
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCase(createGenerateCaseInput());

    expect(result.usedFallback).toBe(false);
    expect(result.content.title).toBe('Caso del proveedor externo');
    expect(result.content.suspects[0].name).toBe('Alicia Mora');
    expect(result.content.clues[0].relevance).toBe('Alta');
  });

  it('registers the prompt and raw response when a route returns content', async () => {
    const client = createClientMock([
      JSON.stringify({
        title: 'Caso registrado',
      }),
    ]);
    const promptRegistry = createPromptRegistryMock();
    const provider = createProvider([nvidiaRoute], client, promptRegistry);

    await provider.generateCase(createGenerateCaseInput());

    expect(promptRegistry.savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'case',
        route: nvidiaRoute,
      }),
    );
    expect(promptRegistry.saveResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        fileBaseName: 'registry-entry',
        isEnabled: true,
      }),
      expect.stringContaining('Caso registrado'),
    );
  });

  it('registers the prompt before a route fails without a response', async () => {
    const client = {
      createTextCompletion: jest
        .fn()
        .mockRejectedValue(AiProviderRequestError.retryable('network_error')),
    } as unknown as jest.Mocked<AiTextGenerationClient>;
    const promptRegistry = createPromptRegistryMock();
    const provider = createProvider([nvidiaRoute], client, promptRegistry);

    const result = await provider.generateCase(createGenerateCaseInput());

    expect(result.usedFallback).toBe(true);
    expect(promptRegistry.savePrompt).toHaveBeenCalledTimes(1);
    expect(promptRegistry.saveResponse).not.toHaveBeenCalled();
  });

  it('rotates after invalid JSON and uses Cerebras as the next provider', async () => {
    const client = createClientMock([
      'texto que no es JSON',
      JSON.stringify({
        title: 'Caso recuperado por Cerebras',
      }),
    ]);
    const provider = createProvider([nvidiaRoute, cerebrasRoute], client);

    const result = await provider.generateCase(createGenerateCaseInput());

    expect(result.usedFallback).toBe(false);
    expect(result.content.title).toBe('Caso recuperado por Cerebras');
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

  it('rotates from Google to an OpenAI-compatible route after invalid JSON', async () => {
    const client = createClientMock([
      'texto que no es JSON',
      JSON.stringify({
        title: 'Caso recuperado por NVIDIA',
      }),
    ]);
    const provider = createProvider([googleRoute, nvidiaRoute], client);

    const result = await provider.generateCase(createGenerateCaseInput());

    expect(result.usedFallback).toBe(false);
    expect(result.content.title).toBe('Caso recuperado por NVIDIA');
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

  it('uses local fallback when every external provider fails', async () => {
    const client = {
      createTextCompletion: jest
        .fn()
        .mockRejectedValue(AiProviderRequestError.retryable('http_error', 429)),
    } as unknown as jest.Mocked<AiTextGenerationClient>;
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCase(createGenerateCaseInput());

    expect(result.usedFallback).toBe(true);
    expect(result.content.status).toBe('pending');
    expect(result.content.suspects).toHaveLength(3);
  });

  it('converts a valid provider response into an admin case base', async () => {
    const client = createClientMock([
      JSON.stringify({
        difficulty: 'medium',
        publicBriefing:
          'La brigada recibe una denuncia sobre archivos alterados.',
        summary:
          'Un archivo municipal fue manipulado antes de una auditoria interna.',
        title: 'El Archivo Invertido',
        victimName: 'Roberto Salas',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateAdminCaseBase(
      createGenerateAdminCaseBaseInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content).toEqual(
      expect.objectContaining({
        difficulty: 'medium',
        title: 'El Archivo Invertido',
        victimName: 'Roberto Salas',
      }),
    );
  });

  it('builds the admin case base prompt with difficulty, theme and forbidden titles', async () => {
    const client = createClientMock([
      JSON.stringify({
        difficulty: 'hard',
        summary:
          'Una investigacion interna descubre un patron de sabotaje documental.',
        title: 'El Sello Roto',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await provider.generateAdminCaseBase(
      createGenerateAdminCaseBaseInput({
        difficulty: 'hard',
        forbiddenTitles: ['Caso manual'],
        theme: 'sabotaje documental',
      }),
    );

    expect(client.createTextCompletion).toHaveBeenCalledWith(
      nvidiaRoute,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('sabotaje documental'),
          }),
          expect.objectContaining({
            content: expect.stringContaining('Caso manual'),
          }),
          expect.objectContaining({
            content: expect.stringContaining(
              'dificultad obligatoria es "hard"',
            ),
          }),
        ]),
      }),
    );
  });

  it('throws when generated admin case base difficulty is invalid', async () => {
    const client = createClientMock([
      JSON.stringify({
        difficulty: 'nightmare',
        summary:
          'Una investigacion interna descubre un patron de sabotaje documental.',
        title: 'El Sello Roto',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateAdminCaseBase(createGenerateAdminCaseBaseInput()),
    ).rejects.toThrow('dificultad valida');
  });

  it('throws when generated admin case base difficulty changes', async () => {
    const client = createClientMock([
      JSON.stringify({
        difficulty: 'hard',
        summary:
          'Una investigacion interna descubre un patron de sabotaje documental.',
        title: 'El Sello Roto',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateAdminCaseBase(createGenerateAdminCaseBaseInput()),
    ).rejects.toThrow('se esperaba medium');
  });

  it('throws when generated admin case base title is empty', async () => {
    const client = createClientMock([
      JSON.stringify({
        difficulty: 'medium',
        summary:
          'Una investigacion interna descubre un patron de sabotaje documental.',
        title: ' ',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateAdminCaseBase(createGenerateAdminCaseBaseInput()),
    ).rejects.toThrow('title');
  });

  it('throws when generated admin case base text is too long', async () => {
    const client = createClientMock([
      JSON.stringify({
        difficulty: 'medium',
        summary: 'a'.repeat(2001),
        title: 'El Sello Roto',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateAdminCaseBase(createGenerateAdminCaseBaseInput()),
    ).rejects.toThrow('summary');
  });

  it('converts a valid provider response into generated case suspects', async () => {
    const client = createClientMock([
      JSON.stringify({
        suspects: [
          {
            age: 42,
            background: 'Tenia acceso al archivo central.',
            name: 'Alicia Mora',
            occupation: 'Archivista',
            personality: 'Reservada y precisa.',
            publicNotes: 'Su coartada depende de registros internos.',
            relationshipToVictim: 'Colega directa',
          },
          {
            age: 39,
            background: 'Supervisaba rutas de seguridad.',
            name: 'Bruno Rivas',
            occupation: 'Guardia',
            personality: 'Pragmatico y defensivo.',
            publicNotes: 'Reporto una ronda incompleta.',
            relationshipToVictim: 'Responsable de seguridad',
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseSuspects(
      createGenerateCaseSuspectsInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.suspects).toEqual([
      expect.objectContaining({
        age: 42,
        name: 'Alicia Mora',
        occupation: 'Archivista',
      }),
      expect.objectContaining({
        age: 39,
        name: 'Bruno Rivas',
      }),
    ]);
  });

  it('registers the case suspects prompt operation', async () => {
    const client = createClientMock([
      JSON.stringify({
        suspects: [{ name: 'Alicia Mora' }, { name: 'Bruno Rivas' }],
      }),
    ]);
    const promptRegistry = createPromptRegistryMock();
    const provider = createProvider([nvidiaRoute], client, promptRegistry);

    await provider.generateCaseSuspects(createGenerateCaseSuspectsInput());

    expect(promptRegistry.savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'case-suspects',
        route: nvidiaRoute,
      }),
    );
  });

  it('throws the provider error when suspect JSON is invalid', async () => {
    const client = createClientMock(['respuesta invalida']);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSuspects(createGenerateCaseSuspectsInput()),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when generated suspects do not match the requested count', async () => {
    const client = createClientMock([
      JSON.stringify({
        suspects: [{ name: 'Alicia Mora' }],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSuspects(createGenerateCaseSuspectsInput()),
    ).rejects.toThrow('se esperaban 2');
  });

  it('converts a valid provider response into generated case evidences', async () => {
    const client = createClientMock([
      JSON.stringify({
        selectedCulpritSuspectId: '22222222-2222-4222-8222-222222222222',
        evidences: [
          {
            title: 'Registro de camaras',
            description: 'La camara ubica a Alicia cerca de la escena.',
            type: 'digital',
            importance: 'critical',
            location: 'Archivo central',
            discoveryHint: 'Revisar camaras internas.',
            weight: 10,
            isDecoy: false,
            isInitiallyVisible: false,
            metadata: {
              proves: ['identity', 'opportunity'],
            },
          },
        ],
        solution: {
          culpritSuspectId: '22222222-2222-4222-8222-222222222222',
          motiveSummary: 'Alicia necesitaba ocultar una falsificacion.',
          methodSummary: 'Manipulo el registro despues del cierre.',
          opportunitySummary: 'Tenia acceso al archivo.',
          fullExplanation: 'Las evidencias conectan acceso, motivo y metodo.',
        },
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseEvidences(
      createGenerateCaseEvidencesInput({ generateSolution: true }),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.selectedCulpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.content.evidences).toHaveLength(2);
    expect(result.content.evidences[0].title).toBe('Registro de camaras');
    expect(result.content.solution?.culpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('falls back to a known suspect when generated evidences use an invalid culprit id', async () => {
    const client = createClientMock([
      JSON.stringify({
        selectedCulpritSuspectId: 'invalid-suspect-id',
        evidences: [],
        solution: {
          culpritSuspectId: 'invalid-suspect-id',
          motiveSummary: 'Motivo generado.',
          methodSummary: 'Metodo generado.',
          opportunitySummary: 'Oportunidad generada.',
          fullExplanation: 'Explicacion generada.',
        },
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseEvidences(
      createGenerateCaseEvidencesInput({ generateSolution: true }),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.selectedCulpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.content.solution?.culpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('rotates after invalid evidence JSON and uses the next provider', async () => {
    const client = createClientMock([
      'respuesta invalida',
      JSON.stringify({
        selectedCulpritSuspectId: '33333333-3333-4333-8333-333333333333',
        evidences: [
          {
            title: 'Informe recuperado',
            description: 'Un informe externo confirma una linea temporal.',
            type: 'document',
            importance: 'critical',
            weight: 8,
            isDecoy: false,
            isInitiallyVisible: true,
            metadata: {},
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute, cerebrasRoute], client);

    const result = await provider.generateCaseEvidences(
      createGenerateCaseEvidencesInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.selectedCulpritSuspectId).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
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

  it('uses local evidence fallback when every external provider fails', async () => {
    const client = {
      createTextCompletion: jest
        .fn()
        .mockRejectedValue(AiProviderRequestError.retryable('http_error', 429)),
    } as unknown as jest.Mocked<AiTextGenerationClient>;
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseEvidences(
      createGenerateCaseEvidencesInput({ evidenceCount: 4 }),
    );

    expect(result.usedFallback).toBe(true);
    expect(result.content.evidences).toHaveLength(4);
    expect(result.content.selectedCulpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('converts a valid provider response into generated case statements', async () => {
    const client = createClientMock([
      JSON.stringify({
        statements: [
          {
            suspectId: '22222222-2222-4222-8222-222222222222',
            speakerName: 'Alicia Mora',
            content:
              'No estuve cerca del archivo despues del cierre, aunque vi el registro antes.',
            context: 'Declaracion evasiva del culpable esperado.',
            isInitiallyVisible: true,
          },
          {
            suspectId: '33333333-3333-4333-8333-333333333333',
            speakerName: 'Bruno Rivas',
            content:
              'La ronda de seguridad termino antes de que se alterara el registro.',
            context: 'Declaracion contextual de un sospechoso inocente.',
            isInitiallyVisible: false,
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseStatements(
      createGenerateCaseStatementsInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.culpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.content.statements).toHaveLength(2);
    expect(
      result.content.statements.map((statement) => statement.suspectId),
    ).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ]);
  });

  it('wraps root statement arrays returned by providers', async () => {
    const client = createClientMock([
      JSON.stringify([
        {
          suspectId: '22222222-2222-4222-8222-222222222222',
          speakerName: 'Alicia Mora',
          content:
            'No estuve cerca del archivo despues del cierre, aunque vi el registro antes.',
          context: 'Declaracion evasiva del culpable esperado.',
          isInitiallyVisible: true,
        },
        {
          suspectId: '33333333-3333-4333-8333-333333333333',
          speakerName: 'Bruno Rivas',
          content:
            'La ronda de seguridad termino antes de que se alterara el registro.',
          context: 'Declaracion contextual de un sospechoso inocente.',
          isInitiallyVisible: false,
        },
      ]),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseStatements(
      createGenerateCaseStatementsInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.statements).toHaveLength(2);
    expect(result.content.statements[0]).toEqual(
      expect.objectContaining({
        suspectId: '22222222-2222-4222-8222-222222222222',
        speakerName: 'Alicia Mora',
      }),
    );
  });

  it('throws the provider error when statement JSON is invalid', async () => {
    const client = createClientMock(['respuesta invalida']);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseStatements(createGenerateCaseStatementsInput()),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when generated statements include invalid suspect ids', async () => {
    const client = createClientMock([
      JSON.stringify({
        statements: [
          {
            suspectId: 'invalid-suspect-id',
            speakerName: 'Persona inventada',
            content: 'Esta declaracion no debe usarse.',
            context: 'Contexto invalido.',
            isInitiallyVisible: true,
          },
          {
            suspectId: '33333333-3333-4333-8333-333333333333',
            speakerName: 'Bruno Rivas',
            content: 'Vi el registro de seguridad antes de salir.',
            context: 'Declaracion valida.',
            isInitiallyVisible: false,
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseStatements(createGenerateCaseStatementsInput()),
    ).rejects.toThrow('La IA devolvio un suspectId que no pertenece al caso');
  });

  it('throws when every external statement provider fails', async () => {
    const client = {
      createTextCompletion: jest
        .fn()
        .mockRejectedValue(AiProviderRequestError.retryable('http_error', 429)),
    } as unknown as jest.Mocked<AiTextGenerationClient>;
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseStatements(createGenerateCaseStatementsInput()),
    ).rejects.toThrow('AI provider failed with http_error (429)');
  });

  it('converts a valid provider response into generated case contradictions', async () => {
    const client = createClientMock([
      JSON.stringify({
        contradictions: [
          {
            suspectId: '22222222-2222-4222-8222-222222222222',
            statementId: '55555555-5555-4555-8555-555555555555',
            refutingEvidenceId: '44444444-4444-4444-8444-444444444444',
            title: 'Registro contra coartada',
            explanation:
              'El registro de acceso contradice la hora que Alicia declaro.',
            proves: 'false_alibi',
            isInitiallyVisible: false,
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseContradictions(
      createGenerateCaseContradictionsInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.culpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.content.difficulty).toBe('medium');
    expect(result.content.contradictions).toEqual([
      expect.objectContaining({
        proves: 'false_alibi',
        statementId: '55555555-5555-4555-8555-555555555555',
      }),
    ]);
  });

  it('throws the provider error when contradiction JSON is invalid', async () => {
    const client = createClientMock(['respuesta invalida']);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseContradictions(
        createGenerateCaseContradictionsInput(),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when generated contradictions include invalid ids', async () => {
    const client = createClientMock([
      JSON.stringify({
        contradictions: [
          {
            suspectId: '22222222-2222-4222-8222-222222222222',
            statementId: 'invalid-statement-id',
            refutingEvidenceId: '44444444-4444-4444-8444-444444444444',
            title: 'Registro contra coartada',
            explanation:
              'El registro de acceso contradice la hora que Alicia declaro.',
            proves: 'false_alibi',
            isInitiallyVisible: false,
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseContradictions(
        createGenerateCaseContradictionsInput(),
      ),
    ).rejects.toThrow('statementId que no pertenece al caso');
  });

  it('throws when generated contradictions omit the culprit', async () => {
    const client = createClientMock([
      JSON.stringify({
        contradictions: [
          {
            suspectId: '33333333-3333-4333-8333-333333333333',
            statementId: '66666666-6666-4666-8666-666666666666',
            refutingEvidenceId: '44444444-4444-4444-8444-444444444444',
            title: 'Ruta secundaria',
            explanation: 'La evidencia complica parcialmente a Bruno.',
            proves: 'contradiction',
            isInitiallyVisible: false,
          },
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseContradictions(
        createGenerateCaseContradictionsInput(),
      ),
    ).rejects.toThrow('ninguna contradiccion para el culpable');
  });

  it('throws when generated contradictions exceed the difficulty limit', async () => {
    const client = createClientMock([
      JSON.stringify({
        contradictions: [
          createContradictionPayload(),
          createContradictionPayload({ title: 'Segunda contradiccion' }),
          createContradictionPayload({ title: 'Tercera contradiccion' }),
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseContradictions(
        createGenerateCaseContradictionsInput({ difficulty: 'easy' }),
      ),
    ).rejects.toThrow('el maximo es 2');
  });

  it('converts a valid provider response into generated solve requirements', async () => {
    const client = createClientMock([
      JSON.stringify({
        solveRequirements: [
          createSolveRequirementPayload({
            requirementType: 'culprit',
            requiredSuspectId: '22222222-2222-4222-8222-222222222222',
          }),
          createSolveRequirementPayload({
            proofRole: 'identity',
            requiredEvidenceId: '44444444-4444-4444-8444-444444444444',
            requirementType: 'identity',
          }),
          createSolveRequirementPayload({
            proofRole: 'false_alibi',
            requiredContradictionId: '77777777-7777-4777-8777-777777777777',
            requirementType: 'false_alibi',
          }),
          createSolveRequirementPayload({
            proofRole: 'motive',
            requiredSuspectId: '22222222-2222-4222-8222-222222222222',
            requirementType: 'motive',
          }),
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseSolveRequirements(
      createGenerateCaseSolveRequirementsInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.culpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.content.difficulty).toBe('medium');
    expect(result.content.requirements).toHaveLength(4);
    expect(result.content.requirements[0]).toEqual(
      expect.objectContaining({
        requirementType: 'culprit',
        requiredSuspectId: '22222222-2222-4222-8222-222222222222',
      }),
    );
  });

  it('throws the provider error when solve requirement JSON is invalid', async () => {
    const client = createClientMock(['respuesta invalida']);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolveRequirements(
        createGenerateCaseSolveRequirementsInput(),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when generated solve requirements include invalid ids', async () => {
    const client = createClientMock([
      JSON.stringify({
        solveRequirements: [
          createSolveRequirementPayload({
            requirementType: 'culprit',
            requiredSuspectId: '22222222-2222-4222-8222-222222222222',
          }),
          createSolveRequirementPayload({
            requiredEvidenceId: 'invalid-evidence-id',
            requirementType: 'identity',
          }),
          createSolveRequirementPayload({
            requiredContradictionId: '77777777-7777-4777-8777-777777777777',
            requirementType: 'contradiction',
          }),
          createSolveRequirementPayload({
            proofRole: 'motive',
            requiredSuspectId: '22222222-2222-4222-8222-222222222222',
            requirementType: 'motive',
          }),
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolveRequirements(
        createGenerateCaseSolveRequirementsInput(),
      ),
    ).rejects.toThrow('requiredEvidenceId que no pertenece al caso');
  });

  it('throws when generated solve requirements omit the mandatory culprit requirement', async () => {
    const client = createClientMock([
      JSON.stringify({
        solveRequirements: [
          createSolveRequirementPayload({
            requiredEvidenceId: '44444444-4444-4444-8444-444444444444',
            requirementType: 'identity',
          }),
          createSolveRequirementPayload({
            requiredContradictionId: '77777777-7777-4777-8777-777777777777',
            requirementType: 'contradiction',
          }),
          createSolveRequirementPayload({
            proofRole: 'motive',
            requiredSuspectId: '33333333-3333-4333-8333-333333333333',
            requirementType: 'motive',
          }),
          createSolveRequirementPayload({
            proofRole: 'opportunity',
            requiredEvidenceId: '44444444-4444-4444-8444-444444444444',
            requirementType: 'opportunity',
          }),
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolveRequirements(
        createGenerateCaseSolveRequirementsInput(),
      ),
    ).rejects.toThrow('requisito culprit obligatorio');
  });

  it('throws when generated solve requirements fall outside the difficulty range', async () => {
    const client = createClientMock([
      JSON.stringify({
        solveRequirements: [
          createSolveRequirementPayload(),
          createSolveRequirementPayload(),
        ],
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolveRequirements(
        createGenerateCaseSolveRequirementsInput({ difficulty: 'easy' }),
      ),
    ).rejects.toThrow('rango permitido es 3-4');
  });

  it('converts a valid provider response into an investigation graph', async () => {
    const client = createClientMock([
      JSON.stringify(createInvestigationGraphPayload()),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseInvestigationGraph(
      createGenerateCaseInvestigationGraphInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.actions).toHaveLength(6);
    expect(result.content.statementUnlockRules).toEqual([
      expect.objectContaining({
        actionTempId: 'interview_case_circle',
        statementId: '66666666-6666-4666-8666-666666666666',
      }),
    ]);
    expect(result.content.contradictionUnlockRules).toEqual([
      expect.objectContaining({
        actionTempId: 'compare_versions',
        contradictionId: '77777777-7777-4777-8777-777777777777',
      }),
    ]);
  });

  it('repairs a generated investigation graph before returning it', async () => {
    const client = createClientMock([
      JSON.stringify(
        createInvestigationGraphPayload({
          actionPrerequisites: [],
        }),
      ),
      JSON.stringify(createInvestigationGraphPayload()),
    ]);
    const promptRegistry = createPromptRegistryMock();
    const provider = createProvider([nvidiaRoute], client, promptRegistry);

    const result = await provider.generateCaseInvestigationGraph(
      createGenerateCaseInvestigationGraphInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.actions).toHaveLength(6);
    expect(client.createTextCompletion).toHaveBeenCalledTimes(2);
    expect(promptRegistry.savePrompt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ operation: 'case-investigation-graph' }),
    );
    expect(promptRegistry.savePrompt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operation: 'case-investigation-graph-repair',
      }),
    );
  });

  it('rotates to the next route after two failed graph repair attempts', async () => {
    const invalidPayload = createInvestigationGraphPayload({
      actionPrerequisites: [],
    });
    const client = createClientMock([
      JSON.stringify(invalidPayload),
      JSON.stringify(invalidPayload),
      JSON.stringify(invalidPayload),
      JSON.stringify(createInvestigationGraphPayload()),
    ]);
    const provider = createProvider([nvidiaRoute, cerebrasRoute], client);

    const result = await provider.generateCaseInvestigationGraph(
      createGenerateCaseInvestigationGraphInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(client.createTextCompletion).toHaveBeenCalledTimes(4);
    expect(client.createTextCompletion).toHaveBeenNthCalledWith(
      4,
      cerebrasRoute,
      expect.any(Object),
    );
  });

  it('converts a valid provider response into a generated case solution', async () => {
    const client = createClientMock([
      JSON.stringify({
        culpritSuspectId: '22222222-2222-4222-8222-222222222222',
        motiveSummary: 'Alicia necesitaba ocultar una falsificacion.',
        methodSummary: 'Manipulo el registro despues del cierre.',
        opportunitySummary: 'Tuvo acceso al archivo durante una ventana breve.',
        fullExplanation:
          'La solucion conecta el registro de acceso, la declaracion evasiva y la contradiccion contra su coartada.',
      }),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    const result = await provider.generateCaseSolution(
      createGenerateCaseSolutionInput(),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.content.culpritSuspectId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.content.fullExplanation).toContain('registro de acceso');
  });

  it('throws the provider error when solution JSON is invalid', async () => {
    const client = createClientMock(['respuesta invalida']);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolution(createGenerateCaseSolutionInput()),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when generated solution uses a different culprit', async () => {
    const client = createClientMock([
      JSON.stringify(
        createSolutionPayload({
          culpritSuspectId: '33333333-3333-4333-8333-333333333333',
        }),
      ),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolution(createGenerateCaseSolutionInput()),
    ).rejects.toThrow('pero se esperaba');
  });

  it('throws when generated solution fields are too short', async () => {
    const client = createClientMock([
      JSON.stringify(createSolutionPayload({ motiveSummary: 'No' })),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolution(createGenerateCaseSolutionInput()),
    ).rejects.toThrow('motiveSummary');
  });

  it('throws when generated solution fields are too long', async () => {
    const client = createClientMock([
      JSON.stringify(
        createSolutionPayload({ fullExplanation: 'a'.repeat(5001) }),
      ),
    ]);
    const provider = createProvider([nvidiaRoute], client);

    await expect(
      provider.generateCaseSolution(createGenerateCaseSolutionInput()),
    ).rejects.toThrow('fullExplanation');
  });

  function createProvider(
    routes: readonly AiProviderRoute[],
    client: jest.Mocked<AiTextGenerationClient>,
    promptRegistry = createPromptRegistryMock(),
  ): ExternalAiContentProvider {
    return new ExternalAiContentProvider(
      new AiProviderRotator(createRegistry(routes)),
      client,
      new AiPromptFactory(),
      promptRegistry,
      new GeneratedAdminCaseBaseNormalizer(),
      new GeneratedContentNormalizer(),
      new GeneratedCaseContradictionNormalizer(),
      new GeneratedCaseEvidenceNormalizer(),
      new GeneratedCaseInvestigationGraphNormalizer(),
      new GeneratedCaseSolveRequirementNormalizer(),
      new GeneratedCaseSolutionNormalizer(),
      new GeneratedCaseStatementNormalizer(),
      new GeneratedCaseSuspectNormalizer(),
      new LocalAiContentProvider(),
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

  function createGenerateCaseInput(): GenerateCaseInput {
    return {
      theme: 'fraude en archivo municipal',
      category: 'Robo',
      severity: 'Alta',
    };
  }

  function createGenerateAdminCaseBaseInput(
    overrides: Partial<GenerateAdminCaseBaseInput> = {},
  ): GenerateAdminCaseBaseInput {
    return {
      difficulty: 'medium',
      forbiddenTitles: ['Caso duplicado'],
      theme: 'fraude en archivo municipal',
      ...overrides,
    };
  }

  function createGenerateCaseSuspectsInput(
    overrides: Partial<GenerateCaseSuspectsInput> = {},
  ): GenerateCaseSuspectsInput {
    return {
      caseData: {
        difficulty: 'medium',
        id: '11111111-1111-4111-8111-111111111111',
        publicBriefing: 'La victima fue encontrada en el archivo central.',
        summary: 'Un expediente manual para probar sospechosos por IA.',
        title: 'Muerte en el Archivo Central',
        victimName: 'Roberto Salas',
      },
      difficulty: 'medium',
      suspectCount: 2,
      ...overrides,
    };
  }

  function createGenerateCaseEvidencesInput(
    overrides: Partial<GenerateCaseEvidencesInput> = {},
  ): GenerateCaseEvidencesInput {
    return {
      caseData: {
        difficulty: 'medium',
        id: '11111111-1111-4111-8111-111111111111',
        publicBriefing: 'La victima fue encontrada en el archivo central.',
        summary: 'Un expediente manual para probar evidencias por IA.',
        title: 'Muerte en el Archivo Central',
        victimName: 'Roberto Salas',
      },
      evidenceCount: 2,
      generateSolution: false,
      suspects: [
        {
          age: 42,
          createdAt: '2026-05-21T00:00:00.000Z',
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Alicia Mora',
          occupation: 'Archivista',
        },
        {
          age: 39,
          createdAt: '2026-05-22T00:00:00.000Z',
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Bruno Rivas',
          occupation: 'Guardia',
        },
      ],
      ...overrides,
    };
  }

  function createGenerateCaseStatementsInput(
    overrides: Partial<GenerateCaseStatementsInput> = {},
  ): GenerateCaseStatementsInput {
    const evidenceInput = createGenerateCaseEvidencesInput();

    return {
      caseData: evidenceInput.caseData,
      culpritSuspectId: '22222222-2222-4222-8222-222222222222',
      evidences: [
        {
          description: 'Registro digital que ubica a Alicia en la escena.',
          id: '44444444-4444-4444-8444-444444444444',
          importance: 'critical',
          isDecoy: false,
          isInitiallyVisible: true,
          metadata: {},
          title: 'Registro de acceso',
          type: 'digital',
          weight: 10,
        },
      ],
      suspects: evidenceInput.suspects,
      ...overrides,
    };
  }

  function createGenerateCaseContradictionsInput(
    overrides: Partial<GenerateCaseContradictionsInput> = {},
  ): GenerateCaseContradictionsInput {
    const statementInput = createGenerateCaseStatementsInput();

    return {
      ...statementInput,
      difficulty: 'medium',
      statements: [
        {
          content: 'No estuve cerca del archivo despues del cierre.',
          id: '55555555-5555-4555-8555-555555555555',
          isInitiallyVisible: true,
          speakerName: 'Alicia Mora',
          suspectId: '22222222-2222-4222-8222-222222222222',
        },
        {
          content: 'La ronda termino antes de la alteracion del registro.',
          id: '66666666-6666-4666-8666-666666666666',
          isInitiallyVisible: false,
          speakerName: 'Bruno Rivas',
          suspectId: '33333333-3333-4333-8333-333333333333',
        },
      ],
      ...overrides,
    };
  }

  function createGenerateCaseSolutionInput(
    overrides: Partial<GenerateCaseSolutionInput> = {},
  ): GenerateCaseSolutionInput {
    const contradictionInput = createGenerateCaseContradictionsInput();

    return {
      caseData: contradictionInput.caseData,
      contradictions: [
        {
          explanation: 'El registro contradice la hora declarada.',
          id: '77777777-7777-4777-8777-777777777777',
          isInitiallyVisible: false,
          proves: 'false_alibi',
          refutingEvidenceId: '44444444-4444-4444-8444-444444444444',
          statementId: '55555555-5555-4555-8555-555555555555',
          suspectId: '22222222-2222-4222-8222-222222222222',
          title: 'Registro contra coartada',
        },
      ],
      culpritSuspectId: contradictionInput.culpritSuspectId,
      evidences: contradictionInput.evidences,
      statements: contradictionInput.statements,
      suspects: contradictionInput.suspects,
      ...overrides,
    };
  }

  function createGenerateCaseSolveRequirementsInput(
    overrides: Partial<GenerateCaseSolveRequirementsInput> = {},
  ): GenerateCaseSolveRequirementsInput {
    const solutionInput = createGenerateCaseSolutionInput();

    return {
      actions: [],
      caseData: solutionInput.caseData,
      contradictionUnlockRules: [],
      contradictions: solutionInput.contradictions,
      culpritSuspectId: solutionInput.culpritSuspectId,
      difficulty: 'medium',
      evidenceUnlockRules: [],
      evidences: solutionInput.evidences,
      solution: {
        caseId: solutionInput.caseData.id,
        createdAt: '2026-05-21T00:00:00.000Z',
        culpritSuspectId: solutionInput.culpritSuspectId,
        fullExplanation:
          'La solucion conecta motivo, metodo y oportunidad con las pruebas existentes.',
        id: '88888888-8888-4888-8888-888888888888',
        methodSummary: 'Manipulo el registro despues del cierre.',
        motiveSummary: 'Alicia necesitaba ocultar una falsificacion.',
        opportunitySummary: 'Tuvo acceso al archivo durante una ventana breve.',
      },
      statements: solutionInput.statements,
      suspects: solutionInput.suspects,
      ...overrides,
    };
  }

  function createGenerateCaseInvestigationGraphInput(
    overrides: Partial<GenerateCaseInvestigationGraphInput> = {},
  ): GenerateCaseInvestigationGraphInput {
    const requirementsInput = createGenerateCaseSolveRequirementsInput();

    return {
      caseData: requirementsInput.caseData,
      contradictions: requirementsInput.contradictions,
      culpritSuspectId: requirementsInput.culpritSuspectId,
      difficulty: requirementsInput.difficulty,
      evidences: requirementsInput.evidences,
      requirements: [
        {
          description: 'Identificar al culpable.',
          id: 'requirement-identity',
          isMandatory: true,
          proofRole: 'identity',
          requiredEvidenceId: '44444444-4444-4444-8444-444444444444',
          requirementType: 'identity',
          weight: 5,
        },
        {
          description: 'Romper la coartada.',
          id: 'requirement-contradiction',
          isMandatory: true,
          proofRole: 'contradiction',
          requiredContradictionId: '77777777-7777-4777-8777-777777777777',
          requirementType: 'contradiction',
          weight: 5,
        },
      ],
      solution: requirementsInput.solution,
      statements: requirementsInput.statements,
      suspects: requirementsInput.suspects,
      ...overrides,
    };
  }

  function createInvestigationGraphPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      actionPrerequisites: [
        {
          actionTempId: 'compare_versions',
          prerequisiteActionTempId: 'inspect_case_files',
        },
        {
          actionTempId: 'compare_versions',
          prerequisiteActionTempId: 'interview_case_circle',
        },
        {
          actionTempId: 'follow_up_line_1',
          prerequisiteActionTempId: 'compare_versions',
        },
        {
          actionTempId: 'follow_up_line_2',
          prerequisiteActionTempId: 'follow_up_line_1',
        },
        {
          actionTempId: 'follow_up_line_3',
          prerequisiteActionTempId: 'follow_up_line_2',
        },
      ],
      actions: [
        createInvestigationActionPayload({
          isInitiallyAvailable: true,
          tempId: 'inspect_case_files',
        }),
        createInvestigationActionPayload({
          actionType: 'interview',
          isInitiallyAvailable: true,
          requiredSkill: 'interrogation',
          tempId: 'interview_case_circle',
        }),
        createInvestigationActionPayload({
          actionType: 'custom',
          requiredSkill: 'psychology',
          tempId: 'compare_versions',
        }),
        createInvestigationActionPayload({ tempId: 'follow_up_line_1' }),
        createInvestigationActionPayload({ tempId: 'follow_up_line_2' }),
        createInvestigationActionPayload({ tempId: 'follow_up_line_3' }),
      ],
      contradictionUnlockRules: [
        {
          actionTempId: 'compare_versions',
          contradictionId: '77777777-7777-4777-8777-777777777777',
          isGuaranteed: true,
          successChance: 1,
        },
      ],
      evidenceUnlockRules: [],
      statementUnlockRules: [
        {
          actionTempId: 'interview_case_circle',
          isGuaranteed: true,
          statementId: '66666666-6666-4666-8666-666666666666',
          successChance: 1,
        },
      ],
      ...overrides,
    };
  }

  function createInvestigationActionPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      actionType: 'inspect_scene',
      baseDurationMinutes: 45,
      description: 'Accion de investigacion.',
      isInitiallyAvailable: false,
      metadata: {},
      minimumSkillLevel: 50,
      requiredSkill: 'crime_scene_analysis',
      requiresDetective: true,
      tempId: 'action-temp-id',
      title: 'Accion investigativa',
      ...overrides,
    };
  }

  function createContradictionPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      explanation: 'El registro contradice la hora declarada.',
      isInitiallyVisible: false,
      proves: 'false_alibi',
      refutingEvidenceId: '44444444-4444-4444-8444-444444444444',
      statementId: '55555555-5555-4555-8555-555555555555',
      suspectId: '22222222-2222-4222-8222-222222222222',
      title: 'Registro contra coartada',
      ...overrides,
    };
  }

  function createSolveRequirementPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      description: 'Requisito generado para comprobar la solucion oficial.',
      isMandatory: true,
      proofRole: 'identity',
      requiredSuspectId: '22222222-2222-4222-8222-222222222222',
      requirementType: 'culprit',
      weight: 5,
      ...overrides,
    };
  }

  function createSolutionPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      culpritSuspectId: '22222222-2222-4222-8222-222222222222',
      fullExplanation:
        'La solucion conecta motivo, metodo y oportunidad con las pruebas existentes.',
      methodSummary: 'Manipulo el registro despues del cierre.',
      motiveSummary: 'Alicia necesitaba ocultar una falsificacion.',
      opportunitySummary: 'Tuvo acceso al archivo durante una ventana breve.',
      ...overrides,
    };
  }
});
