/**
 * The Ground View scene's own art direction: one small palette and one sun,
 * shared by every scene component so the ground, forest, settlement and sky
 * read as a single place. Deliberately separate from the app's UI design
 * tokens (lib/design-tokens.ts): those are tuned for flat map legends and
 * paper-like surfaces, not for lit soil and foliage.
 *
 * The mood is a hazy, warm late afternoon in the Chattogram hills: low
 * golden sun, soft blue-green shade under the canopy, pale haze swallowing
 * the far ridges.
 */

/** Unit vector pointing FROM the scene TOWARD the sun (low, warm, off to one side). */
export const SUN_DIRECTION: readonly [number, number, number] = [0.55, 0.52, 0.65];

export const LOOK = {
  sky: {
    zenith: "#5f9fc4",
    mid: "#a9cddb",
    /** Horizon haze. Fog must use exactly this color so terrain melts into the sky. */
    horizon: "#e6dcc3",
    sunGlow: "#ffe2a8",
  },
  light: {
    sun: "#ffe6bd",
    skyFill: "#bcd7e6",
    groundBounce: "#5c6b3e",
  },
  ground: {
    grassLight: "#6f9440",
    grass: "#4f7d38",
    grassShade: "#34602f",
    leafLitter: "#6b5a34",
    /** Cleared earth: a desaturated brown/tan family, dry on top, darker where freshly cut. */
    soilDry: "#b8976a",
    soil: "#9a774e",
    soilCut: "#74563a",
    rock: "#8c8676",
    /** Exposed river sandbar (a char): pale, dry silt and sand near the
     *  water's own level, distinct from the hillside's browner cleared soil. */
    sand: "#d9c896",
    sandWet: "#b8a371",
    /** Wet riverbed silt, seen faintly through shallow, near-transparent water. */
    riverbed: "#746a4f",
  },
  /** Far hill ranges beyond the terrain, nearest to farthest. Unlit and hand-set
   *  (they ignore fog), each paler and warmer toward the horizon haze. */
  far: {
    ridgeNear: "#93a591",
    ridgeMid: "#a9b9b0",
    ridgeFar: "#c2cbc0",
  },
  /** Exponential fog density (per metre): clear at 30 m, hazed at 80 m, a pale
   *  silhouette by 110 m. Fog colour is always `sky.horizon`. */
  atmosphere: {
    fogDensity: 0.0105,
    exposure: 1.1,
    sunIntensity: 3.0,
    fillIntensity: 2.3,
  },
  foliage: {
    deep: "#1f4a2c",
    mid: "#2f6a35",
    bright: "#4d8a3a",
    lime: "#7da642",
    palm: "#3c7a3a",
    bamboo: "#8aa84f",
    undergrowth: "#3b7034",
    /** Shadowed inside of crowns and the dark underside of leaves. */
    shadow: "#163a24",
    /** Sun-struck crown tops and leaf tips. */
    sunlit: "#a3c24c",
    /** Older, yellowing fronds and grass. */
    dry: "#98a24a",
  },
  wood: {
    trunkDark: "#4a3728",
    trunk: "#6a513a",
    trunkPale: "#8a7a62",
    cut: "#c9a878",
    /** Weathered grey of old fence slats and poles. */
    weathered: "#7a6e5c",
  },
  road: {
    surface: "#a47a52",
    track: "#c2a078",
    edge: "#7d5d40",
  },
  metal: {
    wire: "#2b2a28",
  },
  /** River water, used only where real WorldCover data has open water
   *  (_lib/realTerrain.ts's `water` grid); absent elsewhere. */
  water: {
    deep: "#2f5a63",
    shallow: "#5f98a0",
    foam: "#dfeee9",
  },
  house: {
    wall: "#c8b08a",
    wallShade: "#a88f6a",
    plinth: "#8b7a66",
    roofTin: "#9fb0b6",
    roofRust: "#a8684a",
    door: "#5a4030",
    frame: "#6e5540",
    plinthShade: "#6a5d4d",
    /** Dark interior seen through window openings. */
    interior: "#2c2a25",
    insulator: "#d8d4c6",
    /** Washing on the line. */
    cloth: "#d9d2c0",
  },
} as const;
