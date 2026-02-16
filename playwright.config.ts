import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { platform } from "node:process";

const resolveChromeChannel = (): "chrome" | undefined => {
  const chromePathsByPlatform: Record<string, string[]> = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/opt/google/chrome/chrome"
    ],
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    ]
  };

  const chromePaths = chromePathsByPlatform[platform] ?? [];
  return chromePaths.some((path) => existsSync(path)) ? "chrome" : undefined;
};

const chromeChannel = resolveChromeChannel();
const useChromeChannel = chromeChannel !== undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    ...(useChromeChannel
      ? {
          channel: chromeChannel,
          headless: false,
          launchOptions: {
            args: ["--headless=new"]
          }
        }
      : {
          headless: true
        })
  }
});
