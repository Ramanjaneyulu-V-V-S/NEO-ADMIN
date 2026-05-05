import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import {
    ArrowRightLeft, Search, Loader2, ChevronLeft, ChevronRight,
    ChevronsLeft, X, UserRoundCog, Users, Building2, MapPin, FolderOpen,
    FileText, Info, ClipboardList
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onClose }) => {
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [toast, onClose]);

    if (!toast) return null;
    const isError = toast.type === 'error';
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border
            ${isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            <span>{toast.message}</span>
            <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
    );
};

// ─── SelectWrapper ─────────────────────────────────────────────────────────
const SelectWrapper = ({ children }) => (
    <div className="relative">
        {children}
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
            </svg>
        </div>
    </div>
);

const selectCls         = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none cursor-pointer pr-8';
const disabledSelectCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-8';

const FieldLabel = ({ icon: Icon, label }) => (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
        <Icon size={13} className="text-slate-400" />
        {label}
    </label>
);

// ─── Case Details Modal ───────────────────────────────────────────────────────
const CaseDetailsModal = ({ caseItem, onClose }) => {
    if (!caseItem) return null;

    const DetailRow = ({ label, value }) => (
        <div className="flex gap-2">
            <span className="text-xs font-semibold text-slate-500 w-36 shrink-0">{label}</span>
            <span className="text-xs text-slate-800 break-all">{value || '—'}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm">
                            <FileText size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{caseItem.object_name}</p>
                            <p className="text-xs text-slate-500">Case Details</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-contain flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={14} className="text-[#0A66C2]" />
                        <h3 className="text-sm font-bold text-slate-800">Case Details</h3>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100">
                        <DetailRow label="Case Number"    value={caseItem.object_name} />
                        <DetailRow label="Subject"        value={caseItem.description} />
                        <DetailRow label="Department"     value={caseItem.department_name} />
                        <DetailRow label="Vertical"       value={caseItem.functions} />
                        <DetailRow label="Office Type"    value={caseItem.ho_ro} />
                        <DetailRow label="Case Priority"  value={caseItem.task_priority} />
                        <DetailRow label="Case Status"    value={caseItem.status} />
                        <DetailRow label="Nature of Case" value={caseItem.case_nature} />
                        <DetailRow label="Disposal Level" value={caseItem.disposal_level} />
                        <DetailRow label="File No"        value={caseItem.file_number} />
                        <DetailRow label="Case Type"      value={caseItem.types} />
                        <DetailRow label="Created By"     value={caseItem.r_creator_name} />
                        <DetailRow label="Created Date"   value={caseItem.r_creation_date} />
                        <DetailRow label="Language"       value={caseItem.language_type} />
                        <DetailRow label="Object ID"      value={caseItem.r_object_id} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Movement Register Modal ──────────────────────────────────────────────────
const MovementRegisterModal = ({ caseItem, onClose }) => {
    const [movement, setMovement] = useState([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        if (!caseItem) return;
        setLoading(true);
        api.get(`/delegate/cases/${caseItem.r_object_id}/movement`)
            .then(res => setMovement(Array.isArray(res.data) ? res.data : []))
            .catch(() => setMovement([]))
            .finally(() => setLoading(false));
    }, [caseItem]);

    if (!caseItem) return null;

    const movCols = [
        { key: 'object_name',    label: 'Object Name' },
        { key: 'performer',      label: 'Performer' },
        { key: 'decision',       label: 'Decision' },
        { key: 'assigned_user',  label: 'Assigned User' },
        { key: 'completion_date',label: 'Completion Date' },
        { key: 'r_creation_date',label: 'R Creation Date' },
        { key: 'r_modify_date',  label: 'R Modify Date' },
        { key: 'acl_domain',     label: 'Acl Domain' },
        { key: 'acl_name',       label: 'Acl Name' },
        { key: 'owner_name',     label: 'Owner Name' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm">
                            <ClipboardList size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{caseItem.object_name}</p>
                            <p className="text-xs text-slate-500">Movement Register</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-contain flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <ClipboardList size={14} className="text-[#0A66C2]" />
                        <h3 className="text-sm font-bold text-slate-800">Movement Register</h3>
                        {!loading && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                {movement.length}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 py-12 justify-center text-slate-400">
                            <Loader2 size={18} className="animate-spin text-[#0A66C2]" />
                            <span className="text-sm">Loading movement register…</span>
                        </div>
                    ) : movement.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                            No movement register records found for this case.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2.5 font-semibold text-slate-600 w-8">#</th>
                                        {movCols.map(col => (
                                            <th key={col.key} className="px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {movement.map((rec, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                            {movCols.map(col => (
                                                <td key={col.key} className="px-3 py-2 text-slate-700 max-w-xs truncate"
                                                    title={String(rec[col.key] ?? '')}>
                                                    {rec[col.key] ?? '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── DelegatePage ─────────────────────────────────────────────────────────────
const DelegatePage = () => {
    const [officeType, setOfficeType] = useState('');
    const [location,   setLocation]   = useState('');
    const [department, setDepartment] = useState(null);

    const [users,        setUsers]        = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');

    const [cases,        setCases]        = useState([]);
    const [loadingCases, setLoadingCases] = useState(false);
    const [page,         setPage]         = useState(1);
    const pageSize = 20;
    const [hasNext, setHasNext] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');

    const [delegating, setDelegating] = useState(null);
    const [toast,      setToast]      = useState(null);

    const [detailCase,   setDetailCase]   = useState(null); // Case Details modal
    const [movementCase, setMovementCase] = useState(null); // Movement Register modal

    // Role & profile context for Local Admin
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const ot  = ctx.office_type || '';
                const loc = ctx.location    || '';
                if (ot) {
                    setOfficeType(ot);
                    if (loc) setLocation(loc);
                }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    const locations   = getLocations(officeType);
    const [allDepartments, setAllDepartments] = useState([]);
    const isRoTe      = officeType === 'RO' || officeType === 'TE';

    // Derive location short code for case filtering
    const locationShortCode = isLocalAdmin && location
        ? (locations.find(l => l.location === location)?.shortCode || '')
        : '';

    useEffect(() => {
        if (!officeType || (isRoTe && !location)) { setAllDepartments([]); return; }
        fetchDepartments(officeType, location).then(setAllDepartments);
    }, [officeType, location]);

    // For Local Admin: filter departments to only those in their profile
    const departments = isLocalAdmin && profileCtx
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            return allDepartments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
          })()
        : allDepartments;

    const fetchCases = useCallback(async (query, hoRo, deptName, pg, roShortCode, deptNames) => {
        setLoadingCases(true);
        try {
            const params = { query: query || '', page: pg, size: pageSize };
            if (hoRo)         params.hoRo         = hoRo;
            if (deptName)     params.deptName     = deptName;
            if (!deptName && deptNames) params.deptNames = deptNames;
            if (roShortCode)  params.roShortCode  = roShortCode;
            const res = await api.get('/delegate/cases', { params });
            setCases(res.data?.cases || []);
            setHasNext(res.data?.hasNext || false);
        } catch (err) {
            setToast({ type: 'error', message: 'Failed to load cases: ' + (err.response?.data?.message || err.message) });
            setCases([]);
        } finally {
            setLoadingCases(false);
        }
    }, [pageSize]);

    // For Local Admin, wait until profile context and departments are loaded,
    // then fetch cases filtered by location (RO/TE) or departments (HO)
    const localAdminDeptNames = isLocalAdmin && officeType === 'HO' && departments.length > 0
        ? departments.map(d => d.name).join(',')
        : '';

    useEffect(() => {
        if (isLocalAdmin) {
            if (!profileCtx) return; // wait for profile context
            if (officeType === 'HO') {
                // HO Local Admin: wait for departments to load, then filter by their departments
                if (!localAdminDeptNames) return;
                fetchCases('', officeType, '', 1, '', localAdminDeptNames);
            } else {
                // RO/TE Local Admin: filter by location short code
                fetchCases('', officeType, '', 1, locationShortCode);
                if (location) fetchUsersByLocation(location);
            }
        } else {
            fetchCases('', '', '', 1);
        }
    }, [fetchCases, isLocalAdmin, profileCtx, officeType, location, locationShortCode, localAdminDeptNames]);

    const fetchUsersByDept = async (shortCode, officeTypeFilter) => {
        setLoadingUsers(true); setUsers([]);
        try {
            const params = { shortCode };
            if (officeTypeFilter) params.officeType = officeTypeFilter;
            const res = await api.get('/users/by-dept', { params });
            setUsers(res.data?.users || res.data || []);
        } catch (err) {
            setToast({ type: 'error', message: 'Failed to load users: ' + (err.response?.data?.message || err.message) });
        } finally { setLoadingUsers(false); }
    };

    const fetchUsersByLocation = async (loc) => {
        setLoadingUsers(true); setUsers([]);
        try {
            const res = await api.get('/users/by-location', { params: { location: loc } });
            setUsers(res.data?.users || res.data || []);
        } catch (err) {
            setToast({ type: 'error', message: 'Failed to load users: ' + (err.response?.data?.message || err.message) });
        } finally { setLoadingUsers(false); }
    };

    const handleOfficeTypeChange = (val) => {
        setOfficeType(val); setLocation(''); setDepartment(null);
        setUsers([]); setFilteredUsers([]); setSelectedUser(''); setPage(1);
        fetchCases(activeQuery, val, '', 1);
    };

    const handleLocationChange = (val) => {
        setLocation(val); setDepartment(null); setSelectedUser(''); setFilteredUsers([]); setPage(1);
        const sc = locations.find(l => l.location === val)?.shortCode || '';
        if (val) { fetchUsersByLocation(val); fetchCases(activeQuery, officeType, '', 1, sc); }
        else { setUsers([]); fetchCases(activeQuery, officeType, '', 1); }
    };

    const handleDepartmentChange = (shortCode) => {
        if (!shortCode) {
            setDepartment(null); setSelectedUser(''); setFilteredUsers([]);
            if (isRoTe && location) fetchUsersByLocation(location); else setUsers([]);
            fetchCases(activeQuery, officeType, '', 1, locationShortCode, localAdminDeptNames); setPage(1); return;
        }
        const dept = departments.find(d => d.shortCode === shortCode) || null;
        setDepartment(dept); setSelectedUser(''); setPage(1);

        if (dept) {
            fetchCases(activeQuery, officeType, dept.name, 1, locationShortCode);

            // For RO/TE, filter previously fetched location-based users by department_short_code_multi
            if (isRoTe && users.length > 0) {
                const deptCodeLower = dept.shortCode.toLowerCase();
                const filtered = users.filter(u => {
                    const deptMulti = u.department_short_code_multi;
                    return Array.isArray(deptMulti)
                        ? deptMulti.some(d => d?.toLowerCase?.() === deptCodeLower)
                        : deptMulti?.toLowerCase?.() === deptCodeLower;
                });
                setFilteredUsers(filtered);
            } else {
                // For HO, fetch users by department with officeType filter
                fetchUsersByDept(dept.shortCode, officeType);
                setFilteredUsers([]);
            }
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const q = searchQuery.trim();
        setActiveQuery(q); setPage(1); setSelectedUser('');
        fetchCases(q, officeType, department?.name || '', 1, locationShortCode, !department ? localAdminDeptNames : '');
    };

    const clearSearch = () => {
        setSearchQuery(''); setActiveQuery(''); setPage(1); setSelectedUser('');
        fetchCases('', officeType, department?.name || '', 1, locationShortCode, !department ? localAdminDeptNames : '');
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(activeQuery, officeType, department?.name || '', newPage, locationShortCode, !department ? localAdminDeptNames : '');
    };

    const handleDelegate = async (caseItem) => {
        if (!selectedUser) { setToast({ type: 'error', message: 'Please select a user to delegate to.' }); return; }
        setDelegating(caseItem.r_object_id);
        try {
            const assignedUser = `NEO Admin (${loginUsername})`;
            const res = await api.post('/delegate', { caseId: caseItem.r_object_id, performerDisplayName: selectedUser, loginUsername: assignedUser });
            setToast({ type: 'success', message: res.data?.message || 'Case delegated successfully.' });
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || err.message || 'Delegation failed.' });
        } finally { setDelegating(null); }
    };

    const rangeStart = cases.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd   = (page - 1) * pageSize + cases.length;

    return (
        <div className="max-w-7xl mx-auto">
            <Toast toast={toast} onClose={() => setToast(null)} />

            {detailCase   && <CaseDetailsModal      caseItem={detailCase}   onClose={() => setDetailCase(null)} />}
            {movementCase && <MovementRegisterModal  caseItem={movementCase} onClose={() => setMovementCase(null)} />}

            <p className="text-sm text-slate-500 mb-5">Filter by office and department, select a user, then delegate cases.</p>

            {/* ── Filter Panel ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" />
                        <SelectWrapper>
                            <select value={officeType} onChange={e => handleOfficeTypeChange(e.target.value)}
                                disabled={isLocalAdmin}
                                className={isLocalAdmin ? disabledSelectCls : selectCls}>
                                <option value="">— All offices —</option>
                                <option value="HO">HO — Head Office</option>
                                <option value="RO">RO — Regional Office</option>
                                <option value="TE">TE — Training Establishment</option>
                            </select>
                        </SelectWrapper>
                    </div>
                    <div>
                        <FieldLabel icon={MapPin} label="Location" />
                        {isRoTe ? (
                            <SelectWrapper>
                                <select value={location} onChange={e => handleLocationChange(e.target.value)}
                                    disabled={isLocalAdmin}
                                    className={isLocalAdmin ? disabledSelectCls : selectCls}>
                                    <option value="">— Select location —</option>
                                    {locations.map(l => <option key={l.shortCode} value={l.location}>{l.location}</option>)}
                                </select>
                            </SelectWrapper>
                        ) : officeType === 'HO' ? (
                            <input readOnly value="Mumbai (Head Office)" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed" />
                        ) : (
                            <input readOnly value="" placeholder="— Select office first —" className={disabledSelectCls} />
                        )}
                    </div>
                    <div>
                        <FieldLabel icon={FolderOpen} label="Department" />
                        <SelectWrapper>
                            <select value={department?.shortCode || ''} onChange={e => handleDepartmentChange(e.target.value)}
                                disabled={!officeType || (isRoTe && !location)}
                                className={!officeType || (isRoTe && !location) ? disabledSelectCls : selectCls}>
                                <option value="">{!officeType ? '— Select office first —' : (isRoTe && !location) ? '— Select location first —' : '— Select department —'}</option>
                                {departments.map(d => <option key={d.shortCode} value={d.shortCode}>{d.name}</option>)}
                            </select>
                        </SelectWrapper>
                    </div>
                    <div>
                        <FieldLabel icon={Users} label="Delegate To" />
                        <SelectWrapper>
                            {/* Show filtered users if department selected, otherwise show all users */}
                            {(() => {
                                const displayUsers = department && isRoTe ? filteredUsers : users;
                                const isEmpty = displayUsers.length === 0;
                                return (
                                    <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                                        disabled={loadingUsers || isEmpty}
                                        className={loadingUsers || isEmpty ? disabledSelectCls : selectCls}>
                                        <option value="">{loadingUsers ? 'Loading users…' : isEmpty ? '— No matching users —' : '— Select user —'}</option>
                                        {displayUsers.map(u => <option key={u.r_object_id || u.user_login_name} value={u.object_name}>{u.object_name}</option>)}
                                    </select>
                                );
                            })()}
                        </SelectWrapper>
                    </div>
                </div>
            </div>

            {/* ── Search Bar + Chips ── */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by case number…"
                            className="w-64 pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] shadow-sm transition-all" />
                        {searchQuery && (
                            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button type="submit" disabled={!searchQuery.trim() || loadingCases}
                        className="px-5 py-2.5 bg-[#0A66C2] text-white rounded-lg text-sm font-semibold hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all">
                        {loadingCases ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Search
                    </button>
                </form>
                <div className="flex items-center gap-2 flex-wrap">
                    {officeType  && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium"><Building2 size={11} /> {officeType}</span>}
                    {location    && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium"><MapPin size={11} /> {location}</span>}
                    {department  && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium"><FolderOpen size={11} /> {department.name}</span>}
                    {selectedUser && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium"><UserRoundCog size={11} /> {selectedUser}</span>}
                </div>
            </div>

            {/* ── Cases Table ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {!loadingCases && cases.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                            Showing <span className="font-semibold text-[#0A66C2]">{rangeStart}–{rangeEnd}</span>{hasNext ? '+' : ''} cases
                        </span>
                        {!selectedUser && <span className="text-amber-600 text-xs font-medium">Select a user above to enable delegation</span>}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 font-semibold text-slate-700 w-14">#</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Case Number</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Subject</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Office / Dept</th>
                                <th className="px-5 py-3 font-semibold text-slate-700 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingCases ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-6" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                                        <td className="px-5 py-3"><div className="h-8 bg-slate-100 rounded w-28 mx-auto" /></td>
                                    </tr>
                                ))
                            ) : cases.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-14 text-center text-slate-500">
                                        <p className="font-medium">No cases found</p>
                                        <p className="text-xs mt-1">{officeType && !department ? 'Select a department to narrow results' : 'Try different filters or a different search term'}</p>
                                    </td>
                                </tr>
                            ) : (
                                cases.map((c, idx) => {
                                    const isDelegating = delegating === c.r_object_id;
                                    return (
                                        <tr key={c.r_object_id || idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-5 py-2.5 text-slate-400 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</td>
                                            <td className="px-5 py-2.5 font-medium text-slate-900">{c.object_name || '-'}</td>
                                            <td className="px-5 py-2.5 text-slate-500 max-w-xs truncate" title={c.description}>{c.description || '-'}</td>
                                            <td className="px-5 py-2.5 text-slate-500">
                                                <div className="flex flex-col">
                                                    <span>{c.ho_ro || '-'}</span>
                                                    <span className="text-xs text-slate-400">{c.department_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* Case Details */}
                                                    <button onClick={() => setDetailCase(c)} title="Case Details"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 transition-all">
                                                        <FileText size={15} />
                                                    </button>
                                                    {/* Movement Register */}
                                                    <button onClick={() => setMovementCase(c)} title="Movement Register"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                                        <ClipboardList size={15} />
                                                    </button>
                                                    {/* Delegate */}
                                                    <button onClick={() => handleDelegate(c)}
                                                        disabled={!selectedUser || isDelegating || !!delegating}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-all">
                                                        {isDelegating ? <><Loader2 size={12} className="animate-spin" /> Delegating…</> : <><ArrowRightLeft size={12} /> Delegate</>}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loadingCases && cases.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <button onClick={() => handlePageChange(1)} disabled={page === 1}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronsLeft size={16} className="text-slate-600" />
                        </button>
                        <div className="flex items-center gap-1">
                            <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft size={16} className="text-slate-600" />
                            </button>
                            <span className="px-3 py-1 text-sm font-medium text-slate-700">Page {page}</span>
                            <button onClick={() => handlePageChange(page + 1)} disabled={!hasNext}
                                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronRight size={16} className="text-slate-600" />
                            </button>
                        </div>
                        <div className="w-8" />
                    </div>
                )}
            </div>
        </div>
    );
};

export { DelegatePage as DelegateContent, CaseDetailsModal, MovementRegisterModal };
export default DelegatePage;
