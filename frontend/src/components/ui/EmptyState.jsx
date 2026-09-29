import { cn } from '../../utils/cn';

/**
 * Empty / no-results state. An empty screen is an invitation to act —
 * pass `action` (a Button) where there's a next step.
 */
export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
    return (
        <div className={cn('flex animate-fade-rise flex-col items-center justify-center px-6 py-16 text-center', className)}>
            {Icon && (
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-canopy-tint">
                    <Icon size={22} className="text-canopy" />
                </div>
            )}
            {title && <p className="font-display text-title text-ink">{title}</p>}
            {description && <p className="mt-1 max-w-sm text-body text-slate-500">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export default EmptyState;
