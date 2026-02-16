export const HERO_METRIC_CONSTANTS = {
  improvementMiou: 1.9
} as const;

export const DASHBOARD_METRIC_CONSTANTS = {
  improvementMiou: 8.42,
  bandwidthReductionPercent: 35,
  bandwidthReductionApproximate: true
} as const;

export const METRIC_CONSTANTS = {
  hero: HERO_METRIC_CONSTANTS,
  dashboard: DASHBOARD_METRIC_CONSTANTS
} as const;
