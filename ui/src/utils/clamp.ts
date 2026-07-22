/**
 * Restrict `value` to the inclusive range [min, max]. Shared idiom for the
 * many hand-inlined `Math.max(min, Math.min(max, value))` clamps across the
 * UI — extracted so the formula lives in exactly one place.
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
