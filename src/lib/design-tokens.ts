/**
 * منظومة رموز التصميم الموحدة (Design Tokens) - نظام محل شفرة
 * مستوحاة من لوحة الألوان MP072:
 * - Palladian (#EEE9DF): الخلفية الفاتحة المرجعية
 * - Oatmeal (#C9C1B1): الحدود والفواصل والأسطح الثانوية
 * - Blue Fantastic (#2C3B4D): النصوص الأساسية والأرقام الكبيرة والقوائم الجانبية
 * - Abyssal Anchorfish Blue (#1B2632): العناوين الداكنة وخلفية الوضع الداكن
 * - Burning Flame (#FFB162): اللون الأساسي التفاعلي وحلقة التركيز الافتراضية
 * - Truffle Trouble (#A35139): خلفيات التنبيهات والشارات والأيقونات
 */

export const PALETTE = {
  palladian: '#EEE9DF',
  oatmeal: '#C9C1B1',
  blueFantastic: '#2C3B4D',
  abyssal: '#1B2632',
  burningFlame: '#FFB162',
  truffleTrouble: '#A35139',
  // درجات متوازنة داخل نفس العائلة اللونية لتحسين العمق والتباين (>= 4.5:1)
  lightCanvas: '#F1ECE2',
  warmPaper: '#FBF9F4',
  oatmealSoft: '#EBE5D8',
  chartDayBarLight: '#E0D6C2',
  lightBorder: '#BDB3A0',
  lightDivider: '#D6CDBA',
  truffleInkLight: '#F7F4EE',
  mutedFantastic: '#4A596B',
  mutedSuccessLight: '#2F5E4E',
  mutedSuccessDark: '#86C5AA',
  mutedWarningLight: '#7A4816',
  mutedDangerLight: '#853D29',
  darkSurface: '#263647',
  darkSurfaceAlt: '#2F4054',
  darkBorder: '#4E6279',
  darkBadgeNeutral: '#5A6B7D',
} as const;

export const THEME_MODES = {
  light: {
    canvas: PALETTE.lightCanvas,
    surface: PALETTE.warmPaper,
    surfaceAlt: PALETTE.oatmealSoft,
    border: PALETTE.lightBorder,
    divider: PALETTE.lightDivider,
    ink: PALETTE.blueFantastic,
    inkStrong: PALETTE.abyssal,
    kpiNumber: PALETTE.blueFantastic,
    inkMuted: PALETTE.mutedFantastic,
    accent: PALETTE.burningFlame,
    accentInk: PALETTE.abyssal,
    secondaryAccent: PALETTE.truffleTrouble,
    secondaryInk: PALETTE.truffleInkLight,
    dangerText: PALETTE.mutedDangerLight,
    success: PALETTE.mutedSuccessLight,
    warning: PALETTE.mutedWarningLight,
    danger: PALETTE.truffleTrouble,
  },
  dark: {
    canvas: PALETTE.abyssal,
    surface: PALETTE.darkSurface,
    surfaceAlt: PALETTE.darkSurfaceAlt,
    border: PALETTE.darkBorder,
    divider: '#3F5166',
    ink: PALETTE.palladian,
    inkStrong: PALETTE.truffleInkLight,
    kpiNumber: PALETTE.truffleInkLight,
    inkMuted: PALETTE.oatmeal,
    badgeNeutral: PALETTE.darkBadgeNeutral,
    accent: PALETTE.burningFlame,
    accentInk: PALETTE.abyssal,
    secondaryAccent: PALETTE.truffleTrouble,
    secondaryInk: PALETTE.truffleInkLight,
    dangerText: '#F2A48E',
    success: PALETTE.mutedSuccessDark,
    warning: PALETTE.burningFlame,
    danger: PALETTE.truffleTrouble,
  },
} as const;

export const RADII = {
  control: '0.75rem',
  card: '1rem',
  hero: '1.5rem',
  pill: '9999px',
} as const;

export const SPACING = {
  pageGap: '1.25rem',
  cardPadding: '1.25rem',
  touchTargetMin: '2.75rem',
} as const;

export const SHADOWS = {
  card: '0 2px 6px 0 rgb(27 38 50 / 0.10)',
  elevated: '0 12px 32px -8px rgb(27 38 50 / 0.16)',
  accentGlow: '0 6px 18px -4px rgb(255 177 98 / 0.35)',
} as const;

export const CHART_TOKENS = {
  normalDayLight: PALETTE.chartDayBarLight,
  currentDayBar: PALETTE.burningFlame,
  darkBase: PALETTE.blueFantastic,
  highlightFill: PALETTE.truffleTrouble,
} as const;

export const ICON_TOKENS = {
  set: 'lucide-outline',
  strokeWidth: 1.75,
  sizes: {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  },
} as const;
