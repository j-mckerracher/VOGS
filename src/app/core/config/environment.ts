// Use same-origin proxy in dev to avoid CORS, direct CloudFront in production
const isDevServer = typeof globalThis !== "undefined"
  && typeof globalThis.location !== "undefined"
  && globalThis.location?.hostname === "localhost";

export const environment = {
  cloudfrontBaseUrl: isDevServer
    ? "/cdn-proxy"
    : "https://d3msd1uq322nhw.cloudfront.net",
  sceneId: "002",
  cameraCount: 5,
  frameCount: 199
} as const;
