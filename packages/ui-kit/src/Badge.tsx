/**
 * Componente Badge riutilizzabile
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-blue-600/20 text-blue-300 border border-blue-600/30',
        secondary: 'bg-gray-700/50 text-gray-300 border border-gray-600/50',
        success: 'bg-green-600/20 text-green-300 border border-green-600/30',
        warning: 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/30',
        destructive: 'bg-red-600/20 text-red-300 border border-red-600/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

