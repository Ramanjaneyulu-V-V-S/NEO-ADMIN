import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

const VARIANTS = {
    primary: 'bg-canopy text-white hover:bg-canopy-dark disabled:bg-canopy/50',
    secondary: 'bg-surface text-ink border border-line hover:bg-paper disabled:text-slate-400',
    ghost: 'bg-transparent text-slate-600 hover:bg-canopy-tint hover:text-canopy disabled:text-slate-300',
    danger: 'bg-danger text-white hover:brightness-95 disabled:bg-danger/50',
    accent: 'bg-harvest text-white hover:brightness-95 disabled:bg-harvest/50',
};

const SIZES = {
    sm: 'h-8 px-3 text-caption gap-1.5',
    md: 'h-10 px-4 text-body gap-2',
    icon: 'h-9 w-9 justify-center',
};

/**
 * Button — variants: primary | secondary | ghost | danger | accent
 *          sizes: sm | md | icon
 * Props: loading (shows spinner + disables), plus all native button props.
 */
export const Button = forwardRef(function Button(
    { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center rounded-lg font-medium transition active:scale-[0.98]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-canopy/40 focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed disabled:active:scale-100',
                VARIANTS[variant],
                SIZES[size],
                className
            )}
            {...rest}
        >
            {loading && <Spinner size={size === 'sm' ? 13 : 15} />}
            {children}
        </button>
    );
});

export default Button;
