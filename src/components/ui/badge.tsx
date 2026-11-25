import React from 'react';
import { cn } from './button';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'purple' | 'info' | 'accent';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-badge-neutral text-ink-strong border-line',
    success: 'bg-success-bg text-success border-success-border',
    danger: 'bg-truffle text-truffle-ink border-truffle',
    warning: 'bg-warning-bg text-warning border-warning-border',
    purple: 'bg-danger-bg text-danger-text border-danger-border',
    accent: 'bg-flame/20 text-ink-strong border-flame',
    info: 'bg-info-bg text-ink-strong border-info-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
