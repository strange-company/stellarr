import { useCallback, useEffect, useRef } from 'react';
import { useDrag } from '@use-gesture/react';

const PANEL_EDGE_GUTTER = 16;

export type FloatingPanelCorner = 'top-left' | 'top-right';

interface UseFloatingPanelOptions {
  /** Persisted panel position, or null before the panel has ever been dragged. */
  pos: { x: number; y: number } | null;
  setPos: (pos: { x: number; y: number }) => void;
  /** Gates the on-open/on-resize clamp effect — true while the panel is mounted/visible. */
  active: boolean;
  /** Corner the panel snaps to before it has ever been dragged. */
  defaultCorner: FloatingPanelCorner;
}

interface UseFloatingPanelResult {
  panelRef: React.RefObject<HTMLDivElement | null>;
  bindDrag: () => Record<string, unknown>;
  /** Inline position style — spread onto the panel's root element. */
  style: React.CSSProperties;
}

/**
 * Shared drag/clamp/bounds machinery for the app's floating, draggable panels
 * (OptionsPanel, FloatingMidiPanel). Owns PANEL_EDGE_GUTTER, the on-open/
 * on-resize edge clamp, the useDrag bounds + binding, and the default inline
 * position style. Callers own store wiring (which position field, which
 * gating flag) and all body/content rendering.
 */
export function useFloatingPanel({
  pos,
  setPos,
  active,
  defaultCorner,
}: UseFloatingPanelOptions): UseFloatingPanelResult {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Clamp stored position so the panel can never sit outside the visible
  // parent (e.g. when the saved position came from a larger window or a
  // different layout). Reserves PANEL_EDGE_GUTTER on every side. Runs on
  // open AND on subsequent window resizes — without the on-open clamp, a
  // smaller WebView between sessions could leave the panel completely
  // offscreen with no titlebar to drag it back.
  const clampStoredPos = useCallback(() => {
    if (!pos) return;
    const parent = panelRef.current?.parentElement;
    const panelEl = panelRef.current;
    if (!parent || !panelEl) return;
    const maxX = parent.clientWidth - panelEl.offsetWidth - PANEL_EDGE_GUTTER;
    const maxY = parent.clientHeight - panelEl.offsetHeight - PANEL_EDGE_GUTTER;
    const nx = Math.max(PANEL_EDGE_GUTTER, Math.min(pos.x, Math.max(PANEL_EDGE_GUTTER, maxX)));
    const ny = Math.max(PANEL_EDGE_GUTTER, Math.min(pos.y, Math.max(PANEL_EDGE_GUTTER, maxY)));
    if (nx !== pos.x || ny !== pos.y) {
      setPos({ x: nx, y: ny });
    }
  }, [pos, setPos]);

  useEffect(() => {
    if (!active || !pos) return undefined;
    // RAF to ensure the panel has rendered + measured itself before we
    // read offsetWidth / offsetHeight on first open.
    const id = requestAnimationFrame(clampStoredPos);
    window.addEventListener('resize', clampStoredPos);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', clampStoredPos);
    };
  }, [active, pos, clampStoredPos]);

  const getBounds = useCallback(() => {
    const parent = panelRef.current?.parentElement;
    const panelEl = panelRef.current;
    if (!parent || !panelEl) return { left: 0, top: 0, right: 0, bottom: 0 };
    return {
      left: PANEL_EDGE_GUTTER,
      top: PANEL_EDGE_GUTTER,
      right: Math.max(
        PANEL_EDGE_GUTTER,
        parent.clientWidth - panelEl.offsetWidth - PANEL_EDGE_GUTTER,
      ),
      bottom: Math.max(
        PANEL_EDGE_GUTTER,
        parent.clientHeight - panelEl.offsetHeight - PANEL_EDGE_GUTTER,
      ),
    };
  }, []);

  const bindDrag = useDrag(
    ({ offset: [x, y] }) => {
      setPos({ x, y });
    },
    {
      from: () => {
        if (pos) return [pos.x, pos.y];
        if (defaultCorner === 'top-left') {
          return [PANEL_EDGE_GUTTER, PANEL_EDGE_GUTTER];
        }
        // Default top-right offset
        const parent = panelRef.current?.parentElement;
        const panelEl = panelRef.current;
        if (!parent || !panelEl) return [0, 0];
        return [
          Math.max(0, parent.clientWidth - panelEl.offsetWidth - PANEL_EDGE_GUTTER),
          PANEL_EDGE_GUTTER,
        ];
      },
      bounds: getBounds,
      filterTaps: true,
      // Don't grab pointer capture — otherwise clicks on child buttons
      // (close, ⋯, bypass toggle) route to the titlebar instead of the target.
      pointer: { capture: false },
    },
  );

  const style: React.CSSProperties = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px` }
    : defaultCorner === 'top-left'
      ? { left: `${PANEL_EDGE_GUTTER}px`, top: `${PANEL_EDGE_GUTTER}px` }
      : { right: `${PANEL_EDGE_GUTTER}px`, top: `${PANEL_EDGE_GUTTER}px` };

  return { panelRef, bindDrag, style };
}
