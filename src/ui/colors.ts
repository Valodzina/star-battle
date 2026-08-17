export const COLORS = {
  white: 0xffffff,
  background: 0xb0b9c2,
  title: 0x2d3740,
  activeTint: 0x2d3740,
  inactiveTint: 0x68737C,

  menuButtonColorEasy:   0x789D72,
  menuButtonColorMedium: 0x6E9FB8,
  menuButtonColorHard:   0x907FAF,

  menuButton: 0xc4cacf,
  menuButtonHover: 0xD4D9DD,
  menuButtonDark: 0xaeb7be,
  menuButtonText : 0x2d3740,
  menuButtonSubText : 0x44505c,
  menuButtonBarTrackColor: 0xa4aab4,



  levelSelectHeaderEasy: 0x789D72,
  levelSelectHeaderMedium: 0x6E9FB8,
  levelSelectHeaderHard: 0x907FAF,

  // levelSelectHeaderEasy: 0x6F9369,
  // levelSelectHeaderMedium: 0x6090A8,
  // levelSelectHeaderHard: 0x806F9D,


  levelNavActiveTint: 0x44505c,
  levelNavInactiveTint: 0x68737C,

  levelButton:      0xC4CACF,
  levelButtonHover: 0xD4D9DD,

  levelButtonLocked:0x969FA8,

  // Level number
  levelNumber:      0x2D3740,
  levelNumberLocked:0x68737C,

  // Level states
  starFilled:       0xE5A85F,
  starOutline:      0x7F8992,
  lock:             0x606B74,


  text: 0xffffff,
  textMuted: 0xb0b0c8,


  gridLine: 0x44505c,
  regionBorder: 0x44505c,
  boardUnderlay: 0x44505c,
  cellPlayable: 0x2e2e4e,

  elementFill: 0x44505c,
  dotFill: 0x677482,

  victoryCard: 0xfcf7f4,
  victoryCardShadow: 0x000000,
  victoryCardTitle: 0x2a2a4a,
  victoryCardTime: 0x44505c,
  victoryStarTint: 0xe7c48b,
  victoryButtonColor: 0x799d72,

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

export const REGION_BACKGROUNDS: readonly number[] = [
  0x70808E, // from 0xB3C9D8
  0x6C7B8B, // from 0xA9BCD2
  0x73788B, // from 0xBAB6D1
  0x797989, // from 0xC9B7CC
  0x7F7B86, // from 0xD8BBC4
  0x7F7A79, // from 0xD7B9A5
  0x7F8079, // from 0xD8C9A5
  0x75837E, // from 0xBFCFB0
  0x6E7E80, // from 0xADC4B6
  0x7A7A84, // from 0xCBB8C0
] as const;

export const REGION_STAR_OUTLINES: readonly number[] = [
  0xC4D5E1, // from 0xB3C9D8
  0xBCCBDC, // from 0xA9BCD2
  0xC9C6DB, // from 0xBAB6D1
  0xD5C7D7, // from 0xC9B7CC
  0xE1CAD1, // from 0xD8BBC4
  0xE0C8B9, // from 0xD7B9A5
  0xE1D5B9, // from 0xD8C9A5
  0xCDDAC1, // from 0xBFCFB0
  0xBFD1C6, // from 0xADC4B6
  0xD6C8CE, // from 0xCBB8C0
] as const;

export function getRegionColor(regionId: number): number {
  return REGION_COLORS[regionId % REGION_COLORS.length] ?? COLORS.cellPlayable;
}

export function getRegionStarOutline(regionId: number): number {
  return REGION_STAR_OUTLINES[regionId % REGION_STAR_OUTLINES.length] ?? COLORS.elementFill;
}
