import { Injectable } from "@angular/core";
import { environment } from "../config/environment";

export interface FrameData {
  readonly frameIndex: number;
  readonly imageUrls: readonly string[];
}

export interface TrackEntry {
  readonly id: number;
  readonly bbox: readonly number[];
  readonly cameraIndex: number;
  readonly frameIndex: number;
}

export interface SceneData {
  readonly sceneId: string;
  readonly totalFrames: number;
  readonly cameraCount: number;
  readonly timestamps: Record<string, number>;
  readonly trackIds: number[];
  readonly trackCameraVis: Record<string, unknown>;
}

const LOG_PREFIX = "[SceneDataService]";

@Injectable({ providedIn: "root" })
export class SceneDataService {
  private sceneData: SceneData | null = null;
  private loadPromise: Promise<SceneData> | null = null;

  async loadSceneData(): Promise<SceneData> {
    if (this.sceneData !== null) {
      console.log(LOG_PREFIX, "Returning cached scene data");
      return this.sceneData;
    }

    if (this.loadPromise !== null) {
      console.log(LOG_PREFIX, "Awaiting in-flight load");
      return this.loadPromise;
    }

    this.loadPromise = this.fetchSceneData();
    this.sceneData = await this.loadPromise;
    this.loadPromise = null;
    return this.sceneData;
  }

  getFrameImageUrls(frameIndex: number): string[] {
    const paddedFrame = String(frameIndex).padStart(6, "0");
    const urls: string[] = [];
    for (let cam = 0; cam < environment.cameraCount; cam++) {
      urls.push(
        `${environment.cloudfrontBaseUrl}/${environment.sceneId}/images/${paddedFrame}_${cam}.png`
      );
    }
    return urls;
  }

  getDynamicMaskUrls(frameIndex: number): string[] {
    const paddedFrame = String(frameIndex).padStart(6, "0");
    const urls: string[] = [];
    for (let cam = 0; cam < environment.cameraCount; cam++) {
      urls.push(
        `${environment.cloudfrontBaseUrl}/${environment.sceneId}/dynamic_mask/${paddedFrame}_${cam}.png`
      );
    }
    return urls;
  }

  private async fetchSceneData(): Promise<SceneData> {
    const base = `${environment.cloudfrontBaseUrl}/${environment.sceneId}`;

    console.log(LOG_PREFIX, "Loading scene metadata from CloudFront...");
    console.log(LOG_PREFIX, "Base URL:", base);

    const [timestamps, trackIds, trackCameraVis] = await Promise.all([
      this.fetchJson<Record<string, Record<string, number>>>(`${base}/timestamps.json`),
      this.fetchJson<number[]>(`${base}/track/track_ids.json`),
      this.fetchJson<Record<string, unknown>>(`${base}/track/track_camera_vis.json`)
    ]);

    const frameTimestamps = timestamps["FRAME"] ?? {};
    const totalFrames = Object.keys(frameTimestamps).length;

    const data: SceneData = {
      sceneId: environment.sceneId,
      totalFrames,
      cameraCount: environment.cameraCount,
      timestamps: frameTimestamps,
      trackIds: Array.isArray(trackIds) ? trackIds : Object.values(trackIds as Record<string, number>),
      trackCameraVis: trackCameraVis
    };

    const trackCount = Array.isArray(trackIds) ? trackIds.length : Object.keys(trackIds as Record<string, number>).length;
    console.log(LOG_PREFIX, `Scene loaded: ${totalFrames} frames, ${environment.cameraCount} cameras`);
    console.log(LOG_PREFIX, `Track IDs: ${trackCount} tracked objects`);

    return data;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    console.log(LOG_PREFIX, "Fetching:", url);
    const startMs = performance.now();

    const response = await globalThis.fetch(url);
    if (!response.ok) {
      const msg = `Failed to fetch ${url}: ${response.status} ${response.statusText}`;
      console.error(LOG_PREFIX, msg);
      throw new Error(msg);
    }

    const data = (await response.json()) as T;
    const durationMs = Math.round(performance.now() - startMs);
    console.log(LOG_PREFIX, `Fetched ${url} in ${durationMs}ms`);
    return data;
  }
}
