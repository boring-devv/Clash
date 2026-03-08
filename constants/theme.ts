import { Dimensions } from 'react-native';

export const { width: SW, height: SH } = Dimensions.get('window');

export const C = {
  bg:          '#07070F',
  bgCard:      '#0E0E1C',
  bgElevated:  '#141428',
  bgMuted:     '#1C1C35',

  purple:      '#8B5CF6',
  purpleLight: '#A78BFA',
  purpleDark:  '#6D28D9',
  purpleDim:   '#8B5CF615',
  purpleGlow:  '#8B5CF640',
  purpleFaint: '#8B5CF610',

  pink:        '#EC4899',
  cyan:        '#22D3EE',
  gold:        '#F59E0B',
  green:       '#10B981',
  red:         '#EF4444',
  orange:      '#F97316',

  t1:  '#F0F0FF',
  t2:  '#8080A8',
  t3:  '#505070',
  t4:  '#2A2A50',

  // Aliases for backward compatibility
  text: '#F0F0FF',
  textSub: '#8080A8',
  textMuted: '#505070',

  border:      '#1E1E38',
  borderLight: '#2E2E50',

  gPurple:  ['#8B5CF6', '#6D28D9'] as [string, string],
  gFire:    ['#F97316', '#EC4899'] as [string, string],
  gDark:    ['#0E0E1C', '#07070F'] as [string, string],
  gGold:    ['#F59E0B', '#D97706'] as [string, string],
  gCyan:    ['#22D3EE', '#0EA5E9'] as [string, string],
  gViolet:  ['#A78BFA', '#8B5CF6'] as [string, string],
};

export const light = {
  bg: '#FFFFFF',
  bgCard: '#F8F8FA',
  bgElevated: '#FFFFFF',
  bgMuted: '#F1F1F5',
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  purpleDark: '#6D28D9',
  pink: '#EC4899',
  cyan: '#22D3EE',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  orange: '#F97316',
  text: '#000000',
  textSub: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  icon: '#333333',
  background: '#FFFFFF',
};

export const dark = {
  bg: '#07070F',
  bgCard: '#0E0E1C',
  bgElevated: '#141428',
  bgMuted: '#1C1C35',
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  purpleDark: '#6D28D9',
  pink: '#EC4899',
  cyan: '#22D3EE',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  orange: '#F97316',
  text: '#F0F0FF',
  textSub: '#8080A8',
  textMuted: '#505070',
  border: '#1E1E38',
  borderLight: '#2E2E50',
  icon: '#F0F0FF',
  background: '#07070F',
};

// Export Colors as alias for C for backward compatibility
export const Colors = {
  ...C,
  light,
  dark,
};

export const T = {
  xs:  10, sm: 12, base: 14, md: 15,
  lg:  17, xl: 20, '2xl': 24, '3xl': 30,
  '4xl': 36, '5xl': 48, '6xl': 60,
};

export const S = {
  xs: 4, sm: 8, md: 16, lg: 24,
  xl: 32, '2xl': 48, '3xl': 64,
};

export const R = {
  sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, full: 9999,
};

export const CAT_ICONS: Record<string, string> = {
  fitness: '💪', gaming: '🎮', cooking: '🍳', art: '🎨',
  music: '🎵', dance: '💃', sport: '⚽', other: '⚡',
};

export const CAT_COLORS: Record<string, string> = {
  fitness: '#10B981', gaming: '#8B5CF6', cooking: '#F59E0B',
  art: '#EC4899', music: '#22D3EE', dance: '#F97316',
  sport: '#3B82F6', other: '#6366F1',
};

export const STATUS_META: Record<string, { label: string; color: string }> = {
  open:         { label: 'OPEN',      color: '#10B981' },
  active:       { label: 'LIVE',      color: '#22D3EE' },
  pending_vote: { label: 'VOTE NOW',  color: '#F59E0B' },
  resolved:     { label: 'ENDED',     color: '#8B5CF6' },
  expired:      { label: 'EXPIRED',   color: '#505070' },
};
