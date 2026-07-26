import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Input } from '../Input';

describe('Input font-variant-numeric hygiene', () => {
  it('the mono variant carries tabular-nums + slashed-zero (numeric form fields)', () => {
    const { container } = render(<Input mono type="number" value={0} onChange={() => {}} />);
    const input = container.querySelector('input')!;
    expect(getComputedStyle(input).fontVariantNumeric).toBe('tabular-nums slashed-zero');
  });

  it('the base (non-mono) input does not force tabular-nums (text fields render normally)', () => {
    const { container } = render(<Input type="text" value="" onChange={() => {}} />);
    const input = container.querySelector('input')!;
    expect(getComputedStyle(input).fontVariantNumeric).not.toBe('tabular-nums slashed-zero');
  });
});
