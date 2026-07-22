import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useStore } from '../../../store';
import type { GridBlock, Connection } from '../../../store';
import { ConnectionLayer } from '../ConnectionLayer';
import { colors } from '../../common/colors';

const blocks: GridBlock[] = [
  { id: 'in', type: 'input', name: 'IN', col: 0, row: 0, nodeId: 1 },
  { id: 'a', type: 'plugin', name: 'A', col: 1, row: 0, nodeId: 2 },
  { id: 'b', type: 'plugin', name: 'B', col: 2, row: 0, nodeId: 3 },
  { id: 'out', type: 'output', name: 'OUT', col: 3, row: 0, nodeId: 4 },
];

// in->a, a->b, b->out — a->b sits in the middle of the array so removing
// the first connection shifts its array index from 1 to 0.
const connections: Connection[] = [
  { sourceId: 'in', destId: 'a' },
  { sourceId: 'a', destId: 'b' },
  { sourceId: 'b', destId: 'out' },
];

function resetStore() {
  act(() => {
    useStore.setState({
      blocks,
      connections,
      grid: { columns: 4, rows: 1 },
      cellZoom: 'M',
      selectedBlockId: null,
      draggingConnection: null,
    });
  });
}

describe('ConnectionLayer', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders one <g> per connection, in connection order', () => {
    const { container } = render(<ConnectionLayer />);
    expect(container.querySelectorAll('svg > g').length).toBe(3);
  });

  it('keeps hover on the same connection (by source/dest pair) when an earlier connection is removed', () => {
    const { container } = render(<ConnectionLayer />);

    const groups = container.querySelectorAll('svg > g');
    expect(groups.length).toBe(3);

    // Hover the middle connection (a->b): its invisible hit-path is the
    // first <path> inside the second <g>.
    const abGroup = groups[1];
    const abHitPath = abGroup.querySelectorAll('path')[0];
    const abVisiblePath = abGroup.querySelectorAll('path')[1];
    fireEvent.mouseOver(abHitPath);

    // Sanity check the hover actually registered before mutating the store.
    expect(abVisiblePath.getAttribute('stroke')).toBe(colors.danger);

    // Remove the first connection (in->a). a->b shifts from array index 1
    // to index 0; b->out shifts from index 2 to index 1.
    act(() => {
      useStore.setState({
        connections: connections.filter((c) => !(c.sourceId === 'in' && c.destId === 'a')),
      });
    });

    const groupsAfter = container.querySelectorAll('svg > g');
    expect(groupsAfter.length).toBe(2);

    // a->b (now at index 0) must still show the hover style...
    const abVisiblePathAfter = groupsAfter[0].querySelectorAll('path')[1];
    expect(abVisiblePathAfter.getAttribute('stroke')).toBe(colors.danger);

    // ...and b->out (now at index 1, the array slot a->b used to occupy
    // before the removal) must NOT have inherited the hover state.
    const boutVisiblePathAfter = groupsAfter[1].querySelectorAll('path')[1];
    expect(boutVisiblePathAfter.getAttribute('stroke')).not.toBe(colors.danger);
  });
});
