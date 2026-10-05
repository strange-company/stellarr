import { describe, it, expect } from 'vitest';
import { clamp } from '../clamp';

describe('clamp', () => {
  it('passes through values already inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('clamps values below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps values above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('works with negative ranges', () => {
    expect(clamp(-70, -60, 0)).toBe(-60);
    expect(clamp(5, -60, 0)).toBe(0);
    expect(clamp(-30, -60, 0)).toBe(-30);
  });

  it('works with fractional bounds and values', () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
