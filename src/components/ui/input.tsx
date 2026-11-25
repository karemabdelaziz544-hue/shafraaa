import React from 'react';
import { cn } from './button';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-ink">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'w-full h-11 px-3.5 rounded-xl border border-line bg-surface text-ink-strong text-sm placeholder:text-ink-muted transition-colors focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/30 disabled:bg-oatmeal/45 disabled:opacity-65',
            error && 'border-danger focus:border-danger focus:ring-danger/25',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs font-medium text-danger-text">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
