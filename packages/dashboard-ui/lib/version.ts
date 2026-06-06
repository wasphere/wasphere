import pkg from "../package.json"

/**
 * Single source of truth for the displayed app version. Reads package.json, so
 * bumping the version at release time automatically updates everywhere it's shown
 * (header badge, login footer, …) — no more hardcoded "v1.0".
 */
export const APP_VERSION: string = pkg.version
