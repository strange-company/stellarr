import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useStore } from '../../store';
import type { GridBlock as GridBlockData } from '../../store';
import {
  requestAddBlock,
  requestAddConnection,
  requestMoveBlock,
  requestPasteBlock,
  requestToggleBlockBypass,
  requestRemoveConnection,
  requestSetSelectedBlock,
} from '../../bridge';
import { IoAddSharp, IoCloseSharp } from 'react-icons/io5';
import { GridBlockComponent } from './GridBlock';
import { ConnectionLayer } from './ConnectionLayer';
import { BlockMenu } from './BlockMenu';
import { DroppableCell } from './DroppableCell';
import { useGridLayout } from './layout';
import { TYPE_ABBREVIATIONS } from '../common/constants';
import { colors, blockPaletteByName } from '../common/colors';
import styles from './Grid.module.css';

const typeColors: Record<string, string> = {
  input: blockPaletteByName.slateLight,
  output: blockPaletteByName.slateLight,
  plugin: blockPaletteByName.blue,
};

// Lightweight preview shown in the DragOverlay portal during block drag
function BlockGhost({ block }: { block: GridBlockData }) {
  const layout = useGridLayout();
  const accentColor = block.pluginMissing
    ? colors.warning
    : block.blockColor || typeColors[block.type] || colors.secondary;

  return (
    <div
      className={styles.dragGhost}
      style={{
        width: layout.cellSize,
        height: layout.cellSize,
        borderColor: accentColor,
      }}
    >
      <span style={{ color: accentColor }}>
        {block.displayName ||
          TYPE_ABBREVIATIONS[block.type] ||
          block.type.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}

export function Grid() {
  const layout = useGridLayout();
  const grid = useStore((s) => s.grid);
  const blocks = useStore((s) => s.blocks);
  const connections = useStore((s) => s.connections);
  const draggingConnection = useStore((s) => s.draggingConnection);
  const setDraggingConnection = useStore((s) => s.setDraggingConnection);
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedBlockId = useStore((s) => s.selectedBlockId);
  const clipboardBlockType = useStore((s) => s.clipboardBlockType);

  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null);
  const [activeBlock, setActiveBlock] = useState<GridBlockData | null>(null);
  const [menuCell, setMenuCell] = useState<{ col: number; row: number } | null>(null);
  const [connMenu, setConnMenu] = useState<{
    x: number;
    y: number;
    sourceId: string;
    destId: string;
  } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{
    x: number;
    y: number;
    blockId: string;
    side: 'input' | 'output';
  } | null>(null);

  // Space key toggles bypass on the selected block
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && selectedBlockId) {
        e.preventDefault();
        const block = useStore.getState().blocks.find((b) => b.id === selectedBlockId);
        if (block && block.type !== 'input' && block.type !== 'output') {
          useStore.getState().setBlockBypassed(selectedBlockId, !block.bypassed);
          requestToggleBlockBypass(selectedBlockId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedBlockId]);

  // Notify engine of selected block changes for LUFS measurement
  const clearLoudnessHistory = useStore((s) => s.clearLoudnessHistory);
  useEffect(() => {
    requestSetSelectedBlock(selectedBlockId ?? '');
    clearLoudnessHistory();
  }, [selectedBlockId, clearLoudnessHistory]);

  const occupiedSet = useMemo(() => new Set(blocks.map((b) => `${b.col},${b.row}`)), [blocks]);

  // -- dnd-kit ----------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const block = blocks.find((b) => b.id === event.active.id);
      setActiveBlock(block ?? null);
      setHoveredCell(null);
    },
    [blocks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveBlock(null);

      if (!event.over) return;

      const blockId = String(event.active.id);
      const overId = String(event.over.id);
      // droppable ids are "cell-{col}-{row}"
      const parts = overId.split('-');
      const col = Number(parts[1]);
      const row = Number(parts[2]);

      const moving = blocks.find((b) => b.id === blockId);
      if (!moving) return;
      if (moving.col !== col || moving.row !== row) requestMoveBlock(blockId, col, row);
    },
    [blocks],
  );

  // -- Connection drag handlers ------------------------------------------------

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingConnection && gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        setDraggingConnection({
          ...draggingConnection,
          mouseX: e.clientX - rect.left,
          mouseY: e.clientY - rect.top,
        });
      }
    },
    [draggingConnection, setDraggingConnection],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingConnection) return;

      const target = e.target as HTMLElement;
      const dropBlockId = target.getAttribute('data-port-block-id');
      const dropPortType = target.getAttribute('data-port-type');

      if (dropBlockId && dropPortType) {
        if (draggingConnection.portType === 'output' && dropPortType === 'input')
          requestAddConnection(draggingConnection.blockId, dropBlockId);
        else if (draggingConnection.portType === 'input' && dropPortType === 'output')
          requestAddConnection(dropBlockId, draggingConnection.blockId);
      }

      setDraggingConnection(null);
    },
    [draggingConnection, setDraggingConnection],
  );

  // -- Cell interaction handlers ----------------------------------------------

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      if (occupiedSet.has(`${col},${row}`)) return;
      setMenuCell({ col, row });
    },
    [occupiedSet],
  );

  const handleConnectionClick = useCallback(
    (e: React.MouseEvent, sourceId: string, destId: string) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      setConnMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        sourceId,
        destId,
      });
    },
    [],
  );

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, blockId: string, side: 'input' | 'output') => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      setEdgeMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        blockId,
        side,
      });
    },
    [],
  );

  useEffect(() => {
    if (!connMenu && !edgeMenu) return;
    const close = () => {
      setConnMenu(null);
      setEdgeMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [connMenu, edgeMenu]);

  const handleMenuSelect = useCallback(
    (type: string) => {
      if (!menuCell) return;

      const blockMap = new Map(blocks.map((b) => [b.id, b]));
      let spliceSourceId: string | undefined;
      let spliceDestId: string | undefined;

      for (const conn of useStore.getState().connections) {
        const src = blockMap.get(conn.sourceId);
        const dst = blockMap.get(conn.destId);
        if (!src || !dst) continue;
        if (src.row !== menuCell.row || dst.row !== menuCell.row) continue;

        const minCol = Math.min(src.col, dst.col);
        const maxCol = Math.max(src.col, dst.col);

        if (menuCell.col > minCol && menuCell.col < maxCol) {
          spliceSourceId = conn.sourceId;
          spliceDestId = conn.destId;
          break;
        }
      }

      requestAddBlock(type, menuCell.col, menuCell.row, spliceSourceId, spliceDestId);
      setMenuCell(null);
    },
    [menuCell, blocks],
  );

  // -- Render -----------------------------------------------------------------

  const gw = layout.gridWidth(grid.columns);
  const gh = layout.gridHeight(grid.rows);
  const isDragging = activeBlock !== null;

  return (
    <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div
        ref={gridRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoveredCell(null)}
        className={styles.grid}
        style={{
          width: gw,
          height: gh,
          // CSS variable consumed by GridBlock.module.css to scale block
          // typography proportionally with cell zoom. See the
          // useGridLayout hook + CLAUDE.md "Grid block scale +
          // accessibility floors" rule.
          ['--block-scale' as string]: String(layout.blockScale),
        }}
      >
        {/* Cell backgrounds (droppable targets) */}
        {Array.from({ length: grid.rows }, (_, row) =>
          Array.from({ length: grid.columns }, (_, col) => {
            const key = `${col},${row}`;
            const occupied = occupiedSet.has(key);
            const isHovered =
              !isDragging && !occupied && hoveredCell?.col === col && hoveredCell?.row === row;
            const isMenuOpen = menuCell?.col === col && menuCell?.row === row;

            const cell = (
              <DroppableCell
                key={key}
                col={col}
                row={row}
                occupied={occupied}
                isHovered={isHovered}
                isMenuOpen={isMenuOpen}
                onMouseEnter={() => {
                  if (!occupied && !isDragging) setHoveredCell({ col, row });
                }}
                onMouseLeave={() => {
                  if (hoveredCell?.col === col && hoveredCell?.row === row) setHoveredCell(null);
                }}
                onClick={() => handleCellClick(col, row)}
              >
                {(isHovered || isMenuOpen) && (
                  <span className={styles.cellPlus}>
                    <IoAddSharp size={20} />
                  </span>
                )}
              </DroppableCell>
            );

            if (isMenuOpen) {
              return (
                <BlockMenu
                  key={key}
                  open={true}
                  onSelect={handleMenuSelect}
                  onPaste={
                    clipboardBlockType
                      ? () => {
                          requestPasteBlock(col, row);
                          setMenuCell(null);
                        }
                      : undefined
                  }
                  onClose={() => setMenuCell(null)}
                >
                  {cell}
                </BlockMenu>
              );
            }

            return cell;
          }),
        )}

        <ConnectionLayer onConnectionClick={handleConnectionClick} />

        {connMenu && (
          <div
            className={styles.connMenu}
            style={{ left: connMenu.x, top: connMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={styles.connMenuItem}
              onClick={() => {
                requestRemoveConnection(connMenu.sourceId, connMenu.destId);
                setConnMenu(null);
              }}
            >
              Disconnect
            </div>
          </div>
        )}

        {edgeMenu &&
          (() => {
            const edgeConns = connections.filter((c) =>
              edgeMenu.side === 'output'
                ? c.sourceId === edgeMenu.blockId
                : c.destId === edgeMenu.blockId,
            );
            return (
              <div
                className={styles.connMenu}
                style={{ left: edgeMenu.x, top: edgeMenu.y }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {edgeConns.map((c) => {
                  const connectedId = edgeMenu.side === 'output' ? c.destId : c.sourceId;
                  const connectedBlock = blocks.find((b) => b.id === connectedId);
                  const label =
                    connectedBlock?.displayName ||
                    TYPE_ABBREVIATIONS[connectedBlock?.type ?? ''] ||
                    'Block';
                  return (
                    <div
                      key={`${c.sourceId}-${c.destId}`}
                      className={styles.connMenuItem}
                      onClick={() => {
                        requestRemoveConnection(c.sourceId, c.destId);
                      }}
                    >
                      <span>{label}</span>
                      <span className={styles.connMenuDisconnect}>
                        <IoCloseSharp size={14} />
                      </span>
                    </div>
                  );
                })}
                {edgeConns.length === 0 && (
                  <div className={styles.connMenuEmpty}>No connections</div>
                )}
              </div>
            );
          })()}

        {blocks.map((block) => (
          <GridBlockComponent
            key={block.id}
            block={block}
            onEdgeContextMenu={handleEdgeContextMenu}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeBlock ? <BlockGhost block={activeBlock} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
