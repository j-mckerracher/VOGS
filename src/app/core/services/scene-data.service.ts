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

/** Normalized ego pose: position centered at frame 0, heading in radians. */
export interface EgoPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number; // yaw angle in radians
  readonly matrix: readonly number[]; // flat 16-element row-major 4×4
}

/** Camera calibration for one camera. */
export interface CameraCalibration {
  readonly cameraIndex: number;
  readonly extrinsic: readonly number[]; // flat 16-element 4×4
  readonly dirX: number; // forward direction in vehicle frame (x)
  readonly dirY: number; // forward direction in vehicle frame (y)
  readonly hfov: number; // horizontal FOV in radians
  readonly posX: number; // position relative to vehicle center (x)
  readonly posY: number; // position relative to vehicle center (y)
}

/** Track camera visibility: trackId → frameIndex → cameraIndices[] */
export type TrackCameraVis = Record<string, Record<string, number[]>>;

export interface SceneData {
  readonly sceneId: string;
  readonly totalFrames: number;
  readonly cameraCount: number;
  readonly timestamps: Record<string, number>;
  readonly trackIds: number[];
  readonly trackCameraVis: TrackCameraVis;
  readonly egoPoses: EgoPose[];
  readonly cameraCalibrations: CameraCalibration[];
}

const LOG_PREFIX = "[SceneDataService]";
const BATCH_SIZE = 20;
const IMAGE_WIDTH = 1920; // assumed sensor width in pixels

@Injectable({ providedIn: "root" })
export class SceneDataService {
  private sceneData: SceneData | null = null;
  private loadPromise: Promise<SceneData> | null = null;

  /** Progress callback for loading status (0-1). */
  // eslint-disable-next-line no-unused-vars -- callback type signature
  onProgress: ((fraction: number, message: string) => void) | null = null;

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
    this.emitProgress(0, "Loading metadata...");

    // Phase 1: metadata (timestamps, tracks)
    const [timestamps, trackIds, trackCameraVis] = await Promise.all([
      this.fetchJson<Record<string, Record<string, number>>>(`${base}/timestamps.json`),
      this.fetchJson<Record<string, number>>(`${base}/track/track_ids.json`),
      this.fetchJson<TrackCameraVis>(`${base}/track/track_camera_vis.json`)
    ]);

    const frameTimestamps = timestamps["FRAME"] ?? {};
    const totalFrames = Object.keys(frameTimestamps).length;
    const trackIdArray = Object.values(trackIds);
    console.log(LOG_PREFIX, `Metadata loaded: ${totalFrames} frames, ${trackIdArray.length} tracks`);
    this.emitProgress(0.15, "Loading camera calibration...");

    // Phase 2: camera calibration
    const cameraCalibrations = await this.loadCameraCalibrations(base);
    this.emitProgress(0.25, "Loading ego poses...");

    // Phase 3: ego poses (batched)
    const egoPoses = await this.loadEgoPoses(base, totalFrames);
    this.emitProgress(1, "Scene data ready");

    const data: SceneData = {
      sceneId: environment.sceneId,
      totalFrames,
      cameraCount: environment.cameraCount,
      timestamps: frameTimestamps,
      trackIds: trackIdArray,
      trackCameraVis,
      egoPoses,
      cameraCalibrations
    };

    console.log(LOG_PREFIX, `Scene loaded: ${totalFrames} frames, ${environment.cameraCount} cameras, ${trackIdArray.length} tracks, ${egoPoses.length} poses, ${cameraCalibrations.length} calibrations`);
    return data;
  }

  private async loadCameraCalibrations(base: string): Promise<CameraCalibration[]> {
    const calibrations: CameraCalibration[] = [];

    const extrinsicPromises = [];
    const intrinsicPromises = [];
    for (let cam = 0; cam < environment.cameraCount; cam++) {
      extrinsicPromises.push(this.fetchText(`${base}/extrinsics/${cam}.txt`));
      intrinsicPromises.push(this.fetchText(`${base}/intrinsics/${cam}.txt`));
    }

    const extrinsicTexts = await Promise.all(extrinsicPromises);
    const intrinsicTexts = await Promise.all(intrinsicPromises);

    for (let cam = 0; cam < environment.cameraCount; cam++) {
      const ext = this.parseMatrix4x4(extrinsicTexts[cam]);
      const intr = this.parseIntrinsics(intrinsicTexts[cam]);
      const hfov = 2 * Math.atan((IMAGE_WIDTH / 2) / intr.fx);

      // Camera forward direction from extrinsic rotation (3rd column = Z axis in camera frame)
      // Extrinsic maps camera coords to vehicle coords: R * [0,0,1] = forward in vehicle frame
      const dirX = ext[2];  // row 0, col 2
      const dirY = ext[6];  // row 1, col 2
      // Camera position in vehicle frame (translation column)
      const posX = ext[3];  // row 0, col 3
      const posY = ext[7];  // row 1, col 3

      calibrations.push({ cameraIndex: cam, extrinsic: ext, dirX, dirY, hfov, posX, posY });
      console.log(LOG_PREFIX, `Camera ${cam}: hfov=${(hfov * 180 / Math.PI).toFixed(1)}° dir=(${dirX.toFixed(2)},${dirY.toFixed(2)}) pos=(${posX.toFixed(2)},${posY.toFixed(2)})`);
    }

    return calibrations;
  }

  private async loadEgoPoses(base: string, totalFrames: number): Promise<EgoPose[]> {
    const poses: (EgoPose | null)[] = new Array(totalFrames).fill(null);
    let loaded = 0;

    for (let batchStart = 0; batchStart < totalFrames; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalFrames);
      const batchPromises: Promise<void>[] = [];

      for (let f = batchStart; f < batchEnd; f++) {
        const padded = String(f).padStart(6, "0");
        const url = `${base}/ego_pose/${padded}.txt`;
        batchPromises.push(
          this.fetchText(url).then(text => {
            poses[f] = this.parseEgoPose(text);
          })
        );
      }

      await Promise.all(batchPromises);
      loaded += (batchEnd - batchStart);
      const progress = 0.25 + 0.75 * (loaded / totalFrames);
      this.emitProgress(progress, `Loading ego poses... ${loaded}/${totalFrames}`);
    }

    // Normalize: subtract frame 0 position
    const origin = poses[0];
    if (!origin) {
      throw new Error("Failed to load frame 0 ego pose");
    }
    const ox = origin.x;
    const oy = origin.y;

    const normalized: EgoPose[] = poses.map(p => {
      if (!p) return { x: 0, y: 0, z: 0, heading: 0, matrix: new Array(16).fill(0) };
      return { ...p, x: p.x - ox, y: p.y - oy };
    });

    console.log(LOG_PREFIX, `Ego poses loaded: ${normalized.length} frames, travel range: (${normalized[normalized.length - 1].x.toFixed(1)}, ${normalized[normalized.length - 1].y.toFixed(1)})m`);
    return normalized;
  }

  private parseEgoPose(text: string): EgoPose {
    const values = text.trim().split(/\s+/).map(Number);
    if (values.length !== 16) {
      throw new Error(`Expected 16 values in ego_pose, got ${values.length}`);
    }
    // Row-major 4×4: translation is at indices 3, 7, 11
    const x = values[3];
    const y = values[7];
    const z = values[11];
    // Heading from rotation matrix: atan2(R[1][0], R[0][0])
    const heading = Math.atan2(values[4], values[0]);
    return { x, y, z, heading, matrix: values };
  }

  private parseMatrix4x4(text: string): number[] {
    const values = text.trim().split(/\s+/).map(Number);
    if (values.length !== 16) {
      throw new Error(`Expected 16 values in 4x4 matrix, got ${values.length}`);
    }
    return values;
  }

  private parseIntrinsics(text: string): { fx: number; fy: number; cx: number; cy: number } {
    const values = text.trim().split(/\s+/).map(Number);
    return { fx: values[0], fy: values[1], cx: values[2], cy: values[3] };
  }

  private emitProgress(fraction: number, message: string): void {
    if (this.onProgress) {
      this.onProgress(fraction, message);
    }
  }

  private async fetchText(url: string): Promise<string> {
    const response = await globalThis.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
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
