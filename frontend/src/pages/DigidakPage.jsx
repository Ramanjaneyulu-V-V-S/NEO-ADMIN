import { useState, useEffect, useMemo, useCallback } from 'react';
import { Mail, Search, ClipboardList, X } from 'lucide-react';
import api from '../api/axios';
import { formatDate } from '../utils/datetime';
import { caseStatusTone } from '../utils/statusTone';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import {
    PageHeader, Card, Field, Input, DateInput, Button, DataTable, Badge, EmptyState, Pagination, useToast,
} from '../components/ui';
import CustomSelect from '../components/ui/CustomSelect.jsx';

const MIN_QUERY = 3;
const PAGE_SIZE = 10;
const OFFICE_TYPES = [
    { value: '', label: 'Any' },
    { value: 'HO', label: 'HO' },
    { value: 'RO', label: 'RO' },
    { value: 'TE', label: 'TE' },
];

const dash = (v) => {
    const value = Array.isArray(v) ? v.join(', ') : v;
    return value === undefined || value === null || value === '' ? '—' : value;
};
const directionLabel = (d) => (d === 'Inward' ? 'Inbox' : d === 'Outward' ? 'Outbox' : dash(d));

const MATCH_COLUMNS = [
    { key: 'uid_number', header: 'Letter Number', primary: true, mono: true,
      render: (r) => <span className="font-medium text-ink">{dash(r.uid_number)}</span> },
    { key: 'letter_subject', header: 'Subject', cardLabel: 'Subject',
      render: (r) => <span className="block max-w-xs truncate text-slate-600" title={r.letter_subject}>{dash(r.letter_subject)}</span> },
    { key: 'decision', header: 'Direction', cardLabel: 'Direction',
      render: (r) => <Badge tone={r.decision === 'Inward' ? 'canopy' : 'harvest'}>{directionLabel(r.decision)}</Badge> },
    { key: 'status', header: 'Status', cardLabel: 'Status',
      render: (r) => <Badge tone={caseStatusTone(r.status)}>{dash(r.status)}</Badge> },
    { key: 'r_creation_date', header: 'Created', mono: true, cardLabel: 'Created',
      render: (r) => <span className="text-xs text-slate-600">{formatDate(r.r_creation_date)}</span> },
];

const movementCell = (key, header, extra = {}) => ({
    key, header, render: (r) => <span className="block max-w-xs truncate" title={String(dash(r[key]))}>{dash(r[key])}</span>, ...extra,
});
const MOVEMENT_COLUMNS = [
    { key: 'idx', header: '#', mono: true, width: 'w-12', card: 'hide', render: (_r, i) => i + 1 },
    movementCell('type_category', 'Type Category', { primary: true }),
    movementCell('performer', 'Performer'),
    movementCell('status', 'Status'),
    movementCell('assigned_user', 'Assigned User'),
    movementCell('entry_type', 'Entry Type'),
    movementCell('received_date', 'Received Date', { mono: true }),
    movementCell('completed_date', 'Completed Date', { mono: true }),
];

const Detail = ({ label, children, mono = false }) => (
    <div className="min-w-0">
        <dt className="text-caption text-slate-400">{label}</dt>
        <dd className={`mt-0.5 break-words text-body text-ink ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
);

// Sidebar entry point for Digidak: find a letter by number and/or office, department/location and dates,
// then see its details and movement register.
export default function DigidakPage() {
    const toast = useToast();

    // Local Admins are pinned to their own office (same rule as the Reports page).
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';
    const [profileCtx, setProfileCtx] = useState(null);

    const [query, setQuery] = useState('');
    const [officeType, setOfficeType] = useState('');
    const [location, setLocation] = useState('');
    const [deptName, setDeptName] = useState('');
    const [departments, setDepartments] = useState([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [searching, setSearching] = useState(false);
    const [applied, setApplied] = useState(null); // the criteria behind the current results
    const [page, setPage] = useState(1);
    const [matches, setMatches] = useState(null); // null = nothing searched yet
    const [hasMore, setHasMore] = useState(false);
    const [selected, setSelected] = useState(null);
    const [movement, setMovement] = useState([]);
    const [movementLoading, setMovementLoading] = useState(false);

    const isRoTe = officeType === 'RO' || officeType === 'TE';
    const locations = useMemo(() => getLocations(officeType), [officeType]);
    const trimmedQuery = query.trim();
    const queryTooShort = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY;
    const canSearch = !queryTooShort && (trimmedQuery.length >= MIN_QUERY || officeType || fromDate || toDate);

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                if (ctx.office_type) {
                    setOfficeType(ctx.office_type);
                    if (ctx.location) setLocation(ctx.location);
                }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // HO departments (RO/TE narrow by location instead).
    useEffect(() => {
        setDepartments([]);
        if (officeType !== 'HO') return;
        fetchDepartments('HO', '')
            .then(depts => setDepartments(depts || []))
            .catch(() => setDepartments([]));
    }, [officeType]);

    const deptOptions = useMemo(() => {
        let list = departments;
        if (isLocalAdmin && profileCtx && officeType === 'HO') {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : [])).map(s => s.toLowerCase());
            const filtered = list.filter(d => allowed.includes(d.shortCode.toLowerCase()));
            if (filtered.length > 0) list = filtered;
        }
        return [{ value: '', label: 'Any' }, ...list.map(d => ({ value: d.name, label: d.name }))];
    }, [departments, isLocalAdmin, profileCtx, officeType]);

    const runSearch = useCallback(async (criteria, pageNo) => {
        setSearching(true);
        try {
            const { data } = await api.get('/digidak/search', { params: { ...criteria, page: pageNo, size: PAGE_SIZE } });
            if (data?.error) {
                toast.error(data.error);
                setMatches([]);
                setSelected(null);
                return;
            }
            const pageItems = data?.items || [];
            setApplied(criteria);
            setPage(pageNo);
            setMatches(pageItems);
            setHasMore(Boolean(data?.hasNext));
            setSelected(pageNo === 1 && pageItems.length === 1 && !data?.hasNext ? pageItems[0] : null);
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Search failed.');
            setMatches([]);
            setSelected(null);
        } finally {
            setSearching(false);
        }
    }, [toast]);

    const handleSearch = () => {
        if (!canSearch || searching) return;
        runSearch({
            q: trimmedQuery,
            hoRo: officeType,
            location: isRoTe ? location : '',
            deptNames: officeType === 'HO' ? deptName : '',
            fromDate,
            toDate,
        }, 1);
    };

    // Load the movement register for whichever letter is open.
    useEffect(() => {
        if (!selected) {
            setMovement([]);
            return undefined;
        }
        let cancelled = false;
        setMovementLoading(true);
        api.get(`/digidak/${selected.r_object_id}/movement`)
            .then(res => { if (!cancelled) setMovement(Array.isArray(res.data) ? res.data : []); })
            .catch(() => { if (!cancelled) setMovement([]); })
            .finally(() => { if (!cancelled) setMovementLoading(false); });
        return () => { cancelled = true; };
    }, [selected]);

    const clear = () => {
        setQuery('');
        setFromDate('');
        setToDate('');
        setDeptName('');
        if (!isLocalAdmin) {
            setOfficeType('');
            setLocation('');
        }
        setApplied(null);
        setMatches(null);
        setSelected(null);
        setHasMore(false);
        setPage(1);
    };

    const handleOfficeTypeChange = (val) => {
        setOfficeType(val);
        setLocation('');
        setDeptName('');
    };

    const dirty = query || fromDate || toDate || deptName || matches || (!isLocalAdmin && officeType);

    return (
        <div className="flex flex-1 flex-col gap-6">
            <PageHeader
                title="Digidak Letters"
                icon={Mail}
                description="Find a letter by its number, office or date, then see its details and movement register."
            />

            <Card>
                <form
                    className="space-y-4"
                    onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
                >
                    <Field
                        label="Letter Number"
                        htmlFor="digidak-letter-number"
                        error={queryTooShort ? `Type at least ${MIN_QUERY} characters` : undefined}
                    >
                        <div className="relative">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                id="digidak-letter-number"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. 174332/2025-26 — partial numbers work"
                                invalid={queryTooShort}
                                autoFocus
                                className="pl-9 font-mono"
                            />
                        </div>
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Office Type">
                            <CustomSelect
                                value={officeType}
                                onChange={handleOfficeTypeChange}
                                options={OFFICE_TYPES}
                                placeholder="Any"
                                disabled={isLocalAdmin}
                                ariaLabel="Office type"
                            />
                        </Field>

                        {isRoTe && (
                            <Field label="Location">
                                <CustomSelect
                                    value={location}
                                    onChange={setLocation}
                                    options={[{ value: '', label: 'Any' }, ...locations.map(l => ({ value: l.location, label: l.location }))]}
                                    placeholder="Any"
                                    disabled={isLocalAdmin}
                                    ariaLabel="Location"
                                />
                            </Field>
                        )}

                        {officeType === 'HO' && (
                            <Field label="Department">
                                <CustomSelect
                                    value={deptName}
                                    onChange={setDeptName}
                                    options={deptOptions}
                                    placeholder="Any"
                                    ariaLabel="Department"
                                />
                            </Field>
                        )}

                        <Field label="From Date">
                            <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </Field>
                        <Field label="To Date">
                            <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </Field>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" disabled={!canSearch} loading={searching}>
                            <Search size={15} /> Search
                        </Button>
                        {dirty && (
                            <Button type="button" variant="secondary" onClick={clear}>
                                <X size={15} /> Clear
                            </Button>
                        )}
                        <p className="text-caption text-slate-400">
                            Searches inbox, outbox and drafts. Enter a letter number, or pick an office or dates.
                        </p>
                    </div>
                </form>
            </Card>

            {matches && matches.length === 0 && (
                <Card>
                    <EmptyState
                        icon={Mail}
                        title="No letters found"
                        description="Nothing matches these filters. Check the number, or widen the office and dates."
                    />
                </Card>
            )}

            {matches && matches.length > 0 && !(matches.length === 1 && page === 1 && !hasMore) && (
                <section className="space-y-2">
                    <div className="flex items-center gap-2">
                        <h2 className="text-body font-semibold text-ink">Matching letters</h2>
                        <span className="text-caption text-slate-400">Select one to open it</span>
                    </div>
                    <DataTable
                        columns={MATCH_COLUMNS}
                        rows={matches}
                        rowKey={(r) => r.r_object_id}
                        onRowClick={setSelected}
                        rowClassName={(r) => (selected?.r_object_id === r.r_object_id ? 'bg-canopy-tint' : '')}
                        className="md:rounded-card md:border md:border-line"
                    />
                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        hasNext={hasMore}
                        rangeStart={(page - 1) * PAGE_SIZE + 1}
                        rangeEnd={(page - 1) * PAGE_SIZE + matches.length}
                        loading={searching}
                        onPageChange={(n) => applied && runSearch(applied, n)}
                    />
                </section>
            )}

            {selected && (
                <>
                    <Card spine className="space-y-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-mono text-title font-semibold text-ink">{dash(selected.uid_number)}</h2>
                            <Badge tone={caseStatusTone(selected.status)}>{dash(selected.status)}</Badge>
                            {selected.decision && (
                                <Badge tone={selected.decision === 'Inward' ? 'canopy' : 'harvest'}>
                                    {directionLabel(selected.decision)}
                                </Badge>
                            )}
                        </div>
                        <p className="text-body text-slate-600">{dash(selected.letter_subject)}</p>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Detail label="Initiator">{dash(selected.initiator)}</Detail>
                            <Detail label="File Number" mono>{dash(selected.file_number)}</Detail>
                            <Detail label="Type Category">{dash(selected.type_category)}</Detail>
                            <Detail label="Entry Type">{dash(selected.entry_type)}</Detail>
                            <Detail label="Language">{dash(selected.languages)}</Detail>
                            <Detail label="Mode of Dispatch">{dash(selected.mode_of_receipt)}</Detail>
                            <Detail label="Priority">{dash(selected.priority)}</Detail>
                            <Detail label="Secrecy">{dash(selected.secrecy)}</Detail>
                            <Detail label="Region">{dash(selected.login_region)}</Detail>
                            <Detail label="Sent To">{dash(selected.selected_region)}</Detail>
                            <Detail label="Created" mono>{selected.r_creation_date ? formatDate(selected.r_creation_date) : '—'}</Detail>
                            <Detail label="Group" mono>{dash(selected.login_cgm_group)}</Detail>
                        </dl>
                    </Card>

                    <section className="space-y-2">
                        <div className="flex items-center gap-2">
                            <ClipboardList size={16} className="text-canopy" />
                            <h2 className="text-body font-semibold text-ink">Movement register</h2>
                            {!movementLoading && <Badge tone="canopy">{movement.length}</Badge>}
                        </div>
                        <DataTable
                            columns={MOVEMENT_COLUMNS}
                            rows={movement}
                            rowKey={(r, i) => r.r_object_id || i}
                            loading={movementLoading}
                            skeletonRows={4}
                            empty={{
                                icon: ClipboardList,
                                title: 'No movement records',
                                description: 'No movement register entries were found for this letter.',
                            }}
                            className="md:rounded-card md:border md:border-line"
                        />
                    </section>
                </>
            )}
        </div>
    );
}
