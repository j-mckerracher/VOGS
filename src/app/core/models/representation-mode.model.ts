export const REPRESENTATION_MODES = ["occupancy", "gaussian"] as const;

export type RepresentationMode = (typeof REPRESENTATION_MODES)[number];
