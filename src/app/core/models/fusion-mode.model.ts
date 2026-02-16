export const FUSION_MODES = [
  "single_agent",
  "naive_fusion",
  "vogs",
  "ground_truth"
] as const;

export type FusionMode = (typeof FUSION_MODES)[number];
