import { cn } from '../../utils/cn';

/**
 * Horizontal tab bar. Scrolls horizontally on narrow screens.
 *   tabs: [{ id, label, icon? }]   (filter for role BEFORE passing in)
 *   value / onChange: controlled active id
 */
export function Tabs({ tabs, value, onChange, className = '' }) {
    return (
        <div className={cn('-mx-1 overflow-x-auto border-b border-line scrollbar-thin', className)}>
            <div role="tablist" className="flex min-w-max gap-1 px-1">
                {tabs.map((t) => {
                    const active = t.id === value;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={active}
                            onClick={() => onChange(t.id)}
                            className={cn(
                                'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-body font-medium transition-colors',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-canopy/40',
                                active
                                    ? 'border-canopy text-canopy'
                                    : 'border-transparent text-slate-500 hover:text-ink'
                            )}
                        >
                            {Icon && <Icon size={15} />}
                            {t.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default Tabs;
