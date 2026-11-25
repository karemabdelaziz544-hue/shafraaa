import React from 'react';
import { Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
      'inline-flex items-center justify-center font-medium rounded-xl transition-[transform,opacity,background-color,border-color] duration-150 select-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
      primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20 focus:ring-brand-500',
      secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 focus:ring-slate-400',
      outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-slate-400',
      danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20 focus:ring-rose-500',
      ghost: 'hover:bg-slate-100 text-slate-700 focus:ring-slate-300',
      success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 focus:ring-emerald-500',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs gap-1.5',
      md: 'h-11 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2 font-semibold',
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
          <Check className="w-4 h-4 ml-1.5" />
        ) : null}
        {isSaved ? <span>{savedText}</span> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
