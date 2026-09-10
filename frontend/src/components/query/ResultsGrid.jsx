import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
    Filter, ArrowUp, ArrowDown, ArrowUpDown, Columns3,
    FileDown, FileSpreadsheet, X, Check, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Badge, Button, Pagination, EmptyState } from '../ui';
import { cn } from '../../utils/cn';
import { downloadGridCsv, downloadGridXlsx } from '../../utils/userExport';
import { formatDateTime } from '../../utils/datetime';

// Documentum REST returns date columns as ISO-8601 UTC
// (e.g. "2026-04-16T17:17:23.000+00:00"). Render those in local time
// as "DD/MM/YYYY hh:mm:ss AM/PM"; leave every other value untouched.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function displayCell(value) {
    if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
        return formatDateTime(value);
    }
    return value === null || value === undefined ? '' : String(value);
}

// The Documentum REST DQL endpoint expands repeating attributes into one entry
// per value, so a single object with a 5-value repeating attribute comes back as
// 5 near-identical rows. dqMan (DFC) keeps it as one row. This folds rows that
// share an r_object_id back into one, joining the columns that actually differ
// into a distinct-value list. No-op when r_object_id isn't selected or nothing
// is duplicated.
function collapseByObjectId(rows, columns) {
    if (!columns.includes('r_object_id')) return rows;

    const groups = new Map();
    const order = [];
    for (const row of rows) {
        const id = row.r_object_id;
        if (id === null || id === undefined || id === '') {
            order.push([row]);
            continue;
        }
        let bucket = groups.get(id);
        if (!bucket) {
            bucket = [];
            groups.set(id, bucket);
            order.push(bucket);
        }
        bucket.push(row);
    }

    if (order.every((bucket) => bucket.length === 1)) return rows;

    return order.map((bucket) => {
        if (bucket.length === 1) return bucket[0];
        const merged = {};
        for (const col of columns) {
            const distinct = [];
            for (const row of bucket) {
                const v = row[col];
                const s = v === null || v === undefined ? '' : String(v);
                if (!distinct.includes(s)) distinct.push(s);
            }
            if (distinct.length === 1) {
                merged[col] = bucket[0][col];
            } else {
                merged[col] = distinct.filter((s) => s !== '').join(', ');
            }
        }
        return merged;
    });
}

const PAGE_SIZES = [10, 25, 50, 100, 500];

const MATCH_MODES = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'startsWith', label: 'Starts with' },
];

const panelCls =
    'z-[99999] w-60 rounded-lg border border-line bg-white p-3 shadow-pop text-body ' +
    'data-[state=open]:animate-panel-in data-[state=closed]:animate-panel-out';

function matchCell(cell, filter) {
    if (!filter || !filter.value) return true;
    const c = String(cell ?? '').toLowerCase();
    const v = filter.value.toLowerCase();
    if (filter.mode === 'equals') return c === v;
    if (filter.mode === 'startsWith') return c.startsWith(v);
    return c.includes(v);
}

function compareValues(a, b) {
    const av = a ?? '';
    const bv = b ?? '';
    if (typeof a === 'string' && typeof b === 'string'
        && ISO_DATETIME_RE.test(a) && ISO_DATETIME_RE.test(b)) {
        return new Date(a).getTime() - new Date(b).getTime();
    }
    const an = Number(av);
    const bn = Number(bv);
    if (av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
        return an - bn;
    }
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sortable, filterable results grid for the Query tab.
 *
 * Props:
 *   columns   — string[] column names in display order
 *   rows      — Array<Object> keyed by column name
 *   loading   — a run is in flight
 *   runId     — bumps on every fresh execution; resets sort / filters / paging
 *   emptyLabel — text when there are zero rows and not loading
 */
export default function ResultsGrid({ columns = [], rows = [], loading = false, runId = 0, emptyLabel = 'No results' }) {
    const [sort, setSort] = useState({ col: null, dir: null }); // dir: 'asc' | 'desc'
    const [filters, setFilters] = useState({}); // col -> { value, mode }
    const [hidden, setHidden] = useState(() => new Set());
    const [collapse, setCollapse] = useState(true); // fold repeating-attribute rows (dqMan-style)
    const [expandedCells, setExpandedCells] = useState(() => new Set()); // "rowIdx:col" of merged cells shown in full
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // A fresh result set (new runId) resets sort / filters / hidden columns / page.
    // This is the "adjust state during render" pattern — no effect, no cascading render.
    const [seenRunId, setSeenRunId] = useState(runId);
    if (runId !== seenRunId) {
        setSeenRunId(runId);
        setSort({ col: null, dir: null });
        setFilters({});
        setHidden(new Set());
        setExpandedCells(new Set());
        setPage(1);
    }

    const visibleColumns = useMemo(
        () => columns.filter((c) => !hidden.has(c)),
        [columns, hidden],
    );

    // Rows with repeating-attribute expansion folded back by r_object_id.
    const collapsedRows = useMemo(() => collapseByObjectId(rows, columns), [rows, columns]);
    const canCollapse = collapsedRows.length !== rows.length;
    const baseRows = collapse && canCollapse ? collapsedRows : rows;

    const filteredRows = useMemo(() => {
        const active = Object.entries(filters).filter(([, f]) => f && f.value);
        if (active.length === 0) return baseRows;
        return baseRows.filter((row) => active.every(([col, f]) => matchCell(displayCell(row[col]), f)));
    }, [baseRows, filters]);

    const sortedRows = useMemo(() => {
        if (!sort.col || !sort.dir) return filteredRows;
        const copy = [...filteredRows];
        copy.sort((a, b) => {
            const res = compareValues(a[sort.col], b[sort.col]);
            return sort.dir === 'asc' ? res : -res;
        });
        return copy;
    }, [filteredRows, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pagedRows = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return sortedRows.slice(start, start + pageSize);
    }, [sortedRows, safePage, pageSize]);

    const hasFilters = Object.values(filters).some((f) => f && f.value);

    const toggleSort = (col) => {
        setSort((prev) => {
            if (prev.col !== col) return { col, dir: 'asc' };
            if (prev.dir === 'asc') return { col, dir: 'desc' };
            return { col: null, dir: null };
        });
    };

    const setFilter = (col, next) => {
        setFilters((prev) => {
            const copy = { ...prev };
            if (!next || !next.value) delete copy[col];
            else copy[col] = next;
            return copy;
        });
        setPage(1);
    };

    const toggleCell = (rowIdx, col) => {
        setExpandedCells((prev) => {
            const copy = new Set(prev);
            const key = `${rowIdx}:${col}`;
            if (copy.has(key)) copy.delete(key);
            else copy.add(key);
            return copy;
        });
    };

    const toggleColumn = (col) => {
        setHidden((prev) => {
            const copy = new Set(prev);
            if (copy.has(col)) copy.delete(col);
            else copy.add(col);
            return copy;
        });
    };

    const exportRows = () =>
        sortedRows.map((row) => {
            const out = {};
            for (const col of visibleColumns) out[col] = displayCell(row[col]);
            return out;
        });

    const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const handleCsv = () => downloadGridCsv(visibleColumns, exportRows(), `query-results-${stamp()}.csv`);
    const handleXlsx = () => downloadGridXlsx(visibleColumns, exportRows(), `query-results-${stamp()}.xlsx`);

    if (!loading && rows.length === 0) {
        return (
            <div className="rounded-card border border-line bg-white shadow-card">
                <EmptyState icon={Filter} title={emptyLabel} description="Run a SELECT statement to see rows here." />
            </div>
        );
    }

    return (
        <div className="rounded-card border border-line bg-white shadow-card">
            {/* Header: count + column menu + export */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <Badge tone="canopy">Results ({baseRows.length})</Badge>
                    {collapse && canCollapse && (
                        <span className="text-caption text-slate-500">
                            from <span className="font-mono text-harvest">{rows.length}</span> rows
                        </span>
                    )}
                    {hasFilters && filteredRows.length !== baseRows.length && (
                        <span className="text-caption text-slate-500">
                            <span className="font-mono text-harvest">{filteredRows.length}</span> filtered
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {canCollapse && (
                        <button
                            type="button"
                            onClick={() => {
                                setCollapse((v) => !v);
                                setExpandedCells(new Set());
                            }}
                            className={cn(
                                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-caption font-medium transition-colors',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-canopy/40 focus-visible:ring-offset-1',
                                collapse
                                    ? 'border-canopy bg-canopy-tint text-canopy'
                                    : 'border-line bg-white text-ink hover:bg-paper',
                            )}
                            aria-pressed={collapse}
                            title="Fold rows that share an r_object_id (repeating-attribute expansion) into one"
                        >
                            <Check size={13} className={cn(!collapse && 'opacity-30')} /> Collapse repeating rows
                        </button>
                    )}

                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                            <X size={13} /> Clear filters
                        </Button>
                    )}

                    <Popover.Root>
                        <Popover.Trigger asChild>
                            <Button variant="secondary" size="sm">
                                <Columns3 size={13} /> Columns
                            </Button>
                        </Popover.Trigger>
                        <Popover.Portal>
                            <Popover.Content align="end" sideOffset={4} className={cn(panelCls, 'max-h-72 overflow-y-auto scrollbar-thin')}>
                                <p className="mb-2 text-caption font-medium text-slate-500">Show columns</p>
                                <div className="flex flex-col gap-0.5">
                                    {columns.map((col) => {
                                        const shown = !hidden.has(col);
                                        return (
                                            <button
                                                key={col}
                                                type="button"
                                                onClick={() => toggleColumn(col)}
                                                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-body hover:bg-canopy-tint"
                                            >
                                                <span
                                                    className={cn(
                                                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                                        shown ? 'border-canopy bg-canopy text-white' : 'border-line bg-white',
                                                    )}
                                                >
                                                    {shown && <Check size={11} />}
                                                </span>
                                                <span className="truncate font-mono text-caption">{col}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root>

                    <Button variant="secondary" size="sm" onClick={handleCsv} disabled={sortedRows.length === 0}>
                        <FileDown size={13} /> CSV
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleXlsx} disabled={sortedRows.length === 0}>
                        <FileSpreadsheet size={13} /> Excel
                    </Button>
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-auto max-h-[calc(100vh-30rem)] min-h-[320px]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-line bg-paper">
                        <tr>
                            <th className="sticky left-0 z-20 w-12 bg-paper px-3 py-2 font-mono text-caption text-slate-400">#</th>
                            {visibleColumns.map((col) => {
                                const filter = filters[col];
                                const sorted = sort.col === col ? sort.dir : null;
                                return (
                                    <th key={col} className="bg-paper px-3 py-2 font-semibold text-ink">
                                        <div className="flex items-center gap-1.5 min-w-[120px]">
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(col)}
                                                className="flex items-center gap-1 whitespace-nowrap font-mono text-caption hover:text-canopy"
                                                title="Sort"
                                            >
                                                {col}
                                                {sorted === 'asc' && <ArrowUp size={12} className="text-canopy" />}
                                                {sorted === 'desc' && <ArrowDown size={12} className="text-canopy" />}
                                                {!sorted && <ArrowUpDown size={12} className="text-slate-300" />}
                                            </button>

                                            <Popover.Root>
                                                <Popover.Trigger asChild>
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            'rounded p-1 hover:bg-canopy-tint',
                                                            filter?.value ? 'text-canopy' : 'text-slate-300',
                                                        )}
                                                        title="Filter column"
                                                    >
                                                        <Filter size={12} />
                                                    </button>
                                                </Popover.Trigger>
                                                <Popover.Portal>
                                                    <Popover.Content align="start" sideOffset={4} className={panelCls}>
                                                        <p className="mb-1.5 truncate font-mono text-caption text-slate-500">{col}</p>
                                                        <div className="mb-2 flex gap-1">
                                                            {MATCH_MODES.map((m) => (
                                                                <button
                                                                    key={m.value}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setFilter(col, { value: filter?.value || '', mode: m.value })
                                                                    }
                                                                    className={cn(
                                                                        'flex-1 rounded border px-1.5 py-1 text-[11px]',
                                                                        (filter?.mode || 'contains') === m.value
                                                                            ? 'border-canopy bg-canopy-tint text-canopy'
                                                                            : 'border-line text-slate-500 hover:bg-paper',
                                                                    )}
                                                                >
                                                                    {m.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={filter?.value || ''}
                                                            onChange={(e) =>
                                                                setFilter(col, {
                                                                    value: e.target.value,
                                                                    mode: filter?.mode || 'contains',
                                                                })
                                                            }
                                                            placeholder="Value…"
                                                            className="w-full rounded border border-line px-2 py-1.5 text-body focus:border-canopy focus:outline-none focus:ring-2 focus:ring-canopy/20"
                                                        />
                                                        {filter?.value && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setFilter(col, null)}
                                                                className="mt-2 flex items-center gap-1 text-caption text-slate-500 hover:text-danger"
                                                            >
                                                                <X size={12} /> Clear
                                                            </button>
                                                        )}
                                                    </Popover.Content>
                                                </Popover.Portal>
                                            </Popover.Root>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                        {pagedRows.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + 1} className="px-3 py-12 text-center text-slate-400">
                                    <Filter className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                                    <p className="text-body">No rows match the current filters</p>
                                </td>
                            </tr>
                        ) : (
                            pagedRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-paper">
                                    <td className="sticky left-0 border-r border-line bg-white px-3 py-2 font-mono text-caption text-slate-400">
                                        {(safePage - 1) * pageSize + idx + 1}
                                    </td>
                                    {visibleColumns.map((col) => {
                                        const raw = row[col];
                                        const text = displayCell(raw) || '—';
                                        // A merged cell from collapseByObjectId — a distinct-value list.
                                        const parts =
                                            typeof raw === 'string' && raw.includes(', ')
                                                ? raw.split(', ')
                                                : null;
                                        if (!parts) {
                                            return (
                                                <td
                                                    key={col}
                                                    className="max-w-xs truncate px-3 py-2 font-mono text-caption text-slate-600"
                                                    title={String(raw ?? '')}
                                                >
                                                    {text}
                                                </td>
                                            );
                                        }
                                        const rowNo = (safePage - 1) * pageSize + idx;
                                        const open = expandedCells.has(`${rowNo}:${col}`);
                                        return (
                                            <td
                                                key={col}
                                                className="max-w-xs px-3 py-2 align-top font-mono text-caption text-slate-600"
                                                title={String(raw ?? '')}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCell(rowNo, col)}
                                                    aria-expanded={open}
                                                    className="flex min-w-0 max-w-full items-start gap-1 text-left hover:text-canopy"
                                                    title={open ? 'Collapse' : `Show all ${parts.length} values`}
                                                >
                                                    <span className={cn('shrink-0 pt-px', open ? 'text-canopy' : 'text-slate-400')}>
                                                        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </span>
                                                    {open ? (
                                                        <span className="flex min-w-0 flex-col gap-0.5">
                                                            {parts.map((p, i) => (
                                                                <span key={i} className="break-all">{p}</span>
                                                            ))}
                                                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                                                {parts.length} distinct
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="min-w-0 truncate">{text}</span>
                                                    )}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                page={safePage}
                pageSize={pageSize}
                total={sortedRows.length}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                }}
                pageSizes={PAGE_SIZES}
                loading={loading}
            />
        </div>
    );
}
