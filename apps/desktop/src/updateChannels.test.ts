import { describe, expect, it } from "vitest";

import {
  doesVersionMatchDesktopUpdateChannel,
  resolveDefaultDesktopUpdateChannel,
} from "./updateChannels.ts";

describe("resolveDefaultDesktopUpdateChannel", () => {
  it("defaults releases to latest", () => {
    expect(resolveDefaultDesktopUpdateChannel("0.0.17")).toBe("latest");
    expect(resolveDefaultDesktopUpdateChannel("0.0.17-beta.1")).toBe("latest");
  });
});

describe("doesVersionMatchDesktopUpdateChannel", () => {
  it("accepts releases on the latest channel", () => {
    expect(doesVersionMatchDesktopUpdateChannel("0.0.17", "latest")).toBe(true);
    expect(doesVersionMatchDesktopUpdateChannel("0.0.17-beta.1", "latest")).toBe(true);
  });
});
