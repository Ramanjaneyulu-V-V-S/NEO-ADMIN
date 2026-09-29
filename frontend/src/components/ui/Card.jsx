import { cn } from '../../utils/cn';

/**
 * Surface container. `spine` adds the canopy ledger-spine on the leading edge.
 * `pad` toggles the default padding (set false when the card holds a table).
 */
export function Card({ spine = false, pad = true, className = '', children, ...rest }) {
    return (
        <div
            className={cn(
                'rounded-card border border-line bg-surface shadow-card',
                spine && 'ledger-spine',
                pad && 'p-5',
                className
            )}
            {...rest}
        >
            {children}
        </div>
    );
}

export default Card;
