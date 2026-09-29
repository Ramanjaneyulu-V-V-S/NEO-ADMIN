import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { base } from './Input';

/**
 * Native date picker in the `Input` shell, so date fields line up with the
 * text inputs and `CustomSelect` triggers beside them. `invalid` swaps the
 * ring/border to danger. Passes `value`, `onChange`, `min`, `max`, `disabled`…
 * The picker chrome follows the app theme via `color-scheme` (index.css).
 */
export const DateInput = forwardRef(function DateInput({ className = '', invalid = false, ...rest }, ref) {
    return (
        <input
            ref={ref}
            type="date"
            className={cn(
                base,
                'h-10',
                '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60',
                invalid && 'border-danger focus:border-danger focus:ring-danger/20',
                className
            )}
            {...rest}
        />
    );
});

export default DateInput;
