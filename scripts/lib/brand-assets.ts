export const BRAND_ASSET_PATHS = {
  productionMacIconPng: "assets/vfactor/app-icon-1024.png",
  productionLinuxIconPng: "assets/vfactor/app-icon-1024.png",
  productionWindowsIconIco: "assets/vfactor/icon.ico",
  productionWebFaviconIco: "assets/vfactor/favicon.ico",
  productionWebFavicon16Png: "assets/vfactor/favicon-16x16.png",
  productionWebFavicon32Png: "assets/vfactor/favicon-32x32.png",
  productionWebAppleTouchIconPng: "assets/vfactor/apple-touch-icon.png",

  developmentDesktopIconPng: "assets/vfactor/dev/icon.png",
  developmentDockIconPng: "assets/vfactor/dev/dock.png",
  developmentMacIconIcns: "assets/vfactor/dev/icon.icns",
  developmentWindowsIconIco: "assets/vfactor/dev/icon.ico",
  developmentWebFaviconIco: "assets/vfactor/dev/icon.ico",
  developmentWebFavicon16Png: "assets/vfactor/dev/favicon-16x16.png",
  developmentWebFavicon32Png: "assets/vfactor/dev/favicon-32x32.png",
  developmentWebAppleTouchIconPng: "assets/vfactor/dev/apple-touch-icon.png",
} as const;

export interface IconOverride {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

export const DEVELOPMENT_ICON_OVERRIDES: ReadonlyArray<IconOverride> = [
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFaviconIco,
    targetRelativePath: "dist/client/favicon.ico",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFavicon16Png,
    targetRelativePath: "dist/client/favicon-16x16.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFavicon32Png,
    targetRelativePath: "dist/client/favicon-32x32.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebAppleTouchIconPng,
    targetRelativePath: "dist/client/apple-touch-icon.png",
  },
];

export const PUBLISH_ICON_OVERRIDES: ReadonlyArray<IconOverride> = [
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFaviconIco,
    targetRelativePath: "dist/client/favicon.ico",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFavicon16Png,
    targetRelativePath: "dist/client/favicon-16x16.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFavicon32Png,
    targetRelativePath: "dist/client/favicon-32x32.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebAppleTouchIconPng,
    targetRelativePath: "dist/client/apple-touch-icon.png",
  },
];
