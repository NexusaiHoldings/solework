/**
 * active-theme — the resolved ThemeContract this company wears.
 * Written by provisioning (_step_substrate_install): an approved mood
 * board's derived theme wins, else the CMO's authored ThemeContract
 * (company-theme-authoring-001 / visual phase 3b). Do NOT hand-edit.
 */
import type { ThemeContract } from "./contract";

export const activeTheme: ThemeContract = {
  "type": {
    "fontBody": "inter",
    "fontHeading": "playfair"
  },
  "color": {
    "bg": "#faf8f5",
    "text": "#1c1612",
    "accent": "#8b3a2a",
    "border": "#ddd4c8",
    "danger": "#a32d2d",
    "success": "#2d6b45",
    "surface": "#f2ede6",
    "textMuted": "#6b5f52",
    "accentText": "#ffffff",
    "surfaceAlt": "#e8e0d5",
    "borderStrong": "#b8a99a"
  },
  "shape": {
    "radius": 6
  }
};
