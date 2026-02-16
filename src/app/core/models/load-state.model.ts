export const LOAD_STATES = ["idle", "loading", "ready", "failed"] as const;

export type LoadState = (typeof LOAD_STATES)[number];

export interface LoadStateError {
  readonly code: string;
  readonly message: string;
}

export interface SceneLoadState {
  readonly status: LoadState;
  readonly error: LoadStateError | null;
}
