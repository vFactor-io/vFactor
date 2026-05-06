import { describe, expect, it } from "vitest";

import { resolveDesktopAppBranding, resolveDesktopAppStageLabel } from "./appBranding.ts";

describe("resolveDesktopAppStageLabel", () => {
  it("uses Dev in desktop development", () => {
    expect(
      resolveDesktopAppStageLabel({
        isDevelopment: true,
        appVersion: "0.0.17-beta.1",
      }),
    ).toBe("Dev");
  });

  it("uses Alpha for packaged builds", () => {
    expect(
      resolveDesktopAppStageLabel({
        isDevelopment: false,
        appVersion: "0.0.17",
      }),
    ).toBe("Alpha");
  });
});

describe("resolveDesktopAppBranding", () => {
  it("returns a complete desktop branding payload", () => {
    expect(
      resolveDesktopAppBranding({
        isDevelopment: false,
        appVersion: "0.0.17",
      }),
    ).toEqual({
      baseName: "vFactor",
      stageLabel: "Alpha",
      displayName: "vFactor (Alpha)",
    });
  });
});
