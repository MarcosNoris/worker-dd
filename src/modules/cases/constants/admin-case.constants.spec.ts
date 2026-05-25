import {
  ADMIN_ACTION_TYPES,
  normalizeAdminActionType,
} from './admin-case.constants';

describe('admin case constants', () => {
  it('normalizes every canonical action type to itself', () => {
    ADMIN_ACTION_TYPES.forEach((actionType) => {
      expect(normalizeAdminActionType(actionType)).toBe(actionType);
    });
  });

  it('normalizes legacy action type aliases to canonical database values', () => {
    expect(normalizeAdminActionType('inspection')).toBe('inspect_scene');
    expect(normalizeAdminActionType('financial_review')).toBe(
      'check_financial_records',
    );
  });

  it('normalizes action type casing, spacing and separators', () => {
    expect(normalizeAdminActionType(' Check Financial Records ')).toBe(
      'check_financial_records',
    );
    expect(normalizeAdminActionType('check-financial-records')).toBe(
      'check_financial_records',
    );
  });
});
