export const Colors = {
  // Wood
  woodLight: '#d4a264',
  woodMid: '#b8834a',
  woodDark: '#8a5e2e',
  woodGrain: '#9e6e38',

  // Paper
  paperFace: '#faf8f2',
  paperAged: '#f2e8d0',
  paperLines: '#c4cfe0',
  paperEdge: '#d8ccb0',

  // Ink
  inkDark: '#1a1208',
  inkMid: '#3d2e18',
  inkFaint: '#8a7a60',

  // Cards
  cardRed: '#c0392b',
  cardBlack: '#1a1208',

  // Accent
  amber: '#d4890a',
  amberLight: '#f0a830',

  // Feedback
  success: '#3a7d44',
  error: '#a32020',
} as const;

export const Fonts = {
  display: 'IMFellEnglishSC_400Regular',
  handwriting: 'Caveat_400Regular',
  handwritingBold: 'Caveat_700Bold',
  body: 'Lato_400Regular',
  bodyBold: 'Lato_700Bold',
} as const;

export const Shadows = {
  card: {
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  panel: {
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
