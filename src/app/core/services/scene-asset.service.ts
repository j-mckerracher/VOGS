import { Injectable } from "@angular/core";
import { TimeoutError, catchError, concat, defer, from, of, retry, throwError, timeout } from "rxjs";
import type { Observable } from "rxjs";
import type { SceneManifestAsset, SceneManifestEntry } from "../models/scene-manifest.model";
import type { LoadEvent, ReadyEvent } from "../models/load-event.model";
import { AssetBudgetError } from "../errors/asset-budget.error";
import { AssetFetchError } from "../errors/asset-fetch.error";
import { AssetParseError } from "../errors/asset-parse.error";
export { LOAD_EVENT_TYPES, isLoadEventType } from "../models/load-event.model";
export type { FailedEvent, LoadEvent, LoadingEvent, ReadyEvent } from "../models/load-event.model";

export const SCENE_ASSET_TIMEOUT_MS = 12_000 as const;
export const SCENE_ASSET_RETRY_COUNT = 1 as const;
export const SCENE_ASSET_BUDGET_BYTES = 2_000_000 as const;
export const SCENE_ASSET_FORMATS = ["ply", "splat", "gltf"] as const;
export type SceneAssetFormat = (typeof SCENE_ASSET_FORMATS)[number];
const TRANSIENT_HTTP_STATUSES = [408, 429, 500, 502, 503, 504] as const;

@Injectable({ providedIn: "root" })
export class SceneAssetService {
  private lastEntry: SceneManifestEntry | null = null;

  loadScene(entry: SceneManifestEntry): Observable<LoadEvent> {
    this.lastEntry = entry;
    return this.runLoad(entry);
  }

  retryLast(): Observable<LoadEvent> {
    if (this.lastEntry === null) {
      return of({
        type: "failed",
        error: new AssetParseError("No scene has been loaded yet.")
      });
    }

    return this.runLoad(this.lastEntry);
  }

  private runLoad(entry: SceneManifestEntry): Observable<LoadEvent> {
    const load$ = defer(() => from(this.fetchAndParse(entry))).pipe(
      timeout({ first: SCENE_ASSET_TIMEOUT_MS }),
      retry({
        count: SCENE_ASSET_RETRY_COUNT,
        delay: (error) => (this.isTransientError(error) ? of(0) : throwError(() => error))
      })
    );

    return concat(
      of({ type: "loading" } as const),
      load$.pipe(
        catchError((error) =>
          of({
            type: "failed",
            error: this.mapError(error)
          } as const)
        )
      )
    );
  }

  private async fetchAndParse(entry: SceneManifestEntry): Promise<ReadyEvent> {
    const asset = this.getPrimaryAsset(entry);

    if (asset.sizeBytes > SCENE_ASSET_BUDGET_BYTES) {
      throw new AssetBudgetError(
        `Scene asset ${asset.id} exceeds budget (${asset.sizeBytes} > ${SCENE_ASSET_BUDGET_BYTES}).`,
        asset.sizeBytes
      );
    }

    const format = this.resolveFormat(asset.url);
    const response = await this.fetchAsset(asset.url);
    const data = await this.parseAsset(response, format);

    return {
      type: "ready",
      payload: {
        sceneId: entry.sceneId,
        assetUrl: asset.url,
        format,
        sizeBytes: asset.sizeBytes,
        data
      }
    };
  }

  private getPrimaryAsset(entry: SceneManifestEntry): SceneManifestAsset {
    const primaryAsset = entry.assets[0];
    if (primaryAsset === undefined) {
      throw new AssetParseError(`Scene ${entry.sceneId} is missing asset metadata.`);
    }

    return primaryAsset;
  }

  private resolveFormat(url: string): SceneAssetFormat {
    const extension = this.extractExtension(url);
    if (extension === null || !(SCENE_ASSET_FORMATS as readonly string[]).includes(extension)) {
      throw new AssetParseError(
        `Asset format is not allowed. Supported formats: ${SCENE_ASSET_FORMATS.join(", ")}.`
      );
    }

    return extension as SceneAssetFormat;
  }

  private extractExtension(url: string): string | null {
    const path = url.split("?")[0];
    const parts = path.split(".");
    if (parts.length < 2) {
      return null;
    }

    return parts[parts.length - 1]?.toLowerCase() ?? null;
  }

  private async fetchAsset(url: string): Promise<Response> {
    let response: Response;
    try {
      response = await globalThis.fetch(url);
    } catch (error) {
      throw new AssetFetchError(
        `Asset request failed: ${error instanceof Error ? error.message : "unknown network error"}`
      );
    }

    if (!response.ok) {
      throw new AssetFetchError(`Asset request returned ${response.status}.`, response.status);
    }

    return response;
  }

  private async parseAsset(response: Response, format: SceneAssetFormat): Promise<ArrayBuffer | string | unknown> {
    try {
      if (format === "gltf") {
        return await response.json();
      }

      if (format === "ply") {
        return await response.text();
      }

      return await response.arrayBuffer();
    } catch (error) {
      throw new AssetParseError(
        `Asset parse failed: ${error instanceof Error ? error.message : "unknown parse error"}`
      );
    }
  }

  private mapError(error: unknown): AssetFetchError | AssetParseError | AssetBudgetError {
    if (error instanceof AssetFetchError || error instanceof AssetParseError || error instanceof AssetBudgetError) {
      return error;
    }

    if (error instanceof TimeoutError) {
      return new AssetFetchError(`Asset request timed out after ${SCENE_ASSET_TIMEOUT_MS}ms.`);
    }

    return new AssetFetchError("Asset request failed with an unknown error.");
  }

  private isTransientError(error: unknown): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }

    if (!(error instanceof AssetFetchError)) {
      return false;
    }

    return error.status === undefined || (TRANSIENT_HTTP_STATUSES as readonly number[]).includes(error.status);
  }
}
