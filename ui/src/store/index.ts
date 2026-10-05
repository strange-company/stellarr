import { create } from 'zustand';
import type { UpdateStatePayload } from '../bridge';

export type TabId = 'grid' | 'tuner' | 'midi' | 'settings';
export const TAB_IDS: readonly TabId[] = ['grid', 'tuner', 'midi', 'settings'];
export function isTabId(value: unknown): value is TabId {
  return typeof value === 'string' && (TAB_IDS as readonly string[]).includes(value);
}
export type BadgeReason = 'update' | 'error' | 'midi-conflict';
export type BadgeSeverity = 'info' | 'warn' | 'danger';
export interface Badge {
  reason: BadgeReason;
  severity: BadgeSeverity;
}

export interface GridBlock {
  id: string;
  type: string;
  name: string;
  col: number;
  row: number;
  nodeId: number;
  testTone?: boolean;
  testToneSample?: string;
  pluginId?: string;
  pluginName?: string;
  pluginFormat?: string;
  displayName?: string;
  blockColor?: string;
  mix?: number;
  balance?: number;
  level?: number; // dB
  bypassed?: boolean;
  bypassMode?: string;
  hasEditor?: boolean;
  pluginMissing?: boolean;
  numStates?: number;
  activeStateIndex?: number;
  dirtyStates?: number[];
}

export interface Connection {
  sourceId: string;
  destId: string;
}

export interface GridSettings {
  columns: number;
  rows: number;
}

export interface ScanDirectory {
  path: string;
  isDefault: boolean;
}

export interface PluginInfo {
  id: string;
  name: string;
  manufacturer: string;
  format: string;
}

export type MidiCurve = 'linear' | 'log' | 'exp' | 'sigmoid';

export interface MidiMapping {
  channel: number;
  cc: number;
  target: string;
  blockId?: string;
  targetIndex?: number;
  // Continuous-target shaping
  ccMin?: number;
  ccMax?: number;
  paramMin?: number;
  paramMax?: number;
  curve?: MidiCurve;
  threshold?: number;
}

export interface MidiMonitorEvent {
  type: string;
  channel: number;
  data1: number;
  data2: number;
}

export interface Scene {
  name: string;
  blockStateMap: Record<string, number>;
}

/**
 * Predicts whether switching from `outgoing` to `incoming` will trigger the
 * engine's "rewire" path (capture + setStateInformation, brief audio dip)
 * or stay on the instant Stellarr-only path. Mirrors the engine's
 * `sceneRewireRequired` check, including the same effective-index clamp:
 * any block with a different effective State index between the two scenes
 * implies a binary swap. Effective index = the raw stateMap value clamped
 * to the block's current state count, matching what the engine does before
 * recall. Without clamping here, scenes carrying stale out-of-range
 * indices from an older preset would incorrectly show a rewire dot even
 * though the engine takes the fast path.
 */
export function sceneRewireRequired(
  outgoing: Scene,
  incoming: Scene,
  blocks: GridBlock[],
): boolean {
  const numStatesByBlockId = new Map<string, number>();
  for (const b of blocks) {
    if (b.numStates !== undefined && b.numStates > 0) {
      numStatesByBlockId.set(b.id, b.numStates);
    }
  }

  const effective = (blockId: string, rawIdx: number): number => {
    const n = numStatesByBlockId.get(blockId) ?? 0;
    if (n <= 0) return -1;
    return Math.min(rawIdx, n - 1);
  };

  for (const blockId in incoming.blockStateMap) {
    const incomingIdx = incoming.blockStateMap[blockId];
    const outgoingRaw = outgoing.blockStateMap[blockId] ?? -1;
    if (effective(blockId, outgoingRaw) !== effective(blockId, incomingIdx)) return true;
  }
  for (const blockId in outgoing.blockStateMap) {
    if (!(blockId in incoming.blockStateMap)) return true;
  }
  return false;
}

interface StellarrState {
  loading: boolean;
  loadingStatus: string;
  loadingProgress: number;
  connected: boolean;
  activeTab: TabId;
  blocks: GridBlock[];
  connections: Connection[];
  grid: GridSettings;
  scanDirectories: ScanDirectory[];
  availablePlugins: PluginInfo[];
  scanning: boolean;
  telemetryEnabled: boolean;
  developerModeEnabled: boolean;
  // Cell zoom — global UI scale for Grid cells. Persisted in localStorage.
  cellZoom: 'S' | 'M' | 'L';
  setCellZoom: (z: 'S' | 'M' | 'L') => void;
  cycleCellZoom: (direction: -1 | 1) => void;
  // Floating MIDI panel — open/closed state is NOT persisted.
  midiPanelOpen: boolean;
  toggleMidiPanel: () => void;
  setMidiPanelOpen: (open: boolean) => void;
  // Panel position — null means use default placement. Persisted in localStorage.
  midiPanelPosition: { x: number; y: number } | null;
  setMidiPanelPosition: (pos: { x: number; y: number }) => void;
  flavour: 'prod' | 'dev';
  presetDirectory: string;
  presetFiles: string[];
  currentPresetIndex: number;
  testToneSamples: string[];
  testToneSample: string;
  cpuPercent: number;
  justSaved: boolean;
  scenes: Scene[];
  activeSceneIndex: number;
  midiMappings: MidiMapping[];
  midiLearning: boolean;
  midiMonitorEvents: MidiMonitorEvent[];
  midiMonitorEnabled: boolean;
  midiMappingActivity: Record<number, number>; // mapping index → timestamp of last activity
  isLoadingPreset: boolean;
  setIsLoadingPreset: (loading: boolean) => void;

  lufsWindow: 'momentary' | 'shortTerm';
  lufsByBlockId: Record<string, number>;
  targetLufsByBlockId: Record<string, number | null>;
  loudnessHistory: number[]; // last N LUFS samples for currently selected block

  setLoading: (loading: boolean) => void;
  setLoadingStatus: (status: string, progress: number) => void;
  setConnected: (value: boolean) => void;
  setActiveTab: (tab: TabId) => void;

  // Tuner
  tunerNote: string | null;
  tunerOctave: number;
  tunerCents: number;
  tunerFrequency: number;
  tunerConfidence: number;
  referencePitch: number;
  tunerMode: 'needle' | 'strobe';
  setTunerData: (
    note: string | null,
    octave: number,
    cents: number,
    frequency: number,
    confidence: number,
  ) => void;
  setReferencePitch: (hz: number) => void;
  setTunerMode: (mode: 'needle' | 'strobe') => void;
  setBlockTestTone: (blockId: string, enabled: boolean) => void;
  setGridSize: (columns: number, rows: number) => void;
  setScanDirectories: (dirs: ScanDirectory[]) => void;
  setAvailablePlugins: (plugins: PluginInfo[]) => void;
  setScanning: (scanning: boolean) => void;
  setTelemetryEnabled: (enabled: boolean) => void;
  setDeveloperModeEnabled: (enabled: boolean) => void;
  setFlavour: (flavour: 'prod' | 'dev') => void;
  setBlockPlugin: (
    blockId: string,
    pluginId: string,
    pluginName: string,
    pluginFormat: string,
    hasEditor: boolean,
  ) => void;
  setBlockMix: (blockId: string, mix: number) => void;
  setBlockBalance: (blockId: string, balance: number) => void;
  setBlockLevel: (blockId: string, level: number) => void;
  setBlockDisplayName: (blockId: string, displayName: string) => void;
  setBlockColor: (blockId: string, blockColor: string) => void;
  setBlockBypassed: (blockId: string, bypassed: boolean) => void;
  setBlockBypassMode: (blockId: string, mode: string) => void;
  setBlockStates: (
    blockId: string,
    numStates: number,
    activeStateIndex: number,
    dirtyStates: number[],
  ) => void;
  setPresetList: (directory: string, files: string[], currentIndex: number) => void;
  setCpuPercent: (cpu: number) => void;
  setTestToneSamples: (samples: string[]) => void;
  setTestToneSample: (sample: string) => void;
  setJustSaved: (value: boolean) => void;
  setScenes: (scenes: Scene[], activeSceneIndex: number) => void;
  setMidiMappings: (mappings: MidiMapping[], learning: boolean) => void;
  getStateMidiMapping: (blockId: string, stateIndex: number) => MidiMapping | undefined;
  appendMidiMonitorEvents: (events: MidiMonitorEvent[]) => void;
  clearMidiMonitor: () => void;
  setMidiMonitorEnabled: (enabled: boolean) => void;
  updateMidiActivity: (events: MidiMonitorEvent[]) => void;

  setLufsWindow: (window: 'momentary' | 'shortTerm') => void;
  setBlockLufs: (samples: { id: string; lufs: number; targetLufs?: number | null }[]) => void;
  pushLoudnessSample: (lufs: number) => void;
  clearLoudnessHistory: () => void;

  addBlock: (block: GridBlock) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (blockId: string, col: number, row: number) => void;
  addConnection: (conn: Connection) => void;
  removeConnection: (sourceId: string, destId: string) => void;
  syncGraph: (blocks: GridBlock[], connections: Connection[]) => void;

  clipboardBlockType: string | null;
  setClipboardBlockType: (type: string | null) => void;

  selectedBlockId: string | null;
  selectBlock: (blockId: string | null) => void;

  floatingPanelPos: { x: number; y: number } | null;
  setFloatingPanelPos: (pos: { x: number; y: number } | null) => void;

  draggingConnection: {
    blockId: string;
    portType: 'input' | 'output';
    mouseX: number;
    mouseY: number;
  } | null;
  setDraggingConnection: (
    state: {
      blockId: string;
      portType: 'input' | 'output';
      mouseX: number;
      mouseY: number;
    } | null,
  ) => void;

  badges: Partial<Record<TabId, Badge>>;
  setBadge: (tab: TabId, badge: Badge | null) => void;

  softwareUpdate: UpdateStatePayload;
  setSoftwareUpdate: (s: UpdateStatePayload) => void;
}

const ZOOM_ORDER: ['S', 'M', 'L'] = ['S', 'M', 'L'];

export const readCellZoom = (): 'S' | 'M' | 'L' => {
  try {
    const v = localStorage.getItem('stellarr.cellZoom');
    if (v === 'S' || v === 'M' || v === 'L') return v;
  } catch {
    // localStorage may be inaccessible (SSR, private mode); fall through.
  }
  return 'M';
};

export const readMidiPanelPosition = (): { x: number; y: number } | null => {
  try {
    const raw = localStorage.getItem('stellarr.midiPanel.position');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Bad JSON or localStorage inaccessible; fall through to null.
  }
  return null;
};

export const useStore = create<StellarrState>((set, get) => ({
  loading: true,
  loadingStatus: 'Initialising...',
  loadingProgress: 0,
  connected: false,
  activeTab: 'grid',
  tunerNote: null,
  tunerOctave: 0,
  tunerCents: 0,
  tunerFrequency: 0,
  tunerConfidence: 0,
  referencePitch: 440,
  tunerMode: 'needle',
  blocks: [],
  connections: [],
  grid: { columns: 12, rows: 5 },
  scanDirectories: [],
  availablePlugins: [],
  scanning: false,
  telemetryEnabled: false,
  developerModeEnabled: false,
  cellZoom: readCellZoom(),
  midiPanelOpen: false,
  midiPanelPosition: readMidiPanelPosition(),
  flavour: 'prod',
  presetDirectory: '',
  presetFiles: [],
  currentPresetIndex: -1,
  testToneSamples: [],
  testToneSample: 'Synth (Default)',
  cpuPercent: 0,
  justSaved: false,
  scenes: [],
  activeSceneIndex: -1,
  midiMappings: [],
  midiLearning: false,
  midiMonitorEvents: [],
  midiMonitorEnabled: false,
  midiMappingActivity: {},
  isLoadingPreset: false,
  setIsLoadingPreset: (loading) => set({ isLoadingPreset: loading }),
  lufsWindow: 'shortTerm',
  lufsByBlockId: {},
  targetLufsByBlockId: {},
  loudnessHistory: [],
  clipboardBlockType: null,
  selectedBlockId: null,
  floatingPanelPos: null,
  draggingConnection: null,
  badges: {},
  softwareUpdate: {
    status: 'idle',
    latestVersion: '',
    releasedAt: '',
    sizeBytes: 0,
    releaseNotesUrl: '',
    downloadProgress: 0,
    error: '',
  },

  setLoading: (loading) => set({ loading }),
  setLoadingStatus: (status, progress) => set({ loadingStatus: status, loadingProgress: progress }),
  setConnected: (value) => set({ connected: value }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setTunerData: (note, octave, cents, frequency, confidence) =>
    set({
      tunerNote: note,
      tunerOctave: octave,
      tunerCents: cents,
      tunerFrequency: frequency,
      tunerConfidence: confidence,
    }),

  setReferencePitch: (hz) => set({ referencePitch: hz }),
  setTunerMode: (mode) => set({ tunerMode: mode }),

  setBlockTestTone: (blockId, enabled) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, testTone: enabled } : b)),
    })),

  setGridSize: (columns, rows) => set({ grid: { columns, rows } }),
  setScanDirectories: (dirs) => set({ scanDirectories: dirs }),
  setAvailablePlugins: (plugins) => set({ availablePlugins: plugins, scanning: false }),
  setScanning: (scanning) => set({ scanning }),
  setTelemetryEnabled: (enabled) => set({ telemetryEnabled: enabled }),
  setDeveloperModeEnabled: (enabled) => set({ developerModeEnabled: enabled }),

  setCellZoom: (z) => {
    if (z === get().cellZoom) return;
    try {
      localStorage.setItem('stellarr.cellZoom', z);
    } catch {
      // ignore — see readCellZoom comment.
    }
    set({ cellZoom: z });
  },

  cycleCellZoom: (direction) => {
    const current = get().cellZoom;
    const idx = ZOOM_ORDER.indexOf(current);
    const next = ZOOM_ORDER[Math.max(0, Math.min(ZOOM_ORDER.length - 1, idx + direction))];
    if (next === current) return;
    try {
      localStorage.setItem('stellarr.cellZoom', next);
    } catch {
      // ignore — see readCellZoom comment.
    }
    set({ cellZoom: next });
  },

  toggleMidiPanel: () => set((s) => ({ midiPanelOpen: !s.midiPanelOpen })),

  setMidiPanelOpen: (open) => {
    if (open === get().midiPanelOpen) return;
    set({ midiPanelOpen: open });
  },

  setMidiPanelPosition: (pos) => {
    try {
      localStorage.setItem('stellarr.midiPanel.position', JSON.stringify(pos));
    } catch {
      // ignore — see readMidiPanelPosition comment.
    }
    set({ midiPanelPosition: pos });
  },

  setFlavour: (flavour) => set({ flavour }),

  setBlockPlugin: (blockId, pluginId, pluginName, pluginFormat, hasEditor) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId
          ? { ...b, pluginId, pluginName, pluginFormat, hasEditor, pluginMissing: false }
          : b,
      ),
    })),

  setBlockMix: (blockId, mix) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, mix } : b)),
    })),

  setBlockBalance: (blockId, balance) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, balance } : b)),
    })),

  setBlockLevel: (blockId, level) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, level } : b)),
    })),

  setBlockDisplayName: (blockId, displayName) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, displayName } : b)),
    })),

  setBlockColor: (blockId, blockColor) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, blockColor } : b)),
    })),

  setBlockBypassed: (blockId, bypassed) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, bypassed } : b)),
    })),

  setBlockBypassMode: (blockId, bypassMode) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, bypassMode } : b)),
    })),

  setBlockStates: (blockId, numStates, activeStateIndex, dirtyStates) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId ? { ...b, numStates, activeStateIndex, dirtyStates } : b,
      ),
    })),

  setPresetList: (directory, files, currentIndex) =>
    set({ presetDirectory: directory, presetFiles: files, currentPresetIndex: currentIndex }),

  setCpuPercent: (cpu) => set({ cpuPercent: cpu }),

  setTestToneSamples: (samples) => set({ testToneSamples: samples }),
  setTestToneSample: (sample) => set({ testToneSample: sample }),
  setJustSaved: (value) => set({ justSaved: value }),

  setScenes: (scenes, activeSceneIndex) => set({ scenes, activeSceneIndex }),

  setMidiMappings: (mappings, learning) => set({ midiMappings: mappings, midiLearning: learning }),

  getStateMidiMapping: (blockId, stateIndex) => {
    const mappings = get().midiMappings;
    return mappings.find(
      (m) =>
        m.target === 'blockState'
        && m.blockId === blockId
        && m.targetIndex === stateIndex,
    );
  },

  appendMidiMonitorEvents: (events) =>
    set((s) => ({
      midiMonitorEvents: [...s.midiMonitorEvents, ...events].slice(-200),
    })),

  clearMidiMonitor: () => set({ midiMonitorEvents: [] }),

  setMidiMonitorEnabled: (enabled) => set({ midiMonitorEnabled: enabled }),

  updateMidiActivity: (events) =>
    set((s) => {
      const activity = { ...s.midiMappingActivity };
      const now = Date.now();
      let changed = false;

      for (const evt of events) {
        for (let i = 0; i < s.midiMappings.length; i++) {
          const m = s.midiMappings[i];
          const channelMatch = m.channel === -1 || m.channel === evt.channel;
          if (!channelMatch) continue;

          if (evt.type === 'CC' && m.cc === evt.data1) {
            activity[i] = now;
            changed = true;
          } else if (evt.type === 'PC' && m.cc === -1 && m.target === 'presetChange') {
            activity[i] = now;
            changed = true;
          }
        }
      }

      return changed ? { midiMappingActivity: activity } : {};
    }),

  setLufsWindow: (window) => set({ lufsWindow: window }),
  setBlockLufs: (samples) =>
    set((state) => {
      const lufsByBlockId = { ...state.lufsByBlockId };
      const targetLufsByBlockId = { ...state.targetLufsByBlockId };
      for (const s of samples) {
        lufsByBlockId[s.id] = s.lufs;
        if (s.targetLufs !== undefined) targetLufsByBlockId[s.id] = s.targetLufs;
      }
      return { lufsByBlockId, targetLufsByBlockId };
    }),
  pushLoudnessSample: (lufs) =>
    set((state) => {
      const next = [...state.loudnessHistory, lufs];
      if (next.length > 120) next.shift();
      return { loudnessHistory: next };
    }),
  clearLoudnessHistory: () => set({ loudnessHistory: [] }),

  addBlock: (block) => set((s) => ({ blocks: [...s.blocks, block] })),

  removeBlock: (blockId) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
      connections: s.connections.filter((c) => c.sourceId !== blockId && c.destId !== blockId),
      selectedBlockId: s.selectedBlockId === blockId ? null : s.selectedBlockId,
    })),

  moveBlock: (blockId, col, row) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, col, row } : b)),
    })),

  addConnection: (conn) => set((s) => ({ connections: [...s.connections, conn] })),

  removeConnection: (sourceId, destId) =>
    set((s) => ({
      connections: s.connections.filter((c) => !(c.sourceId === sourceId && c.destId === destId)),
    })),

  syncGraph: (blocks, connections) => set({ blocks, connections }),

  setClipboardBlockType: (type) => set({ clipboardBlockType: type }),
  selectBlock: (blockId) =>
    set((s) => ({
      selectedBlockId: blockId,
      floatingPanelPos: blockId === null ? null : s.floatingPanelPos,
    })),
  setFloatingPanelPos: (pos) => set({ floatingPanelPos: pos }),
  setDraggingConnection: (state) => set({ draggingConnection: state }),

  setBadge: (tab, badge) =>
    set((state) => {
      const next = { ...state.badges };
      if (badge === null) delete next[tab];
      else next[tab] = badge;
      return { badges: next };
    }),

  setSoftwareUpdate: (s) => set({ softwareUpdate: s }),
}));
