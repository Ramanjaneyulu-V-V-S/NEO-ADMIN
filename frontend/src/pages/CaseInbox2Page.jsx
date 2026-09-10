import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import {
    Inbox, Loader2, X, User, Building2, MapPin, FolderOpen,
    FileText, Info, ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import { formatDateTime } from '../utils/datetime';

const PAGE_SIZE = 20;

const disabledSelectCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-8';

const FieldLabel = ({ icon: Icon, label }) => (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
        <Icon size={13} className="text-slate-400" />
        {label}
    </label>
);

// ─── Case Details Modal ────────────────────────────────────────────────────────
const CaseDetailsModal = ({ caseItem, onClose }) => {
    if (!caseItem) return null;

    const f = (c, field) => c[`packagescase_folder${field}`] || c[field] || '';

    const DetailRow = ({ label, value }) => (
        <div className="flex gap-2">
            <span className="text-xs font-semibold text-slate-500 w-36 shrink-0">{label}</span>
            <span className="text-xs text-slate-800 break-all">{value || '—'}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm">
                            <FileText size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{f(caseItem, 'object_name')}</p>
                            <p className="text-xs text-slate-500">Case Details</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={14} className="text-canopy" />
                        <h3 className="text-sm font-bold text-slate-800">Case Details</h3>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100">
                        <DetailRow label="Case Number"    value={f(caseItem, 'object_name')} />
                        <DetailRow label="Subject"        value={f(caseItem, 'description')} />
                        <DetailRow label="Department"     value={f(caseItem, 'department_name')} />
                        <DetailRow label="Vertical"       value={f(caseItem, 'functions')} />
                        <DetailRow label="Office Type"    value={f(caseItem, 'ho_ro')} />
                        <DetailRow label="Case Priority"  value={f(caseItem, 'task_priority')} />
                        <DetailRow label="Case Status"    value={f(caseItem, 'status')} />
                        <DetailRow label="Nature of Case" value={f(caseItem, 'case_nature')} />
                        <DetailRow label="Disposal Level" value={f(caseItem, 'disposal_level')} />
                        <DetailRow label="File No"        value={f(caseItem, 'file_number')} />
                        <DetailRow label="Case Type"      value={f(caseItem, 'types')} />
                        <DetailRow label="Created By"     value={f(caseItem, 'r_creator_name')} />
                        <DetailRow label="Language"       value={f(caseItem, 'language_type')} />
                        <DetailRow label="Task"           value={caseItem.packagesworkflow_paramtask_name} />
                        <DetailRow label="Performer"      value={caseItem.task_performer_name} />
                        <DetailRow label="Object ID"      value={f(caseItem, 'id') || caseItem.id} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Movement Register Modal ───────────────────────────────────────────────────
const MovementRegisterModal = ({ caseItem, onClose }) => {
    const [movement, setMovement] = useState([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        if (!caseItem) return;
        const caseId = caseItem.packagescase_folderid || caseItem.r_object_id || caseItem.objectId || caseItem.id;
        if (!caseId) { setLoading(false); return; }
        setLoading(true);
        api.get(`/delegate/cases/${caseId}/movement`, {
            params: { isValidEntry: true }
        })
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
        { key: 'completion_date',label: 'Completion Date', render: formatDateTime },
        { key: 'r_creation_date',label: 'R Creation Date', render: formatDateTime },
        { key: 'r_modify_date',  label: 'R Modify Date',   render: formatDateTime },
        { key: 'acl_domain',     label: 'Acl Domain' },
        { key: 'acl_name',       label: 'Acl Name' },
        { key: 'owner_name',     label: 'Owner Name' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm">
                            <ClipboardList size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">
                                {caseItem.packagescase_folderobject_name || caseItem.object_name}
                            </p>
                            <p className="text-xs text-slate-500">Movement Register</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <ClipboardList size={14} className="text-canopy" />
                        <h3 className="text-sm font-bold text-slate-800">Movement Register</h3>
                        {!loading && (
                            <span className="px-2 py-0.5 bg-canopy-tint text-canopy text-xs font-semibold rounded-full">
                                {movement.length}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 py-12 justify-center text-slate-400">
                            <Loader2 size={18} className="animate-spin text-canopy" />
                            <span className="text-sm">Loading movement register…</span>
                        </div>
                    ) : movement.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                            No movement register records found for this case.
                        </div>
                    ) : (
                        <div className="overflow-auto scrollbar-thin border border-slate-200 rounded-xl max-h-[55vh]">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
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
                                        <tr key={idx} className="hover:bg-canopy-tint/30 transition-colors">
                                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                            {movCols.map(col => (
                                                <td key={col.key} className="px-3 py-2 text-slate-700 max-w-xs truncate"
                                                    title={String(rec[col.key] ?? '')}>
                                                    {col.render ? col.render(rec[col.key]) : (rec[col.key] ?? '—')}
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

// ─── CaseInbox2Page ────────────────────────────────────────────────────────────
const CaseInbox2Page = () => {
    // Local Admin role & profile context
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);
    const [localAdminOfficeType, setLocalAdminOfficeType] = useState('');
    const [localAdminLocation, setLocalAdminLocation] = useState('');
    const [localAdminDepartments, setLocalAdminDepartments] = useState([]);

    // Fetch Local Admin profile context on mount
    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                setLocalAdminOfficeType(ctx.office_type || '');
                setLocalAdminLocation(ctx.location || '');
                const deptMulti = ctx.department_short_code_multi || [];
                setLocalAdminDepartments(Array.isArray(deptMulti) ? deptMulti : []);
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // Filter state
    const [officeType,  setOfficeType]  = useState(() => isLocalAdmin ? '' : '');
    const [location,    setLocation]    = useState(() => isLocalAdmin ? '' : '');
    const [department,  setDepartment]  = useState(null);
    const [allDepartments, setAllDepartments] = useState([]);

    // Initialize filters for Local Admin when profile context loads
    useEffect(() => {
        if (isLocalAdmin && profileCtx && localAdminOfficeType) {
            setOfficeType(localAdminOfficeType);
            if (localAdminLocation) setLocation(localAdminLocation);
        }
    }, [isLocalAdmin, profileCtx, localAdminOfficeType, localAdminLocation]);

    // Users state
    const [users,        setUsers]        = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Cases state
    const [cases,        setCases]        = useState([]);
    const [total,        setTotal]        = useState(0);
    const [loadingCases, setLoadingCases] = useState(false);
    const [page,         setPage]         = useState(1);
    const [error,        setError]        = useState(null);

    const [detailCase,   setDetailCase]   = useState(null);
    const [movementCase, setMovementCase] = useState(null);

    const locations = getLocations(officeType);
    const isRoTe    = officeType === 'RO' || officeType === 'TE';

    // For Local Admin: filter departments to only those in their profile
    const departments = isLocalAdmin && profileCtx
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            return allDepartments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
          })()
        : allDepartments;

    // Fetch departments when office type / location changes
    useEffect(() => {
        if (!officeType || (isRoTe && !location)) { setAllDepartments([]); return; }
        fetchDepartments(officeType, location).then(setAllDepartments);
    }, [officeType, location]);

    // For Local Admin: auto-fetch users when profile context loads with location/office type
    useEffect(() => {
        if (!isLocalAdmin) return;
        if (!profileCtx || !officeType || (isRoTe && !location)) return;
        if (isRoTe && location) {
            fetchUsersByLocation(location);
        }
    }, [isLocalAdmin, profileCtx, officeType, location]);

    // Fetch users by location
    const fetchUsersByLocation = async (loc) => {
        setLoadingUsers(true); setUsers([]);
        try {
            const res = await api.get('/users/by-location', { params: { location: loc } });
            setUsers(res.data?.users || res.data || []);
        } catch { setUsers([]); }
        finally { setLoadingUsers(false); }
    };

    // Fetch users by department
    const fetchUsersByDept = async (shortCode, officeTypeFilter) => {
        setLoadingUsers(true); setUsers([]);
        try {
            const params = { shortCode };
            if (officeTypeFilter) params.officeType = officeTypeFilter;
            const res = await api.get('/users/by-dept', { params });
            setUsers(res.data?.users || res.data || []);
        } catch { setUsers([]); }
        finally { setLoadingUsers(false); }
    };

    // Office type change handler
    const handleOfficeTypeChange = (val) => {
        setOfficeType(val); setLocation(''); setDepartment(null);
        setUsers([]); setFilteredUsers([]); setSelectedUser(null); setCases([]); setTotal(0); setPage(1);
    };

    // Location change handler
    const handleLocationChange = (val) => {
        setLocation(val); setDepartment(null); setSelectedUser(null); setFilteredUsers([]);
        setCases([]); setTotal(0); setPage(1);
        if (val) fetchUsersByLocation(val);
        else setUsers([]);
    };

    // Department change handler
    const handleDepartmentChange = (shortCode) => {
        setSelectedUser(null); setCases([]); setTotal(0); setPage(1);
        if (!shortCode) {
            setDepartment(null); setFilteredUsers([]);
            if (isRoTe && location) fetchUsersByLocation(location);
            else setUsers([]);
            return;
        }
        const dept = departments.find(d => d.shortCode === shortCode) || null;
        setDepartment(dept);

        if (dept) {
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

    // Fetch cases for selected user
    const fetchCases = useCallback(async (userName, pg) => {
        if (!userName) { setCases([]); setTotal(0); return; }
        setLoadingCases(true);
        setError(null);
        try {
            const start = (pg - 1) * PAGE_SIZE;
            const res = await api.get('/inbox/tasklist', {
                params: { username: userName, page: pg, start }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(entry => {
                    const props = entry?.content?.properties || entry?.properties || entry;
                    return { ...props, _raw: entry };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }
            setCases(items);
            setTotal(data.total || data.count || items.length);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load inbox');
            setCases([]);
            setTotal(0);
        } finally {
            setLoadingCases(false);
        }
    }, []);

    const handleSelectUser = (userName) => {
        setSelectedUser(userName);
        setPage(1);
        fetchCases(userName, 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(selectedUser, newPage);
    };

    const rangeStart = cases.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const rangeEnd   = (page - 1) * PAGE_SIZE + cases.length;
    const hasNext    = rangeEnd < total;
    const hasPrev    = page > 1;

    const p               = (c, f) => c[`packagescase_folder${f}`] || c[f];
    const getCaseName     = (c) => p(c, 'object_name') || '—';
    const getCaseDesc     = (c) => p(c, 'description') || c.packagesworkflow_paramtask_name || '—';
    const getCaseStatus   = (c) => p(c, 'status') || '—';
    const getCasePriority = (c) => p(c, 'task_priority') || '—';
    const getCaseDept     = (c) => p(c, 'department_name') || '—';
    const getCaseHoRo     = (c) => p(c, 'ho_ro') || '—';
    const getCaseId       = (c) => p(c, 'id') || c.id || '';

    return (
        <div className="flex h-full flex-col">
            {detailCase   && <CaseDetailsModal     caseItem={detailCase}   onClose={() => setDetailCase(null)} />}
            {movementCase && <MovementRegisterModal caseItem={movementCase} onClose={() => setMovementCase(null)} />}

            {/* Filter Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" />
                        <CustomSelect
                            value={officeType}
                            onChange={handleOfficeTypeChange}
                            disabled={isLocalAdmin}
                            placeholder="— Select office type —"
                            options={[
                                { value: 'HO', label: 'HO — Head Office' },
                                { value: 'RO', label: 'RO — Regional Office' },
                                { value: 'TE', label: 'TE — Training Establishment' },
                            ]}
                        />
                    </div>
                    <div>
                        <FieldLabel icon={MapPin} label="Location" />
                        {isRoTe ? (
                            <CustomSelect
                                value={location}
                                onChange={handleLocationChange}
                                disabled={isLocalAdmin}
                                placeholder="— Select location —"
                                options={locations.map(l => ({ value: l.location, label: l.location }))}
                            />
                        ) : officeType === 'HO' ? (
                            <input readOnly value="Mumbai (Head Office)" className={disabledSelectCls} />
                        ) : (
                            <input readOnly value="" placeholder="— Select office first —" className={disabledSelectCls} />
                        )}
                    </div>
                    <div>
                        <FieldLabel icon={FolderOpen} label="Department" />
                        <CustomSelect
                            value={department?.shortCode || ''}
                            onChange={handleDepartmentChange}
                            disabled={!officeType || (isRoTe && !location)}
                            placeholder={!officeType ? '— Select office first —' : (isRoTe && !location) ? '— Select location first —' : '— All departments —'}
                            options={departments.map(d => ({ value: d.shortCode, label: d.name }))}
                        />
                    </div>
                    <div>
                        <FieldLabel icon={User} label="User Name" />
                        {/* Show filtered users if department selected, otherwise show all users */}
                        {(() => {
                            const displayUsers = department && isRoTe ? filteredUsers : users;
                            const isEmpty = displayUsers.length === 0;
                            return (
                                <CustomSelect
                                    value={selectedUser || ''}
                                    onChange={handleSelectUser}
                                    disabled={loadingUsers || isEmpty}
                                    placeholder={loadingUsers ? 'Loading users…' : isEmpty ? '— No matching users —' : '— Select user —'}
                                    options={displayUsers.map(u => ({ value: u.object_name, label: u.object_name }))}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Tasks panel */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

                {/* Panel header */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <ClipboardList size={15} className="text-canopy" />
                    <span className="text-sm font-semibold text-slate-700">
                        {selectedUser ? `Inbox — ${selectedUser}` : 'Inbox Tasks'}
                    </span>
                    {selectedUser && !loadingCases && total > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                            {total} case{total !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Table area */}
                <div className="flex-1 overflow-auto">
                    {!selectedUser && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <Inbox size={36} strokeWidth={1.5} />
                            <p className="text-sm">Select a user to view their inbox cases</p>
                        </div>
                    )}

                    {selectedUser && loadingCases && (
                        <div className="flex items-center justify-center h-full py-16">
                            <Loader2 size={24} className="animate-spin text-canopy" />
                        </div>
                    )}

                    {selectedUser && !loadingCases && error && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-danger py-16">
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {selectedUser && !loadingCases && !error && cases.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <Inbox size={36} strokeWidth={1.5} />
                            <p className="text-sm">No pending cases found for this user</p>
                        </div>
                    )}

                    {selectedUser && !loadingCases && !error && cases.length > 0 && (
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">#</th>
                                    {['Case Number', 'Subject', 'Department', 'Office', 'Status', 'Priority', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cases.map((c, idx) => (
                                    <tr key={getCaseId(c) || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                                            {(page - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{getCaseName(c)}</td>
                                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={getCaseDesc(c)}>
                                            {getCaseDesc(c)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{getCaseDept(c)}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{getCaseHoRo(c)}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium">
                                                {getCaseStatus(c)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getCasePriority(c) !== '—' ? (
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                    getCasePriority(c) === 'High'   ? 'bg-danger-tint text-danger' :
                                                    getCasePriority(c) === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>{getCasePriority(c)}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setDetailCase(c)}
                                                    title="Case Details"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors"
                                                >
                                                    <FileText size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setMovementCase(c)}
                                                    title="Movement Register"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors"
                                                >
                                                    <ClipboardList size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination footer */}
                {selectedUser && !loadingCases && cases.length > 0 && (hasPrev || hasNext) && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-slate-500">
                            {rangeStart > 0 ? `Showing ${rangeStart}–${rangeEnd}${total > rangeEnd ? ` of ${total}` : ''}` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={!hasPrev}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={!hasPrev}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 py-1 text-xs font-medium text-slate-700">Page {page}</span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={!hasNext}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="w-16" />
                    </div>
                )}
            </div>
        </div>
    );
};

export { CaseInbox2Page as CaseInboxContent };
export default CaseInbox2Page;
