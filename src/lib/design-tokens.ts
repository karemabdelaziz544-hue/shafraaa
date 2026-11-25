/**
 * منظومة رموز التصميم الموحدة (Design Tokens) - نظام محل شفرة
 * مستوحاة من لوحة الألوان MP072:
 * - Palladian (#EEE9DF): الخلفية الفاتحة الأساسية والنصوص الفاتحة على الأسطح الداكنة
 * - Oatmeal (#C9C1B1): الحدود والفواصل والأسطح الثانوية وحالات التعطيل
 * - Blue Fantastic (#2C3B4D): النصوص الأساسية والقوائم الجانبية والرؤوس
 * - Abyssal Anchorfish Blue (#1B2632): أغمق الأسطح وخلفية الوضع الداكن والنصوص القوية
 * - Burning Flame (#FFB162): اللون الأساسي التفاعلي (الأزرار الرئيسية، التحديد النشط، التركيز)
 * - Truffle Trouble (#A35139): اللون الثانوي التكميلي (الروابط، الشارات، التنبيهات والإجراءات الحساسة)
 */

export const PALETTE = {
  palladian: '#EEE9DF',
  oatmeal: '#C9C1B1',
  blueFantastic: '#2C3B4D',
  abyssal: '#1B2632',
  burningFlame: '#FFB162',
  truffleTrouble: '#A35139',
  // درجات مساعدة مشتقة بنفس الهوية البصرية ومتوافقة مع تباين >= 4.5:1
  warmPaper: '#F7F4EE',
  oatmealSoft: '#E7E1D5',
  mutedFantastic: '#4A596B',
  mutedSuccessLight: '#2F5E4E',
  mutedSuccessDark: '#86C5AA',
  mutedWarningLight: '#7A4816',
  mutedDangerLight: '#853D29',
} as const;

export const THEME_MODES = {
  light: {
    canvas: PALETTE.palladian,
    surface: PALETTE.warmPaper,
    surfaceAlt: PALETTE.oatmealSoft,
    border: PALETTE.oatmeal,
    ink: PALETTE.blueFantastic,
    inkStrong: PALETTE.abyssal,
    inkMuted: PALETTE.mutedFantastic,
    accent: PALETTE.burningFlame,
    accentInk: PALETTE.abyssal,
    secondaryAccent: PALETTE.truffleTrouble,
    secondaryInk: PALETTE.palladian,
    success: PALETTE.mutedSuccessLight,
    warning: PALETTE.mutedWarningLight,
    danger: PALETTE.truffleTrouble,
  },
  dark: {
    canvas: PALETTE.abyssal,
    surface: '#23303F',
    surfaceAlt: PALETTE.blueFantastic,
    border: '#445568',
    ink: PALETTE.palladian,
    inkStrong: PALETTE.warmPaper,
    inkMuted: PALETTE.oatmeal,
    accent: PALETTE.burningFlame,
    accentInk: PALETTE.abyssal,
    secondaryAccent: PALETTE.truffleTrouble,
    secondaryInk: PALETTE.palladian,
    success: PALETTE.mutedSuccessDark,
    warning: PALETTE.burningFlame,
    danger: PALETTE.truffleTrouble,
  },
} as const;

export const RADII = {
  control: '0.75rem', // 12px (rounded-xl)
  card: '1rem',       // 16px (rounded-2xl)
  hero: '1.5rem',     // 24px (rounded-3xl)
  pill: '9999px',
} as const;

export const SPACING = {
  pageGap: '1.25rem',
  cardPadding: '1.25rem',
  touchTargetMin: '2.75rem', // 44px لأهداف اللمس على الموبايل
} as const;

export const SHADOWS = {
  card: '0 1px 2px 0 rgb(27 38 50 / 0.06)',
  elevated: '0 12px 32px -8px rgb(27 38 50 / 0.18)',
  accentGlow: '0 6px 18px -4px rgb(255 177 98 / 0.35)',
} as const;

export const CHART_TOKENS = {
  barFillLight: PALETTE.blueFantastic,
  barFillHover: PALETTE.burningFlame,
  barTrackLight: PALETTE.oatmealSoft,
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
