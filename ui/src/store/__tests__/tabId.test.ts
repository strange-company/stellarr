import { describe, it, expect } from 'vitest';
import { TAB_IDS, isTabId } from '../index';

describe('isTabId', () => {
  it('accepts every known tab id', () => {
    for (const id of TAB_IDS) {
      expect(isTabId(id)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isTabId('bogus')).toBe(false);
    expect(isTabId('')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isTabId(undefined)).toBe(false);
    expect(isTabId(null)).toBe(false);
    expect(isTabId(42)).toBe(false);
    expect(isTabId({})).toBe(false);
  });
});
