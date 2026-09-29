import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Indeterminate activity indicator. */
export function Spinner({ size = 16, className = '' }) {
    return <Loader2 size={size} className={cn('animate-spin', className)} />;
}

export default Spinner;
