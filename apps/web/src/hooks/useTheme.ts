import { applyAppearance, syncBrowserChromeTheme, useAppearance } from "../appearance/store";
import type { ThemeId } from "../appearance/types";

export { applyAppearance, syncBrowserChromeTheme, useAppearance };
export type { ThemeId } from "../appearance/types";

export function useTheme() {
  const appearance = useAppearance();

  return {
    theme: appearance.themeId,
    setTheme: appearance.setThemeId,
    resolvedTheme: appearance.resolvedAppearance,
  } as {
    readonly theme: ThemeId;
    readonly setTheme: (themeId: ThemeId) => void;
    readonly resolvedTheme: "light" | "dark";
  };
}
