import type { DesktopUpdateChannel } from "@t3tools/contracts";

export function resolveDefaultDesktopUpdateChannel(_appVersion: string): DesktopUpdateChannel {
  return "latest";
}

export function doesVersionMatchDesktopUpdateChannel(
  _version: string,
  channel: DesktopUpdateChannel,
): boolean {
  return channel === "latest";
}
