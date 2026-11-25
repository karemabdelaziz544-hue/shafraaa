import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { ICON_TOKENS } from '@/lib/design-tokens';
import { cn } from '@/components/ui/button';

export type IconSize = keyof typeof ICON_TOKENS.sizes;

interface AppIconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: IconSize;
}

/**
 * غلاف موحد للأيقونات يضمن استخدام حزمة Lucide بنمط Outline وسُمك خط ثابت (1.75)
 * مع تدرج مقاسات موحد في جميع صفحات ومكونات التطبيق.
 */
export function AppIcon({
  icon: Icon,
  size = 'sm',
  strokeWidth = ICON_TOKENS.strokeWidth,
  className,
  ...props
}: AppIconProps) {
  return (
    <Icon
      strokeWidth={strokeWidth}
      className={cn(ICON_TOKENS.sizes[size], 'shrink-0', className)}
      {...props}
    />
  );
}
