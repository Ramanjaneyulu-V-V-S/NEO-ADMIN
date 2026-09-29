import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../api/axios';
import {
    ChevronsLeft, ChevronLeft, ChevronRight,
    Loader2, Users, FileSpreadsheet, FileText,
} from 'lucide-react';
import { fetchDepartments, getLocations } from '../data/nabardMetadata.js';
import { downloadCsv, downloadXlsx, downloadRosterXlsx, mapWithConcurrency } from '../utils/userExport.js';
import { recordExport } from '../utils/audit.js';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import { Button, DataTable } from '../components/ui';

const PAGE_SIZE = 15;
const CONCURRENCY = 8;
const ALL_VALUE = '__ALL__';

// ─── Cascading dropdown primitive — the app-standard hardened CustomSelect ──────
const Select = CustomSelect;

const Label = ({ children }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">{children}</label>
);

// ─── Column definitions shared by the table and both export formats ───────────
const COLUMN_DEFS = [
    { key: 'object_name',            header: 'Name',          width: 26 },
    { key: 'uin',                    header: 'UIN',            width: 14 },
    { key: 'user_login_name',        header: 'Login Name',     width: 20 },
    { key: 'designation',            header: 'Designation',    width: 24 },
    { key: 'user_grade',             header: 'Grade',          width: 14 },
    { key: 'office_type',            header: 'Office Type',    width: 12 },
    { key: 'location',               header: 'Location',       width: 16, hideForHo: true },
    { key: 'department_name',        header: 'Department',     width: 30, hideForHo: true },
    { key: 'ro_short_code',          header: 'RO Code',        width: 10, hideForHo: true },
    { key: 'vertical',               header: 'Vertical',       width: 26, hoOnly: true },
    { key: 'user_email_address',     header: 'Email',          width: 28 },
    { key: 'primary_mobile_number',  header: 'Mobile',         width: 16 },
    { key: 'is_active',              header: 'Active',         width: 10 },
];

function columnsFor(officeType) {
    return COLUMN_DEFS.filter(c => {
        if (c.hoOnly && officeType !== 'HO') return false;
        if (c.hideForHo && officeType === 'HO') return false;
        return true;
    });
}

function cellValue(row, col) {
    if (col.key === 'is_active') {
        const v = row.is_active;
        return (v === true || v === 'true' || v === '1' || v === 1) ? 'Yes' : 'No';
    }
    return row[col.key] ?? '';
}

// "NEO ..." accounts (NEO Support 1/2/3, NEO Test User, logins neo.support1 etc.) are the app's
// own service/test accounts, not real users — never show them in results. Matches "neo" only as a
// leading word (so it won't false-positive on a real name like "Neomi").
const isExcludedName = (name) => /^neo\b/i.test((name || '').trim());

// Collapses rows sharing the same key into a single row, joining that field's distinct values
// together with ", " instead of listing the same person once per value.
function combineFieldAcrossRows(rows, field, keyFn) {
    const byKey = new Map();
    const order = [];
    for (const r of rows) {
        const key = keyFn(r);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, { row: r, values: [r[field]].filter(Boolean) });
            order.push(key);
        } else if (r[field] && !existing.values.includes(r[field])) {
            existing.values.push(r[field]);
        }
    }
    return order.map(key => {
        const { row, values } = byKey.get(key);
        return { ...row, [field]: values.sort().join(', ') };
    });
}

// Users who oversee more than one vertical within the same department (e.g. CGMs) show up
// once per vertical membership from the source groups — collapse those into a single row
// with all verticals joined together instead of listing the same person repeatedly.
function combineVerticalsWithinDept(rows) {
    return combineFieldAcrossRows(rows, 'vertical', r => `${r.department_name}::${r.r_object_id || r.user_login_name || r.object_name}`);
}

// RO/TE users assigned to more than one department (department_short_code_multi) show up once
// per department in the raw expansion — collapse those into a single row per user with all their
// departments joined together, the same treatment HO's Vertical column gets.
function combineDeptsForUser(rows) {
    return combineFieldAcrossRows(rows, 'department_name', r => r.r_object_id || r.user_login_name || r.object_name);
}

// ─── Fetch all cms_user_profile rows across pages (Documentum REST caps at 2000/page) ──
async function fetchAllProfiles(officeTypeFilter, locationFilter) {
    const SIZE = 2000;
    let page = 1;
    let all = [];
    while (true) {
        const params = { page, size: SIZE };
        if (officeTypeFilter) params.officeTypeFilter = officeTypeFilter;
        if (locationFilter) params.locationFilter = locationFilter;
        const res = await api.get('/users/profiles', { params });
        all = all.concat(res.data.users || []);
        if (!res.data.hasNext) break;
        page++;
    }
    return all;
}

const UserExportTab = ({ onToast }) => {
    const [officeType, setOfficeType] = useState('');
    const [location, setLocation] = useState('');
    const [dept, setDept] = useState('');
    const [deptOptions, setDeptOptions] = useState([]);
    const [verticals, setVerticals] = useState([]);
    const [selectedVertical, setSelectedVertical] = useState('');

    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(1);

    const [loadingDepts, setLoadingDepts] = useState(false);
    const [loadingVerticals, setLoadingVerticals] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [exporting, setExporting] = useState(false);
    const [exportingAll, setExportingAll] = useState(false);
    const [exportProgress, setExportProgress] = useState('');

    // Lazily-populated HO profile lookup map (login name -> full profile), scoped per office type.
    const profileMapRef = useRef(new Map());
    const profileMapKeyRef = useRef(null);

    const isROTE = officeType === 'RO' || officeType === 'TE';

    const resetBelow = (level) => {
        if (level === 'location') { setLocation(''); }
        setDept(''); setDeptOptions([]);
        setSelectedVertical(''); setVerticals([]);
        setRows([]); setPage(1);
    };

    const handleOfficeTypeChange = (v) => {
        setOfficeType(v);
        resetBelow('location');
    };

    // HO has no location step — load its departments as soon as it's selected.
    useEffect(() => {
        if (officeType !== 'HO') return;
        setLoadingDepts(true);
        fetchDepartments('HO')
            .then(setDeptOptions)
            .finally(() => setLoadingDepts(false));
    }, [officeType]);

    const handleLocationChange = async (v) => {
        setLocation(v);
        resetBelow('dept');
        if (!v) return;
        setLoadingDepts(true);
        setLoadingUsers(true);
        try {
            const { rows, deptOptions } = await loadRoteLocationData(officeType, v);
            setDeptOptions(deptOptions);
            setDept(ALL_VALUE);
            setRows(rows);
        } catch {
            setDeptOptions([]);
            setRows([]);
            onToast({ type: 'error', message: 'Failed to load users for this location.' });
        } finally {
            setLoadingDepts(false);
            setLoadingUsers(false);
        }
    };

    const handleDeptChange = async (v) => {
        setDept(v);
        setSelectedVertical(''); setVerticals([]);
        setRows([]); setPage(1);
        if (!v) return;

        if (v === ALL_VALUE) {
            if (officeType === 'HO') {
                await loadAllHoUsers();
            } else {
                // RO/TE "All Departments": every user at this location, duplicated once per
                // department they belong to (department_short_code_multi) — mirrors the Export
                // All roster rules: exclude DDM-only assignments and profiles missing location/RO code.
                setLoadingUsers(true);
                try {
                    const { rows: allDeptRows } = await loadRoteLocationData(officeType, location);
                    setRows(allDeptRows);
                } catch {
                    setRows([]);
                    onToast({ type: 'error', message: 'Failed to load users for this location.' });
                } finally {
                    setLoadingUsers(false);
                }
            }
            return;
        }

        const d = deptOptions.find(o => o.name === v);
        if (!d) return;

        if (officeType === 'HO') {
            setLoadingVerticals(true);
            let deptVerticals = [];
            try {
                const res = await api.get('/groups/vertical-folders', { params: { deptName: v } });
                deptVerticals = res.data || [];
                setVerticals(deptVerticals);
            } catch {
                setVerticals([]);
                onToast({ type: 'error', message: 'Failed to load verticals for this department.' });
            } finally {
                setLoadingVerticals(false);
            }

            // Show every user in the department (across all its verticals) as soon as it's
            // picked; the Vertical dropdown below narrows this further if a specific one is chosen.
            if (deptVerticals.length > 0) {
                setSelectedVertical(ALL_VALUE);
                await loadHoDeptUsers(v, deptVerticals);
            }
        } else {
            // RO/TE: department is the terminal level — fetch users by location, filter client-side by
            // department, then enrich against the full profile list (by-location is a minimal projection).
            setLoadingUsers(true);
            try {
                const [res, profileMap] = await Promise.all([
                    api.get('/users/by-location', { params: { location } }),
                    getLocationProfileMap(officeType, location),
                ]);
                const deptShortCodeLower = d.shortCode.toLowerCase();
                const filtered = (res.data || []).filter(u => {
                    const deptMulti = u.department_short_code_multi || [];
                    return Array.isArray(deptMulti)
                        ? deptMulti.some(x => x?.toLowerCase() === deptShortCodeLower)
                        : (deptMulti?.toLowerCase?.() === deptShortCodeLower);
                });
                // Users can belong to multiple departments (department_short_code_multi), so the
                // profile's own primary department_name/short_code may not be the department just
                // drilled into — force it to the selected department for a coherent export.
                const hydrated = filtered
                    .map(u => {
                        const profile = profileMap.get(u.r_object_id) || u;
                        return { ...profile, department_name: d.name, department_short_code: d.shortCode };
                    })
                    .filter(u => !isExcludedName(u.object_name) && !isExcludedName(u.user_login_name));
                setRows(hydrated);
            } catch {
                setRows([]);
                onToast({ type: 'error', message: 'Failed to load users for this department.' });
            } finally {
                setLoadingUsers(false);
            }
        }
    };

    // Lazily builds/caches the full HO profile lookup map (lowercased, trimmed).
    // /groups/{name}/members returns each member's *display name* (matches object_name),
    // not the login name, so index by both to be safe.
    const getHoProfileMap = useCallback(async () => {
        if (profileMapKeyRef.current === 'HO') return profileMapRef.current;
        const all = await fetchAllProfiles('HO');
        const map = new Map();
        for (const u of all) {
            if (u.object_name) map.set(u.object_name.trim().toLowerCase(), u);
            if (u.user_login_name) map.set(u.user_login_name.trim().toLowerCase(), u);
        }
        profileMapRef.current = map;
        profileMapKeyRef.current = 'HO';
        return map;
    }, []);

    // /users/by-location only returns a minimal projection (name/login/dept codes), not the
    // full profile — so RO/TE rows need the same enrichment step as HO, scoped per location
    // and keyed by r_object_id (the one field guaranteed to match between both endpoints).
    const getLocationProfileMap = useCallback(async (ot, loc) => {
        const key = `${ot}::${loc}`;
        if (profileMapKeyRef.current === key) return profileMapRef.current;
        const all = await fetchAllProfiles(ot, loc);
        const map = new Map();
        for (const u of all) {
            if (u.r_object_id) map.set(u.r_object_id, u);
        }
        profileMapRef.current = map;
        profileMapKeyRef.current = key;
        return map;
    }, []);

    // Fetches every user at a RO/TE location, expands multi-department members into one row per
    // department (via /users/dept-multi — the same source Export All uses), excluding DDM and
    // profiles missing location/RO code. Also derives the Department dropdown's actual options
    // from the department codes that show up in that expansion, rather than a static per-location list.
    const loadRoteLocationData = useCallback(async (ot, loc) => {
        const [res, profileMap, deptMultiRes, configDepts] = await Promise.all([
            api.get('/users/by-location', { params: { location: loc } }),
            getLocationProfileMap(ot, loc),
            api.get('/users/dept-multi', { params: { officeTypeFilter: ot } }),
            fetchDepartments(ot, loc),
        ]);
        const deptMultiMap = deptMultiRes.data || {};
        const nameByCode = new Map(configDepts.map(d => [d.shortCode.toLowerCase(), d.name]));
        const expanded = (res.data || [])
            .map(u => profileMap.get(u.r_object_id) || u)
            .filter(u => (u.location || '').trim() && (u.ro_short_code || '').trim())
            .filter(u => !isExcludedName(u.object_name) && !isExcludedName(u.user_login_name))
            .flatMap(u => {
                const multi = deptMultiMap[u.r_object_id];
                const codes = multi && multi.length > 0 ? multi : [u.department_short_code];
                return codes
                    .filter(c => (c || '').trim().toUpperCase() !== 'DDM')
                    .map(c => {
                        const code = (c || '').trim();
                        return { ...u, department_short_code: code, department_name: nameByCode.get(code.toLowerCase()) || code };
                    });
            });
        const namesByShortCode = new Map();
        for (const r of expanded) {
            const code = (r.department_short_code || '').trim();
            if (code && !namesByShortCode.has(code.toLowerCase())) namesByShortCode.set(code.toLowerCase(), r.department_name);
        }
        const deptOptions = [...namesByShortCode.entries()]
            .map(([shortCode, name]) => ({ shortCode, name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // Users assigned to multiple departments show up once per department above — collapse
        // them into a single row with all their departments joined together (see combineDeptsForUser)
        // so the "All Departments" view matches one row per person, mirroring HO's Vertical column.
        const rows = combineDeptsForUser(expanded)
            .sort((a, b) => (a.object_name || '').localeCompare(b.object_name || ''));
        return { rows, deptOptions };
    }, [getLocationProfileMap]);

    // Fetches every member across all verticals in one HO department, hydrates against the full
    // profile map, and collapses users who sit in more than one vertical within that department
    // into a single row (see combineVerticalsWithinDept) instead of listing them once per vertical.
    const loadHoDeptUsers = useCallback(async (deptName, deptVerticals) => {
        setLoadingUsers(true);
        try {
            const hoProfileMap = await getHoProfileMap();
            const memberResults = await mapWithConcurrency(deptVerticals, CONCURRENCY, async (v) => {
                const res = await api.get(`/groups/${v.groupName}/members`);
                return { vertical: v, members: res.data?.users || [] };
            });
            const flat = [];
            for (const r of memberResults) {
                if (!r) continue;
                for (const m of r.members) {
                    if (isExcludedName(m.name)) continue;
                    const profile = hoProfileMap.get((m.name || '').trim().toLowerCase());
                    flat.push(profile
                        ? { ...profile, vertical: r.vertical.name }
                        : { object_name: m.name, user_login_name: m.name, office_type: 'HO', department_name: deptName, vertical: r.vertical.name, _unresolved: true });
                }
            }
            const combined = combineVerticalsWithinDept(flat)
                .sort((a, b) => (a.object_name || '').localeCompare(b.object_name || ''));
            setRows(combined);
        } catch {
            setRows([]);
            onToast({ type: 'error', message: 'Failed to load users for this department.' });
        } finally {
            setLoadingUsers(false);
        }
    }, [getHoProfileMap, onToast]);

    // Builds the full flat HO row list: one row per department × vertical × member (a user who sits
    // in several verticals of the same department gets one row per vertical here). The Export All
    // workbook uses this shape directly; the "All Departments" screen view collapses it further via
    // combineVerticalsWithinDept (see loadAllHoUsers).
    const buildHoRows = useCallback(async (onProgress) => {
        onProgress?.('Loading HO departments…');
        const hoDepts = await fetchDepartments('HO');

        onProgress?.(`Loading verticals for ${hoDepts.length} HO departments…`);
        const deptVerticalResults = await mapWithConcurrency(hoDepts, CONCURRENCY, async (d) => {
            const res = await api.get('/groups/vertical-folders', { params: { deptName: d.name } });
            return { dept: d, verticals: res.data || [] };
        });
        const deptVerticalPairs = [];
        for (const r of deptVerticalResults) {
            if (!r) continue;
            for (const v of r.verticals) deptVerticalPairs.push({ dept: r.dept, vertical: v });
        }

        onProgress?.(`Fetching members for ${deptVerticalPairs.length} verticals…`);
        const hoProfileMap = await getHoProfileMap();
        const memberResults = await mapWithConcurrency(deptVerticalPairs, CONCURRENCY, async (pair) => {
            const res = await api.get(`/groups/${pair.vertical.groupName}/members`);
            return { ...pair, members: res.data?.users || [] };
        });

        const flat = [];
        for (const r of memberResults) {
            if (!r) continue;
            for (const m of r.members) {
                if (isExcludedName(m.name)) continue;
                const profile = hoProfileMap.get((m.name || '').trim().toLowerCase());
                flat.push(profile
                    ? { ...profile, vertical: r.vertical.name }
                    : { object_name: m.name, user_login_name: m.name, office_type: 'HO', department_name: r.dept.name, department_short_code: r.dept.shortCode, vertical: r.vertical.name });
            }
        }
        return flat.sort((a, b) =>
            (a.department_name || '').localeCompare(b.department_name || '')
            || (a.vertical || '').localeCompare(b.vertical || '')
            || (a.object_name || '').localeCompare(b.object_name || ''));
    }, [getHoProfileMap]);

    const loadAllHoUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const flat = await buildHoRows();
            const combined = combineVerticalsWithinDept(flat).sort((a, b) =>
                (a.department_name || '').localeCompare(b.department_name || '')
                || (a.object_name || '').localeCompare(b.object_name || ''));
            setRows(combined);
        } catch {
            setRows([]);
            onToast({ type: 'error', message: 'Failed to load HO users.' });
        } finally {
            setLoadingUsers(false);
        }
    }, [buildHoRows, onToast]);

    const handleVerticalChange = async (v) => {
        setSelectedVertical(v);
        setRows([]); setPage(1);
        if (!v) return;
        if (v === ALL_VALUE) {
            await loadHoDeptUsers(dept, verticals);
            return;
        }
        setLoadingUsers(true);
        try {
            const vLabel = verticals.find(x => x.groupName === v)?.name || v;
            const [membersRes, profileMap] = await Promise.all([
                api.get(`/groups/${v}/members`),
                getHoProfileMap(),
            ]);
            const members = (membersRes.data?.users || []).filter(m => !isExcludedName(m.name));
            const hydrated = members.map(m => {
                const profile = profileMap.get((m.name || '').trim().toLowerCase());
                return profile
                    ? { ...profile, vertical: vLabel }
                    : { object_name: m.name, user_login_name: m.name, office_type: 'HO', department_name: dept, vertical: vLabel, _unresolved: true };
            });
            setRows(hydrated);
        } catch {
            setRows([]);
            onToast({ type: 'error', message: 'Failed to load members for this vertical.' });
        } finally {
            setLoadingUsers(false);
        }
    };

    // ── Pagination (client-side, matches the rest of the app) ──────────────────
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const paged = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
    const start = rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, rows.length);

    const cols = columnsFor(officeType);
    const WRAP_KEYS = ['vertical', 'department_name'];
    const tableColumns = [
        { key: 'idx', header: '#', width: 'w-10', card: 'hide',
          render: (_r, idx) => <span className="text-slate-400 font-mono text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</span> },
        ...cols.map((c, i) => ({
            key: c.key,
            header: c.header,
            primary: i === 0,
            render: (r) => (
                <span
                    className={`block text-slate-700 ${WRAP_KEYS.includes(c.key) ? 'whitespace-normal break-words md:min-w-[220px] md:max-w-[320px]' : 'md:whitespace-nowrap'}`}
                    title={r._unresolved ? 'Profile not found for this login name' : undefined}
                >
                    {cellValue(r, c) || <span className="text-slate-300">—</span>}
                </span>
            ),
        })),
    ];

    // ── Export: current drilled-down selection ──────────────────────────────────
    const currentSelectionLabel = () => {
        const parts = [officeType, location, dept, selectedVertical].filter(Boolean);
        return parts.join('_').replace(/[^a-zA-Z0-9_-]+/g, '-') || 'export';
    };

    const handleExportCurrent = async (format) => {
        if (rows.length === 0) {
            onToast({ type: 'error', message: 'No users to export for this selection.' });
            return;
        }
        setExporting(true);
        try {
            const dateStr = new Date().toISOString().slice(0, 10);
            const filenameBase = `user-export_${currentSelectionLabel()}_${dateStr}`;
            if (format === 'csv') {
                const headers = cols.map(c => c.header);
                const dataRows = rows.map(r => cols.map(c => cellValue(r, c)));
                downloadCsv(headers, dataRows, `${filenameBase}.csv`);
            } else {
                const columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }));
                const dataRows = rows.map(r => Object.fromEntries(cols.map(c => [c.key, cellValue(r, c)])));
                await downloadXlsx([{ name: (officeType || 'Users').slice(0, 31), columns, rows: dataRows }], `${filenameBase}.xlsx`);
            }
            onToast({ type: 'success', message: `Exported ${rows.length} user${rows.length !== 1 ? 's' : ''}.` });
            recordExport({
                action: 'Export User Directory',
                target: currentSelectionLabel(),
                targetType: 'user',
                count: rows.length,
                detail: format.toUpperCase(),
            });
        } catch {
            onToast({ type: 'error', message: 'Export failed. Please try again.' });
        } finally {
            setExporting(false);
        }
    };

    // ── Export: whole hierarchy in one workbook (sheet per office type) ────────
    const handleExportAll = async () => {
        setExportingAll(true);
        try {
            const hoRows = await buildHoRows(setExportProgress);

            setExportProgress('Fetching RO/TE profiles…');
            const [roteAllRaw, deptMultiRes] = await Promise.all([
                fetchAllProfiles('RO'),
                api.get('/users/dept-multi', { params: { officeTypeFilter: 'RO' } }),
            ]);
            const roteAll = roteAllRaw.filter(u => !isExcludedName(u.object_name) && !isExcludedName(u.user_login_name));
            const deptMultiMap = deptMultiRes.data || {};

            // Users scoped to multiple departments (e.g. CGMs/RO heads) get one row per
            // department code from department_short_code_multi; single-department users keep
            // their one row. A "DDM" department code (district office staff) is dropped either way.
            const expandByDept = (u) => {
                const multi = deptMultiMap[u.r_object_id];
                const codes = multi && multi.length > 0 ? multi : [u.department_short_code];
                return codes
                    .filter(c => (c || '').trim().toUpperCase() !== 'DDM')
                    .map(c => ({ ...u, department_short_code: c }));
            };

            const byOfficeType = (ot) => roteAll
                .filter(u => (u.office_type || '').toUpperCase() === ot)
                .filter(u => (u.location || '').trim() && (u.ro_short_code || '').trim())
                .flatMap(expandByDept)
                .sort((a, b) =>
                    (a.location || '').localeCompare(b.location || '')
                    || (a.ro_short_code || '').localeCompare(b.ro_short_code || '')
                    || (a.department_short_code || '').localeCompare(b.department_short_code || '')
                    || (a.object_name || '').localeCompare(b.object_name || ''));
            const roRows = byOfficeType('RO');
            const teRows = byOfficeType('TE');

            // Flat roster rows for downloadRosterXlsx — rows must stay sorted by the group key
            // columns so it can merge consecutive matching cells hierarchically (see its docstring).
            const toRosterRows = (dataRows, keyGetters) => dataRows.map(r => ({
                keyVals: keyGetters.map(get => get(r) || '—'),
                trailing: [r.object_name || r.user_login_name || '—', r.uin || '—'],
            }));

            const hoSheet = {
                name: 'HO',
                groupColumns: [{ header: 'Department', width: 30 }, { header: 'Vertical', width: 34 }],
                trailingColumns: [{ header: 'Users', width: 32 }, { header: 'UIN', width: 16 }],
                rows: toRosterRows(hoRows, [r => r.department_name, r => r.vertical]),
            };
            const roteSheet = (name, dataRows) => ({
                name,
                groupColumns: [
                    { header: 'Location', width: 18 },
                    { header: 'ro_short_code', width: 16 },
                    { header: 'department_short_code', width: 22 },
                ],
                trailingColumns: [{ header: 'usernames', width: 32 }, { header: 'UIN', width: 16 }],
                rows: toRosterRows(dataRows, [r => r.location, r => r.ro_short_code, r => r.department_short_code]),
            });

            const dateStr = new Date().toISOString().slice(0, 10);
            await downloadRosterXlsx(
                [hoSheet, roteSheet('RO', roRows), roteSheet('TE', teRows)],
                `user-data-export_all_${dateStr}.xlsx`
            );

            const total = hoRows.length + roRows.length + teRows.length;
            onToast({ type: 'success', message: `Exported ${total} users across HO/RO/TE.` });
            recordExport({
                action: 'Export User Directory',
                target: 'All HO/RO/TE',
                targetType: 'user',
                count: total,
                detail: 'XLSX roster (full hierarchy)',
            });
        } catch {
            onToast({ type: 'error', message: 'Bulk export failed. Please try again.' });
        } finally {
            setExportingAll(false);
            setExportProgress('');
        }
    };

    const locationOptions = isROTE ? getLocations(officeType).map(l => ({ value: l.location, label: l.location })) : [];
    const deptSelectOptions = [
        { value: ALL_VALUE, label: 'All Departments' },
        ...deptOptions.map(d => ({ value: d.name, label: d.name })),
    ];
    const verticalSelectOptions = [
        { value: ALL_VALUE, label: 'All Verticals' },
        ...verticals.map(v => ({ value: v.groupName, label: v.name })),
    ];

    const busy = loadingDepts || loadingVerticals || loadingUsers;

    return (
        <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-end gap-4 mb-4 flex-wrap">
                <Button
                    variant="secondary"
                    onClick={handleExportAll}
                    loading={exportingAll}
                    title="Export the entire HO/RO/TE hierarchy as one workbook"
                >
                    {!exportingAll && <FileSpreadsheet size={14} />}
                    {exportingAll ? (exportProgress || 'Exporting…') : 'Export All (XLSX)'}
                </Button>
            </div>

            {/* Cascading filters */}
            <div className="bg-surface border border-slate-200 rounded-xl p-4 shadow-sm flex items-end gap-4 flex-wrap mb-4">
                <div className="min-w-[160px]">
                    <Label>Office Type</Label>
                    <Select
                        value={officeType}
                        onChange={handleOfficeTypeChange}
                        placeholder="— Select office type —"
                        options={[
                            { value: 'HO', label: 'HO' },
                            { value: 'RO', label: 'RO' },
                            { value: 'TE', label: 'TE' },
                        ]}
                    />
                </div>

                {isROTE && (
                    <div className="min-w-[200px]">
                        <Label>Location</Label>
                        <Select
                            value={location}
                            onChange={handleLocationChange}
                            disabled={!officeType}
                            placeholder="— Select location —"
                            options={locationOptions}
                        />
                    </div>
                )}

                <div className="min-w-[220px]">
                    <Label>Department</Label>
                    <Select
                        value={dept}
                        onChange={handleDeptChange}
                        disabled={!officeType || (isROTE && !location) || loadingDepts}
                        placeholder={loadingDepts ? 'Loading…' : '— Select department —'}
                        options={deptSelectOptions}
                    />
                </div>

                {officeType === 'HO' && (
                    <div className="min-w-[220px]">
                        <Label>Vertical</Label>
                        <Select
                            value={selectedVertical}
                            onChange={handleVerticalChange}
                            disabled={!dept || dept === ALL_VALUE || loadingVerticals}
                            placeholder={
                                dept === ALL_VALUE ? 'Not applicable'
                                : loadingVerticals ? 'Loading…'
                                : (verticals.length === 0 && dept ? 'No verticals found' : '— Select vertical —')
                            }
                            options={verticalSelectOptions}
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={() => handleExportCurrent('csv')}
                        disabled={exporting || rows.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileText size={14} /> CSV
                    </button>
                    <button
                        onClick={() => handleExportCurrent('xlsx')}
                        disabled={exporting || rows.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-canopy text-white text-sm font-medium rounded-lg hover:bg-canopy-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        XLSX
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="bg-surface border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {rows.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-slate-600">
                            <span className="font-semibold text-canopy">{rows.length}</span> user{rows.length !== 1 ? 's' : ''} found
                        </span>
                        <span className="text-slate-400 text-xs">Showing {start}-{end}</span>
                    </div>
                )}

                <DataTable
                    columns={tableColumns}
                    rows={paged}
                    rowKey={(r, idx) => r.r_object_id || r.user_login_name || idx}
                    loading={busy}
                    skeletonRows={5}
                    empty={{ icon: Users, title: !officeType ? 'Select an office type to begin' : 'No users found for this selection' }}
                    stickyHeader
                    maxHeight="70vh"
                    className="p-3 md:p-0"
                />

                {rows.length > 0 && (
                    <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-sm">
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 border border-slate-200 rounded hover:bg-surface disabled:opacity-40 text-slate-600"><ChevronsLeft size={14} /></button>
                            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="p-1.5 border border-slate-200 rounded hover:bg-surface disabled:opacity-40 text-slate-600"><ChevronLeft size={14} /></button>
                            <span className="px-3 text-slate-700 font-medium">{page} / {totalPages}</span>
                            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="p-1.5 border border-slate-200 rounded hover:bg-surface disabled:opacity-40 text-slate-600"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserExportTab;
