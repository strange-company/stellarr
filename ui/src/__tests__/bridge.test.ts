import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventNames } from '../bridge/eventNames';
import { initBridge } from '../bridge';
import { useStore } from '../store';

// The dynamic theme-store import inside the screenshotSetup handler resolves
// to a store whose setTheme() throws, so the promise chain rejects the same
// way a real chunk-load failure would — letting us exercise the .catch()
// path (Finding E) without fighting Vitest's mocker over a factory that
// itself throws. No other module reachable from this test file imports
// '../store/theme' statically, so the mock is safely scoped to this file.
vi.mock('../store/theme', () => ({
  useThemeStore: {
    getState: () => ({
      setTheme: () => {
        throw new Error('theme store unavailable');
      },
    }),
  },
}));

vi.mock('@sentry/browser', () => ({
  init: vi.fn(),
  getClient: vi.fn(() => undefined),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/browser';

type Listener = (payload: unknown) => void;

let listeners: Map<string, Listener>;

function installJuceStub(): Map<string, Listener> {
  const map = new Map<string, Listener>();
  window.__JUCE__ = {
    backend: {
      addEventListener: vi.fn((eventId: string, callback: Listener) => {
        map.set(eventId, callback);
        return [eventId, 0] as [string, number];
      }),
      emitEvent: vi.fn(),
    },
    initialisationData: { __juce__functions: [] },
  };
  return map;
}

// Invokes the handler registered for `eventName` exactly as JUCE would —
// i.e. through the onEngineEvent wrapper, not the raw handler.
function dispatch(eventName: string, detail: unknown): void {
  const handler = listeners.get(eventName);
  if (!handler) throw new Error(`No listener registered for "${eventName}"`);
  handler(detail);
}

const realAddBlock = useStore.getState().addBlock;

beforeEach(() => {
  vi.restoreAllMocks();
  // The Sentry module mock's vi.fn()s aren't spies on a real implementation,
  // so restoreAllMocks() doesn't clear their call history/impls — reset them
  // explicitly so each test starts from a clean slate.
  vi.mocked(Sentry.init).mockReset();
  vi.mocked(Sentry.getClient).mockReset().mockReturnValue(undefined);
  vi.mocked(Sentry.captureMessage).mockReset();
  vi.mocked(Sentry.captureException).mockReset();
  listeners = installJuceStub();
  useStore.setState({
    blocks: [],
    connections: [],
    activeTab: 'grid',
    telemetryEnabled: false,
    addBlock: realAddBlock,
  });
  initBridge();
});

afterEach(() => {
  useStore.setState({ addBlock: realAddBlock });
  vi.unstubAllEnvs();
});

describe('onEngineEvent error boundary (Finding A)', () => {
  it('catches a handler that throws instead of letting it escape', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useStore.setState({
      addBlock: () => {
        throw new Error('boom');
      },
    });

    expect(() =>
      dispatch(EventNames.BlockAdded, {
        id: 'b1',
        type: 'gain',
        name: 'Gain',
        col: 0,
        row: 0,
        nodeId: 1,
      }),
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalled();
    const loggedEventName = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes(EventNames.BlockAdded)),
    );
    expect(loggedEventName).toBe(true);
  });
});

describe('telemetry opt-in Sentry guard (Finding B)', () => {
  it('does not throw out of the handler when Sentry.init throws', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://fakepublickey@o0.ingest.sentry.io/0');
    vi.mocked(Sentry.getClient).mockReturnValue(undefined);
    vi.mocked(Sentry.init).mockImplementation(() => {
      throw new Error('bad dsn');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => dispatch(EventNames.TelemetryState, { enabled: true })).not.toThrow();

    expect(errorSpy).toHaveBeenCalled();
    // Telemetry opt-in itself must still register even though Sentry failed.
    expect(useStore.getState().telemetryEnabled).toBe(true);
  });

  it('happy path: Sentry.init still runs normally when it does not throw', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://fakepublickey@o0.ingest.sentry.io/0');
    vi.mocked(Sentry.getClient).mockReturnValue(undefined);

    dispatch(EventNames.TelemetryState, { enabled: true });

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Telemetry enabled', 'info');
    expect(useStore.getState().telemetryEnabled).toBe(true);
  });
});

describe('screenshotSetup tab validation (Finding C)', () => {
  it('ignores an unknown tab id instead of applying it', async () => {
    vi.useFakeTimers();
    try {
      dispatch(EventNames.LifecycleScreenshotSetup, { page: 'not-a-real-tab' });
      await vi.runAllTimersAsync();
      expect(useStore.getState().activeTab).toBe('grid'); // unchanged from beforeEach seed
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies a known, valid tab id', async () => {
    vi.useFakeTimers();
    try {
      dispatch(EventNames.LifecycleScreenshotSetup, { page: 'settings' });
      await vi.runAllTimersAsync();
      expect(useStore.getState().activeTab).toBe('settings');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('numeric coercion guards (Finding D)', () => {
  it('blockAdded: skips a block with a non-numeric coordinate instead of storing NaN', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    dispatch(EventNames.BlockAdded, {
      id: 'b2',
      type: 'gain',
      name: 'Gain',
      col: 'abc',
      row: 1,
      nodeId: 2,
    });

    expect(useStore.getState().blocks).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('blockAdded: skips a block with a missing coordinate instead of storing NaN', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    dispatch(EventNames.BlockAdded, {
      id: 'b2',
      type: 'gain',
      name: 'Gain',
      row: 1,
      nodeId: 2,
      // col intentionally omitted
    });

    expect(useStore.getState().blocks).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('blockMoved: leaves the block untouched when a coordinate is malformed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useStore.setState({
      blocks: [{ id: 'b1', type: 'gain', name: 'Gain', col: 0, row: 0, nodeId: 1 }],
    });

    dispatch(EventNames.BlockMoved, { blockId: 'b1', col: 2 /* row missing */ });

    expect(useStore.getState().blocks).toEqual([
      { id: 'b1', type: 'gain', name: 'Gain', col: 0, row: 0, nodeId: 1 },
    ]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('graphState: drops only the malformed block, keeps valid ones', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    dispatch(EventNames.GraphState, {
      blocks: [
        { id: 'b1', type: 'gain', name: 'Gain', col: 0, row: 0, nodeId: 1 },
        { id: 'b2', type: 'amp', name: 'Amp', col: 'bad', row: 1, nodeId: 2 },
      ],
      connections: [],
    });

    const ids = useStore.getState().blocks.map((b) => b.id);
    expect(ids).toEqual(['b1']);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('happy-path regression: valid payloads route through unchanged', () => {
  it('blockAdded with valid numeric fields adds the block and selects it', () => {
    dispatch(EventNames.BlockAdded, {
      id: 'b3',
      type: 'amp',
      name: 'Amp',
      col: 2,
      row: 3,
      nodeId: 9,
    });

    expect(useStore.getState().blocks).toEqual([
      { id: 'b3', type: 'amp', name: 'Amp', col: 2, row: 3, nodeId: 9 },
    ]);
    expect(useStore.getState().selectedBlockId).toBe('b3');
  });

  it('blockMoved with valid numeric fields updates the block position', () => {
    useStore.setState({
      blocks: [{ id: 'b1', type: 'gain', name: 'Gain', col: 0, row: 0, nodeId: 1 }],
    });

    dispatch(EventNames.BlockMoved, { blockId: 'b1', col: 4, row: 5 });

    expect(useStore.getState().blocks).toEqual([
      { id: 'b1', type: 'gain', name: 'Gain', col: 4, row: 5, nodeId: 1 },
    ]);
  });

  it('graphState with fully valid blocks/connections syncs identically to before', () => {
    dispatch(EventNames.GraphState, {
      blocks: [
        {
          id: 'b1',
          type: 'gain',
          name: 'Gain',
          col: 0,
          row: 0,
          nodeId: 1,
          displayName: 'My Gain',
          blockColor: '#ff0000',
          mix: 0.5,
          balance: 0,
          level: -3,
          // Note: true, not false — the pre-existing (unrelated-to-this-task)
          // mapping uses a truthy check (`r.bypassed ? ... : undefined`), so
          // `false` already maps to `undefined` today. That quirk predates
          // this change and is intentionally left untouched here.
          bypassed: true,
          bypassMode: 'hard',
        },
        { id: 'b2', type: 'amp', name: 'Amp', col: 1, row: 0, nodeId: 2 },
      ],
      connections: [{ sourceId: 'b1', destId: 'b2' }],
    });

    const state = useStore.getState();
    expect(state.blocks).toEqual([
      {
        id: 'b1',
        type: 'gain',
        name: 'Gain',
        col: 0,
        row: 0,
        nodeId: 1,
        displayName: 'My Gain',
        blockColor: '#ff0000',
        pluginId: undefined,
        pluginName: undefined,
        pluginFormat: undefined,
        pluginMissing: undefined,
        mix: 0.5,
        balance: 0,
        level: -3,
        bypassed: true,
        bypassMode: 'hard',
        numStates: undefined,
        activeStateIndex: undefined,
        dirtyStates: undefined,
      },
      {
        id: 'b2',
        type: 'amp',
        name: 'Amp',
        col: 1,
        row: 0,
        nodeId: 2,
        displayName: undefined,
        blockColor: undefined,
        pluginId: undefined,
        pluginName: undefined,
        pluginFormat: undefined,
        pluginMissing: undefined,
        mix: undefined,
        balance: undefined,
        level: undefined,
        bypassed: undefined,
        bypassMode: undefined,
        numStates: undefined,
        activeStateIndex: undefined,
        dirtyStates: undefined,
      },
    ]);
    expect(state.connections).toEqual([{ sourceId: 'b1', destId: 'b2' }]);
  });
});

describe('screenshotSetup dynamic theme import (Finding E)', () => {
  it('does not produce an unhandled rejection when the theme chunk fails to load', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      dispatch(EventNames.LifecycleScreenshotSetup, { theme: 'dark', page: 'grid' });
      await vi.runAllTimersAsync();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
