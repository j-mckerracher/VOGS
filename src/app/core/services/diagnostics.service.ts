import { Injectable } from "@angular/core";
import type { FusionMode } from "../models/fusion-mode.model";
import type { RepresentationMode } from "../models/representation-mode.model";
import type {
  DiagnosticsEvent,
  DiagnosticsEventType
} from "../models/diagnostics-event.model";

type DiagnosticsPayload = {
  event: DiagnosticsEventType;
  timestamp: string;
  sceneId: string;
  mode?: FusionMode | RepresentationMode;
  durationMs?: number;
  errorCode?: string;
};

const DIAGNOSTICS_FIELDS = [
  "event",
  "timestamp",
  "sceneId",
  "mode",
  "durationMs",
  "errorCode"
] as const satisfies readonly (keyof DiagnosticsPayload)[];

@Injectable({ providedIn: "root" })
export class DiagnosticsService {
  logAssetLoadStart(sceneId: string): void {
    this.emit({
      event: "asset_load_start",
      timestamp: this.getTimestamp(),
      sceneId
    });
  }

  logAssetLoadSuccess(sceneId: string, durationMs: number): void {
    this.emit({
      event: "asset_load_success",
      timestamp: this.getTimestamp(),
      sceneId,
      durationMs
    });
  }

  logAssetLoadFailed(sceneId: string, durationMs: number, errorCode: string): void {
    this.emit({
      event: "asset_load_failed",
      timestamp: this.getTimestamp(),
      sceneId,
      durationMs,
      errorCode
    });
  }

  logFusionModeChanged(sceneId: string, mode: FusionMode): void {
    this.emit({
      event: "fusion_mode_changed",
      timestamp: this.getTimestamp(),
      sceneId,
      mode
    });
  }

  logRepresentationChanged(sceneId: string, mode: RepresentationMode): void {
    this.emit({
      event: "representation_changed",
      timestamp: this.getTimestamp(),
      sceneId,
      mode
    });
  }

  private emit(event: DiagnosticsEvent): void {
    try {
      this.write(this.sanitize(event));
    } catch {
      // Diagnostics are best-effort and must never interrupt UI flow.
    }
  }

  protected write(payload: DiagnosticsPayload): void {
    globalThis.console.info("diagnostics", payload);
  }

  private sanitize(event: DiagnosticsEvent): DiagnosticsPayload {
    const payload: Partial<DiagnosticsPayload> = {};
    const sanitizedEvent = event as unknown as Record<string, unknown>;
    const writablePayload = payload as Record<string, unknown>;
    for (const field of DIAGNOSTICS_FIELDS) {
      const value = sanitizedEvent[field];
      if (value !== undefined) {
        writablePayload[field] = value;
      }
    }

    return payload as DiagnosticsPayload;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }
}

