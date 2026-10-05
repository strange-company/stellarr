import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CellZoomLevel = 'S' | 'M' | 'L';

interface UiPrefsState {
  // Cell zoom — global UI scale for Grid cells.
  cellZoom: CellZoomLevel;
  setCellZoom: (z: CellZoomLevel) => void;
  cycleCellZoom: (direction: -1 | 1) => void;
  // Floating MIDI panel position — null means use default placement.
  // (Open/closed state is NOT a persisted preference — it lives on the
  // main engine-state store since it's ephemeral session UI, not a saved
  // preference.)
  midiPanelPosition: { x: number; y: number } | null;
  setMidiPanelPosition: (pos: { x: number; y: number }) => void;
}

const ZOOM_ORDER: CellZoomLevel[] = ['S', 'M', 'L'];

// Legacy hand-rolled localStorage keys used before this store existed.
// Read once as the initial-state seed so existing users keep their saved
// zoom/position after the upgrade to the unified `stellarr.uiPrefs` key
// below. Once persist's own `stellarr.uiPrefs` entry exists, it takes
// priority over these on every subsequent load (persist rehydration
// overwrites the initializer's return value) — see store/uiPrefs test
// "stellarr.uiPrefs wins over legacy keys once it exists".
const LEGACY_CELL_ZOOM_KEY = 'stellarr.cellZoom';
const LEGACY_MIDI_PANEL_POSITION_KEY = 'stellarr.midiPanel.position';

function seedLegacyCellZoom(): CellZoomLevel {
  try {
    const v = localStorage.getItem(LEGACY_CELL_ZOOM_KEY);
    if (v === 'S' || v === 'M' || v === 'L') return v;
  } catch {
    // localStorage may be inaccessible (SSR, private mode); fall through.
  }
  return 'M';
}

function seedLegacyMidiPanelPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(LEGACY_MIDI_PANEL_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Bad JSON or localStorage inaccessible; fall through to null.
  }
  return null;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set, get) => ({
      cellZoom: seedLegacyCellZoom(),
      setCellZoom: (z) => {
        if (z === get().cellZoom) return;
        set({ cellZoom: z });
      },
      cycleCellZoom: (direction) => {
        const current = get().cellZoom;
        const idx = ZOOM_ORDER.indexOf(current);
        const next = ZOOM_ORDER[Math.max(0, Math.min(ZOOM_ORDER.length - 1, idx + direction))];
        if (next === current) return;
        set({ cellZoom: next });
      },
      midiPanelPosition: seedLegacyMidiPanelPosition(),
      setMidiPanelPosition: (pos) => set({ midiPanelPosition: pos }),
    }),
    {
      name: 'stellarr.uiPrefs',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
