import {
  parseJsonObject,
  parseJsonObjectWithRootArrayFallback,
} from './json-object.parser';

describe('json object parser', () => {
  it('parses an object response with surrounding text', () => {
    const payload = parseJsonObject<{
      readonly statements: readonly unknown[];
    }>('Respuesta:\n{"statements":[]}\nfin');

    expect(payload).toEqual({ statements: [] });
  });

  it('wraps a root array response with the expected property', () => {
    const payload = parseJsonObjectWithRootArrayFallback<{
      readonly statements?: unknown;
    }>(
      `[
        {
          "suspectId": "suspect-1",
          "speakerName": "Alicia Mora",
          "content": "No estuve alli.",
          "context": "Coartada inicial.",
          "isInitiallyVisible": true
        }
      ]`,
      'statements',
    );

    expect(payload).toEqual({
      statements: [
        {
          suspectId: 'suspect-1',
          speakerName: 'Alicia Mora',
          content: 'No estuve alli.',
          context: 'Coartada inicial.',
          isInitiallyVisible: true,
        },
      ],
    });
  });

  it('wraps a root array response with escaped newlines and quotes', () => {
    const rawStatementsJson = [
      String.raw`[`,
      String.raw`  {`,
      String.raw`    \"suspectId\": \"suspect-1\",`,
      String.raw`    \"speakerName\": \"Alicia Mora\",`,
      String.raw`    \"content\": \"No estuve alli.\",`,
      String.raw`    \"context\": \"Coartada inicial.\",`,
      String.raw`    \"isInitiallyVisible\": true`,
      String.raw`  }`,
      String.raw`]`,
    ].join(String.raw`\n`);

    const payload = parseJsonObjectWithRootArrayFallback<{
      readonly statements?: unknown;
    }>(rawStatementsJson, 'statements');

    expect(payload).toEqual({
      statements: [
        {
          suspectId: 'suspect-1',
          speakerName: 'Alicia Mora',
          content: 'No estuve alli.',
          context: 'Coartada inicial.',
          isInitiallyVisible: true,
        },
      ],
    });
  });

  it('rejects a root array when the caller requires an object', () => {
    expect(() => parseJsonObject('[]')).toThrow('invalid_json');
  });
});
