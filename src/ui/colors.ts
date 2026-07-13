export const COLORS = {
  background: 0x1a1a2e,
  buttonEasy: 0x2d6a4f,
  buttonMedium: 0x1d3557,
  buttonHard: 0x7b2d26,
  buttonBack: 0x3d3d5c,
  tile: 0x2a2a4a,
  tileHover: 0x3d3d6b,
  text: 0xffffff,
  textMuted: 0xb0b0c8,
  title: 0xe8e8f0,
  gridLine: 0x5a5a7a,
  regionBorder: 0xe8e8f0,
  cellPlayable: 0x2e2e4e,
  cellEmpty: 0x1a1a2e,
  elementFill: 0xf4a261,
  dotFill: 0xffffff,
  victoryOverlay: 0x000000,
  victoryText: 0xffffff,
} as const;

export const REGION_COLORS: readonly number[] = [
  0x3d5a80,
  0x4a7c59,
  0x7b5e57,
  0x6b4c9a,
  0x8b6914,
  0x4a6670,
  0x7a4a6b,
  0x5a7060,
] as const;

export function getRegionColor(regionId: number): number {
  return REGION_COLORS[regionId % REGION_COLORS.length] ?? COLORS.cellPlayable;
}
