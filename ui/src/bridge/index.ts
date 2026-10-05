import * as Sentry from '@sentry/browser';
import { useStore } from '../store';
import type {
  GridBlock,
  Connection,
  ScanDirectory,
  PluginInfo,
  Scene,
  MidiMapping,
  MidiCurve,
  MidiMonitorEvent,
} from '../store';
import { EventNames, type InboundEventName, type OutboundEventName } from './eventNames';

export type UpdateStatus =
  | 'idle' | 'checking' | 'available' | 'no-update'
  | 'downloading' | 'ready' | 'error';

export interface UpdateStatePayload {
  status: UpdateStatus;
  latestVersion: string;
  releasedAt: string;
  sizeBytes: number;
  releaseNotesUrl: string;
  downloadProgress: number;
  error: string;
}

declare global {
  interface Window {
    __JUCE__?: {
      backend: {
        addEventListener: (
          eventId: string,
          callback: (payload: unknown) => void,
        ) => [string, number];
        emitEvent: (eventId: string, payload: unknown) => void;
      };
      initialisationData: {
        __juce__functions: string[];
      };
    };
  }
}

let bridgeReady = false;

function callNativeFunction(name: string, ...args: unknown[]): void {
  const juce = window.__JUCE__;
  if (!juce) return;

  juce.backend.emitEvent('__juce__invoke', {
    name,
    params: args,
    resultId: 0,
  });
}

function extractMessage(detail: unknown): string {
  if (typeof detail === 'object' && detail !== null && 'message' in detail)
    return String((detail as Record<string, unknown>).message);
  return String(detail);
}

function asRecord(detail: unknown): Record<string, unknown> {
  if (typeof detail === 'object' && detail !== null) return detail as Record<string, unknown>;
  return {};
}

// -- Graph commands (UI → C++) -----------------------------------------------

export function requestAddBlock(
  type: string,
  col: number,
  row: number,
  spliceSourceId?: string,
  spliceDestId?: string,
): void {
  sendEvent(
    EventNames.BlockAdd,
    JSON.stringify({
      type,
      col,
      row,
      ...(spliceSourceId && spliceDestId ? { spliceSourceId, spliceDestId } : {}),
    }),
  );
}

export function requestRemoveBlock(blockId: string): void {
  sendEvent(EventNames.BlockRemove, JSON.stringify({ blockId }));
}

export function requestMoveBlock(blockId: string, col: number, row: number): void {
  sendEvent(EventNames.BlockMove, JSON.stringify({ blockId, col, row }));
}

export function requestAddConnection(sourceId: string, destId: string): void {
  sendEvent(EventNames.ConnectionAdd, JSON.stringify({ sourceId, destId }));
}

export function requestRemoveConnection(sourceId: string, destId: string): void {
  sendEvent(EventNames.ConnectionRemove, JSON.stringify({ sourceId, destId }));
}

export function requestSetBlockMix(blockId: string, mix: number): void {
  sendEvent(EventNames.BlockSetMix, JSON.stringify({ blockId, mix }));
}

export function requestSetBlockLevel(blockId: string, level: number): void {
  sendEvent(EventNames.BlockSetLevel, JSON.stringify({ blockId, level }));
}

export function requestSetBlockBalance(blockId: string, balance: number): void {
  sendEvent(EventNames.BlockSetBalance, JSON.stringify({ blockId, balance }));
}

export function requestToggleBlockBypass(blockId: string): void {
  sendEvent(EventNames.BlockToggleBypass, JSON.stringify({ blockId }));
}

export function requestSetBlockBypassMode(blockId: string, bypassMode: string): void {
  sendEvent(EventNames.BlockSetBypassMode, JSON.stringify({ blockId, bypassMode }));
}

export function requestGetTestToneSamples(): void {
  sendEvent(EventNames.InputGetTestToneSamples, '');
}

export function requestSetTestToneSample(blockId: string, sample: string): void {
  sendEvent(EventNames.InputSetTestToneSample, JSON.stringify({ blockId, sample }));
}

export function requestToggleTestTone(blockId: string): void {
  sendEvent(EventNames.InputToggleTestTone, JSON.stringify({ blockId }));
}

export function requestSetBlockColor(blockId: string, color: string): void {
  sendEvent(EventNames.BlockSetColor, JSON.stringify({ blockId, color }));
}

export function requestRenameBlock(blockId: string, name: string): void {
  sendEvent(EventNames.BlockRename, JSON.stringify({ blockId, name }));
}

export function requestCopyBlock(blockId: string): void {
  sendEvent(EventNames.BlockCopy, JSON.stringify({ blockId }));
}

export function requestPasteBlock(col: number, row: number): void {
  sendEvent(EventNames.BlockPaste, JSON.stringify({ col, row }));
}

export function requestSetBlockPlugin(blockId: string, pluginId: string): void {
  sendEvent(EventNames.BlockSetPlugin, JSON.stringify({ blockId, pluginId }));
}

export function requestOpenPluginEditor(blockId: string): void {
  sendEvent(EventNames.BlockOpenEditor, JSON.stringify({ blockId }));
}

export function requestNewSession(): void {
  sendEvent(EventNames.SessionNew, '');
}

export function requestSaveSession(): void {
  sendEvent(EventNames.SessionSave, '');
}

export function requestSaveSessionQuiet(): void {
  sendEvent(EventNames.SessionSaveQuiet, '');
}

export function requestSetGridSize(columns: number, rows: number): void {
  sendEvent(EventNames.GridSetSize, JSON.stringify({ columns, rows }));
}

export function requestLoadSession(): void {
  sendEvent(EventNames.SessionLoad, '');
}

export function requestPickPresetDirectory(): void {
  sendEvent(EventNames.PresetPickDir, '');
}

export function requestLoadPresetByIndex(index: number): void {
  sendEvent(EventNames.PresetLoadByIndex, JSON.stringify({ index }));
}

export function requestRenamePreset(index: number, name: string): void {
  sendEvent(EventNames.PresetRename, JSON.stringify({ index, name }));
}

export function requestDeletePreset(index: number): void {
  sendEvent(EventNames.PresetDelete, JSON.stringify({ index }));
}

export function requestSaveBlockState(blockId: string): void {
  sendEvent(EventNames.BlockStateSave, JSON.stringify({ blockId }));
}

export function requestAddBlockState(blockId: string): void {
  sendEvent(EventNames.BlockStateAdd, JSON.stringify({ blockId }));
}

export function requestRecallBlockState(blockId: string, index: number): void {
  sendEvent(EventNames.BlockStateRecall, JSON.stringify({ blockId, index }));
}

export function requestDeleteBlockState(blockId: string, index: number): void {
  sendEvent(EventNames.BlockStateDelete, JSON.stringify({ blockId, index }));
}

// -- Scene commands -----------------------------------------------------------

export function requestAddScene(): void {
  sendEvent(EventNames.SceneAdd, '{}');
}

export function requestRecallScene(index: number): void {
  sendEvent(EventNames.SceneRecall, JSON.stringify({ index }));
}

export function requestSaveScene(index: number): void {
  sendEvent(EventNames.SceneSave, JSON.stringify({ index }));
}

export function requestRenameScene(index: number, name: string): void {
  sendEvent(EventNames.SceneRename, JSON.stringify({ index, name }));
}

export function requestDeleteScene(index: number): void {
  sendEvent(EventNames.SceneDelete, JSON.stringify({ index }));
}

// -- MIDI mapping commands ----------------------------------------------------

// MIDI shaping defaults — MUST match the engine decode side (engine/bridge /
// MidiMapper). Fields equal to these are omitted from the payload to keep it
// minimal; the engine applies the same default when a field is absent.
const MIDI_CC_MIN_DEFAULT = 0;
const MIDI_CC_MAX_DEFAULT = 127;
const MIDI_THRESHOLD_DEFAULT = 64;
const MIDI_CURVE_DEFAULT: MidiCurve = 'linear';

export interface MidiShapingArgs {
  blockId?: string;
  targetIndex?: number;
  ccMin?: number;
  ccMax?: number;
  paramMin?: number;
  paramMax?: number;
  curve?: MidiCurve;
  threshold?: number;
}

export interface AddMidiMappingArgs extends MidiShapingArgs {
  channel: number;
  cc: number;
  target: string;
}

// Applies the seven optional MIDI-shaping fields to `payload`, omitting any
// that equal the engine's default so the JSON sent to C++ stays minimal.
// Shared by requestAddMidiMapping and requestStartMidiLearn.
function appendMidiShapingFields(payload: Record<string, unknown>, args: MidiShapingArgs): void {
  if (args.targetIndex !== undefined && args.targetIndex >= 0) {
    payload.targetIndex = args.targetIndex;
  }
  if (args.ccMin !== undefined && args.ccMin !== MIDI_CC_MIN_DEFAULT) {
    payload.ccMin = args.ccMin;
  }
  if (args.ccMax !== undefined && args.ccMax !== MIDI_CC_MAX_DEFAULT) {
    payload.ccMax = args.ccMax;
  }
  if (args.paramMin !== undefined && Number.isFinite(args.paramMin)) {
    payload.paramMin = args.paramMin;
  }
  if (args.paramMax !== undefined && Number.isFinite(args.paramMax)) {
    payload.paramMax = args.paramMax;
  }
  if (args.curve !== undefined && args.curve !== MIDI_CURVE_DEFAULT) {
    payload.curve = args.curve;
  }
  if (args.threshold !== undefined && args.threshold !== MIDI_THRESHOLD_DEFAULT) {
    payload.threshold = args.threshold;
  }
}

export function requestAddMidiMapping(args: AddMidiMappingArgs): void {
  const payload: Record<string, unknown> = {
    channel: args.channel,
    cc: args.cc,
    target: args.target,
    blockId: args.blockId ?? '',
  };
  appendMidiShapingFields(payload, args);
  sendEvent(EventNames.MidiAddMapping, JSON.stringify(payload));
}

export function requestRemoveMidiMapping(index: number): void {
  sendEvent(EventNames.MidiRemoveMapping, JSON.stringify({ index }));
}

export function requestClearMidiMappings(): void {
  sendEvent(EventNames.MidiClearMappings, '');
}

export function requestGetMidiMappings(): void {
  sendEvent(EventNames.MidiGetMappings, '');
}

export type StartMidiLearnArgs = Omit<AddMidiMappingArgs, 'channel' | 'cc'>;

export function requestStartMidiLearn(args: StartMidiLearnArgs): void {
  const payload: Record<string, unknown> = {
    target: args.target,
    blockId: args.blockId ?? '',
  };
  appendMidiShapingFields(payload, args);
  sendEvent(EventNames.MidiStartLearn, JSON.stringify(payload));
}

export function requestCancelMidiLearn(): void {
  sendEvent(EventNames.MidiCancelLearn, '');
}

export function requestSetMidiMonitorEnabled(enabled: boolean): void {
  sendEvent(EventNames.MidiSetMonitorEnabled, JSON.stringify({ enabled }));
}

export function requestInjectMidiCC(channel: number, cc: number, value: number): void {
  sendEvent(EventNames.MidiInjectCC, JSON.stringify({ channel, cc, value }));
}

export function requestInjectMidiPC(channel: number, program: number): void {
  sendEvent(EventNames.MidiInjectPC, JSON.stringify({ channel, program }));
}

export function requestSetTunerEnabled(enabled: boolean): void {
  sendEvent(EventNames.TunerSetEnabled, JSON.stringify({ enabled }));
}

export function requestGetReferencePitch(): void {
  sendEvent(EventNames.TunerGetReferencePitch, '');
}

export function requestSetReferencePitch(hz: number): void {
  sendEvent(EventNames.TunerSetReferencePitch, JSON.stringify({ hz }));
}

export function requestScanPlugins(): void {
  sendEvent(EventNames.PluginsScan, '');
}

export function requestGetTelemetryEnabled(): void {
  sendEvent(EventNames.TelemetryGet, '');
}

export function requestSetTelemetryEnabled(enabled: boolean): void {
  sendEvent(EventNames.TelemetrySet, JSON.stringify({ enabled }));
}

export function requestSetDeveloperMode(enabled: boolean): void {
  sendEvent(EventNames.SettingsSetDeveloperMode, JSON.stringify({ enabled }));
}

export function requestPickScanDirectory(): void {
  sendEvent(EventNames.PluginsPickScanDir, '');
}

export function requestRemoveScanDirectory(path: string): void {
  sendEvent(EventNames.PluginsRemoveScanDir, JSON.stringify({ path }));
}

// -- Software update commands -------------------------------------------------

export const requestCheckForUpdates  = () => sendEvent(EventNames.UpdateCheck, '');
export const requestInstallUpdate    = () => sendEvent(EventNames.UpdateInstall, '');
export const requestOpenReleaseNotes = (url: string) =>
  sendEvent(EventNames.UpdateOpenReleaseNotes, JSON.stringify({ url }));

// -- Loudness metering commands -----------------------------------------------

export function requestSetSelectedBlock(blockId: string): void {
  sendEvent(EventNames.LoudnessSetSelectedBlock, JSON.stringify({ blockId }));
}

export function requestSetTargetLufs(blockId: string, lufs: number | null): void {
  sendEvent(EventNames.LoudnessSetTarget, JSON.stringify({ blockId, lufs }));
}

export function requestSetLufsWindow(window: 'momentary' | 'shortTerm'): void {
  sendEvent(EventNames.LoudnessSetWindow, JSON.stringify({ window }));
}

// -- Core bridge -------------------------------------------------------------

export function sendEvent(eventName: InboundEventName, payload: string): void {
  if (!bridgeReady) {
    console.warn('[Bridge] Not connected — event not sent:', eventName);
    return;
  }
  callNativeFunction('sendToNative', eventName, payload);
  console.log(`[Bridge] TX ${eventName}:`, payload);
}

// Typed wrapper around juce.backend.addEventListener -- registering a
// handler for an inbound-only name fails at compile time. Engine emits
// flow through this helper exclusively.
function onEngineEvent(
  juce: NonNullable<Window['__JUCE__']>,
  name: OutboundEventName,
  handler: (detail: unknown) => void,
): void {
  juce.backend.addEventListener(name, handler);
}

export function initBridge(): void {
  const juce = window.__JUCE__;

  if (!juce) {
    console.warn('[Bridge] JUCE backend not available — running outside plugin');
    return;
  }

  console.log('[Bridge] Initialising...');

  // Startup progress
  onEngineEvent(juce, EventNames.LifecycleStartupProgress, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setLoadingStatus(String(d.status), Number(d.progress));
  });

  onEngineEvent(juce, EventNames.LifecycleStartupComplete, () => {
    console.log('[Bridge] RX startupComplete');
    useStore.getState().setLoading(false);
    // Signal native to show WebView after React paints
    requestAnimationFrame(() => sendEvent(EventNames.LifecycleUiReady, ''));
  });

  // Screenshot automation
  onEngineEvent(juce, EventNames.LifecycleScreenshotSetup, (detail: unknown) => {
    const d = asRecord(detail);

    // Apply theme before navigation so first paint is in the correct mode.
    const theme = d.theme;
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      import('../store/theme').then(({ useThemeStore }) => {
        useThemeStore.getState().setTheme(theme);
      });
    }

    // Navigate to page
    const page = String(d.page || 'grid');
    useStore.getState().setActiveTab(page);

    // Delay actions to allow graph state to arrive and render
    setTimeout(() => {
      const store = useStore.getState();
      const actions = d.actions as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(actions)) {
        for (const action of actions) {
          if (action.selectBlock) {
            const val = action.selectBlock;
            if (typeof val === 'string') {
              // Select by block ID
              const block = store.blocks.find((b) => b.id === val);
              if (block) store.selectBlock(block.id);
            } else {
              // Select by grid position (legacy)
              const pos = val as Record<string, unknown>;
              const col = Number(pos.col);
              const row = Number(pos.row);
              const block = store.blocks.find((b) => b.col === col && b.row === row);
              if (block) store.selectBlock(block.id);
            }
          } else if (action.setTestToneSample) {
            const val = action.setTestToneSample as Record<string, unknown>;
            const blockId = String(val.blockId ?? '');
            const sample = String(val.sample ?? '');
            if (blockId) requestSetTestToneSample(blockId, sample);
          } else if (action.toggleTestTone) {
            const blockId = String(action.toggleTestTone);
            if (blockId) requestToggleTestTone(blockId);
          }
        }
      }

      // Wait for render then signal ready
      setTimeout(() => sendEvent(EventNames.LifecycleScreenshotReady, ''), 500);
    }, 1000);
  });

  // Welcome / connection
  onEngineEvent(juce, EventNames.LifecycleWelcome, (detail: unknown) => {
    console.log('[Bridge] RX welcome:', extractMessage(detail));
    useStore.getState().setConnected(true);
  });

  onEngineEvent(juce, EventNames.InputTestToneSamplesUpdated, (detail: unknown) => {
    const d = asRecord(detail);
    const samples = Array.isArray(d.samples) ? (d.samples as unknown[]).map(String) : [];
    useStore.getState().setTestToneSamples(samples);
  });

  onEngineEvent(juce, EventNames.InputTestToneSampleChanged, (detail: unknown) => {
    const d = asRecord(detail);
    const blockId = String(d.blockId);
    const sample = String(d.sample);
    useStore.getState().setTestToneSample(sample);
    // Store per-block
    useStore.setState((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, testToneSample: sample } : b)),
    }));
  });

  onEngineEvent(juce, EventNames.InputTestToneChanged, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX testToneChanged:', d);
    useStore.getState().setBlockTestTone(String(d.blockId), Boolean(d.enabled));
  });

  onEngineEvent(juce, EventNames.BlockMixChanged, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockMix(String(d.blockId), Number(d.mix));
  });

  onEngineEvent(juce, EventNames.BlockLevelChanged, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockLevel(String(d.blockId), Number(d.level));
  });

  onEngineEvent(juce, EventNames.BlockBalanceChanged, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockBalance(String(d.blockId), Number(d.balance));
  });

  onEngineEvent(juce, EventNames.BlockBypassChanged, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockBypassed(String(d.blockId), Boolean(d.bypassed));
  });

  onEngineEvent(juce, EventNames.BlockBypassModeChanged, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockBypassMode(String(d.blockId), String(d.bypassMode));
  });

  // Graph confirmations from C++
  onEngineEvent(juce, EventNames.BlockCopied, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setClipboardBlockType(String(d.type));
  });

  onEngineEvent(juce, EventNames.BlockAdded, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX blockAdded:', d);
    const blockId = String(d.id);
    useStore.getState().addBlock({
      id: blockId,
      type: String(d.type),
      name: String(d.name),
      col: Number(d.col),
      row: Number(d.row),
      nodeId: Number(d.nodeId),
    });
    useStore.getState().selectBlock(blockId);
  });

  onEngineEvent(juce, EventNames.BlockRemoved, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX blockRemoved:', d);
    useStore.getState().removeBlock(String(d.blockId));
  });

  onEngineEvent(juce, EventNames.BlockMoved, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX blockMoved:', d);
    useStore.getState().moveBlock(String(d.blockId), Number(d.col), Number(d.row));
  });

  onEngineEvent(juce, EventNames.ConnectionAdded, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX connectionAdded:', d);
    useStore.getState().addConnection({
      sourceId: String(d.sourceId),
      destId: String(d.destId),
    });
  });

  onEngineEvent(juce, EventNames.ConnectionRemoved, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX connectionRemoved:', d);
    useStore.getState().removeConnection(String(d.sourceId), String(d.destId));
  });

  onEngineEvent(juce, EventNames.BlockColorChanged, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockColor(String(d.blockId), String(d.blockColor));
  });

  onEngineEvent(juce, EventNames.BlockRenamed, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setBlockDisplayName(String(d.blockId), String(d.displayName));
  });

  onEngineEvent(juce, EventNames.BlockPluginSet, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX blockPluginSet:', d);
    useStore
      .getState()
      .setBlockPlugin(
        String(d.blockId),
        String(d.pluginId),
        String(d.pluginName),
        String(d.pluginFormat),
        Boolean(d.hasEditor),
      );
  });

  onEngineEvent(juce, EventNames.GraphState, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX graphState');
    const blocks = (Array.isArray(d.blocks) ? d.blocks : []).map((b: unknown) => {
      const r = asRecord(b);
      return {
        id: String(r.id),
        type: String(r.type),
        name: String(r.name),
        col: Number(r.col),
        row: Number(r.row),
        nodeId: Number(r.nodeId),
        displayName: r.displayName ? String(r.displayName) : undefined,
        blockColor: r.blockColor ? String(r.blockColor) : undefined,
        pluginId: r.pluginId ? String(r.pluginId) : undefined,
        pluginName: r.pluginName ? String(r.pluginName) : undefined,
        pluginFormat: r.pluginFormat ? String(r.pluginFormat) : undefined,
        pluginMissing: r.pluginMissing ? Boolean(r.pluginMissing) : undefined,
        mix: r.mix !== undefined ? Number(r.mix) : undefined,
        balance: r.balance !== undefined ? Number(r.balance) : undefined,
        level: r.level !== undefined ? Number(r.level) : undefined,
        bypassed: r.bypassed ? Boolean(r.bypassed) : undefined,
        bypassMode: r.bypassMode ? String(r.bypassMode) : undefined,
        numStates: r.numStates !== undefined ? Number(r.numStates) : undefined,
        activeStateIndex: r.activeStateIndex !== undefined ? Number(r.activeStateIndex) : undefined,
        dirtyStates: Array.isArray(r.dirtyStates)
          ? (r.dirtyStates as unknown[]).map(Number)
          : undefined,
      } satisfies GridBlock;
    });
    const connections = (Array.isArray(d.connections) ? d.connections : []).map((c: unknown) => {
      const r = asRecord(c);
      return {
        sourceId: String(r.sourceId),
        destId: String(r.destId),
      } satisfies Connection;
    });
    useStore.getState().syncGraph(blocks, connections);
  });

  onEngineEvent(juce, EventNames.GridState, (detail: unknown) => {
    const d = asRecord(detail);
    const columns = Number(d.columns);
    const rows = Number(d.rows);
    if (Number.isFinite(columns) && Number.isFinite(rows)) {
      useStore.getState().setGridSize(columns, rows);
    }
  });

  onEngineEvent(juce, EventNames.PluginsScanStarted, () => {
    useStore.getState().setScanning(true);
  });

  onEngineEvent(juce, EventNames.PluginsListUpdated, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX pluginListUpdated');
    const plugins = (Array.isArray(d.plugins) ? d.plugins : []).map((p: unknown) => {
      const r = asRecord(p);
      return {
        id: String(r.id),
        name: String(r.name),
        manufacturer: String(r.manufacturer),
        format: String(r.format),
      } satisfies PluginInfo;
    });
    useStore.getState().setAvailablePlugins(plugins);
  });

  onEngineEvent(juce, EventNames.PluginsScanDirsUpdated, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX scanDirectoriesUpdated');
    const dirs = (Array.isArray(d.directories) ? d.directories : []).map((dir: unknown) => {
      const r = asRecord(dir);
      return {
        path: String(r.path),
        isDefault: Boolean(r.isDefault),
      } satisfies ScanDirectory;
    });
    useStore.getState().setScanDirectories(dirs);
  });

  onEngineEvent(juce, EventNames.PresetListUpdated, (detail: unknown) => {
    const d = asRecord(detail);
    console.log('[Bridge] RX presetListUpdated');
    const files = (Array.isArray(d.files) ? d.files : []).map(String);
    useStore.getState().setPresetList(String(d.directory), files, Number(d.currentIndex));
  });

  onEngineEvent(juce, EventNames.PresetLoadStarted, () => {
    useStore.getState().setIsLoadingPreset(true);
  });

  onEngineEvent(juce, EventNames.PresetLoadFinished, () => {
    useStore.getState().setIsLoadingPreset(false);
  });

  onEngineEvent(juce, EventNames.BlockStateChanged, (detail: unknown) => {
    const d = asRecord(detail);
    const dirty = Array.isArray(d.dirtyStates) ? (d.dirtyStates as unknown[]).map(Number) : [];
    useStore
      .getState()
      .setBlockStates(String(d.blockId), Number(d.numStates), Number(d.activeStateIndex), dirty);
  });

  onEngineEvent(juce, EventNames.ScenesChanged, (detail: unknown) => {
    const d = asRecord(detail);
    const scenes = (Array.isArray(d.scenes) ? d.scenes : []).map((s: unknown) => {
      const r = asRecord(s);
      const mapRaw = asRecord(r.blockStateMap);
      const blockStateMap: Record<string, number> = {};
      for (const [k, v] of Object.entries(mapRaw)) blockStateMap[k] = Number(v);
      return { name: String(r.name), blockStateMap } satisfies Scene;
    });
    useStore.getState().setScenes(scenes, Number(d.activeSceneIndex));
  });

  onEngineEvent(juce, EventNames.MidiMappingsChanged, (detail: unknown) => {
    const d = asRecord(detail);
    const mappings = (Array.isArray(d.mappings) ? d.mappings : []).map((m: unknown) => {
      const r = asRecord(m);
      return {
        channel: typeof r.channel === 'number' ? r.channel : Number(r.channel),
        cc: typeof r.cc === 'number' ? r.cc : Number(r.cc),
        target: typeof r.target === 'string' ? r.target : String(r.target),
        blockId: r.blockId ? String(r.blockId) : undefined,
        targetIndex: typeof r.targetIndex === 'number' ? r.targetIndex : undefined,
        ccMin: typeof r.ccMin === 'number' ? r.ccMin : undefined,
        ccMax: typeof r.ccMax === 'number' ? r.ccMax : undefined,
        paramMin: typeof r.paramMin === 'number' ? r.paramMin : undefined,
        paramMax: typeof r.paramMax === 'number' ? r.paramMax : undefined,
        curve: (r.curve === 'linear' || r.curve === 'log' || r.curve === 'exp' || r.curve === 'sigmoid')
          ? (r.curve as MidiCurve)
          : undefined,
        threshold: typeof r.threshold === 'number' ? r.threshold : undefined,
      } satisfies MidiMapping;
    });
    useStore.getState().setMidiMappings(mappings, Boolean(d.learning));
  });

  onEngineEvent(juce, EventNames.MidiMonitorData, (detail: unknown) => {
    const d = asRecord(detail);
    const events = (Array.isArray(d.events) ? d.events : []).map((e: unknown) => {
      const r = asRecord(e);
      return {
        type: String(r.type),
        channel: Number(r.channel),
        data1: Number(r.data1),
        data2: Number(r.data2),
      } satisfies MidiMonitorEvent;
    });
    if (events.length > 0) {
      const store = useStore.getState();
      store.appendMidiMonitorEvents(events);
      store.updateMidiActivity(events);
    }
  });

  onEngineEvent(juce, EventNames.MidiLearnComplete, () => {
    // mappingsChanged will follow with the updated list
  });

  onEngineEvent(juce, EventNames.TunerData, (detail: unknown) => {
    const d = asRecord(detail);
    useStore
      .getState()
      .setTunerData(
        d.note ? String(d.note) : null,
        Number(d.octave),
        Number(d.cents),
        Number(d.frequency),
        Number(d.confidence),
      );
  });

  onEngineEvent(juce, EventNames.SystemStats, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setCpuPercent(Number(d.cpu));
  });

  onEngineEvent(juce, EventNames.SessionSaved, () => {
    useStore.getState().setJustSaved(true);
    setTimeout(() => useStore.getState().setJustSaved(false), 1200);
  });

  onEngineEvent(juce, EventNames.TunerReferencePitchState, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setReferencePitch(Number(d.hz));
  });

  // MIDI-driven tuner toggle (Phase 10) — engine fires this when a CC
  // mapped to `tunerToggle` crosses its threshold. Switch the active tab
  // to / from the Tuner so the user actually sees the surface they just
  // activated, instead of pitch detection running silently.
  onEngineEvent(juce, EventNames.TunerActiveState, (detail: unknown) => {
    const d = asRecord(detail);
    const active = Boolean(d.active);
    const store = useStore.getState();
    if (active) {
      if (store.activeTab !== 'tuner') store.setActiveTab('tuner');
    } else if (store.activeTab === 'tuner') {
      store.setActiveTab('grid');
    }
  });

  onEngineEvent(juce, EventNames.SettingsDeveloperModeState, (detail: unknown) => {
    const d = asRecord(detail);
    useStore.getState().setDeveloperModeEnabled(Boolean(d.enabled));
  });

  onEngineEvent(juce, EventNames.TelemetryState, (detail: unknown) => {
    const d = asRecord(detail);
    const enabled = Boolean(d.enabled);
    const wasEnabled = useStore.getState().telemetryEnabled;
    useStore.getState().setTelemetryEnabled(enabled);

    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    if (enabled && dsn && !Sentry.getClient()) {
      Sentry.init({
        dsn,
        release: `stellarr@${__APP_VERSION__}`,
        environment: (import.meta.env.VITE_SENTRY_ENV as string) ?? 'development',
      });

      // Verify the pipeline works on first opt-in
      if (!wasEnabled) {
        Sentry.captureMessage('Telemetry enabled', 'info');
      }
    }
  });

  onEngineEvent(juce, EventNames.LoudnessBlockMetrics, (detail: unknown) => {
    const d = asRecord(detail);
    const rawBlocks = Array.isArray(d.blocks) ? d.blocks : [];
    const samples = rawBlocks.map((b: unknown) => {
      const r = asRecord(b);
      return {
        id: String(r.id),
        lufs: Number(r.lufs),
        targetLufs: r.targetLufs !== undefined ? Number(r.targetLufs) : null,
      };
    });
    useStore.getState().setBlockLufs(samples);

    // Push history sample for currently selected block
    const selectedId = useStore.getState().selectedBlockId;
    const selectedSample = samples.find((s) => s.id === selectedId);
    if (selectedSample) useStore.getState().pushLoudnessSample(selectedSample.lufs);
  });

  onEngineEvent(juce, EventNames.LoudnessWindowState, (detail: unknown) => {
    const d = asRecord(detail);
    const window = String(d.window);
    if (window === 'momentary' || window === 'shortTerm') {
      useStore.getState().setLufsWindow(window);
    }
  });

  onEngineEvent(juce, EventNames.SystemAppConfig, (detail: unknown) => {
    const d = asRecord(detail);
    const flavour = String(d.flavour);
    if (flavour === 'prod' || flavour === 'dev') {
      useStore.getState().setFlavour(flavour);
    }
  });

  onEngineEvent(juce, EventNames.UpdateState, (detail: unknown) => {
    const d = asRecord(detail);
    const status = String(d.status) as UpdateStatus;
    if (!['idle', 'checking', 'available', 'no-update', 'downloading', 'ready', 'error'].includes(status)) return;
    useStore.getState().setSoftwareUpdate({
      status,
      latestVersion:    String(d.latestVersion ?? ''),
      releasedAt:       String(d.releasedAt ?? ''),
      sizeBytes:        Number(d.sizeBytes ?? 0),
      releaseNotesUrl:  String(d.releaseNotesUrl ?? ''),
      downloadProgress: Number(d.downloadProgress ?? 0),
      error:            String(d.error ?? ''),
    });
  });

  bridgeReady = true;
  callNativeFunction('sendToNative', EventNames.LifecycleBridgeReady, '');
  console.log('[Bridge] TX bridgeReady');
}
