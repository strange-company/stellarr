import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TunerPanel } from '../TunerPanel';
import numericStyles from '../../common/Numeric.module.css';

describe('TunerPanel reference-pitch preset tags', () => {
  it('renders the preset Hz value through the Numeric (mono) primitive', () => {
    render(<TunerPanel />);
    const tag = screen.getByRole('button', { name: '440' });
    const numericEl = tag.querySelector(`.${numericStyles.numeric}`);
    expect(numericEl).not.toBeNull();
    expect(numericEl).toHaveTextContent('440');
  });
});
