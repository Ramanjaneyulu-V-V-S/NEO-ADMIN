import { cn } from '../../utils/cn';

/**
 * Page masthead — the ledger spine + Fraunces title + optional description,
 * with an `actions` slot on the right (stacks below on phones).
 * Use once at the top of every page for a consistent header.
 */
export function PageHeader({ title, description, actions, icon: Icon, className = '', children }) {
    return (
        <header className={cn('ledger-spine mb-6 pl-4', className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        {Icon && <Icon size={20} className="shrink-0 text-canopy" />}
                        <h1 className="font-display text-display font-medium text-ink">{title}</h1>
                    </div>
                    {description && (
                        <p className="mt-1 max-w-2xl text-body text-slate-500">{description}</p>
                    )}
                </div>
                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
                )}
            </div>
            {children && <div className="mt-4">{children}</div>}
        </header>
    );
}

export default PageHeader;
