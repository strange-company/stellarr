import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFloatingPanel } from '../useFloatingPanel';

const GUTTER = 16;

function mockDimensions(
  el: HTMLElement,
  props: Partial<Record<'offsetWidth' | 'offsetHeight' | 'clientWidth' | 'clientHeight', number>>,
) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(el, key, { value, configurable: true });
  }
}

describe('useFloatingPanel', () => {
  it('clamps a stored position back within [gutter, viewport - size - gutter] on resize', () => {
    const setPos = vi.fn();
    const { result } = renderHook(() =>
      useFloatingPanel({
        pos: { x: 900, y: 900 },
        setPos,
        active: true,
        defaultCorner: 'top-right',
      }),
    );

    const parent = document.createElement('div');
    const panel = document.createElement('div');
    parent.appendChild(panel);
    document.body.appendChild(parent);
    mockDimensions(parent, { clientWidth: 400, clientHeight: 300 });
    mockDimensions(panel, { offsetWidth: 320, offsetHeight: 200 });

    act(() => {
      result.current.panelRef.current = panel;
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // maxX = 400 - 320 - 16 = 64; maxY = 300 - 200 - 16 = 84
    expect(setPos).toHaveBeenCalledWith({ x: 64, y: 84 });
  });

  it('does not clamp on resize when active is false', () => {
    const setPos = vi.fn();
    const { result } = renderHook(() =>
      useFloatingPanel({
        pos: { x: 900, y: 900 },
        setPos,
        active: false,
        defaultCorner: 'top-right',
      }),
    );

    const parent = document.createElement('div');
    const panel = document.createElement('div');
    parent.appendChild(panel);
    document.body.appendChild(parent);
    mockDimensions(parent, { clientWidth: 400, clientHeight: 300 });
    mockDimensions(panel, { offsetWidth: 320, offsetHeight: 200 });

    act(() => {
      result.current.panelRef.current = panel;
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(setPos).not.toHaveBeenCalled();
  });

  it('defaults to the top-right corner when no stored position exists', () => {
    const { result } = renderHook(() =>
      useFloatingPanel({ pos: null, setPos: vi.fn(), active: true, defaultCorner: 'top-right' }),
    );
    expect(result.current.style).toEqual({ right: `${GUTTER}px`, top: `${GUTTER}px` });
  });

  it('defaults to the top-left corner when no stored position exists', () => {
    const { result } = renderHook(() =>
      useFloatingPanel({ pos: null, setPos: vi.fn(), active: true, defaultCorner: 'top-left' }),
    );
    expect(result.current.style).toEqual({ left: `${GUTTER}px`, top: `${GUTTER}px` });
  });

  it('uses the stored position for style regardless of defaultCorner', () => {
    const { result } = renderHook(() =>
      useFloatingPanel({
        pos: { x: 42, y: 73 },
        setPos: vi.fn(),
        active: true,
        defaultCorner: 'top-left',
      }),
    );
    expect(result.current.style).toEqual({ left: '42px', top: '73px' });
  });
});
