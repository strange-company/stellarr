import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useStore } from '../../../store';
import type { GridBlock } from '../../../store';
import { GridBlockComponent } from '../GridBlock';
import { requestCopyBlock, requestRemoveBlock } from '../../../bridge';

vi.mock('../../../bridge', () => ({
  requestCopyBlock: vi.fn(),
  requestRemoveBlock: vi.fn(),
  requestOpenPluginEditor: vi.fn(),
}));

const block: GridBlock = {
  id: 'block-A',
  type: 'plugin',
  name: 'PLG',
  col: 0,
  row: 0,
  nodeId: 100,
  displayName: 'PLG',
  pluginName: 'Test Plugin',
};

function resetStore() {
  act(() => {
    useStore.setState({
      blocks: [block],
      connections: [],
      selectedBlockId: null,
      draggingConnection: null,
      cellZoom: 'M',
      selectBlock: vi.fn(),
    });
  });
}

describe('GridBlockComponent', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('exposes the copy and remove controls as accessible buttons', () => {
    render(<GridBlockComponent block={block} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('copy button requests a copy and does not let the click bubble to block selection', () => {
    render(<GridBlockComponent block={block} />);
    const selectBlock = useStore.getState().selectBlock;
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(requestCopyBlock).toHaveBeenCalledWith('block-A');
    // Copy explicitly selects its own block once — stopPropagation means the
    // click must not ALSO reach the parent block's onClick and select again.
    expect(selectBlock).toHaveBeenCalledTimes(1);
  });

  it('remove button requests removal and does not select the block', () => {
    render(<GridBlockComponent block={block} />);
    const selectBlock = useStore.getState().selectBlock;
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(requestRemoveBlock).toHaveBeenCalledWith('block-A');
    expect(selectBlock).not.toHaveBeenCalled();
  });
});
