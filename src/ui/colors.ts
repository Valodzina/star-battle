export const COLORS = {
  background: 0xb0b9c2,


  // buttonEasy: 0x83A77E,
  // buttonMedium: 0x78A7BC,
  // buttonHard: 0x9989B5,

  buttonEasy:   0x789D72,
buttonMedium: 0x6E9FB8,
buttonHard:   0x907FAF,

  menuButton: 0xc4cacf,
  menuButtonDark: 0xaeb7be,
  menuButtonText : 0x2d3740,
  menuButtonSubText : 0x44505c,




  buttonBack: 0x3d3d5c,

  


  tile: 0x2a2a4a,
  tileHover: 0x3d3d6b,
  tileLocked: 0x555555,
  tileCompletedBadge: 0xffd700,
  text: 0xffffff,
  textMuted: 0xb0b0c8,
  title: 0x2d3740,

  //gridLine: 0xe8e8e8,
  // regionBorder: 0xe8e8e8,
  // boardUnderlay: 0xe8e8e8,
  gridLine: 0x44505c,
  regionBorder: 0x44505c,
  boardUnderlay: 0x44505c,
  cellPlayable: 0x2e2e4e,

  elementFill: 0x44505c,
  dotFill: 0x677482,
  victoryCard: 0xffffff,
  victoryCardShadow: 0x000000,
  victoryCardTitle: 0x2a2a4a,
  victoryCardTime: 0x44505c,
  victoryStarTint: 0xecca92,
  answerColor: 0x000000,
} as const;

export const REGION_COLORS: readonly number[] = [
  0xB3C9D8,
0xA9BCD2,
0xBAB6D1,
0xC9B7CC,
0xD8BBC4,
0xD7B9A5,
0xD8C9A5,
0xBFCFB0,
0xADC4B6,
0xCBB8C0,
] as const;

export function getRegionColor(regionId: number): number {
  return REGION_COLORS[regionId % REGION_COLORS.length] ?? COLORS.cellPlayable;
}
