import { cn } from '../../utils/cn';

/** Grey placeholder block for loading states. */
export function Skeleton({ className = '' }) {
    return <div className={cn('animate-pulse rounded bg-line/70', className)} />;
}

export default Skeleton;
