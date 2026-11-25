import React from 'react';
import { Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ICON_TOKENS } from '@/lib/design-tokens';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SaveButtonState = 'idle' | 'saving' | 'saved';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  saveState?: SaveButtonState;
  savedText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      saveState = 'idle',
      savedText = 'تم الحفظ',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isBusy = Boolean(isLoading || saveState === 'saving');
    const isSaved = saveState === 'saved' && !isBusy;

    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-[transform,opacity,background-color,border-color,color] duration-150 select-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas';

    const variants = {
      primary:
        'bg-flame hover:bg-flame-hover text-flame-ink shadow-sm focus:ring-flame',
      secondary:
        'bg-oatmeal/55 hover:bg-oatmeal/80 text-ink-strong focus:ring-oatmeal',
      outline:
        'border border-line bg-surface hover:bg-surface-alt text-ink focus:ring-flame',
      danger:
        'bg-truffle hover:bg-truffle/90 text-truffle-ink shadow-sm focus:ring-truffle',
      ghost: 'hover:bg-surface-alt text-ink focus:ring-line',
      success:
        'bg-success hover:bg-success/90 text-success-ink shadow-sm focus:ring-success',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs gap-1.5',
      md: 'h-11 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2 font-bold',
      xl: 'h-14 px-8 text-lg gap-2.5 font-bold',
    };

    const effectiveVariant = isSaved ? 'success' : variant;

    return (
      <button
        ref={ref}
        disabled={disabled || isBusy || isSaved}
        aria-busy={isBusy}
        className={cn(baseStyles, variants[effectiveVariant], sizes[size], className)}
        {...props}
      >
        {isBusy ? (
          <span
            aria-hidden="true"
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none ml-1.5"
          />
        ) : isSaved ? (
          <Check strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1.5 shrink-0" />
        ) : null}
        {isSaved ? <span>{savedText}</span> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
