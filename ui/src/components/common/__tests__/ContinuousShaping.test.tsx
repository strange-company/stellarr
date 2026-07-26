import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContinuousShaping } from '../ContinuousShaping';
import { TARGET_META } from '../shaping/targetMeta';
import inputStyles from '../Input.module.css';

describe('ContinuousShaping', () => {
  const baseState = {
    ccMin: 0,
    ccMax: 127,
    paramMin: undefined as number | undefined,
    paramMax: undefined as number | undefined,
    curve: 'linear' as const,
  };

  it('renders Min/Max rows for blockMix with number inputs', () => {
    const onChange = vi.fn();
    render(
      <ContinuousShaping
        meta={TARGET_META.blockMix}
        state={{ ...baseState, paramMin: 0.3, paramMax: 0.8 }}
        onChange={onChange}
      />,
    );
    // CC inputs (default range)
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('127')).toBeInTheDocument();
    // Param inputs as bare numbers (Mix is 0..100 display range)
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    // Suffix label rendered
    expect(screen.getAllByText('%').length).toBeGreaterThan(0);
  });

  it('emits onChange when ccMin is edited', () => {
    const onChange = vi.fn();
    render(
      <ContinuousShaping
        meta={TARGET_META.blockMix}
        state={baseState}
        onChange={onChange}
      />,
    );
    const ccMinInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(ccMinInput, { target: { value: '20' } });
    fireEvent.blur(ccMinInput);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ccMin: 20 }));
  });

  it('renders every numeric input (CC min/max, param min/max) in mono for tabular alignment', () => {
    render(
      <ContinuousShaping
        meta={TARGET_META.blockMix}
        state={{ ...baseState, paramMin: 0.3, paramMax: 0.8 }}
        onChange={vi.fn()}
      />,
    );
    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs.length).toBeGreaterThan(0);
    for (const input of numberInputs) {
      expect(input.className).toContain(inputStyles.mono);
    }
  });

  it('renders the curve trigger with the current value', () => {
    render(
      <ContinuousShaping
        meta={TARGET_META.blockMix}
        state={{ ...baseState, curve: 'log' }}
        onChange={vi.fn()}
      />,
    );
    // Radix Select renders a button trigger labelled "Curve". The selected
    // value text shows inside it.
    const trigger = screen.getByRole('combobox', { name: /curve/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent ?? '').toMatch(/log/i);
  });
});
