import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
    Filter, ArrowUp, ArrowDown, ArrowUpDown, Columns3,
    FileDown, FileSpreadsheet, X, Check, ChevronDown, ChevronUp, Edit2,
} from 'lucide-react';
import { Badge, Button, Pagination, EmptyState, CustomSelect, Spinner } from '../ui';
import { cn } from '../../utils/cn';
import { downloadGridCsv, downloadGridXlsx } from '../../utils/userExport';
import { formatDateTime } from '../../utils/datetime';
import {
    DESIGNATION_OPTIONS, DESIGNATION_OTHER, DDM_DESIGNATION_OPTIONS, DDM_DISTRICTS,
    getLocations, fetchDepartments, deriveFromDesignation,
} from '../../data/nabardMetadata.js';

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

const OFFICE_TYPE_OPTIONS = [
    { value: 'HO', label: 'HO' },
    { value: 'RO', label: 'RO' },
    { value: 'TE', label: 'TE' },
];

const panelCls =
    'z-[99999] w-60 rounded-lg border border-line bg-surface p-3 shadow-pop text-body ' +
    'data-[state=open]:animate-panel-in data-[state=closed]:animate-panel-out';

// Row columns each editor "kind" needs in order to compute a correct diff /
// group-sync — when the current SELECT didn't include them, editorKindFor()
// returns null and the pencil for that column simply doesn't render.
const GROUP_REQUIRED_COLUMNS = {
    designation: ['user_login_name', 'office_type', 'ro_short_code', 'department_name', 'department_short_code', 'designation'],
    location: ['user_login_name', 'office_type', 'location', 'ro_short_code', 'department_name', 'department_short_code', 'designation'],
};

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

// Only the pairs whose value actually changed — shared by the designation and
// location grouped editors' "confirm" step.
function fieldDiffs(pairs) {
    return pairs.filter((p) => String(p.from ?? '') !== String(p.to ?? ''));
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
 *   fieldEditors — { [column]: 'text' | 'boolean' | 'designation' | 'location' }.
 *               Columns not in this map are display-only. 'text'/'boolean' are
 *               single-cell edits (two-step confirm, then onSaveCell).
 *               'designation'/'location' are grouped edits — every column that
 *               maps to the same kind shares one popover editor and one
 *               onSaveGroup call. A kind only actually renders a pencil when
 *               the row also has the columns that kind's group-sync needs
 *               (see GROUP_REQUIRED_COLUMNS) — narrower SELECTs just don't
 *               get that pencil.
 *   requiredColumns — optional Set<string> of 'text'-kind column names that
 *               may not be saved blank.
 *   onSaveCell — optional async (row, col, newValue) => boolean; called for
 *               'text'/'boolean' kinds after the user confirms. Return true
 *               on success (caller updates `rows`) or false to drop back
 *               into edit mode.
 *   onSaveGroup — optional async (kind, row, draft) => boolean; called for
 *               'designation'/'location' kinds after the user confirms the
 *               grouped diff. `draft` carries every field that kind edits.
 */
export default function ResultsGrid({
    columns = [], rows = [], loading = false, runId = 0, emptyLabel = 'No results',
    fieldEditors = {}, requiredColumns = new Set(), onSaveCell, onSaveGroup,
}) {
    const editorKindFor = (col, row) => {
        const kind = fieldEditors[col];
        if (!kind) return null;
        if (!('r_object_id' in row)) return null;
        if ((kind === 'text' || kind === 'boolean') && typeof onSaveCell !== 'function') return null;
        if ((kind === 'designation' || kind === 'location') && typeof onSaveGroup !== 'function') return null;
        const required = GROUP_REQUIRED_COLUMNS[kind];
        if (required && !required.every((c) => c in row)) return null;
        return kind;
    };

    const [sort, setSort] = useState({ col: null, dir: null }); // dir: 'asc' | 'desc'
    const [filters, setFilters] = useState({}); // col -> { value, mode }
    const [hidden, setHidden] = useState(() => new Set());
    const [collapse, setCollapse] = useState(true); // fold repeating-attribute rows (dqMan-style)
    const [expandedCells, setExpandedCells] = useState(() => new Set()); // "rowIdx:col" of merged cells shown in full
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // At most one cell/group being edited at a time:
    //   { key, kind, anchorCol, stage, draft, error }
    // key is "<rowNo>:<col>" for text/boolean, or "<rowNo>:__designation__" /
    // "<rowNo>:__location__" for the two grouped kinds (shared across every
    // column in that group — anchorCol is whichever pencil was clicked, the
    // only one that actually renders the popover).
    // stage: 'confirmEdit' | 'editing' | 'confirmSave' | 'saving' (text/boolean
    // skip straight to 'editing' — er, start at 'confirmEdit'; grouped kinds
    // start straight at 'editing', skipping that step).
    const [cellEdit, setCellEdit] = useState(null);
    // Department options for the location editor's Department/District picker —
    // reloaded (async, via fetchDepartments) whenever office type or location
    // changes inside that editor.
    const [locDeptOptions, setLocDeptOptions] = useState([]);

    // A fresh result set (new runId) resets sort / filters / hidden columns / page.
    // This is the "adjust state during render" pattern — no effect, no cascading render.
    const [seenRunId, setSeenRunId] = useState(runId);
    if (runId !== seenRunId) {
        setSeenRunId(runId);
        setSort({ col: null, dir: null });
        setFilters({});
        setHidden(new Set());
        setExpandedCells(new Set());
        setCellEdit(null);
        setLocDeptOptions([]);
        setPage(1);
    }

    // ── text / boolean single-cell editing ──────────────────────────────────
    const startCellEdit = (key, kind, col, raw) => {
        const draft = kind === 'boolean' ? String(raw === true || raw === 'true') : (raw ?? '');
        setCellEdit({ key, kind, anchorCol: col, stage: 'confirmEdit', draft, error: null });
    };
    const confirmCellEdit = (key) => setCellEdit((prev) => (prev && prev.key === key ? { ...prev, stage: 'editing' } : prev));
    const cancelCellEdit = () => setCellEdit(null);
    const updateCellDraft = (key, value) =>
        setCellEdit((prev) => (prev && prev.key === key ? { ...prev, draft: value, error: null } : prev));
    const proceedToConfirmSave = (key, col) => {
        setCellEdit((prev) => {
            if (!prev || prev.key !== key) return prev;
            if (requiredColumns.has(col) && !String(prev.draft).trim()) {
                return { ...prev, error: 'Required — cannot be blank' };
            }
            return { ...prev, stage: 'confirmSave', error: null };
        });
    };
    const backToEditing = (key) => setCellEdit((prev) => (prev && prev.key === key ? { ...prev, stage: 'editing' } : prev));
    const saveCellEdit = async (key, row, col, kind) => {
        const draft = cellEdit?.draft ?? '';
        const value = kind === 'boolean' ? draft === 'true' : draft;
        setCellEdit((prev) => (prev && prev.key === key ? { ...prev, stage: 'saving' } : prev));
        const ok = await onSaveCell(row, col, value);
        setCellEdit((prev) => {
            if (!prev || prev.key !== key) return prev; // a newer edit started, or was already cleared
            return ok ? null : { ...prev, stage: 'editing' };
        });
    };

    // ── designation / location grouped editing ──────────────────────────────
    const startGroupEdit = (key, kind, col, row) => {
        if (kind === 'designation') {
            setCellEdit({
                key, kind, anchorCol: col, stage: 'editing',
                draft: {
                    designation: row.designation || '',
                    user_grade: row.user_grade || '',
                    grade_level: row.grade_level ?? '',
                    hindi_designation: row.hindi_designation || '',
                },
                error: null,
            });
            return;
        }
        // location
        const isDDM = row.department_name === 'DDM';
        setCellEdit({
            key, kind, anchorCol: col, stage: 'editing',
            draft: {
                office_type: row.office_type || '',
                location: row.location || '',
                ro_short_code: row.ro_short_code || '',
                department_name: row.department_name || '',
                department_short_code: row.department_short_code || '',
                department_short_code_multi: Array.isArray(row.department_short_code_multi)
                    ? row.department_short_code_multi
                    : (row.department_short_code ? [row.department_short_code] : []),
                isDDM,
            },
            error: null,
        });
        setLocDeptOptions([]);
        if (row.office_type) {
            fetchDepartments(row.office_type, row.location).then(setLocDeptOptions).catch(() => setLocDeptOptions([]));
        }
    };

    const setDesignationField = (key, newDesignation, row) => {
        const isDDMUser = row.department_name === 'DDM' && ['RO', 'TE'].includes(row.office_type);
        const derived = deriveFromDesignation(newDesignation, isDDMUser);
        setCellEdit((prev) => (prev && prev.key === key ? {
            ...prev,
            draft: {
                designation: newDesignation,
                user_grade: derived.user_grade ?? prev.draft.user_grade,
                grade_level: derived.grade_level ?? prev.draft.grade_level,
                hindi_designation: derived.hindi_designation ?? prev.draft.hindi_designation,
            },
            error: null,
        } : prev));
    };

    const setLocationFields = (key, patch) =>
        setCellEdit((prev) => (prev && prev.key === key ? { ...prev, draft: { ...prev.draft, ...patch }, error: null } : prev));

    const handleOfficeTypeChange = async (key, v) => {
        setLocationFields(key, {
            office_type: v,
            location: v === 'HO' ? 'Mumbai' : '',
            ro_short_code: '',
            department_name: '',
            department_short_code: '',
            department_short_code_multi: [],
        });
        setLocDeptOptions([]);
        if (v === 'HO') {
            try {
                setLocDeptOptions(await fetchDepartments('HO'));
            } catch {
                setLocDeptOptions([]);
            }
        }
    };

    const handleLocationSelect = async (key, officeType, v) => {
        const loc = getLocations(officeType).find((l) => l.location === v);
        setLocationFields(key, {
            location: v,
            ro_short_code: loc ? loc.shortCode : '',
            department_name: '',
            department_short_code: '',
            department_short_code_multi: [],
        });
        setLocDeptOptions([]);
        if (v && officeType) {
            try {
                setLocDeptOptions(await fetchDepartments(officeType, v));
            } catch {
                setLocDeptOptions([]);
            }
        }
    };

    const handleDDMToggle = (key, checked) => {
        setLocationFields(key, {
            isDDM: checked,
            department_name: checked ? 'DDM' : '',
            department_short_code: '',
            department_short_code_multi: [],
        });
    };

    const handleDeptSelect = (key, v) => {
        const dept = locDeptOptions.find((d) => d.name === v);
        setLocationFields(key, {
            department_name: v,
            department_short_code: dept ? dept.shortCode : '',
            department_short_code_multi: dept ? [dept.shortCode] : [],
        });
    };

    const handleDistrictSelect = (key, district) => {
        setLocationFields(key, {
            department_name: 'DDM',
            department_short_code: district,
            department_short_code_multi: district ? [district] : [],
        });
    };

    const handleHODeptToggle = (key, shortCode, isAdding) => {
        setCellEdit((prev) => {
            if (!prev || prev.key !== key) return prev;
            const current = prev.draft.department_short_code_multi || [];
            const next = isAdding ? [...current, shortCode] : current.filter((c) => c !== shortCode);
            const first = locDeptOptions.find((d) => d.shortCode === next[0]);
            return {
                ...prev,
                draft: {
                    ...prev.draft,
                    department_short_code_multi: next,
                    department_short_code: next[0] || '',
                    department_name: first?.name || '',
                },
                error: null,
            };
        });
    };

    const proceedGroupConfirm = (key, kind) => {
        setCellEdit((prev) => {
            if (!prev || prev.key !== key) return prev;
            const d = prev.draft;
            if (kind === 'designation' && !d.designation?.trim()) {
                return { ...prev, error: 'Select a designation' };
            }
            if (kind === 'location') {
                if (!d.office_type) return { ...prev, error: 'Select an office type' };
                if (d.office_type !== 'HO' && !d.location) return { ...prev, error: 'Select a location' };
                if (d.office_type === 'HO' && (d.department_short_code_multi || []).length === 0) {
                    return { ...prev, error: 'Select at least one department' };
                }
                if (['RO', 'TE'].includes(d.office_type) && !d.department_short_code) {
                    return { ...prev, error: d.isDDM ? 'Select a district' : 'Select a department' };
                }
            }
            return { ...prev, stage: 'confirmSave', error: null };
        });
    };
    const backToGroupEditing = (key) => setCellEdit((prev) => (prev && prev.key === key ? { ...prev, stage: 'editing' } : prev));
    const saveGroupEdit = async (key, row, kind) => {
        const draft = cellEdit?.draft;
        setCellEdit((prev) => (prev && prev.key === key ? { ...prev, stage: 'saving' } : prev));
        const ok = await onSaveGroup(kind, row, draft);
        setCellEdit((prev) => {
            if (!prev || prev.key !== key) return prev;
            return ok ? null : { ...prev, stage: 'confirmSave' };
        });
    };

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

    if (loading && rows.length === 0) {
        return (
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <div className="h-0.5 overflow-hidden bg-canopy-tint">
                    <div className="h-full w-1/3 animate-progress-indeterminate rounded-full bg-canopy" />
                </div>
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <Spinner size={22} className="mb-3 text-canopy" />
                    <p className="font-display text-title text-ink">Running query…</p>
                    <p className="mt-1 max-w-sm text-body text-slate-500">Fetching rows from the repository.</p>
                </div>
            </div>
        );
    }

    if (!loading && rows.length === 0) {
        return (
            <div className="rounded-card border border-line bg-surface shadow-card">
                <EmptyState icon={Filter} title={emptyLabel} description="Run a SELECT statement to see rows here." />
            </div>
        );
    }

    return (
        <div className="rounded-card border border-line bg-surface shadow-card">
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

                <div className="flex flex-wrap items-center gap-1.5">
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
                                    : 'border-line bg-surface text-ink hover:bg-paper',
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
                            {/* No `overscroll-contain` — see CustomSelect: a popover over a
                                scrollable page must hand the wheel back once its list ends. */}
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
                                                        shown ? 'border-canopy bg-canopy text-white' : 'border-line bg-surface',
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

            {/* Grid — intentionally a raw <table>, not DataTable: the column set is dynamic (whatever the
                DQL returned), so folio cards don't apply. Below md it scrolls horizontally inside this
                container with a frozen row-number column; the page itself never scrolls sideways. */}
            <div className="overflow-x-auto overflow-y-auto overscroll-x-contain scrollbar-thin max-h-[calc(100vh-30rem)] min-h-[320px]">
                <table className="w-full min-w-max text-left text-sm">
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
                    <tbody className="divide-y divide-line bg-surface">
                        {pagedRows.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + 1} className="px-3 py-12 text-center text-slate-400">
                                    <Filter className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                                    <p className="text-body">No rows match the current filters</p>
                                </td>
                            </tr>
                        ) : (
                            pagedRows.map((row, idx) => {
                                const rowNo = (safePage - 1) * pageSize + idx;
                                return (
                                <tr key={idx} className="group hover:bg-paper">
                                    <td className="sticky left-0 border-r border-line bg-surface px-3 py-2 font-mono text-caption text-slate-400">
                                        {rowNo + 1}
                                    </td>
                                    {visibleColumns.map((col) => {
                                        const raw = row[col];
                                        const text = displayCell(raw) || '—';
                                        // A merged cell from collapseByObjectId — a distinct-value list.
                                        const parts =
                                            typeof raw === 'string' && raw.includes(', ')
                                                ? raw.split(', ')
                                                : null;
                                        const kind = parts ? null : editorKindFor(col, row);
                                        const key = kind === 'designation'
                                            ? `${rowNo}:__designation__`
                                            : kind === 'location'
                                                ? `${rowNo}:__location__`
                                                : `${rowNo}:${col}`;
                                        if (!parts) {
                                            // ── grouped kinds (designation / location) ──────────────
                                            if (kind === 'designation' || kind === 'location') {
                                                const active = cellEdit?.key === key;
                                                const isAnchor = active && cellEdit.anchorCol === col;
                                                return (
                                                    <td key={col} className="max-w-xs px-3 py-2 font-mono text-caption text-slate-600" title={String(raw ?? '')}>
                                                        <div className="flex items-center gap-1">
                                                            <span className="min-w-0 flex-1 truncate">{text}</span>
                                                            {!active && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startGroupEdit(key, kind, col, row)}
                                                                    title={`Edit ${kind}`}
                                                                    className="shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-canopy-tint hover:text-canopy group-hover:opacity-100"
                                                                >
                                                                    <Edit2 size={11} />
                                                                </button>
                                                            )}
                                                            {isAnchor && (
                                                                <Popover.Root open onOpenChange={(o) => { if (!o) cancelCellEdit(); }}>
                                                                    <Popover.Trigger asChild>
                                                                        <button type="button" title="Editing" className="shrink-0 rounded p-1 text-canopy">
                                                                            <Edit2 size={11} />
                                                                        </button>
                                                                    </Popover.Trigger>
                                                                    <Popover.Portal>
                                                                        <Popover.Content align="start" sideOffset={4} className={cn(panelCls, 'w-80')}>
                                                                            {kind === 'designation' ? (
                                                                                <DesignationPanel
                                                                                    row={row}
                                                                                    cellEdit={cellEdit}
                                                                                    onDesignationChange={(v) => setDesignationField(key, v, row)}
                                                                                    onContinue={() => proceedGroupConfirm(key, 'designation')}
                                                                                    onCancel={cancelCellEdit}
                                                                                    onBack={() => backToGroupEditing(key)}
                                                                                    onSave={() => saveGroupEdit(key, row, 'designation')}
                                                                                />
                                                                            ) : (
                                                                                <LocationPanel
                                                                                    row={row}
                                                                                    cellEdit={cellEdit}
                                                                                    deptOptions={locDeptOptions}
                                                                                    onOfficeTypeChange={(v) => handleOfficeTypeChange(key, v)}
                                                                                    onLocationSelect={(v) => handleLocationSelect(key, cellEdit.draft.office_type, v)}
                                                                                    onDDMToggle={(checked) => handleDDMToggle(key, checked)}
                                                                                    onDeptSelect={(v) => handleDeptSelect(key, v)}
                                                                                    onDistrictSelect={(v) => handleDistrictSelect(key, v)}
                                                                                    onHODeptToggle={(code, adding) => handleHODeptToggle(key, code, adding)}
                                                                                    onContinue={() => proceedGroupConfirm(key, 'location')}
                                                                                    onCancel={cancelCellEdit}
                                                                                    onBack={() => backToGroupEditing(key)}
                                                                                    onSave={() => saveGroupEdit(key, row, 'location')}
                                                                                />
                                                                            )}
                                                                        </Popover.Content>
                                                                    </Popover.Portal>
                                                                </Popover.Root>
                                                            )}
                                                            {active && !isAnchor && (
                                                                <span className="shrink-0 text-[10px] uppercase tracking-wide text-harvest">editing…</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // ── text / boolean kinds ────────────────────────────────
                                            if (kind && cellEdit?.key === key) {
                                                if (cellEdit.stage === 'confirmEdit') {
                                                    return (
                                                        <td key={col} className="max-w-xs px-3 py-2 font-mono text-caption">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="text-slate-500">Edit this value?</span>
                                                                <button type="button" onClick={() => confirmCellEdit(key)} className="font-medium text-canopy hover:underline">Yes</button>
                                                                <button type="button" onClick={cancelCellEdit} className="text-slate-500 hover:text-danger">Cancel</button>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                if (cellEdit.stage === 'confirmSave') {
                                                    const fromLabel = kind === 'boolean' ? (raw === true || raw === 'true' ? 'Active' : 'Inactive') : text;
                                                    const toLabel = kind === 'boolean' ? (cellEdit.draft === 'true' ? 'Active' : 'Inactive') : (cellEdit.draft || '—');
                                                    return (
                                                        <td key={col} className="max-w-xs px-3 py-2 font-mono text-caption">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex min-w-0 items-center gap-1.5">
                                                                    <span className="truncate text-slate-400 line-through">{fromLabel}</span>
                                                                    <span className="shrink-0 text-slate-400">→</span>
                                                                    <span className="truncate font-semibold text-ink">{toLabel}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => saveCellEdit(key, row, col, kind)}
                                                                        disabled={cellEdit.stage === 'saving'}
                                                                        className="font-medium text-canopy hover:underline disabled:opacity-50"
                                                                    >
                                                                        {cellEdit.stage === 'saving' ? 'Saving…' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => backToEditing(key)}
                                                                        disabled={cellEdit.stage === 'saving'}
                                                                        className="text-slate-500 hover:text-danger disabled:opacity-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                // 'editing' (and transient 'saving' rendered as disabled editing)
                                                return (
                                                    <td key={col} className="max-w-xs px-3 py-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1">
                                                                {kind === 'boolean' ? (
                                                                    <div className="min-w-0 flex-1">
                                                                        <CustomSelect
                                                                            value={cellEdit.draft}
                                                                            onChange={(v) => updateCellDraft(key, v)}
                                                                            options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
                                                                            ariaLabel="Active status"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        value={cellEdit.draft}
                                                                        onChange={(e) => updateCellDraft(key, e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') proceedToConfirmSave(key, col);
                                                                            if (e.key === 'Escape') cancelCellEdit();
                                                                        }}
                                                                        className="min-w-0 flex-1 rounded border border-line px-2 py-1 font-mono text-caption focus:border-canopy focus:outline-none focus:ring-2 focus:ring-canopy/20"
                                                                    />
                                                                )}
                                                                <button type="button" onClick={() => proceedToConfirmSave(key, col)} title="Continue" className="shrink-0 rounded p-1 text-canopy hover:bg-canopy-tint">
                                                                    <Check size={13} />
                                                                </button>
                                                                <button type="button" onClick={cancelCellEdit} title="Cancel" className="shrink-0 rounded p-1 text-slate-400 hover:bg-paper">
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                            {cellEdit.error && <span className="text-[11px] text-danger">{cellEdit.error}</span>}
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td
                                                    key={col}
                                                    className="max-w-xs px-3 py-2 font-mono text-caption text-slate-600"
                                                    title={String(raw ?? '')}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span className="min-w-0 flex-1 truncate">{text}</span>
                                                        {kind && (
                                                            <button
                                                                type="button"
                                                                onClick={() => startCellEdit(key, kind, col, raw)}
                                                                title="Edit value"
                                                                className="shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-canopy-tint hover:text-canopy group-hover:opacity-100"
                                                            >
                                                                <Edit2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        }
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
                                );
                            })
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

// ─── Grouped editor panels (rendered inside the anchored Popover.Content) ────

function DesignationPanel({ row, cellEdit, onDesignationChange, onContinue, onCancel, onBack, onSave }) {
    const { draft, stage, error } = cellEdit;
    const isDDMUser = row.department_name === 'DDM' && ['RO', 'TE'].includes(row.office_type);
    const options = isDDMUser ? DDM_DESIGNATION_OPTIONS : DESIGNATION_OPTIONS;
    const saving = stage === 'saving';
    // Mirrors EditUserProfileModal's "Other" affordance: a designation that
    // isn't one of the known options gets a free-text input instead of the
    // select (DDM users have a fixed 3-value set — no "Other" there).
    const [custom, setCustom] = useState(
        () => !isDDMUser && !!draft.designation && !options.some((o) => o.value === draft.designation),
    );

    if (stage === 'confirmSave') {
        const diffs = fieldDiffs([
            { label: 'Designation', from: row.designation, to: draft.designation },
            { label: 'Grade', from: row.user_grade, to: draft.user_grade },
            { label: 'Level', from: row.grade_level, to: draft.grade_level },
            { label: 'Hindi designation', from: row.hindi_designation, to: draft.hindi_designation },
        ]);
        return (
            <div className="flex flex-col gap-2">
                <p className="text-caption font-medium text-slate-500">Confirm changes</p>
                {diffs.length === 0 ? (
                    <p className="text-caption text-slate-400">No changes</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {diffs.map((d) => (
                            <li key={d.label} className="text-caption">
                                <span className="text-slate-500">{d.label}:</span>{' '}
                                <span className="text-slate-400 line-through">{d.from || '—'}</span>{' '}
                                <span className="text-slate-400">→</span>{' '}
                                <span className="font-semibold text-ink">{d.to || '—'}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex items-center gap-3 pt-1">
                    <button type="button" onClick={onSave} disabled={saving} className="font-medium text-canopy hover:underline disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={onBack} disabled={saving} className="text-slate-500 hover:text-danger disabled:opacity-50">
                        Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-caption font-medium text-slate-500">Edit designation</p>
            <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Designation</label>
                <CustomSelect
                    value={custom ? DESIGNATION_OTHER : draft.designation}
                    onChange={(v) => {
                        if (v === DESIGNATION_OTHER) {
                            setCustom(true);
                            onDesignationChange('');
                        } else {
                            setCustom(false);
                            onDesignationChange(v);
                        }
                    }}
                    options={options}
                    ariaLabel="Designation"
                />
                {!isDDMUser && custom && (
                    <input
                        autoFocus
                        type="text"
                        value={draft.designation}
                        onChange={(e) => onDesignationChange(e.target.value)}
                        placeholder="Enter designation"
                        className="w-full rounded border border-line px-2 py-1.5 text-body focus:border-canopy focus:outline-none focus:ring-2 focus:ring-canopy/20"
                    />
                )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-caption">
                <div>
                    <span className="text-[11px] text-slate-400">Grade</span>
                    <div className="font-mono">{draft.user_grade || '—'}</div>
                </div>
                <div>
                    <span className="text-[11px] text-slate-400">Level</span>
                    <div className="font-mono">{draft.grade_level === '' || draft.grade_level === null || draft.grade_level === undefined ? '—' : draft.grade_level}</div>
                </div>
            </div>
            <div>
                <span className="text-[11px] text-slate-400">Hindi designation</span>
                <div className="font-mono text-caption">{draft.hindi_designation || '—'}</div>
            </div>
            {error && <span className="text-[11px] text-danger">{error}</span>}
            <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={onContinue} className="font-medium text-canopy hover:underline">Continue</button>
                <button type="button" onClick={onCancel} className="text-slate-500 hover:text-danger">Cancel</button>
            </div>
        </div>
    );
}

function LocationPanel({
    row, cellEdit, deptOptions,
    onOfficeTypeChange, onLocationSelect, onDDMToggle, onDeptSelect, onDistrictSelect, onHODeptToggle,
    onContinue, onCancel, onBack, onSave,
}) {
    const { draft, stage, error } = cellEdit;
    const saving = stage === 'saving';
    const isHO = draft.office_type === 'HO';
    const isROTE = ['RO', 'TE'].includes(draft.office_type);

    if (stage === 'confirmSave') {
        const oldDept = (row.department_short_code_multi || []).length
            ? row.department_short_code_multi.join(', ')
            : (row.department_short_code || '');
        const newDept = (draft.department_short_code_multi || []).length
            ? draft.department_short_code_multi.join(', ')
            : (draft.department_short_code || '');
        const diffs = fieldDiffs([
            { label: 'Office type', from: row.office_type, to: draft.office_type },
            { label: 'Location', from: row.location, to: draft.location },
            { label: 'RO short code', from: row.ro_short_code, to: draft.ro_short_code },
            { label: 'Department', from: row.department_name, to: draft.department_name },
            { label: 'Dept./District code', from: oldDept, to: newDept },
        ]);
        return (
            <div className="flex flex-col gap-2">
                <p className="text-caption font-medium text-slate-500">Confirm changes</p>
                {diffs.length === 0 ? (
                    <p className="text-caption text-slate-400">No changes</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {diffs.map((d) => (
                            <li key={d.label} className="text-caption">
                                <span className="text-slate-500">{d.label}:</span>{' '}
                                <span className="text-slate-400 line-through">{d.from || '—'}</span>{' '}
                                <span className="text-slate-400">→</span>{' '}
                                <span className="font-semibold text-ink">{d.to || '—'}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex items-center gap-3 pt-1">
                    <button type="button" onClick={onSave} disabled={saving} className="font-medium text-canopy hover:underline disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={onBack} disabled={saving} className="text-slate-500 hover:text-danger disabled:opacity-50">
                        Back
                    </button>
                </div>
            </div>
        );
    }

    const locs = isROTE ? getLocations(draft.office_type) : [];

    return (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto scrollbar-thin">
            <p className="text-caption font-medium text-slate-500">Edit office / location</p>

            <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Office type</label>
                <CustomSelect value={draft.office_type} onChange={onOfficeTypeChange} options={OFFICE_TYPE_OPTIONS} ariaLabel="Office type" />
            </div>

            {isROTE && (
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Location</label>
                    <CustomSelect
                        value={draft.location}
                        onChange={onLocationSelect}
                        options={locs.map((l) => ({ value: l.location, label: l.location }))}
                        placeholder="— Select location —"
                        ariaLabel="Location"
                    />
                </div>
            )}

            <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">RO short code</label>
                <div className="rounded border border-line bg-paper px-2 py-1.5 font-mono text-caption text-slate-500">
                    {isHO ? '—' : (draft.ro_short_code || '—')}
                </div>
            </div>

            {isROTE && (
                <label className="flex items-center gap-2 rounded-lg border border-canopy/20 bg-canopy-tint px-3 py-2 text-caption">
                    <input type="checkbox" checked={!!draft.isDDM} onChange={(e) => onDDMToggle(e.target.checked)} className="rounded accent-canopy" />
                    <span className="font-semibold text-canopy">DDM — District Development Manager</span>
                </label>
            )}

            {isROTE && draft.isDDM && (
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">District</label>
                    <CustomSelect
                        value={draft.department_short_code}
                        onChange={onDistrictSelect}
                        options={(DDM_DISTRICTS[draft.location] || []).map((d) => ({ value: d, label: d }))}
                        disabled={!draft.location}
                        placeholder="— Select district —"
                        ariaLabel="District"
                    />
                </div>
            )}

            {isROTE && !draft.isDDM && (
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Department</label>
                    <CustomSelect
                        value={draft.department_name}
                        onChange={onDeptSelect}
                        options={deptOptions.map((d) => ({ value: d.name, label: d.name }))}
                        disabled={!draft.location}
                        placeholder="— Select department —"
                        ariaLabel="Department"
                    />
                </div>
            )}

            {isHO && (
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Departments</label>
                    <div className="max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-line">
                        {deptOptions.map((d) => (
                            <label key={d.shortCode} className="flex items-center gap-2 border-b border-line px-2 py-1.5 last:border-0 text-caption hover:bg-paper">
                                <input
                                    type="checkbox"
                                    checked={(draft.department_short_code_multi || []).includes(d.shortCode)}
                                    onChange={(e) => onHODeptToggle(d.shortCode, e.target.checked)}
                                    className="rounded accent-canopy"
                                />
                                <span>{d.name}</span>
                            </label>
                        ))}
                        {deptOptions.length === 0 && <p className="px-2 py-3 text-center text-caption text-slate-400">No departments</p>}
                    </div>
                </div>
            )}

            {error && <span className="text-[11px] text-danger">{error}</span>}
            <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={onContinue} className="font-medium text-canopy hover:underline">Continue</button>
                <button type="button" onClick={onCancel} className="text-slate-500 hover:text-danger">Cancel</button>
            </div>
        </div>
    );
}
