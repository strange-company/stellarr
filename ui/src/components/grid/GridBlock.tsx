import { useCallback, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TbAlertTriangle, TbCopy, TbVolume } from 'react-icons/tb';
import { IoCloseSharp } from 'react-icons/io5';
import type { GridBlock as GridBlockData } from '../../store';
import { requestCopyBlock, requestRemoveBlock, requestOpenPluginEditor } from '../../bridge';
import { useStore } from '../../store';
import { colors } from '../common/colors';
import { useGridLayout } from './layout';
import { TYPE_ABBREVIATIONS } from '../common/constants';
import styles from './GridBlock.module.css';

interface Props {
  block: GridBlockData;
  onEdgeContextMenu?: (e: React.MouseEvent, blockId: string, side: 'input' | 'output') => void;
}

function EdgeZone({
  side,
  blockId,
  accentColor,
  onEdgeContextMenu,
}: {
  side: 'input' | 'output';
  blockId: string;
  accentColor: string;
  onEdgeContextMenu?: (e: React.MouseEvent, blockId: string, side: 'input' | 'output') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const setDraggingConnection = useStore((s) => s.setDraggingConnection);
  const draggingConnection = useStore((s) => s.draggingConnection);
  const isLeft = side === 'input';
  const hasConnections = useStore((s) =>
    s.connections.some((c) => (isLeft ? c.destId === blockId : c.sourceId === blockId)),
  );

  // Show highlight when hovered OR when a connection is being dragged toward this side
  const isDragTarget =
    draggingConnection !== null &&
    ((draggingConnection.portType === 'output' && isLeft) ||
      (draggingConnection.portType === 'input' && !isLeft));
  const showHighlight = hovered || isDragTarget;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDraggingConnection({
        blockId,
        portType: side,
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    },
    [blockId, side, setDraggingConnection],
  );

  return (
    <>
      {showHighlight && (
        <div
          className={`${styles.edgeHighlight} ${isLeft ? styles.edgeHighlightLeft : styles.edgeHighlightRight}`}
          style={{ background: accentColor }}
        />
      )}
      <div
        data-port-block-id={blockId}
        data-port-type={side}
        className={`${styles.edgeZone} ${isLeft ? styles.edgeZoneLeft : styles.edgeZoneRight}`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          if (hasConnections && onEdgeContextMenu) onEdgeContextMenu(e, blockId, side);
        }}
      />
    </>
  );
}

export function GridBlockComponent({ block, onEdgeContextMenu }: Props) {
  const layout = useGridLayout();
  const selectedBlockId = useStore((s) => s.selectedBlockId);
  const selectBlock = useStore((s) => s.selectBlock);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
  });

  const isSelected = selectedBlockId === block.id;

  const isAnchor = block.type === 'input' || block.type === 'output';
  const accentColor = block.pluginMissing
    ? colors.warning
    : block.blockColor || (isAnchor ? colors.gridAnchor : colors.muted);

  // Border always carries the block's accent identity (or dashed when bypassed).
  // Selection is conveyed by tinting the block's background toward the accent
  // colour — no loud overrides on the border, no halo outside the footprint.
  const borderColor = `color-mix(in srgb, ${accentColor} 80%, transparent)`;
  const borderStyle = block.bypassed ? `2px dashed ${borderColor}` : `2px solid ${borderColor}`;

  // Stack the selection tint over the opaque block bg so wires routed behind
  // the block don't bleed through when selected or bypassed.
  const background = isSelected
    ? `color-mix(in srgb, ${accentColor} 14%, var(--color-block-bg))`
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => selectBlock(block.id)}
      onDoubleClick={() => {
        if (block.type === 'plugin' && block.pluginId && !block.pluginMissing)
          requestOpenPluginEditor(block.id);
      }}
      data-grid-block
      className={styles.block}
      style={{
        left: layout.cellLeft(block.col),
        top: layout.cellTop(block.row),
        width: layout.cellSize,
        height: layout.cellSize,
        border: borderStyle,
        background,
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {/* Top region — status icons (format tag dropped in favour of bigger icons) */}
      <div className={styles.topRegion}>
        {block.pluginMissing && (
          <TbAlertTriangle size={22} color={colors.warning} />
        )}
      </div>

      {/* Test-tone indicator — pinned top-centre to line up with the corner
          copy / remove buttons (all three sit at the same y). */}
      {block.type === 'input' && block.testTone && (
        <span className={`${styles.iconSlot} ${styles.testToneBadge}`}>
          <TbVolume size={14} color={colors.green} />
        </span>
      )}

      {/* Middle region — block type */}
      <div className={styles.blockType} style={{ color: accentColor }}>
        {block.displayName ||
          TYPE_ABBREVIATIONS[block.type] ||
          block.type.slice(0, 3).toUpperCase()}
      </div>

      {/* Bottom region — subtitle */}
      <div className={styles.bottomRegion}>
        {block.type === 'plugin' && (
          <div className={block.pluginMissing ? styles.pluginNameMissing : styles.pluginName}>
            {block.pluginMissing
              ? `Missing: ${block.pluginName || 'Unknown'}`
              : (block.pluginName ?? 'No plugin')}
          </div>
        )}
      </div>

      {/* Input edge zone (left) */}
      {block.type !== 'input' && (
        <EdgeZone
          side="input"
          blockId={block.id}
          accentColor={accentColor}
          onEdgeContextMenu={onEdgeContextMenu}
        />
      )}

      {/* Output edge zone (right) */}
      {block.type !== 'output' && (
        <EdgeZone
          side="output"
          blockId={block.id}
          accentColor={accentColor}
          onEdgeContextMenu={onEdgeContextMenu}
        />
      )}

      {/* Copy button — visible on block hover (or its own keyboard focus) via CSS */}
      <button
        type="button"
        aria-label="Copy block"
        className={`${styles.iconSlot} ${styles.copyButton}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          selectBlock(block.id);
          requestCopyBlock(block.id);
        }}
      >
        <TbCopy size={14} />
      </button>

      {/* Remove button — visible on block hover (or its own keyboard focus) via CSS */}
      <button
        type="button"
        aria-label="Remove block"
        className={`${styles.iconSlot} ${styles.removeButton}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          requestRemoveBlock(block.id);
        }}
      >
        <IoCloseSharp size={Math.max(14, Math.round(16 * layout.blockScale))} />
      </button>
    </div>
  );
}
