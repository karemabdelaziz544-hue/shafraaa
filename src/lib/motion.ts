/**
 * إعدادات الحركة الموحدة (Shared Motion Config) - نظام محل شفرة
 * القواعد الصارمة للأداء على الهواتف المتوسطة:
 * - كل الحركات تعتمد على `transform` و `opacity` فقط (GPU-composited)
 * - لا تتجاوز مدة أي حركة 300ms (0.3s)
 * - اتجاه انتقال الصفحات يتبع القراءة العربية RTL (من اليسار لليمين عند الدخول، والعكس عند الخروج)
 * - يتم احترام `prefers-reduced-motion` تلقائياً عبر MotionConfig و usePrefersReducedMotion
 */

export const MOTION_DURATIONS = {
  fast: 0.14,     // 140ms: أزرار، توست، صفوف سريعة
  normal: 0.2,    // 200ms: القوائم، البطاقات، النوافذ
  route: 0.19,    // 190ms: انتقالات الصفحات (150 - 250ms)
  modal: 0.22,    // 220ms: المودال والدرج الجانبي/السفلي
  countUp: 0.26,  // 260ms: عداد الأرقام في لوحة التحكم
  progress: 0.24, // 240ms: شريط التقدم العلوي
} as const;

export const MOTION_EASINGS = {
  standard: [0.22, 1, 0.36, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  linear: 'linear' as const,
};

export const MOTION_DISTANCES = {
  // في الواجهة العربية RTL: المحتوى الجديد ينزلق بلطف من اليسار (-12px) إلى موضعه (0)
  routeSlideX: -12,
  listSlideY: 8,
  sheetSlideY: 24,
  toastSlideY: 14,
  modalScale: 0.96,
  buttonPressScale: 0.97,
  cardPressScale: 0.985,
} as const;

export const ROUTE_TRANSITION = {
  initial: { opacity: 0, x: MOTION_DISTANCES.routeSlideX },
  animate: { opacity: 1, x: 0 },
  transition: {
    duration: MOTION_DURATIONS.route,
    ease: MOTION_EASINGS.standard,
  },
} as const;

export const MODAL_BACKDROP_TRANSITION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: {
    duration: MOTION_DURATIONS.fast,
    ease: MOTION_EASINGS.standard,
  },
} as const;

export const MODAL_PANEL_TRANSITION = {
  initial: { opacity: 0, scale: MOTION_DISTANCES.modalScale, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: MOTION_DISTANCES.modalScale, y: 8 },
  transition: {
    duration: MOTION_DURATIONS.modal,
    ease: MOTION_EASINGS.standard,
  },
} as const;

export const LIST_ITEM_TRANSITION = {
  initial: { opacity: 0, y: MOTION_DISTANCES.listSlideY },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -12 },
  transition: {
    duration: MOTION_DURATIONS.fast,
    ease: MOTION_EASINGS.standard,
  },
} as const;

export const PREFETCH_ROUTES = [
  '/',
  '/sales/new',
  '/sales',
  '/products',
  '/customers',
  '/suppliers',
  '/inventory',
  '/inventory/damaged',
  '/expenses',
  '/drawer',
  '/reports',
] as const;
