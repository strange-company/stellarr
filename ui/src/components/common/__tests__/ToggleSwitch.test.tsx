import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleSwitch } from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  it('exposes role="switch" with aria-checked reflecting the enabled state', () => {
    const { rerender } = render(
      <ToggleSwitch enabled={false} onToggle={() => {}} title="Bypass block" />,
    );
    const sw = screen.getByRole('switch', { name: 'Bypass block' });
    expect(sw).toHaveAttribute('aria-checked', 'false');

    rerender(<ToggleSwitch enabled={true} onToggle={() => {}} title="Bypass block" />);
    expect(screen.getByRole('switch', { name: 'Bypass block' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<ToggleSwitch enabled={false} onToggle={onToggle} title="Bypass block" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
