import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'profit' | 'loss' | 'warning' | 'muted' | 'plan';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary/20 text-primary-light border border-primary/30',
    profit: 'bg-profit/15 text-emerald-400 border border-profit/30',
    loss: 'bg-loss/15 text-red-400 border border-loss/30',
    warning: 'bg-accent/15 text-amber-400 border border-accent/30',
    muted: 'bg-surface-3/50 text-muted border border-border',
    plan: 'bg-accent/20 text-amber-300 border border-accent/30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium font-mono',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
