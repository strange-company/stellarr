import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiPrefsStore } from '../uiPrefs';

const UI_PREFS_KEY = 'stellarr.uiPrefs';
const LEGACY_CELL_ZOOM_KEY = 'stellarr.cellZoom';
const LEGACY_MIDI_PANEL_POSITION_KEY = 'stellarr.midiPanel.position';

describe('cell zoom slice', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiPrefsStore.getState().setCellZoom('M');
  });

  it('defaults to M', () => {
    expect(useUiPrefsStore.getState().cellZoom).toBe('M');
  });

  it('cycleCellZoom(+1) moves M to L', () => {
    useUiPrefsStore.getState().cycleCellZoom(+1);
    expect(useUiPrefsStore.getState().cellZoom).toBe('L');
  });

  it('cycleCellZoom(-1) moves M to S', () => {
    useUiPrefsStore.getState().cycleCellZoom(-1);
    expect(useUiPrefsStore.getState().cellZoom).toBe('S');
  });

  it('cycleCellZoom(+1) clamps at L', () => {
    useUiPrefsStore.getState().setCellZoom('L');
    useUiPrefsStore.getState().cycleCellZoom(+1);
    expect(useUiPrefsStore.getState().cellZoom).toBe('L');
  });

  it('cycleCellZoom(-1) clamps at S', () => {
    useUiPrefsStore.getState().setCellZoom('S');
    useUiPrefsStore.getState().cycleCellZoom(-1);
    expect(useUiPrefsStore.getState().cellZoom).toBe('S');
  });

  it('persists to localStorage under stellarr.uiPrefs', () => {
    useUiPrefsStore.getState().setCellZoom('L');
    const stored = JSON.parse(localStorage.getItem(UI_PREFS_KEY)!);
    expect(stored.state.cellZoom).toBe('L');
  });

  it('setCellZoom skips persistence on no-op (same value)', () => {
    // beforeEach forces the slice to 'M' which wrote to localStorage; clear it
    // again so we can detect whether the next setCellZoom('M') call writes.
    localStorage.removeItem(UI_PREFS_KEY);
    useUiPrefsStore.getState().setCellZoom('M'); // already M — should short-circuit
    expect(localStorage.getItem(UI_PREFS_KEY)).toBeNull();
  });
});

describe('midi panel position slice', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiPrefsStore.setState({ midiPanelPosition: null });
  });

  it('default panel position is null (use default placement)', () => {
    expect(useUiPrefsStore.getState().midiPanelPosition).toBeNull();
  });

  it('setMidiPanelPosition stores + persists', () => {
    useUiPrefsStore.getState().setMidiPanelPosition({ x: 120, y: 50 });
    expect(useUiPrefsStore.getState().midiPanelPosition).toEqual({ x: 120, y: 50 });
    const stored = JSON.parse(localStorage.getItem(UI_PREFS_KEY)!);
    expect(stored.state.midiPanelPosition).toEqual({ x: 120, y: 50 });
  });
});

// Highest-risk behaviour in this refactor: no existing user may lose their
// saved cell-zoom or MIDI-panel position when the hand-rolled localStorage
// slices are replaced by the `persist` middleware. Each test here forces a
// fresh module instance (vi.resetModules + dynamic import) so the store's
// initial-state factory re-reads localStorage exactly as it would on a real
// app relaunch.
describe('useUiPrefsStore — legacy migration seed', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('seeds cellZoom + midiPanelPosition from legacy keys when stellarr.uiPrefs is absent', async () => {
    localStorage.setItem(LEGACY_CELL_ZOOM_KEY, 'L');
    localStorage.setItem(LEGACY_MIDI_PANEL_POSITION_KEY, JSON.stringify({ x: 10, y: 20 }));

    const { useUiPrefsStore: freshStore } = await import('../uiPrefs');

    expect(freshStore.getState().cellZoom).toBe('L');
    expect(freshStore.getState().midiPanelPosition).toEqual({ x: 10, y: 20 });
  });

  it('defaults to M / null when nothing is stored (new user)', async () => {
    const { useUiPrefsStore: freshStore } = await import('../uiPrefs');

    expect(freshStore.getState().cellZoom).toBe('M');
    expect(freshStore.getState().midiPanelPosition).toBeNull();
  });

  it('falls back to defaults when the legacy cell zoom value is corrupt', async () => {
    localStorage.setItem(LEGACY_CELL_ZOOM_KEY, 'XL');
    localStorage.setItem(LEGACY_MIDI_PANEL_POSITION_KEY, 'not-json');

    const { useUiPrefsStore: freshStore } = await import('../uiPrefs');

    expect(freshStore.getState().cellZoom).toBe('M');
    expect(freshStore.getState().midiPanelPosition).toBeNull();
  });

  it('stellarr.uiPrefs wins over legacy keys once it exists', async () => {
    localStorage.setItem(LEGACY_CELL_ZOOM_KEY, 'L');
    localStorage.setItem(LEGACY_MIDI_PANEL_POSITION_KEY, JSON.stringify({ x: 10, y: 20 }));
    localStorage.setItem(
      UI_PREFS_KEY,
      JSON.stringify({ state: { cellZoom: 'S', midiPanelPosition: { x: 1, y: 2 } }, version: 0 }),
    );

    const { useUiPrefsStore: freshStore } = await import('../uiPrefs');

    expect(freshStore.getState().cellZoom).toBe('S');
    expect(freshStore.getState().midiPanelPosition).toEqual({ x: 1, y: 2 });
  });
});
