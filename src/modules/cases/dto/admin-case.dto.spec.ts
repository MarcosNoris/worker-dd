import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateCaseEvidenceDto,
  CreateInvestigationActionDto,
  GenerateCaseSuspectsDto,
} from './admin-case.dto';

describe('CreateCaseEvidenceDto', () => {
  it('normalizes legacy documentary evidence type to the database enum', async () => {
    const dto = plainToInstance(CreateCaseEvidenceDto, {
      description: 'Documento recuperado en la escena.',
      importance: 'supporting',
      title: 'Factura del laboratorio',
      type: 'documentary',
    });

    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    expect(dto.type).toBe('document');
  });
});

describe('CreateInvestigationActionDto', () => {
  it('normalizes legacy action type aliases to the database enum', async () => {
    const dto = plainToInstance(CreateInvestigationActionDto, {
      actionType: 'inspection',
      baseDurationMinutes: 45,
      description: 'Inspeccionar la escena principal del caso.',
      title: 'Inspeccionar escena',
    });

    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    expect(dto.actionType).toBe('inspect_scene');
  });

  it('rejects minimum skill levels below the playable floor', async () => {
    const dto = plainToInstance(CreateInvestigationActionDto, {
      actionType: 'inspect_scene',
      baseDurationMinutes: 45,
      description: 'Inspeccionar la escena principal del caso.',
      minimumSkillLevel: 49,
      title: 'Inspeccionar escena',
    });

    const validationErrors = await validate(dto);

    expect(validationErrors).toEqual([
      expect.objectContaining({
        property: 'minimumSkillLevel',
      }),
    ]);
  });
});

describe('GenerateCaseSuspectsDto', () => {
  it('accepts an empty body', async () => {
    const dto = plainToInstance(GenerateCaseSuspectsDto, {});

    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
  });

  it('transforms and validates suspect count', async () => {
    const dto = plainToInstance(GenerateCaseSuspectsDto, {
      suspectCount: '4',
    });

    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    expect(dto.suspectCount).toBe(4);
  });

  it('rejects suspect counts outside the supported range', async () => {
    const dto = plainToInstance(GenerateCaseSuspectsDto, {
      suspectCount: 7,
    });

    const validationErrors = await validate(dto);

    expect(validationErrors).toEqual([
      expect.objectContaining({
        property: 'suspectCount',
      }),
    ]);
  });
});
