import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * Horizontal tab bar. Scrolls horizontally on narrow screens.
 *   tabs: [{ id, label, icon? }]   (filter for role BEFORE passing in)
 *   value / onChange: controlled active id
 */
export function Tabs({ tabs, value, onChange, className = '' }) {
    const reduce = usePrefersReducedMotion();
    const layoutId = useId();

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
                                'relative flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-body font-medium transition-colors',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-canopy/40',
                                active ? 'text-canopy' : 'text-slate-500 hover:text-ink'
                            )}
                        >
                            {Icon && <Icon size={15} />}
                            {t.label}
                            {active &&
                                (reduce ? (
                                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-canopy" />
                                ) : (
                                    <motion.span
                                        layoutId={layoutId}
                                        className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-canopy"
                                        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                                    />
                                ))}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default Tabs;
