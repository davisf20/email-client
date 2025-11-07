/**
 * Componente Avatar riutilizzabile
 */

import React from 'react';
import { cn } from './utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const displayFallback = !src || imgError;
    const initials = fallback
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full bg-gray-700',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {displayFallback ? (
          <div className="flex h-full w-full items-center justify-center text-gray-300 font-medium">
            {initials}
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

