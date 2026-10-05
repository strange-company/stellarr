import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { PresetBrowser } from '../PresetBrowser';
import { useStore } from '../../../store';
import * as bridge from '../../../bridge';

// Seed the store with a known preset so the trigger has a concrete value
// to render and the loading status message can reference it.
function seedPresets() {
  act(() => {
    useStore.setState({
      presetFiles: ['Acme Lead Tone.stellarr', 'Clean Combo.stellarr'],
      currentPresetIndex: 0,
      scenes: [],
      activeSceneIndex: -1,
      blocks: [],
      midiMappings: [],
      isLoadingPreset: false,
    });
  });
}

beforeEach(() => {
  seedPresets();
  vi.restoreAllMocks();
});

// The Preset trigger's accessible name concatenates the "Preset" label and the
// active preset value. Use a permissive matcher anchored on the label.
function getPresetTrigger() {
  return screen.getByRole('button', { name: /preset.*acme lead tone/i });
}

describe('PresetBrowser trigger gating', () => {
  it('renders enabled trigger when isLoadingPreset is false', () => {
    render(<PresetBrowser />);
    const trigger = getPresetTrigger();
    expect(trigger).not.toHaveAttribute('aria-disabled', 'true');
    expect(trigger).not.toHaveAttribute('aria-busy', 'true');
  });

  it('marks trigger aria-disabled and aria-busy when isLoadingPreset is true', () => {
    act(() => {
      useStore.setState({ isLoadingPreset: true });
    });
    render(<PresetBrowser />);
    const trigger = getPresetTrigger();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
  });

  it('clicks are no-op while loading', () => {
    act(() => {
      useStore.setState({ isLoadingPreset: true });
    });
    const spy = vi.spyOn(bridge, 'requestLoadPresetByIndex');
    render(<PresetBrowser />);
    const trigger = getPresetTrigger();
    fireEvent.click(trigger);
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows a spinner glyph while loading', () => {
    act(() => {
      useStore.setState({ isLoadingPreset: true });
    });
    render(<PresetBrowser />);
    expect(screen.getByTestId('preset-loading-spinner')).toBeInTheDocument();
  });

  it('exposes an aria-live status while loading', () => {
    act(() => {
      useStore.setState({ isLoadingPreset: true });
    });
    render(<PresetBrowser />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/loading preset/i);
  });
});

// -- Rename / delete flows (PresetDropdown + SceneDropdown), exercised
// through the shared useRenameDeleteDialogs hook + RenameDeleteDialogs pair --

// A row's "..." sub-menu trigger is the second menuitem within its
// `.sceneRow` wrapper (the first is the select/rename-target row itself).
// Clicking it opens the Rename/Delete sub-menu rendered via a Radix portal.
function openRowSubmenu(rowIndex: number) {
  const rows = document.querySelectorAll('[class*="sceneRow"]');
  const row = rows[rowIndex] as HTMLElement;
  const menuitemsInRow = within(row).getAllByRole('menuitem');
  fireEvent.click(menuitemsInRow[1]);
}

describe('PresetBrowser rename/delete flows', () => {
  beforeEach(() => {
    act(() => {
      useStore.setState({
        scenes: [
          { name: 'Verse', blockStateMap: {} },
          { name: 'Chorus', blockStateMap: {} },
        ],
        activeSceneIndex: 0,
      });
    });
  });

  it('renames a preset via the preset dropdown row menu', () => {
    const spy = vi.spyOn(bridge, 'requestRenamePreset');
    render(<PresetBrowser />);
    fireEvent.pointerDown(getPresetTrigger(), { button: 0, pointerId: 1, pointerType: 'mouse' });
    openRowSubmenu(0);
    fireEvent.click(screen.getByText('Rename'));

    const input = screen.getByDisplayValue('Acme Lead Tone') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(spy).toHaveBeenCalledWith(0, 'New Name');
    expect(screen.queryByDisplayValue('New Name')).not.toBeInTheDocument();
  });

  it('deletes a preset via the preset dropdown row menu', () => {
    const spy = vi.spyOn(bridge, 'requestDeletePreset');
    render(<PresetBrowser />);
    fireEvent.pointerDown(getPresetTrigger(), { button: 0, pointerId: 1, pointerType: 'mouse' });
    openRowSubmenu(1);
    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/delete "clean combo"/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(spy).toHaveBeenCalledWith(1);
  });

  it('renames a scene via the scene dropdown row menu', () => {
    const spy = vi.spyOn(bridge, 'requestRenameScene');
    render(<PresetBrowser />);
    const sceneTrigger = screen.getByRole('button', { name: /scene.*verse/i });
    fireEvent.pointerDown(sceneTrigger, { button: 0, pointerId: 1, pointerType: 'mouse' });
    openRowSubmenu(0);
    fireEvent.click(screen.getByText('Rename'));

    const input = screen.getByDisplayValue('Verse') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Intro' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(spy).toHaveBeenCalledWith(0, 'Intro');
  });

  it('deletes a scene via the scene dropdown row menu', () => {
    const spy = vi.spyOn(bridge, 'requestDeleteScene');
    render(<PresetBrowser />);
    const sceneTrigger = screen.getByRole('button', { name: /scene.*verse/i });
    fireEvent.pointerDown(sceneTrigger, { button: 0, pointerId: 1, pointerType: 'mouse' });
    openRowSubmenu(1);
    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/delete "chorus"/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(spy).toHaveBeenCalledWith(1);
  });
});
