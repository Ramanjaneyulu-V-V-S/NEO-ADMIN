import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
    Play, ListChecks, StepForward, RotateCcw, Square, Database,
    History, Star, StarOff, Clock, Trash2, Copy, Check, Pencil, X, AlertTriangle,
} from 'lucide-react';
import axios from '../api/axios';
import useQueryHistory from '../hooks/useQueryHistory';
import useQueryFavorites from '../hooks/useQueryFavorites';
import { splitStatements, statementAtOffset, leadingVerb, extractFromTarget } from '../utils/dql';
import { PageHeader, Button, Badge, CustomSelect, useToast } from '../components/ui';
import DqlEditor from '../components/query/DqlEditor';
import ResultsGrid from '../components/query/ResultsGrid';
import { syncUserGroups } from '../utils/userGroupSync.js';

const LIMIT_OPTIONS = [
    { value: 100, label: '100' },
    { value: 500, label: '500' },
    { value: 1000, label: '1,000' },
    { value: 5000, label: '5,000' },
    { value: 10000, label: '10,000' },
];

const PLACEHOLDER = `SELECT r_object_id, object_name FROM dm_user WHERE user_state = 0;
SELECT r_object_id, object_name, r_creation_date FROM dm_cabinet;`;

const panelCls = 'z-[99999] w-[22rem] max-w-[90vw] rounded-lg border border-line bg-surface shadow-pop';

// cms_user_profile fields editable directly in the grid, and how — see
// ResultsGrid.jsx's editorKindFor()/fieldEditors doc for the kinds.
// 'text'/'boolean' are single-cell PATCHes (handleSaveCell below).
// 'designation'/'location' are grouped edits — every field of a kind
// shares one popover and one handleSaveGroup call, which also runs the
// same group-membership sync EditUserProfileModal.jsx does on submit
// (see syncUserGroups, userGroupSync.js).
const FIELD_EDITORS = {
    uin: 'text', user_email_address: 'text', primary_mobile_number: 'text',
    hindi_user_name: 'text', hindi_designation: 'text', user_role: 'text',
    is_active: 'boolean',
    designation: 'designation', user_grade: 'designation', grade_level: 'designation',
    office_type: 'location', location: 'location', ro_short_code: 'location',
    department_name: 'location',
};
const REQUIRED_TEXT_FIELDS = new Set(['uin', 'user_email_address', 'hindi_user_name', 'hindi_designation']);

function upsert(arr, idx, patch) {
    const copy = arr.slice();
    copy[idx] = { ...(copy[idx] || {}), ...patch };
    return copy;
}

function relativeTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
}

const QueryPage = () => {
    const toast = useToast();
    const { history, addQuery, clearHistory } = useQueryHistory();
    const { favorites, addFavorite, removeFavorite, renameFavorite } = useQueryFavorites();

    const [query, setQuery] = useState('');
    const [cursorOffset, setCursorOffset] = useState(0);
    const [resultLimit, setResultLimit] = useState(1000);

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]); // per-statement { status, rowCount, error }
    const [activeResult, setActiveResult] = useState({ columns: [], rows: [] });
    const [activeObjectType, setActiveObjectType] = useState(null);
    const [hasRun, setHasRun] = useState(false);
    const [highlightRange, setHighlightRange] = useState(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [runId, setRunId] = useState(0);

    const abortRef = useRef(null);
    // Last statement actually executed — lets a successful edit re-run the
    // same query to refresh the grid, independent of where the caret is now.
    const lastRunRef = useRef(null);

    const statements = useMemo(() => splitStatements(query), [query]);
    const currentStatement = useMemo(
        () => statementAtOffset(statements, cursorOffset),
        [statements, cursorOffset],
    );
    const currentVerb = currentStatement ? leadingVerb(currentStatement) : '';
    const nonSelectWarning = currentStatement && currentVerb && currentVerb !== 'SELECT';

    // Editing the query invalidates the step cursor and the running marker.
    useEffect(() => {
        setStepIndex(0);
        setHighlightRange(null);
    }, [query]);

    const lastError = useMemo(() => {
        for (let i = results.length - 1; i >= 0; i--) {
            if (results[i]?.status === 'error') return results[i].error;
        }
        return null;
    }, [results]);

    const runOne = useCallback(
        async (statement, idx) => {
            const dql = (typeof statement === 'string' ? statement : statement?.text || '').trim();
            if (!dql) return { ok: false, error: 'Empty statement' };

            lastRunRef.current = { statement, idx };

            if (statement && statement.from != null) {
                setHighlightRange({ from: statement.from, to: statement.to });
            }
            setResults((prev) => upsert(prev, idx, { status: 'running', error: null }));
            // Drop the previous statement's rows immediately — otherwise the grid
            // keeps showing stale data underneath the "running…" badge above it.
            setActiveResult({ columns: [], rows: [] });

            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const res = await axios.post(
                    '/query/execute',
                    { dql, limit: resultLimit },
                    { signal: controller.signal },
                );
                const data = res.data || {};
                if (data.error) {
                    setResults((prev) => upsert(prev, idx, { status: 'error', error: data.error, rowCount: 0 }));
                    return { ok: false, error: data.error };
                }
                const rows = data.rows || [];
                setActiveResult({ columns: data.columns || [], rows });
                setActiveObjectType(extractFromTarget(statement));
                setResults((prev) => upsert(prev, idx, { status: 'ok', rowCount: rows.length, error: null }));
                return { ok: true, rows: rows.length };
            } catch (err) {
                const canceled = err.code === 'ERR_CANCELED' || err.name === 'CanceledError';
                const msg = canceled
                    ? 'Stopped'
                    : err.response?.data?.message || err.message || 'Query failed';
                setResults((prev) => upsert(prev, idx, { status: 'error', error: msg, rowCount: 0 }));
                return { ok: false, error: msg, canceled };
            } finally {
                abortRef.current = null;
            }
        },
        [resultLimit],
    );

    // Single-field inline save from the results grid itself — reuses the same
    // PATCH endpoint as EditUserProfileModal, but for one whitelisted "plain
    // data" or boolean field at a time (see FIELD_EDITORS above). Updates the
    // grid's local row state directly instead of re-running the query, so
    // sort/filter/page position survives the edit.
    const handleSaveCell = useCallback(async (row, col, newValue) => {
        try {
            await axios.patch(`/users/profiles/${row.r_object_id}`, { [col]: newValue });
            setActiveResult((prev) => ({
                ...prev,
                rows: prev.rows.map((r) => (r.r_object_id === row.r_object_id ? { ...r, [col]: newValue } : r)),
            }));
            toast.success(`${col} updated`);
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to update ${col}`);
            return false;
        }
    }, [toast]);

    // Snapshot of a row's current group-relevant fields, in the shape
    // syncUserGroups()/EditUserProfileModal.jsx's originalGroupInfoRef uses —
    // deptCodes empty for a DDM profile, same as the modal's initForm().
    const buildOldGroupInfo = (row) => {
        const isDDMProfile = row.department_name === 'DDM';
        const multiCodes = Array.isArray(row.department_short_code_multi)
            ? row.department_short_code_multi
            : (row.department_short_code ? [row.department_short_code] : []);
        return {
            officeType: row.office_type || '',
            roShortCode: row.ro_short_code || '',
            deptCodes: isDDMProfile ? [] : multiCodes,
            designation: row.designation || '',
            location: row.location || '',
            departmentName: row.department_name || '',
            deptShortCode: row.department_short_code || '',
        };
    };

    // Grouped inline save from the results grid — 'designation' or 'location'
    // fields (see FIELD_EDITORS above). PATCHes just that group's fields, then
    // runs the same client-side group-membership sync
    // EditUserProfileModal.jsx's handleSubmit does, so a moved user comes out
    // correctly (de-)provisioned instead of silently under-provisioned.
    const handleSaveGroup = useCallback(async (kind, row, draft) => {
        if (!row.user_login_name) {
            toast.error('user_login_name is required to edit this field — add it to the SELECT');
            return false;
        }
        const old = buildOldGroupInfo(row);
        let payload;
        let form;
        if (kind === 'designation') {
            payload = {
                designation: draft.designation,
                user_grade: draft.user_grade,
                grade_level: draft.grade_level,
                hindi_designation: draft.hindi_designation,
            };
            form = { ...row, ...payload };
        } else {
            payload = {
                office_type: draft.office_type,
                location: draft.location,
                ro_short_code: draft.ro_short_code,
                department_name: draft.department_name,
                department_short_code: draft.department_short_code,
                department_short_code_multi: draft.department_short_code_multi,
            };
            form = { ...row, ...payload };
        }
        try {
            await axios.patch(`/users/profiles/${row.r_object_id}`, payload);
            const { settled } = await syncUserGroups({ old, form, payload, memberName: row.user_login_name });
            const results = await Promise.allSettled(settled);
            if (results.some((r) => r.value?.ok === false)) {
                toast.error('Saved, but one or more group updates failed — check the user\'s groups');
            } else {
                toast.success(`${kind === 'designation' ? 'Designation' : 'Location'} updated`);
            }
            setActiveResult((prev) => ({
                ...prev,
                rows: prev.rows.map((r) => (r.r_object_id === row.r_object_id ? { ...r, ...payload } : r)),
            }));
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to update ${kind}`);
            return false;
        }
    }, [toast]);

    // History stores the full editor buffer as-run (all statements, as typed),
    // not each executed statement. Deduped by exact text in the hook.
    const recordHistory = useCallback(() => {
        if (query.trim()) addQuery(query, resultLimit);
    }, [query, resultLimit, addQuery]);

    const runStatement = useCallback(async () => {
        if (loading) return;
        if (!currentStatement) {
            toast.error('Nothing to run — write a DQL statement first');
            return;
        }
        const idx = statements.indexOf(currentStatement);
        recordHistory();
        setLoading(true);
        setHasRun(true);
        setResults([]);
        setRunId((n) => n + 1);
        await runOne(currentStatement, idx < 0 ? 0 : idx);
        setLoading(false);
        setHighlightRange(null);
    }, [loading, currentStatement, statements, runOne, recordHistory, toast]);

    const runAll = useCallback(async () => {
        if (loading || statements.length === 0) return;
        recordHistory();
        setLoading(true);
        setHasRun(true);
        setResults([]);
        setRunId((n) => n + 1);
        for (let i = 0; i < statements.length; i++) {
            const r = await runOne(statements[i], i);
            if (!r.ok) {
                if (!r.canceled) toast.error(`Statement ${i + 1}: ${r.error}`);
                break;
            }
        }
        setLoading(false);
        setHighlightRange(null);
    }, [loading, statements, runOne, recordHistory, toast]);

    const step = useCallback(async () => {
        if (loading || statements.length === 0) return;
        const i = stepIndex >= statements.length ? 0 : stepIndex;
        if (i === 0) {
            setResults([]);
            recordHistory();
        }
        setLoading(true);
        setHasRun(true);
        setRunId((n) => n + 1);
        const r = await runOne(statements[i], i);
        setLoading(false);
        setStepIndex(i + 1);
        if (statements[i]?.from != null) {
            setHighlightRange({ from: statements[i].from, to: statements[i].to });
        }
        if (!r.ok && !r.canceled) toast.error(`Statement ${i + 1}: ${r.error}`);
    }, [loading, statements, stepIndex, runOne, recordHistory, toast]);

    const resetStep = useCallback(() => {
        setStepIndex(0);
        setHighlightRange(null);
    }, []);

    const stop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader title="Query" icon={Database} description="Run read-only DQL against the repository." />

            <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-card">
                <DqlEditor
                    value={query}
                    onChange={setQuery}
                    onCursorChange={setCursorOffset}
                    highlightRange={highlightRange}
                    disabled={loading}
                    onExecute={runStatement}
                />

                {query.trim() === '' && (
                    <p className="mt-2 whitespace-pre-wrap font-mono text-caption text-slate-400">{PLACEHOLDER}</p>
                )}

                {/* Toolbar */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={runStatement} loading={loading} disabled={statements.length === 0}>
                        <Play size={13} /> Run{statements.length > 1 ? ' statement' : ''}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={runAll} disabled={loading || statements.length < 2}>
                        <ListChecks size={13} /> Run all
                    </Button>
                    <Button size="sm" variant="secondary" onClick={step} disabled={loading || statements.length === 0}>
                        <StepForward size={13} /> Step{statements.length > 1 ? ` ${Math.min(stepIndex + 1, statements.length)}/${statements.length}` : ''}
                    </Button>
                    {stepIndex > 0 && (
                        <Button size="sm" variant="ghost" onClick={resetStep} disabled={loading}>
                            <RotateCcw size={13} /> Reset
                        </Button>
                    )}
                    {loading && (
                        <Button size="sm" variant="danger" onClick={stop}>
                            <Square size={13} /> Stop
                        </Button>
                    )}

                    <div className="mx-1 h-6 w-px bg-line" />

                    <HistoryMenu
                        history={history}
                        onPick={(q) => setQuery(q)}
                        onClear={clearHistory}
                    />
                    <FavoritesMenu
                        favorites={favorites}
                        currentQuery={query}
                        onPick={(q) => setQuery(q)}
                        onAdd={addFavorite}
                        onRemove={removeFavorite}
                        onRename={renameFavorite}
                        notify={toast}
                    />

                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-caption text-slate-500">Max rows</span>
                        <div className="w-28">
                            <CustomSelect
                                value={resultLimit}
                                onChange={(v) => setResultLimit(Number(v))}
                                options={LIMIT_OPTIONS}
                                ariaLabel="Maximum rows per statement"
                            />
                        </div>
                    </div>
                </div>

                {/* Per-statement status strip */}
                {results.some(Boolean) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {statements.map((s, i) => {
                            const r = results[i];
                            if (!r) return null;
                            const tone = r.status === 'ok' ? 'canopy' : r.status === 'error' ? 'danger' : 'neutral';
                            return (
                                <Badge key={i} tone={tone}>
                                    <span className="font-mono">{i + 1}</span>
                                    {r.status === 'running' && ' running…'}
                                    {r.status === 'ok' && ` ✓ ${r.rowCount}`}
                                    {r.status === 'error' && ` ✗ ${r.error}`}
                                </Badge>
                            );
                        })}
                    </div>
                )}

                {nonSelectWarning && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-harvest/20 bg-harvest/10 px-3 py-2 text-caption text-harvest">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>
                            The statement under the cursor starts with <span className="font-mono font-semibold">{currentVerb}</span>.
                            Only <span className="font-mono">SELECT</span> statements run from here — the server rejects anything else.
                        </span>
                    </div>
                )}

                {lastError && !nonSelectWarning && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-caption text-danger">
                        <X size={14} className="mt-0.5 shrink-0" />
                        <span>{lastError}</span>
                    </div>
                )}
            </div>

            {hasRun ? (
                <ResultsGrid
                    columns={activeResult.columns}
                    rows={activeResult.rows}
                    loading={loading}
                    runId={runId}
                    emptyLabel={loading ? 'Running…' : 'No rows returned'}
                    fieldEditors={activeObjectType === 'cms_user_profile' ? FIELD_EDITORS : {}}
                    requiredColumns={REQUIRED_TEXT_FIELDS}
                    onSaveCell={activeObjectType === 'cms_user_profile' ? handleSaveCell : undefined}
                    onSaveGroup={activeObjectType === 'cms_user_profile' ? handleSaveGroup : undefined}
                />
            ) : (
                <div className="rounded-card border border-line bg-surface py-16 text-center text-slate-400 shadow-card">
                    <Database className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    <p className="text-body">Write DQL above and press Run (⌘/Ctrl+Enter)</p>
                </div>
            )}
        </div>
    );
};

// ─── History dropdown ────────────────────────────────────────────────────────
function HistoryMenu({ history, onPick, onClear }) {
    const [copiedId, setCopiedId] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    const copy = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch (err) {
            console.error('Copy failed', err);
        }
    };

    return (
        <Popover.Root onOpenChange={() => setConfirmClear(false)}>
            <Popover.Trigger asChild>
                <Button size="sm" variant="secondary">
                    <History size={13} /> History
                    {history.length > 0 && <span className="ml-1 font-mono text-[11px] text-slate-400">{history.length}</span>}
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content align="start" sideOffset={4} className={panelCls}>
                    <div className="flex items-center justify-between border-b border-line px-3 py-2">
                        <span className="text-caption font-medium text-slate-500">Recent queries</span>
                        {history.length > 0 && (
                            confirmClear ? (
                                <button
                                    type="button"
                                    onClick={() => { onClear(); setConfirmClear(false); }}
                                    className="text-[11px] font-medium text-danger"
                                >
                                    Confirm clear
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmClear(true)}
                                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-danger"
                                >
                                    <Trash2 size={11} /> Clear
                                </button>
                            )
                        )}
                    </div>
                    <div className="max-h-72 overflow-y-auto scrollbar-thin">
                        {history.length === 0 ? (
                            <p className="px-3 py-6 text-center text-caption text-slate-400">No queries yet</p>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="group flex items-start gap-2 border-b border-line px-3 py-2 last:border-0 hover:bg-paper">
                                    <button type="button" onClick={() => onPick(item.query)} className="min-w-0 flex-1 text-left">
                                        <p className="line-clamp-3 whitespace-pre-wrap break-words font-mono text-caption text-slate-700">{item.query}</p>
                                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                            <Clock size={10} /> {relativeTime(item.executedAt)}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copy(item.query, item.id)}
                                        className="shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-canopy-tint hover:text-canopy group-hover:opacity-100"
                                        title="Copy"
                                    >
                                        {copiedId === item.id ? <Check size={13} className="text-canopy" /> : <Copy size={13} />}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

// ─── Favorites dropdown ──────────────────────────────────────────────────────
function FavoritesMenu({ favorites, currentQuery, onPick, onAdd, onRemove, onRename, notify }) {
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [confirmId, setConfirmId] = useState(null);

    const save = () => {
        if (!name.trim() || !currentQuery.trim()) {
            notify.error('Give the query a name first');
            return;
        }
        onAdd(name.trim(), currentQuery);
        notify.success(`Saved "${name.trim()}"`);
        setName('');
    };

    const commitRename = (id) => {
        if (editName.trim()) onRename(id, editName.trim());
        setEditingId(null);
        setEditName('');
    };

    return (
        <Popover.Root
            onOpenChange={(open) => {
                if (!open) { setEditingId(null); setConfirmId(null); setName(''); }
            }}
        >
            <Popover.Trigger asChild>
                <Button size="sm" variant="secondary">
                    <Star size={13} /> Favorites
                    {favorites.length > 0 && <span className="ml-1 font-mono text-[11px] text-slate-400">{favorites.length}</span>}
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content align="start" sideOffset={4} className={panelCls}>
                    <div className="flex items-center gap-1.5 border-b border-line p-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && save()}
                            placeholder="Save current query as…"
                            className="min-w-0 flex-1 rounded border border-line px-2 py-1.5 text-body focus:border-canopy focus:outline-none focus:ring-2 focus:ring-canopy/20"
                        />
                        <Button size="sm" onClick={save} disabled={!name.trim() || !currentQuery.trim()}>
                            Save
                        </Button>
                    </div>
                    <div className="max-h-72 overflow-y-auto scrollbar-thin">
                        {favorites.length === 0 ? (
                            <p className="px-3 py-6 text-center text-caption text-slate-400">No saved queries</p>
                        ) : (
                            favorites.map((fav) => (
                                <div key={fav.id} className="group border-b border-line px-3 py-2 last:border-0 hover:bg-paper">
                                    {editingId === fav.id ? (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && commitRename(fav.id)}
                                                className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-body focus:border-canopy focus:outline-none"
                                            />
                                            <button type="button" onClick={() => commitRename(fav.id)} className="rounded p-1 text-canopy hover:bg-canopy-tint">
                                                <Check size={13} />
                                            </button>
                                            <button type="button" onClick={() => setEditingId(null)} className="rounded p-1 text-slate-400 hover:bg-paper">
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2">
                                            <button type="button" onClick={() => onPick(fav.query)} className="min-w-0 flex-1 text-left">
                                                <p className="truncate text-body font-medium text-slate-700">{fav.name}</p>
                                                <p className="line-clamp-2 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-400">{fav.query}</p>
                                            </button>
                                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingId(fav.id); setEditName(fav.name); }}
                                                    className="rounded p-1 text-slate-400 hover:bg-canopy-tint hover:text-canopy"
                                                    title="Rename"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                {confirmId === fav.id ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { onRemove(fav.id); setConfirmId(null); }}
                                                        className="rounded px-1 py-1 text-[11px] font-medium text-danger"
                                                    >
                                                        Delete?
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmId(fav.id)}
                                                        className="rounded p-1 text-slate-400 hover:bg-danger-tint hover:text-danger"
                                                        title="Delete"
                                                    >
                                                        <StarOff size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

export default QueryPage;
