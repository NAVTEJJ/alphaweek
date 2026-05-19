import { cn } from '@/lib/utils';
import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm placeholder:text-muted',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/60',
          'transition-colors duration-150',
          error && 'border-loss/60 focus:ring-loss/30',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
);

Input.displayName = 'Input';
