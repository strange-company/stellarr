import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUiPrefsStore } from '../../../store/uiPrefs';
import { useGridLayout, ZOOM_PRESETS } from '../layout';

describe('useGridLayout', () => {
  beforeEach(() => {
    useUiPrefsStore.getState().setCellZoom('M');
  });

  it('returns the M preset by default', () => {
    const { result } = renderHook(() => useGridLayout());
    expect(result.current.cellSize).toBe(ZOOM_PRESETS.M.cellSize);
    expect(result.current.gap).toBe(ZOOM_PRESETS.M.gap);
    expect(result.current.step).toBe(ZOOM_PRESETS.M.cellSize + ZOOM_PRESETS.M.gap);
  });

  it('reflects the current zoom level', () => {
    useUiPrefsStore.getState().setCellZoom('L');
    const { result } = renderHook(() => useGridLayout());
    expect(result.current.cellSize).toBe(ZOOM_PRESETS.L.cellSize);
    expect(result.current.gap).toBe(ZOOM_PRESETS.L.gap);
  });

  describe('gridWidth / gridHeight', () => {
    it('returns 0 for 0 cells (no negative-gap underflow)', () => {
      const { result } = renderHook(() => useGridLayout());
      expect(result.current.gridWidth(0)).toBe(0);
      expect(result.current.gridHeight(0)).toBe(0);
    });

    it('returns just cellSize for 1 cell (no trailing gap)', () => {
      const { result } = renderHook(() => useGridLayout());
      expect(result.current.gridWidth(1)).toBe(ZOOM_PRESETS.M.cellSize);
      expect(result.current.gridHeight(1)).toBe(ZOOM_PRESETS.M.cellSize);
    });

    it('returns cells + gaps for N >= 2', () => {
      const { result } = renderHook(() => useGridLayout());
      const { cellSize, gap } = ZOOM_PRESETS.M;
      expect(result.current.gridWidth(3)).toBe(3 * cellSize + 2 * gap);
      expect(result.current.gridHeight(5)).toBe(5 * cellSize + 4 * gap);
    });
  });

  describe('cellLeft / cellTop', () => {
    it('places col 0 / row 0 at origin', () => {
      const { result } = renderHook(() => useGridLayout());
      expect(result.current.cellLeft(0)).toBe(0);
      expect(result.current.cellTop(0)).toBe(0);
    });

    it('advances by step per col / row', () => {
      const { result } = renderHook(() => useGridLayout());
      const { cellSize, gap } = ZOOM_PRESETS.M;
      const step = cellSize + gap;
      expect(result.current.cellLeft(2)).toBe(2 * step);
      expect(result.current.cellTop(3)).toBe(3 * step);
    });
  });

  describe('outputPortX / inputPortX', () => {
    it('inputPortX matches cellLeft', () => {
      const { result } = renderHook(() => useGridLayout());
      expect(result.current.inputPortX(2)).toBe(result.current.cellLeft(2));
    });

    it('outputPortX = cellLeft + cellSize (right edge)', () => {
      const { result } = renderHook(() => useGridLayout());
      const { cellSize } = ZOOM_PRESETS.M;
      expect(result.current.outputPortX(0)).toBe(cellSize);
      expect(result.current.outputPortX(2)).toBe(result.current.cellLeft(2) + cellSize);
    });
  });

  describe('connectionY', () => {
    it('returns vertical centre when count <= 1', () => {
      const { result } = renderHook(() => useGridLayout());
      const { cellSize, gap } = ZOOM_PRESETS.M;
      const step = cellSize + gap;
      const expectedCentre = 1 * step + cellSize / 2;
      expect(result.current.connectionY(1, 1, 0)).toBe(expectedCentre);
      expect(result.current.connectionY(1, 0, 0)).toBe(expectedCentre);
    });

    it('fans connections symmetrically around the centre when count > 1', () => {
      const { result } = renderHook(() => useGridLayout());
      const { cellSize, gap } = ZOOM_PRESETS.M;
      const step = cellSize + gap;
      const centre = 0 * step + cellSize / 2;

      const y0 = result.current.connectionY(0, 2, 0);
      const y1 = result.current.connectionY(0, 2, 1);
      // index 0 sits below the centre (negative offset), index 1 above.
      expect((y0 + y1) / 2).toBe(centre);
      expect(y1 - y0).toBeGreaterThan(0);
    });

    it('caps the per-connection gap at 16px', () => {
      const { result } = renderHook(() => useGridLayout());
      // With cellSize 88, (cellSize - 8)/count = (88-8)/2 = 40 — capped to 16.
      const y0 = result.current.connectionY(0, 2, 0);
      const y1 = result.current.connectionY(0, 2, 1);
      expect(y1 - y0).toBe(16);
    });
  });
});
