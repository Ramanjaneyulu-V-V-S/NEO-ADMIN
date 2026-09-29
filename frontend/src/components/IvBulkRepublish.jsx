import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { Search, UploadCloud, AlertCircle, CheckCircle2, RotateCcw, Square } from 'lucide-react';
import { Card, Field, DateInput, Button, Modal, useToast } from './ui';
import { formatDate } from '../utils/datetime';

const CONCURRENCY = 3;

const categoryOf = (doc) => doc.category || 'Other';

export default function IvBulkRepublish() {
    const toast = useToast();
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [found, setFound] = useState(null); // { documents, truncated, from, to }
    const [selectedCats, setSelectedCats] = useState(() => new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [run, setRun] = useState(null); // { total, done, ok, failed: [{doc,error}], running, stopped }
    const stopRef = useRef(false);

    const running = !!run?.running;
    const rangeValid = fromDate && toDate && fromDate <= toDate;

    // Warn before leaving mid-run: the publish loop lives in this tab.
    useEffect(() => {
        if (!running) return undefined;
        const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', guard);
        return () => window.removeEventListener('beforeunload', guard);
    }, [running]);

    const categoryCounts = useMemo(() => {
        const counts = new Map();
        (found?.documents || []).forEach((d) => counts.set(categoryOf(d), (counts.get(categoryOf(d)) || 0) + 1));
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [found]);

    const selectedDocs = useMemo(
        () => (found?.documents || []).filter((d) => selectedCats.has(categoryOf(d))),
        [found, selectedCats]
    );

    const handleFind = async () => {
        if (!rangeValid || searching || running) return;
        setSearching(true);
        setSearchError('');
        setFound(null);
        setRun(null);
        try {
            const { data } = await api.get('/iv/documents-by-date', { params: { from: fromDate, to: toDate } });
            if (!data.success) {
                setSearchError(data.error || 'Failed to list documents.');
                return;
            }
            const documents = data.documents || [];
            setFound({ documents, truncated: !!data.truncated, from: fromDate, to: toDate });
            setSelectedCats(new Set(documents.map(categoryOf)));
        } catch (err) {
            setSearchError(err.response?.data?.error || err.message || 'Failed to list documents.');
        } finally {
            setSearching(false);
        }
    };

    const toggleCat = (cat) => {
        setSelectedCats((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
        });
    };

    const publishAll = async (docs) => {
        setConfirmOpen(false);
        stopRef.current = false;
        setRun({ total: docs.length, done: 0, ok: 0, failed: [], running: true, stopped: false });

        let next = 0;
        const worker = async () => {
            while (!stopRef.current) {
                const doc = docs[next++];
                if (!doc) return;
                let error = null;
                try {
                    const { data } = await api.post('/iv/publish', { docId: doc.id });
                    if (!data.success) error = data.error || 'Publish failed';
                } catch (err) {
                    error = err.response?.data?.error || err.message || 'Publish failed';
                }
                setRun((r) => ({
                    ...r,
                    done: r.done + 1,
                    ok: r.ok + (error ? 0 : 1),
                    failed: error ? [...r.failed, { doc, error }] : r.failed,
                }));
            }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, worker));

        setRun((r) => ({ ...r, running: false, stopped: stopRef.current }));
    };

    const percent = run && run.total ? Math.round((run.done / run.total) * 100) : 0;
    const finished = run && !run.running;

    useEffect(() => {
        if (!finished) return;
        if (run.stopped) toast.info(`Stopped after ${run.done} of ${run.total} documents.`);
        else if (run.failed.length === 0) toast.success(`Republished ${run.ok} documents.`);
        else toast.error(`${run.failed.length} of ${run.total} documents failed.`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finished]);

    return (
        <div className="space-y-6">
            <Card className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <Field label="From date" help="Documents last modified on or after this date">
                        <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={running} />
                    </Field>
                    <Field label="To date" help="Up to and including this date">
                        <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={running} />
                    </Field>
                    <Button
                        onClick={handleFind}
                        disabled={!rangeValid || running}
                        loading={searching}
                        className="justify-center"
                    >
                        <Search size={16} />
                        {searching ? 'Searching…' : 'Find documents'}
                    </Button>
                </div>
                {fromDate && toDate && fromDate > toDate && (
                    <p className="text-caption text-danger">From date must not be after To date.</p>
                )}
                {searchError && (
                    <p className="flex items-center gap-2 text-caption text-danger">
                        <AlertCircle size={14} /> {searchError}
                    </p>
                )}
            </Card>

            {found && (
                <Card className="space-y-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-body font-semibold text-slate-800">
                            <span className="font-mono">{found.documents.length}</span> documents modified{' '}
                            {found.from === found.to
                                ? `on ${formatDate(found.from + 'T00:00:00')}`
                                : `${formatDate(found.from + 'T00:00:00')} – ${formatDate(found.to + 'T00:00:00')}`}
                        </h3>
                    </div>

                    {found.truncated && (
                        <div className="flex items-start gap-2 rounded-card border border-harvest/30 bg-harvest/10 p-3 text-caption text-slate-700">
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-harvest" />
                            Only the first {found.documents.length} documents are shown. Narrow the date range to
                            cover the rest.
                        </div>
                    )}

                    {found.documents.length === 0 ? (
                        <p className="text-caption text-slate-500">No documents were modified in this range.</p>
                    ) : (
                        <>
                            <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Document types
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {categoryCounts.map(([cat, count]) => (
                                        <label
                                            key={cat}
                                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-body text-ink hover:bg-paper"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-canopy"
                                                checked={selectedCats.has(cat)}
                                                onChange={() => toggleCat(cat)}
                                                disabled={running}
                                            />
                                            <span className="flex-1 truncate">{cat}</span>
                                            <span className="font-mono text-caption text-slate-500">{count}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={() => setConfirmOpen(true)}
                                disabled={selectedDocs.length === 0 || running}
                                className="w-full justify-center sm:w-auto"
                            >
                                <UploadCloud size={16} />
                                Republish {selectedDocs.length} document{selectedDocs.length === 1 ? '' : 's'}
                            </Button>
                        </>
                    )}
                </Card>
            )}

            {run && (
                <Card className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-body font-semibold text-slate-800">
                            {running ? 'Republishing…' : run.stopped ? 'Stopped' : 'Finished'}
                        </h3>
                        <span className="font-mono text-caption text-slate-500">
                            {run.done} / {run.total}
                        </span>
                    </div>

                    <div
                        className="h-2 overflow-hidden rounded-full bg-paper"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                    >
                        <div className="h-full rounded-full bg-canopy transition-[width] duration-200" style={{ width: `${percent}%` }} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-caption">
                        <span className="flex items-center gap-1 text-canopy-dark">
                            <CheckCircle2 size={14} /> {run.ok} succeeded
                        </span>
                        <span className={`flex items-center gap-1 ${run.failed.length ? 'text-danger' : 'text-slate-400'}`}>
                            <AlertCircle size={14} /> {run.failed.length} failed
                        </span>
                        {run.stopped && (
                            <span className="text-slate-500">{run.total - run.done} not attempted</span>
                        )}
                    </div>

                    {running && (
                        <Button variant="secondary" size="sm" onClick={() => { stopRef.current = true; }}>
                            <Square size={14} /> Stop
                        </Button>
                    )}

                    {!running && run.failed.length > 0 && (
                        <div className="space-y-3">
                            <div className="max-h-64 overflow-y-auto rounded-lg border border-line scrollbar-thin">
                                <ul className="divide-y divide-line">
                                    {run.failed.map(({ doc, error }) => (
                                        <li key={doc.id} className="px-3 py-2 text-caption">
                                            <p className="truncate font-medium text-ink">{doc.name || '—'}</p>
                                            <p className="font-mono text-slate-500">{doc.id}</p>
                                            <p className="text-danger">{error}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => publishAll(run.failed.map((f) => f.doc))}>
                                <RotateCcw size={14} /> Retry {run.failed.length} failed
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            {confirmOpen && (
                <Modal
                    isOpen
                    onClose={() => setConfirmOpen(false)}
                    size="sm"
                    title={
                        <span className="flex items-center gap-2">
                            <UploadCloud size={18} className="text-slate-500" />
                            Republish {selectedDocs.length} documents
                        </span>
                    }
                    footer={
                        <>
                            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                            <Button variant="primary" size="sm" onClick={() => publishAll(selectedDocs)}>Republish</Button>
                        </>
                    }
                >
                    <div className="space-y-2 text-sm text-slate-600">
                        <p>
                            Republish <span className="font-mono font-medium text-slate-900">{selectedDocs.length}</span>{' '}
                            documents modified {formatDate(found.from + 'T00:00:00')} – {formatDate(found.to + 'T00:00:00')} to the IV viewer pipeline?
                        </p>
                        <p className="text-caption text-slate-500">
                            Each document is a separate publish request. Keep this tab open until it finishes — you can stop at any time.
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
}
