import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_DESKTOP_SETTINGS,
  readDesktopSettings,
  resolveDefaultDesktopSettings,
  setDesktopServerExposurePreference,
  setDesktopUpdateChannelPreference,
  writeDesktopSettings,
} from "./desktopSettings.ts";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeSettingsPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "t3-desktop-settings-test-"));
  tempDirectories.push(directory);
  return path.join(directory, "desktop-settings.json");
}

describe("desktopSettings", () => {
  it("returns defaults when no settings file exists", () => {
    expect(readDesktopSettings(makeSettingsPath(), "0.0.17")).toEqual(DEFAULT_DESKTOP_SETTINGS);
  });

  it("defaults prerelease builds to the latest update channel", () => {
    expect(resolveDefaultDesktopSettings("0.0.17-beta.1")).toEqual({
      serverExposureMode: "local-only",
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("persists and reloads the configured server exposure mode", () => {
    const settingsPath = makeSettingsPath();

    writeDesktopSettings(settingsPath, {
      serverExposureMode: "network-accessible",
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });

    expect(readDesktopSettings(settingsPath, "0.0.17")).toEqual({
      serverExposureMode: "network-accessible",
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });
  });

  it("preserves the requested network-accessible preference across temporary fallback", () => {
    expect(
      setDesktopServerExposurePreference(
        {
          serverExposureMode: "local-only",
          updateChannel: "latest",
          updateChannelConfiguredByUser: false,
        },
        "network-accessible",
      ),
    ).toEqual({
      serverExposureMode: "network-accessible",
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("persists the requested update channel metadata", () => {
    expect(
      setDesktopUpdateChannelPreference(
        {
          serverExposureMode: "local-only",
          updateChannel: "latest",
          updateChannelConfiguredByUser: false,
        },
        "latest",
      ),
    ).toEqual({
      serverExposureMode: "local-only",
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });
  });

  it("falls back to defaults when the settings file is malformed", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(settingsPath, "{not-json", "utf8");

    expect(readDesktopSettings(settingsPath, "0.0.17")).toEqual(DEFAULT_DESKTOP_SETTINGS);
  });

  it("keeps legacy settings on the latest channel", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify({ serverExposureMode: "local-only" }), "utf8");

    expect(readDesktopSettings(settingsPath, "0.0.17-beta.1")).toEqual({
      serverExposureMode: "local-only",
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("ignores unsupported legacy update channels", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        serverExposureMode: "local-only",
        updateChannel: "canary",
      }),
      "utf8",
    );

    expect(readDesktopSettings(settingsPath, "0.0.17")).toEqual({
      serverExposureMode: "local-only",
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("preserves explicit update channel metadata", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        serverExposureMode: "local-only",
        updateChannel: "latest",
        updateChannelConfiguredByUser: true,
      }),
      "utf8",
    );

    expect(readDesktopSettings(settingsPath, "0.0.17-beta.1")).toEqual({
      serverExposureMode: "local-only",
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });
  });
});
