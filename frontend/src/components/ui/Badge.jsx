import { cn } from '../../utils/cn';

const TONES = {
    neutral: 'bg-paper text-slate-600 border-line',
    canopy: 'bg-canopy-tint text-canopy border-canopy/20',
    harvest: 'bg-harvest/10 text-harvest border-harvest/20',
    danger: 'bg-danger-tint text-danger border-danger/20',
    info: 'bg-info-tint text-info border-info/20',
    // Categorical/nominal accents — status-domain badges with 3+ values.
    // Not a substitute for `canopy` on primary actions.
    plum: 'bg-plum/10 text-plum border-plum/20',
    tide: 'bg-tide/10 text-tide border-tide/20',
    coral: 'bg-coral/10 text-coral border-coral/20',
    clay: 'bg-clay/10 text-clay border-clay/20',
    moss: 'bg-moss/10 text-moss border-moss/20',
};

/** Small status pill. tone: neutral | canopy | harvest | danger | info */
export function Badge({ tone = 'neutral', className = '', children }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-medium',
                TONES[tone] || TONES.neutral,
                className
            )}
        >
            {children}
        </span>
    );
}

export default Badge;
