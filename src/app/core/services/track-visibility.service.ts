import { Injectable } from "@angular/core";
import type { TrackCameraVis } from "./scene-data.service";
import type { FusionMode } from "../models/fusion-mode.model";

const LOG_PREFIX = "[TrackVisibilityService]";
const PRESENCE_WINDOW = 5; // frames before/after to consider a track "present in scene"
const VOGS_REVEAL_RATE = 0.85;
const NAIVE_REVEAL_RATE = 0.50;

export interface TrackVisibilityResult {
  readonly detected: ReadonlySet<number>;
  readonly total: number; // tracks present in scene
  readonly detectedCount: number;
  readonly perCamera: readonly number[]; // track count per camera index
}

@Injectable({ providedIn: "root" })
export class TrackVisibilityService {
  private trackCameraVis: TrackCameraVis | null = null;
  private totalTracks = 0;
  private totalFrames = 0;
  private presenceCache = new Map<number, Set<number>>(); // frame → set of present track IDs

  initialize(trackCameraVis: TrackCameraVis, totalTracks: number, totalFrames: number): void {
    this.trackCameraVis = trackCameraVis;
    this.totalTracks = totalTracks;
    this.totalFrames = totalFrames;
    this.presenceCache.clear();
    console.log(LOG_PREFIX, `Initialized with ${totalTracks} tracks, ${totalFrames} frames`);
  }

  /** Get tracks visible in at least one camera at this frame (single-agent perception). */
  getSingleAgentVisible(frame: number): Set<number> {
    if (!this.trackCameraVis) return new Set();
    const visible = new Set<number>();
    for (const [trackIdStr, frameMap] of Object.entries(this.trackCameraVis)) {
      const trackId = Number(trackIdStr);
      const cameras = frameMap[String(frame)];
      if (cameras && cameras.length > 0) {
        visible.add(trackId);
      }
    }
    return visible;
  }

  /** Get all tracks present in the scene at this frame (visible within ±PRESENCE_WINDOW frames). */
  getTracksPresent(frame: number): Set<number> {
    if (this.presenceCache.has(frame)) {
      return this.presenceCache.get(frame)!;
    }
    if (!this.trackCameraVis) return new Set();

    const present = new Set<number>();
    const startFrame = Math.max(0, frame - PRESENCE_WINDOW);
    const endFrame = Math.min(this.totalFrames - 1, frame + PRESENCE_WINDOW);

    for (const [trackIdStr, frameMap] of Object.entries(this.trackCameraVis)) {
      const trackId = Number(trackIdStr);
      for (let f = startFrame; f <= endFrame; f++) {
        const cameras = frameMap[String(f)];
        if (cameras && cameras.length > 0) {
          present.add(trackId);
          break;
        }
      }
    }

    this.presenceCache.set(frame, present);
    return present;
  }

  /** Get per-camera track counts at this frame. */
  getPerCameraTrackCounts(frame: number, cameraCount: number): number[] {
    const counts = new Array<number>(cameraCount).fill(0);
    if (!this.trackCameraVis) return counts;

    for (const frameMap of Object.values(this.trackCameraVis)) {
      const cameras = frameMap[String(frame)];
      if (cameras) {
        for (const cam of cameras) {
          if (cam < cameraCount) counts[cam]++;
        }
      }
    }
    return counts;
  }

  /** Get visibility result for a fusion mode at a given frame. */
  getVisibility(frame: number, fusionMode: FusionMode, cameraCount: number): TrackVisibilityResult {
    const singleAgent = this.getSingleAgentVisible(frame);
    const present = this.getTracksPresent(frame);
    const perCamera = this.getPerCameraTrackCounts(frame, cameraCount);

    let detected: Set<number>;

    switch (fusionMode) {
      case "single_agent":
        detected = singleAgent;
        break;

      case "ground_truth":
        detected = present;
        break;

      case "vogs": {
        detected = new Set(singleAgent);
        const occluded = [...present].filter(id => !singleAgent.has(id));
        for (const id of occluded) {
          if (this.deterministicReveal(id, VOGS_REVEAL_RATE)) {
            detected.add(id);
          }
        }
        break;
      }

      case "naive_fusion": {
        detected = new Set(singleAgent);
        const occluded = [...present].filter(id => !singleAgent.has(id));
        for (const id of occluded) {
          if (this.deterministicReveal(id, NAIVE_REVEAL_RATE)) {
            detected.add(id);
          }
        }
        break;
      }

      default:
        detected = singleAgent;
    }

    return {
      detected,
      total: present.size,
      detectedCount: detected.size,
      perCamera
    };
  }

  /** Deterministic reveal based on track ID — same track always revealed/hidden for consistency. */
  private deterministicReveal(trackId: number, rate: number): boolean {
    // Simple hash: (trackId * 7 + 3) mod 100 < rate * 100
    const hash = ((trackId * 7 + 3) % 100);
    return hash < rate * 100;
  }
}
