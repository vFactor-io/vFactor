import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  clampTextSizePx,
  DEFAULT_TEXT_SIZE_PX,
  DEFAULT_THEME_ID,
  getThemeDefinition,
  normalizeThemeId,
  resolveThemeIdForAppearance,
} from "./themeRegistry";
import type { AppearanceSnapshot, ConcreteThemeId, ResolvedAppearance, ThemeId } from "./types";

const THEME_STORAGE_KEY = "vfactor:appearance-theme";
const LEGACY_THEME_STORAGE_KEYS = ["vfactor:theme", "t3code:theme"] as const;
const TEXT_SIZE_STORAGE_KEY = "vfactor:appearance-text-size-px";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLOR_META_NAME = "theme-color";
const DYNAMIC_THEME_COLOR_SELECTOR = `meta[name="${THEME_COLOR_META_NAME}"][data-dynamic-theme-color="true"]`;

type AppearanceOverrides = {
  themeId?: ThemeId;
  textSizePx?: number;
  systemAppearance?: ResolvedAppearance;
};

const listeners = new Set<() => void>();
let lastDesktopTheme: "light" | "dark" | "system" | null = null;

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getSystemAppearance(): ResolvedAppearance {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function normalizePersistedThemeId(value: string | null | undefined): ThemeId {
  if (value === "light") return "vfactor-light";
  if (value === "dark") return "vfactor-dark";
  return normalizeThemeId(value);
}

function getStoredThemeId(): ThemeId {
  if (!hasBrowserStorage()) return DEFAULT_THEME_ID;
  const storedThemeId = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedThemeId) return normalizePersistedThemeId(storedThemeId);
  for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
    const legacyThemeId = localStorage.getItem(legacyKey);
    if (legacyThemeId) return normalizePersistedThemeId(legacyThemeId);
  }
  return DEFAULT_THEME_ID;
}

function getStoredTextSizePx(): number {
  if (!hasBrowserStorage()) return DEFAULT_TEXT_SIZE_PX;
  const rawValue = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
  const parsedValue = rawValue === null ? DEFAULT_TEXT_SIZE_PX : Number.parseInt(rawValue, 10);
  return clampTextSizePx(parsedValue);
}

function buildSnapshot(
  themeId: ThemeId,
  textSizePx: number,
  systemAppearance: ResolvedAppearance,
): AppearanceSnapshot {
  const resolvedAppearance =
    themeId === "system" ? systemAppearance : getThemeDefinition(themeId).appearance;
  const resolvedThemeId: ConcreteThemeId =
    themeId === "system" ? resolveThemeIdForAppearance(resolvedAppearance) : themeId;
  const theme = getThemeDefinition(resolvedThemeId);

  return {
    themeId,
    resolvedAppearance,
    resolvedThemeId,
    textSizePx: clampTextSizePx(textSizePx),
    cornerStyle: "soft",
    theme,
    monacoThemeId: theme.monaco.id,
    pierreDiffTheme: theme.adapters.diff.pierreTheme,
  };
}

let snapshot = buildSnapshot(getStoredThemeId(), getStoredTextSizePx(), getSystemAppearance());

function ensureThemeColorMetaTag(): HTMLMetaElement {
  let element = document.querySelector<HTMLMetaElement>(DYNAMIC_THEME_COLOR_SELECTOR);
  if (element) return element;

  element = document.createElement("meta");
  element.name = THEME_COLOR_META_NAME;
  element.setAttribute("data-dynamic-theme-color", "true");
  document.head.append(element);
  return element;
}

function normalizeThemeColor(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (
    !normalizedValue ||
    normalizedValue === "transparent" ||
    normalizedValue === "rgba(0, 0, 0, 0)" ||
    normalizedValue === "rgba(0 0 0 / 0)"
  ) {
    return null;
  }

  return value?.trim() ?? null;
}

function resolveBrowserChromeSurface(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("main[data-slot='sidebar-inset']") ??
    document.querySelector<HTMLElement>("[data-slot='sidebar-inner']") ??
    document.body
  );
}

export function syncBrowserChromeTheme() {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return;
  const surfaceColor = normalizeThemeColor(
    getComputedStyle(resolveBrowserChromeSurface()).backgroundColor,
  );
  const fallbackColor = normalizeThemeColor(getComputedStyle(document.body).backgroundColor);
  const backgroundColor = surfaceColor ?? fallbackColor;
  if (!backgroundColor) return;

  document.documentElement.style.backgroundColor = backgroundColor;
  document.body.style.backgroundColor = backgroundColor;
  ensureThemeColorMetaTag().setAttribute("content", backgroundColor);
}

function syncDesktopTheme(next: AppearanceSnapshot) {
  if (typeof window === "undefined") return;
  const bridge = window.desktopBridge;
  const desktopTheme = next.themeId === "system" ? "system" : next.resolvedAppearance;
  if (!bridge || lastDesktopTheme === desktopTheme) {
    return;
  }

  lastDesktopTheme = desktopTheme;
  void bridge.setTheme(desktopTheme).catch(() => {
    if (lastDesktopTheme === desktopTheme) {
      lastDesktopTheme = null;
    }
  });
}

export function applyAppearance(overrides: AppearanceOverrides = {}): AppearanceSnapshot {
  const next = buildSnapshot(
    overrides.themeId ?? snapshot.themeId,
    overrides.textSizePx ?? snapshot.textSizePx,
    overrides.systemAppearance ?? getSystemAppearance(),
  );

  if (typeof document === "undefined") {
    return next;
  }

  const root = document.documentElement;
  root.dataset.theme = next.themeId;
  root.dataset.resolvedTheme = next.resolvedThemeId;
  root.dataset.appearance = next.resolvedAppearance;
  root.dataset.cornerStyle = next.cornerStyle;
  root.classList.toggle("dark", next.resolvedAppearance === "dark");
  root.style.colorScheme = next.resolvedAppearance;
  root.style.setProperty("--app-text-size", `${next.textSizePx}px`);

  for (const [name, value] of Object.entries(next.theme.tokens)) {
    root.style.setProperty(`--${name}`, value);
  }

  syncBrowserChromeTheme();
  syncDesktopTheme(next);
  return next;
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function setAppearanceState(overrides: AppearanceOverrides) {
  snapshot = applyAppearance(overrides);
  notify();
  return snapshot;
}

export function getAppearanceSnapshot(): AppearanceSnapshot {
  return snapshot;
}

function subscribeToAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return subscribeToAppearance(listener);
  const unsubscribe = subscribeToAppearance(listener);

  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  const handleMediaChange = (event: MediaQueryListEvent) => {
    if (snapshot.themeId === "system") {
      setAppearanceState({ systemAppearance: event.matches ? "dark" : "light" });
    }
  };
  mediaQuery.addEventListener("change", handleMediaChange);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== TEXT_SIZE_STORAGE_KEY) return;
    setAppearanceState({
      themeId: getStoredThemeId(),
      textSizePx: getStoredTextSizePx(),
    });
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    mediaQuery.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function setAppearanceThemeId(themeId: ThemeId): void {
  if (hasBrowserStorage()) {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
      localStorage.removeItem(legacyKey);
    }
  }
  setAppearanceState({ themeId });
}

export function setAppearanceTextSizePx(textSizePx: number): void {
  const nextTextSizePx = clampTextSizePx(textSizePx);
  if (hasBrowserStorage()) {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, String(nextTextSizePx));
  }
  setAppearanceState({ textSizePx: nextTextSizePx });
}

export function useAppearance(): AppearanceSnapshot & {
  setThemeId: (themeId: ThemeId) => void;
  setTextSizePx: (textSizePx: number) => void;
} {
  const currentSnapshot = useSyncExternalStore(
    subscribe,
    getAppearanceSnapshot,
    getAppearanceSnapshot,
  );

  useEffect(() => {
    snapshot = applyAppearance();
  }, []);

  return {
    ...currentSnapshot,
    setThemeId: useCallback((themeId: ThemeId) => setAppearanceThemeId(themeId), []),
    setTextSizePx: useCallback((textSizePx: number) => setAppearanceTextSizePx(textSizePx), []),
  };
}

if (typeof document !== "undefined") {
  snapshot = applyAppearance();
}
