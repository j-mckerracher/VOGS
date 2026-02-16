import type { AssetBudgetError } from "../errors/asset-budget.error";
import type { AssetFetchError } from "../errors/asset-fetch.error";
import type { AssetParseError } from "../errors/asset-parse.error";
import type { ParsedScenePayload } from "./parsed-scene-payload.model";

export const LOAD_EVENT_TYPES = ["loading", "ready", "failed"] as const;

export type LoadEventType = (typeof LOAD_EVENT_TYPES)[number];

export interface LoadingEvent {
  readonly type: "loading";
}

export interface ReadyEvent {
  readonly type: "ready";
  readonly payload: ParsedScenePayload;
}

export interface FailedEvent {
  readonly type: "failed";
  readonly error: AssetFetchError | AssetParseError | AssetBudgetError;
}

export type LoadEvent = LoadingEvent | ReadyEvent | FailedEvent;

export const isLoadEventType = (value: string): value is LoadEventType =>
  LOAD_EVENT_TYPES.includes(value as LoadEventType);
