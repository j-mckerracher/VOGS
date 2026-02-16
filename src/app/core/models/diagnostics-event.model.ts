import type { FusionMode } from "./fusion-mode.model";
import type { RepresentationMode } from "./representation-mode.model";

export const DIAGNOSTICS_EVENT_TYPES = [
  "asset_load_start",
  "asset_load_success",
  "asset_load_failed",
  "fusion_mode_changed",
  "representation_changed"
] as const;

export type DiagnosticsEventType = (typeof DIAGNOSTICS_EVENT_TYPES)[number];

export interface DiagnosticsEventBase {
  readonly event: DiagnosticsEventType;
  readonly timestamp: string;
  readonly sceneId: string;
}

export interface AssetLoadStartEvent extends DiagnosticsEventBase {
  readonly event: "asset_load_start";
}

export interface AssetLoadSuccessEvent extends DiagnosticsEventBase {
  readonly event: "asset_load_success";
  readonly durationMs: number;
}

export interface AssetLoadFailedEvent extends DiagnosticsEventBase {
  readonly event: "asset_load_failed";
  readonly durationMs: number;
  readonly errorCode: string;
}

export interface FusionModeChangedEvent extends DiagnosticsEventBase {
  readonly event: "fusion_mode_changed";
  readonly mode: FusionMode;
}

export interface RepresentationChangedEvent extends DiagnosticsEventBase {
  readonly event: "representation_changed";
  readonly mode: RepresentationMode;
}

export type DiagnosticsEvent =
  | AssetLoadStartEvent
  | AssetLoadSuccessEvent
  | AssetLoadFailedEvent
  | FusionModeChangedEvent
  | RepresentationChangedEvent;

