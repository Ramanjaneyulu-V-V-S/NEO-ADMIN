import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const base =
    'w-full rounded-lg border border-line bg-white px-3 text-body text-ink placeholder:text-slate-400 ' +
    'transition-colors focus:outline-none focus:border-canopy focus:ring-2 focus:ring-canopy/20 ' +
    'disabled:cursor-not-allowed disabled:bg-paper disabled:text-slate-400';

/** Single-line text input. `invalid` swaps the ring/border to danger. */
export const Input = forwardRef(function Input(
    { className = '', invalid = false, type = 'text', ...rest },
    ref
) {
    return (
        <input
            ref={ref}
            type={type}
            className={cn(
                base,
                'h-10',
                invalid && 'border-danger focus:border-danger focus:ring-danger/20',
                className
            )}
            {...rest}
        />
    );
});

/** Multi-line text input. */
export const Textarea = forwardRef(function Textarea(
    { className = '', invalid = false, rows = 3, ...rest },
    ref
) {
    return (
        <textarea
            ref={ref}
            rows={rows}
            className={cn(
                base,
                'py-2 leading-relaxed',
                invalid && 'border-danger focus:border-danger focus:ring-danger/20',
                className
            )}
            {...rest}
        />
    );
});

export default Input;
