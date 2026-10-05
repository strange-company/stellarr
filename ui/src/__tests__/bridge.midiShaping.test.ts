import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initBridge,
  requestAddMidiMapping,
  requestStartMidiLearn,
  type AddMidiMappingArgs,
  type StartMidiLearnArgs,
} from '../bridge';

// Locks the exact JSON payload the bridge emits for MIDI-shaping requests.
// The C++ decode side (engine/bridge/MidiHandler.cpp / MidiMapper) relies on
// the precise field set and on defaults being omitted rather than sent
// explicitly — this test must keep passing, byte-for-byte, across the
// bridge.ts de-duplication refactor (targetIndex/ccMin/ccMax/paramMin/
// paramMax/curve/threshold guards).
describe('bridge MIDI-shaping payload encoding', () => {
  let emitEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitEvent = vi.fn();
    window.__JUCE__ = {
      backend: {
        addEventListener: vi.fn((): [string, number] => ['id', 0]),
        emitEvent: emitEvent as (eventId: string, payload: unknown) => void,
      },
      initialisationData: { __juce__functions: [] },
    };
    initBridge();
    emitEvent.mockClear();
  });

  function capturePayload(): unknown {
    expect(emitEvent).toHaveBeenCalledTimes(1);
    const [eventId, invokePayload] = emitEvent.mock.calls[0] as [string, Record<string, unknown>];
    expect(eventId).toBe('__juce__invoke');
    const [, jsonPayload] = invokePayload.params as [string, string];
    return JSON.parse(jsonPayload);
  }

  describe('requestAddMidiMapping', () => {
    it('omits every optional shaping field when args carry only defaults', () => {
      const args: AddMidiMappingArgs = { channel: 1, cc: 20, target: 'blockMix' };
      requestAddMidiMapping(args);
      expect(capturePayload()).toEqual({
        channel: 1,
        cc: 20,
        target: 'blockMix',
        blockId: '',
      });
    });

    it('includes every optional shaping field when all differ from defaults', () => {
      const args: AddMidiMappingArgs = {
        channel: 2,
        cc: 30,
        target: 'blockLevel',
        blockId: 'blk-1',
        targetIndex: 3,
        ccMin: 10,
        ccMax: 100,
        paramMin: -1,
        paramMax: 1,
        curve: 'log',
        threshold: 90,
      };
      requestAddMidiMapping(args);
      expect(capturePayload()).toEqual({
        channel: 2,
        cc: 30,
        target: 'blockLevel',
        blockId: 'blk-1',
        targetIndex: 3,
        ccMin: 10,
        ccMax: 100,
        paramMin: -1,
        paramMax: 1,
        curve: 'log',
        threshold: 90,
      });
    });

    it('omits fields that equal the engine defaults even when explicitly set', () => {
      const args: AddMidiMappingArgs = {
        channel: 1,
        cc: 20,
        target: 'blockMix',
        targetIndex: -1,
        ccMin: 0,
        ccMax: 127,
        paramMin: NaN,
        paramMax: NaN,
        curve: 'linear',
        threshold: 64,
      };
      requestAddMidiMapping(args);
      expect(capturePayload()).toEqual({
        channel: 1,
        cc: 20,
        target: 'blockMix',
        blockId: '',
      });
    });

    it('includes a partial subset of non-default shaping fields', () => {
      const args: AddMidiMappingArgs = {
        channel: 1,
        cc: 20,
        target: 'blockMix',
        ccMax: 110,
        threshold: 40,
      };
      requestAddMidiMapping(args);
      expect(capturePayload()).toEqual({
        channel: 1,
        cc: 20,
        target: 'blockMix',
        blockId: '',
        ccMax: 110,
        threshold: 40,
      });
    });
  });

  describe('requestStartMidiLearn', () => {
    it('omits every optional shaping field when args carry only defaults', () => {
      const args: StartMidiLearnArgs = { target: 'blockMix' };
      requestStartMidiLearn(args);
      expect(capturePayload()).toEqual({
        target: 'blockMix',
        blockId: '',
      });
    });

    it('includes every optional shaping field when all differ from defaults', () => {
      const args: StartMidiLearnArgs = {
        target: 'blockLevel',
        blockId: 'blk-2',
        targetIndex: 5,
        ccMin: 5,
        ccMax: 120,
        paramMin: 0.1,
        paramMax: 0.9,
        curve: 'sigmoid',
        threshold: 100,
      };
      requestStartMidiLearn(args);
      expect(capturePayload()).toEqual({
        target: 'blockLevel',
        blockId: 'blk-2',
        targetIndex: 5,
        ccMin: 5,
        ccMax: 120,
        paramMin: 0.1,
        paramMax: 0.9,
        curve: 'sigmoid',
        threshold: 100,
      });
    });

    it('omits fields that equal the engine defaults even when explicitly set', () => {
      const args: StartMidiLearnArgs = {
        target: 'blockMix',
        targetIndex: -1,
        ccMin: 0,
        ccMax: 127,
        paramMin: NaN,
        paramMax: NaN,
        curve: 'linear',
        threshold: 64,
      };
      requestStartMidiLearn(args);
      expect(capturePayload()).toEqual({
        target: 'blockMix',
        blockId: '',
      });
    });

    it('includes a partial subset of non-default shaping fields', () => {
      const args: StartMidiLearnArgs = {
        target: 'blockMix',
        paramMin: -0.5,
        curve: 'exp',
      };
      requestStartMidiLearn(args);
      expect(capturePayload()).toEqual({
        target: 'blockMix',
        blockId: '',
        paramMin: -0.5,
        curve: 'exp',
      });
    });
  });
});
