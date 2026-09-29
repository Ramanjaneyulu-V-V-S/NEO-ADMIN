import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import {
    ArrowRightLeft, Search, Loader2, ChevronLeft, ChevronRight,
    ChevronsLeft, X, UserRoundCog, Users, Building2, MapPin, FolderOpen,
    FileText, ClipboardList
} from 'lucide-react';
import { useToast, DataTable } from '../components/ui';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import { CaseDetailsModal, MovementRegisterModal } from '../components/CaseModals';

const disabledSelectCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-8';

const FieldLabel = ({ icon: Icon, label }) => (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
        <Icon size={13} className="text-slate-400" />
        {label}
    </label>
);

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
    const globalToast = useToast();
    const [toast, setToast] = useState(null);
    useEffect(() => { if (toast) globalToast.show(toast); }, [toast, globalToast]);

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

    // For Local Admin: filter departments to only those in their profile (HO only)
    // For RO/TE, show all departments for the location
    const departments = isLocalAdmin && profileCtx && !isRoTe
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
            const res = await api.post('/delegate', { caseId: caseItem.r_object_id, performerDisplayName: selectedUser, loginUsername });
            setToast({ type: 'success', message: res.data?.message || 'Case delegated successfully.' });
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || err.message || 'Delegation failed.' });
        } finally { setDelegating(null); }
    };

    const rangeStart = cases.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd   = (page - 1) * pageSize + cases.length;

    const iconBtnCls = 'p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors';
    const delegateColumns = [
        { key: 'idx', header: '#', width: 'w-14', card: 'hide',
          render: (_c, idx) => <span className="text-slate-400 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</span> },
        { key: 'object_name', header: 'Case Number', primary: true,
          render: (c) => <span className="font-medium text-slate-900">{c.object_name || '-'}</span> },
        { key: 'description', header: 'Subject',
          render: (c) => <span className="block max-w-xs truncate text-slate-500" title={c.description}>{c.description || '-'}</span> },
        { key: 'office', header: 'Office / Dept',
          render: (c) => (
              <div className="flex flex-col text-slate-500">
                  <span>{c.ho_ro || '-'}</span>
                  <span className="text-xs text-slate-400">{c.department_name}</span>
              </div>
          ) },
        { key: 'action', header: 'Action', align: 'center', card: 'footer',
          render: (c) => {
              const isDelegating = delegating === c.r_object_id;
              return (
                  <div className="flex items-center gap-2 md:justify-center">
                      <button onClick={() => setDetailCase(c)} title="Case Details" className={iconBtnCls}><FileText size={15} /></button>
                      <button onClick={() => setMovementCase(c)} title="Movement Register" className={iconBtnCls}><ClipboardList size={15} /></button>
                      <button onClick={() => handleDelegate(c)}
                          disabled={!selectedUser || isDelegating || !!delegating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-canopy hover:bg-canopy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                          {isDelegating ? <><Loader2 size={12} className="animate-spin" /> Delegating…</> : <><ArrowRightLeft size={12} /> Delegate</>}
                      </button>
                  </div>
              );
          } },
    ];

    return (
        <div>
            {detailCase   && <CaseDetailsModal      caseItem={detailCase}   onClose={() => setDetailCase(null)} />}
            {movementCase && <MovementRegisterModal  caseItem={movementCase} onClose={() => setMovementCase(null)} />}

            <p className="text-sm text-slate-500 mb-5">Filter by office and department, select a user, then delegate cases.</p>

            {/* ── Filter Panel ── */}
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" />
                        <CustomSelect
                            value={officeType}
                            onChange={handleOfficeTypeChange}
                            disabled={isLocalAdmin}
                            placeholder="— All offices —"
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
                            <input readOnly value="Mumbai (Head Office)" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed" />
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
                            placeholder={!officeType ? '— Select office first —' : (isRoTe && !location) ? '— Select location first —' : '— Select department —'}
                            options={departments.map(d => ({ value: d.shortCode, label: d.name }))}
                        />
                    </div>
                    <div>
                        <FieldLabel icon={Users} label="Delegate To" />
                        {/* Show filtered users if department selected, otherwise show all users */}
                        {(() => {
                            const displayUsers = department && isRoTe ? filteredUsers : users;
                            const isEmpty = displayUsers.length === 0;
                            return (
                                <CustomSelect
                                    value={selectedUser}
                                    onChange={setSelectedUser}
                                    disabled={loadingUsers || isEmpty}
                                    placeholder={loadingUsers ? 'Loading users…' : isEmpty ? '— No matching users —' : '— Select user —'}
                                    options={displayUsers.map(u => ({ value: u.object_name, label: u.object_name }))}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* ── Search Bar + Chips ── */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <form onSubmit={handleSearch} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div className="relative min-w-0 flex-1 sm:flex-none">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by case number…"
                            className="w-full sm:w-64 pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy shadow-sm transition-colors" />
                        {searchQuery && (
                            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button type="submit" disabled={!searchQuery.trim() || loadingCases}
                        className="px-5 py-2.5 bg-canopy text-white rounded-lg text-sm font-semibold hover:bg-canopy-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors">
                        {loadingCases ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Search
                    </button>
                </form>
                <div className="flex items-center gap-2 flex-wrap">
                    {officeType  && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-canopy-tint text-canopy border border-canopy/20 rounded-full text-xs font-medium"><Building2 size={11} /> {officeType}</span>}
                    {location    && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium"><MapPin size={11} /> {location}</span>}
                    {department  && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-canopy-tint text-canopy border border-canopy/20 rounded-full text-xs font-medium"><FolderOpen size={11} /> {department.name}</span>}
                    {selectedUser && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-canopy-tint text-canopy border border-canopy/20 rounded-full text-xs font-medium"><UserRoundCog size={11} /> {selectedUser}</span>}
                </div>
            </div>

            {/* ── Cases Table ── */}
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {!loadingCases && cases.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-slate-600">
                            Showing <span className="font-semibold text-canopy">{rangeStart}–{rangeEnd}</span>{hasNext ? '+' : ''} cases
                        </span>
                        {!selectedUser && <span className="text-harvest text-xs font-medium">Select a user above to enable delegation</span>}
                    </div>
                )}

                <DataTable
                    columns={delegateColumns}
                    rows={cases}
                    rowKey={(c, idx) => c.r_object_id || idx}
                    loading={loadingCases}
                    skeletonRows={5}
                    empty={{
                        icon: FolderOpen,
                        title: 'No cases found',
                        description: officeType && !department ? 'Select a department to narrow results' : 'Try different filters or a different search term',
                    }}
                    stickyHeader
                    maxHeight="70vh"
                    className="p-3 md:p-0"
                />

                {!loadingCases && cases.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
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

export { DelegatePage as DelegateContent };
export default DelegatePage;
