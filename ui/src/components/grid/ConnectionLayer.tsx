import { useMemo, useState } from 'react';
import { useStore, type GridBlock } from '../../store';
import { colors } from '../common/colors';
import { useGridLayout } from './layout';
import styles from './ConnectionLayer.module.css';

interface Props {
  onConnectionClick?: (e: React.MouseEvent, sourceId: string, destId: string) => void;
}

// Bypass modes whose dry-signal handling matches engine semantics in
// engine/blocks/Block.cpp:
//   - mute / muteIn / muteOut: always silence the dry path -> dead end
//   - muteFxOut: dry is fully restored regardless of mix -> always live
//   - muteFxIn: dry blends in at gain (1 - mix); fully wet (mix >= 1) or no
//     mix support produces silence, otherwise stays live
const ALWAYS_BREAKING_MODES = new Set(['mute', 'muteIn', 'muteOut']);

function breaksSignal(b: Pick<GridBlock, 'bypassed' | 'bypassMode' | 'mix'>): boolean {
  if (!b.bypassed) return false;
  const mode = b.bypassMode ?? 'thru';
  if (mode === 'thru' || mode === 'muteFxOut') return false;
  if (mode === 'muteFxIn') return (b.mix ?? 1) >= 1;
  return ALWAYS_BREAKING_MODES.has(mode);
}

function orthogonalPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cellSize: number,
  gap: number,
): string {
  // Route through the gap space:
  // 1. Exit source going right into the gap
  // 2. Travel vertically to destination row
  // 3. Enter destination going right from the gap
  const midX = x1 + gap / 2;

  if (Math.abs(y1 - y2) < 1) {
    // Same row — straight horizontal line
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (x2 > x1) {
    // Destination is to the right — simple L-shape through gap
    const bendX = x1 + gap / 2;
    return `M ${x1} ${y1} L ${bendX} ${y1} L ${bendX} ${y2} L ${x2} ${y2}`;
  }

  // Destination is to the left or same column — route around via gap below/above
  const offsetY = y2 > y1 ? cellSize / 2 + gap / 2 : -(cellSize / 2 + gap / 2);
  return [
    `M ${x1} ${y1}`,
    `L ${midX} ${y1}`,
    `L ${midX} ${y1 + offsetY}`,
    `L ${x2 - gap / 2} ${y1 + offsetY}`,
    `L ${x2 - gap / 2} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

// A connection is uniquely identified by its (source, dest) pair — the
// engine's AudioProcessorGraph rejects re-adding an already-connected pair,
// so this is safe to use as a stable render/state key (no parallel-edge
// duplicates to disambiguate).
function connectionKey(sourceId: string, destId: string): string {
  return `${sourceId}->${destId}`;
}

export function ConnectionLayer({ onConnectionClick }: Props) {
  const layout = useGridLayout();
  const blocks = useStore((s) => s.blocks);
  const connections = useStore((s) => s.connections);
  const grid = useStore((s) => s.grid);
  const dragging = useStore((s) => s.draggingConnection);

  const selectedBlockId = useStore((s) => s.selectedBlockId);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);

  // Single memoised block-lookup map — consumed by every memo/render path
  // below instead of each one rebuilding its own `id -> block` Map.
  const blockMap = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  // Shared downstream/upstream adjacency + isMuted() lookup rebuilt once here
  // and consumed by both completeConnections and liveConnections below. Those
  // two memos run genuinely different algorithms (global reachability vs.
  // selection-rooted DFS with cycle-safe memoisation) — only this common
  // setup is de-duplicated; each memo's traversal logic and mute semantics
  // are preserved verbatim.
  const connectionAdjacency = useMemo(() => {
    const downstream = new Map<string, string[]>();
    const upstream = new Map<string, string[]>();
    for (const c of connections) {
      downstream.set(c.sourceId, [...(downstream.get(c.sourceId) ?? []), c.destId]);
      upstream.set(c.destId, [...(upstream.get(c.destId) ?? []), c.sourceId]);
    }
    const isMuted = (id: string) => {
      const b = blockMap.get(id);
      return b ? breaksSignal(b) : false;
    };
    return { downstream, upstream, isMuted };
  }, [connections, blockMap]);

  // Global "complete circuit" set — connections that sit on at least one
  // Input → … → Output path. Independent of block selection. A connection is
  // complete when its source is reachable from some input block AND its
  // destination can reach some output block (mute-bypass blocks break paths).
  const completeConnections = useMemo(() => {
    const complete = new Set<string>();
    if (connections.length === 0) return complete;

    const { downstream, upstream, isMuted } = connectionAdjacency;

    // BFS/DFS from the seeds along the given adjacency, EXCLUDING muted nodes
    // entirely — a muted block breaks the signal chain, so neither it nor
    // anything reachable only through it is "on a live path".
    const floodFrom = (seeds: string[], adj: Map<string, string[]>): Set<string> => {
      const visited = new Set<string>();
      const stack: string[] = [];
      for (const s of seeds) if (!isMuted(s)) stack.push(s);
      while (stack.length) {
        const id = stack.pop()!;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const next of adj.get(id) ?? []) {
          if (!isMuted(next)) stack.push(next);
        }
      }
      return visited;
    };

    const inputs = blocks.filter((b) => b.type === 'input').map((b) => b.id);
    const outputs = blocks.filter((b) => b.type === 'output').map((b) => b.id);

    const reachableFromInput = floodFrom(inputs, downstream);
    const canReachOutput = floodFrom(outputs, upstream);

    connections.forEach((c) => {
      if (reachableFromInput.has(c.sourceId) && canReachOutput.has(c.destId)) {
        complete.add(connectionKey(c.sourceId, c.destId));
      }
    });
    return complete;
  }, [blocks, connections, connectionAdjacency]);

  // Find all connections on live routes (input→output) through the selected block.
  // Memoised so the DFS only re-runs when blocks, connections, or selection change.
  const liveConnections = useMemo(() => {
    const live = new Set<string>();
    if (!selectedBlockId) return live;

    const { downstream, upstream, isMuted } = connectionAdjacency;

    // Memoised DFS: walk a direction collecting blocks that reach a target type.
    // Uses `memo` to cache results so diamond/convergent paths all get counted.
    // `path` tracks the current recursion stack for cycle detection only.
    const walkReachable = (
      startId: string,
      adj: Map<string, string[]>,
      targetType: string,
    ): Set<string> => {
      const reachable = new Set<string>();
      const memo = new Map<string, boolean>();

      const canReach = (id: string, path: Set<string>): boolean => {
        if (memo.has(id)) return memo.get(id)!;
        if (path.has(id)) return false;
        path.add(id);

        const blk = blockMap.get(id);
        if (!blk) {
          memo.set(id, false);
          path.delete(id);
          return false;
        }
        if (blk.type === targetType) {
          reachable.add(id);
          memo.set(id, true);
          path.delete(id);
          return true;
        }
        if (isMuted(id)) {
          memo.set(id, false);
          path.delete(id);
          return false;
        }

        let found = false;
        for (const next of adj.get(id) ?? []) {
          if (canReach(next, path)) {
            reachable.add(id);
            found = true;
          }
        }
        memo.set(id, found);
        path.delete(id);
        return found;
      };

      canReach(startId, new Set());
      return reachable;
    };

    const downstreamLive = walkReachable(selectedBlockId, downstream, 'output');
    const upstreamLive = walkReachable(selectedBlockId, upstream, 'input');

    const allLive = new Set([...downstreamLive, ...upstreamLive]);
    connections.forEach((conn) => {
      if (allLive.has(conn.sourceId) && allLive.has(conn.destId)) {
        live.add(connectionKey(conn.sourceId, conn.destId));
      }
    });
    return live;
  }, [blocks, connections, selectedBlockId, connectionAdjacency, blockMap]);

  const hasSelection = selectedBlockId !== null;

  // Group connections by source block (output side) and dest block (input side)
  // to determine count and sorted index for Y-position spacing.
  const { outputGroups, inputGroups } = useMemo(() => {
    const outGroups = new Map<
      string,
      { destId: string; destRow: number; destCol: number; connIdx: number }[]
    >();
    const inGroups = new Map<
      string,
      { sourceId: string; sourceRow: number; sourceCol: number; connIdx: number }[]
    >();

    connections.forEach((conn, i) => {
      const src = blockMap.get(conn.sourceId);
      const dst = blockMap.get(conn.destId);
      if (!src || !dst) return;

      const outGroup = outGroups.get(conn.sourceId) ?? [];
      outGroup.push({ destId: conn.destId, destRow: dst.row, destCol: dst.col, connIdx: i });
      outGroups.set(conn.sourceId, outGroup);

      const inGroup = inGroups.get(conn.destId) ?? [];
      inGroup.push({ sourceId: conn.sourceId, sourceRow: src.row, sourceCol: src.col, connIdx: i });
      inGroups.set(conn.destId, inGroup);
    });

    for (const group of outGroups.values())
      group.sort((a, b) => a.destRow - b.destRow || a.destCol - b.destCol);
    for (const group of inGroups.values())
      group.sort((a, b) => a.sourceRow - b.sourceRow || a.sourceCol - b.sourceCol);

    return { outputGroups: outGroups, inputGroups: inGroups };
  }, [connections, blockMap]);

  const gw = layout.gridWidth(grid.columns);
  const gh = layout.gridHeight(grid.rows);

  return (
    <svg className={styles.svg} style={{ width: gw, height: gh }}>
      {connections.map((conn, i) => {
        const src = blockMap.get(conn.sourceId);
        const dst = blockMap.get(conn.destId);
        if (!src || !dst) return null;

        const outGroup = outputGroups.get(conn.sourceId) ?? [];
        const inGroup = inputGroups.get(conn.destId) ?? [];
        const outIdx = outGroup.findIndex((g) => g.connIdx === i);
        const inIdx = inGroup.findIndex((g) => g.connIdx === i);

        const x1 = layout.outputPortX(src.col);
        const y1 = layout.connectionY(src.row, outGroup.length, outIdx);
        const x2 = layout.inputPortX(dst.col);
        const y2 = layout.connectionY(dst.row, inGroup.length, inIdx);

        const connKey = connectionKey(conn.sourceId, conn.destId);
        const isSelectedLive = liveConnections.has(connKey);
        const isComplete = completeConnections.has(connKey);

        // Stroke matrix:
        //   selected-live + complete        -> amber 100%
        //   selected-live + incomplete      -> muted 50%
        //   other + complete + selection    -> muted 60%
        //   other + complete + no selection -> muted 80%
        //   other + incomplete              -> muted 50%
        //
        // Dash: complete = solid, incomplete = dashed.
        const mutedAt = (pct: number) => `color-mix(in srgb, ${colors.muted} ${pct}%, transparent)`;

        let stroke: string;
        if (hasSelection && isSelectedLive) {
          stroke = isComplete ? colors.warning : mutedAt(50);
        } else if (isComplete) {
          stroke = hasSelection ? mutedAt(60) : mutedAt(80);
        } else {
          stroke = mutedAt(50);
        }

        const strokeDasharray = isComplete ? undefined : '6 4';
        const isHovered = hoveredConn === connKey;

        // Hover signals the destructive disconnect action — swap to danger
        // colour so it reads as "click to remove" rather than just thicker.
        const visibleStroke = isHovered ? colors.danger : stroke;

        const d = orthogonalPath(x1, y1, x2, y2, layout.cellSize, layout.gap);

        return (
          <g key={connKey}>
            {/* Invisible wide hit area for clicking */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={12}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredConn(connKey)}
              onMouseLeave={() => setHoveredConn((prev) => (prev === connKey ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                onConnectionClick?.(e, conn.sourceId, conn.destId);
              }}
            />
            {/* Visible connection line */}
            <path
              d={d}
              stroke={visibleStroke}
              strokeDasharray={strokeDasharray}
              strokeWidth={isHovered ? 3 : 2}
              fill="none"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}

      {dragging &&
        (() => {
          const blk = blockMap.get(dragging.blockId);
          if (!blk) return null;
          const x1 = dragging.portType === 'output' ? layout.outputPortX(blk.col) : layout.inputPortX(blk.col);
          const y1 = layout.connectionY(blk.row, 1, 0);
          return (
            <line
              x1={x1}
              y1={y1}
              x2={dragging.mouseX}
              y2={dragging.mouseY}
              stroke={colors.connectionLine}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          );
        })()}
    </svg>
  );
}
