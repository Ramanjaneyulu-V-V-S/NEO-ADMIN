import { cn } from '../../utils/cn';

const TONES = {
    neutral: 'bg-paper text-slate-600 border-line',
    canopy: 'bg-canopy-tint text-canopy border-canopy/20',
    harvest: 'bg-harvest/10 text-harvest border-harvest/20',
    danger: 'bg-danger-tint text-danger border-danger/20',
    info: 'bg-info-tint text-info border-info/20',
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
