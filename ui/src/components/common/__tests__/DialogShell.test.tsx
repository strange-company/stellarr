import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DialogShell } from '../DialogShell';

describe('DialogShell', () => {
  it('renders the title and children when open', () => {
    render(
      <DialogShell open onOpenChange={() => {}} title="Delete Preset" variant="plain">
        <p>Are you sure?</p>
      </DialogShell>,
    );
    expect(screen.getByText('Delete Preset')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <DialogShell open={false} onOpenChange={() => {}} title="Delete Preset" variant="plain">
        <p>Are you sure?</p>
      </DialogShell>,
    );
    expect(screen.queryByText('Delete Preset')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('wraps the title in a titlebar bar for the titlebar variant', () => {
    render(
      <DialogShell open onOpenChange={() => {}} title="MIDI — Preset Change" variant="titlebar">
        <p>body content</p>
      </DialogShell>,
    );
    const titleEl = screen.getByText('MIDI — Preset Change');
    // Canonical titlebar shape: title sits inside its own bar element,
    // a sibling of the body — not a direct child of Dialog.Content.
    expect(titleEl.parentElement?.className).toMatch(/titlebar/i);
  });

  it('does not wrap the title in a titlebar bar for the plain variant', () => {
    render(
      <DialogShell open onOpenChange={() => {}} title="Delete Preset" variant="plain">
        <p>body content</p>
      </DialogShell>,
    );
    const titleEl = screen.getByText('Delete Preset');
    expect(titleEl.parentElement?.className).not.toMatch(/titlebar/i);
  });

  it('forwards onOpenAutoFocus to the underlying Dialog.Content', () => {
    const onOpenAutoFocus = vi.fn((e: Event) => e.preventDefault());
    render(
      <DialogShell
        open
        onOpenChange={() => {}}
        title="Rename Preset"
        variant="plain"
        onOpenAutoFocus={onOpenAutoFocus}
      >
        <p>body content</p>
      </DialogShell>,
    );
    expect(onOpenAutoFocus).toHaveBeenCalled();
  });
});
