import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../index';

// Panel position (persisted) moved to store/__tests__/uiPrefs.test.ts along
// with useUiPrefsStore. Open/closed state stays here — it's ephemeral
// session UI on the main store, not a saved preference.
describe('midi panel slice', () => {
  beforeEach(() => {
    useStore.getState().setMidiPanelOpen(false);
  });

  it('defaults to closed', () => {
    expect(useStore.getState().midiPanelOpen).toBe(false);
  });

  it('toggleMidiPanel flips the flag', () => {
    useStore.getState().toggleMidiPanel();
    expect(useStore.getState().midiPanelOpen).toBe(true);
    useStore.getState().toggleMidiPanel();
    expect(useStore.getState().midiPanelOpen).toBe(false);
  });

  it('setMidiPanelOpen sets explicit value', () => {
    useStore.getState().setMidiPanelOpen(true);
    expect(useStore.getState().midiPanelOpen).toBe(true);
  });

  it('open/close NOT persisted to localStorage', () => {
    useStore.getState().setMidiPanelOpen(true);
    expect(localStorage.getItem('stellarr.midiPanel.open')).toBeNull();
  });
});
