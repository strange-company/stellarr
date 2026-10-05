// Leaf module: imports nothing from `../store` or `./index`. Extracted so
// `store/index.ts` can depend on these types without creating a
// store -> bridge -> store import cycle (bridge/index.ts imports `useStore`
// from the store). See CLAUDE.md issue #25.
export type UpdateStatus =
  | 'idle' | 'checking' | 'available' | 'no-update'
  | 'downloading' | 'ready' | 'error';

export interface UpdateStatePayload {
  status: UpdateStatus;
  latestVersion: string;
  releasedAt: string;
  sizeBytes: number;
  releaseNotesUrl: string;
  downloadProgress: number;
  error: string;
}
