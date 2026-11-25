/**
 * دوال التنسيق المالي والمحلي المصري (EGP / ج.م)
 */

const BIDI_CONTROL_REGEX = /[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g;

export function stripDirectionalMarks(value: string): string {
  return value.replace(BIDI_CONTROL_REGEX, '');
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.00 ج.م';
  }
  const num = Number(amount);
  const absFormatted = stripDirectionalMarks(
    new Intl.NumberFormat('ar-EG', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num))
  );
  const sign = num < 0 ? '-' : '';
  return `${sign}${absFormatted} ج.م`;
}

export function formatCurrencyEn(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.00 EGP';
  }
  const num = Number(amount);
  const absFormatted = stripDirectionalMarks(
    new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num))
  );
  const sign = num < 0 ? '-' : '';
  return `${sign}${absFormatted} EGP`;
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0';
  }
  const value = Number(num);
  const absFormatted = stripDirectionalMarks(
    new Intl.NumberFormat('ar-EG').format(Math.abs(value))
  );
  return value < 0 ? `-${absFormatted}` : absFormatted;
}

export function formatPercent(num: number | string | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0%';
  }
  return `${Number(num).toFixed(1)}%`;
}

export function formatArabicDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatArabicDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
