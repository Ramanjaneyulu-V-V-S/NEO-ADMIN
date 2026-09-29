import { ChevronsLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

const PAGE_SIZES = [5, 10, 25, 50];

/**
 * Pager. Works with either a known `total` or a `hasNext` flag.
 * Props: page, pageSize, hasNext, total?, rangeStart?, rangeEnd?,
 *        onPageChange(n), onPageSizeChange(n)?, loading?, pageSizes?
 */
export function Pagination({
    page,
    pageSize,
    hasNext = false,
    total = null,
    rangeStart,
    rangeEnd,
    onPageChange,
    onPageSizeChange,
    loading = false,
    pageSizes = PAGE_SIZES,
    className = '',
}) {
    const start = rangeStart ?? (page - 1) * pageSize + 1;
    const end = rangeEnd ?? (total != null ? Math.min(page * pageSize, total) : page * pageSize);
    const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
    const canNext = total != null ? page < totalPages : hasNext;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 border-t border-line bg-paper/60 px-4 py-2.5 text-caption text-slate-600',
                'sm:flex-row sm:items-center sm:justify-between',
                className
            )}
        >
            <div className="flex items-center gap-3">
                <span>
                    Showing <span className="font-mono text-ink">{start}</span>–
                    <span className="font-mono text-ink">{end}</span>
                    {total != null && (
                        <>
                            {' '}of <span className="font-mono text-ink">{total}</span>
                        </>
                    )}
                </span>
                {onPageSizeChange && (
                    <label className="flex items-center gap-1.5">
                        <span className="hidden xs:inline">Rows</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="rounded border border-line bg-surface px-1.5 py-1 text-caption"
                        >
                            {pageSizes.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            <div className="flex items-center gap-1">
                <PagerButton onClick={() => onPageChange(1)} disabled={page === 1 || loading} label="First page">
                    <ChevronsLeft size={14} />
                </PagerButton>
                <PagerButton onClick={() => onPageChange(page - 1)} disabled={page === 1 || loading} label="Previous page">
                    <ChevronLeft size={14} />
                </PagerButton>
                <span className="px-2 font-mono text-ink">
                    {page}
                    {totalPages != null && <span className="text-slate-400"> / {totalPages}</span>}
                </span>
                <PagerButton onClick={() => onPageChange(page + 1)} disabled={!canNext || loading} label="Next page">
                    <ChevronRight size={14} />
                </PagerButton>
            </div>
        </div>
    );
}

function PagerButton({ onClick, disabled, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="rounded border border-line bg-surface p-1.5 text-slate-600 transition-colors hover:bg-paper disabled:opacity-40"
        >
            {children}
        </button>
    );
}

export default Pagination;
