export const COLORS = {
  background: 0x1a1a2e,
  buttonEasy: 0x2d6a4f,
  buttonMedium: 0x1d3557,
  buttonHard: 0x7b2d26,
  buttonBack: 0x3d3d5c,
  tile: 0x2a2a4a,
  tileHover: 0x3d3d6b,
  tileLocked: 0x555555,
  tileCompletedBadge: 0xffd700,
  text: 0xffffff,
  textMuted: 0xb0b0c8,
  title: 0xe8e8f0,

  //gridLine: 0xe8e8e8,
  // regionBorder: 0xe8e8e8,
  // boardUnderlay: 0xe8e8e8,
  gridLine: 0x44505c,
  regionBorder: 0x44505c,
  boardUnderlay: 0x44505c,
  cellPlayable: 0x2e2e4e,

  elementFill: 0xf4a261,
  dotFill: 0x677482,
  victoryOverlay: 0x000000,
  victoryText: 0xffffff,
  answerColor: 0x000000,
} as const;

export const REGION_COLORS: readonly number[] = [
  0x9CB8CB,
  0x8EA5C0,
  0xA098BE,
  0xB39BB8,
  0xC49FAA,
  0xC39B87,
  0xC5B187,
  0xA5B996,
  0x91ADA0,
  0xB6A0A9,
] as const;

export function getRegionColor(regionId: number): number {
  return REGION_COLORS[regionId % REGION_COLORS.length] ?? COLORS.cellPlayable;
}
