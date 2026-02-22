// Dev: serve local data from src/assets (no AWS costs)
// Prod: direct CloudFront URL
// To test against AWS in dev, change "/assets" to "/cdn-proxy" below
const isDevServer = typeof globalThis !== "undefined"
  && typeof globalThis.location !== "undefined"
  && globalThis.location?.hostname === "localhost";

export const environment = {
  cloudfrontBaseUrl: isDevServer
    ? "/assets"
    : "https://d3msd1uq322nhw.cloudfront.net",
  sceneId: "002",
  cameraCount: 5,
  frameCount: 199
} as const;
