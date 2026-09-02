import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import {
    Search, ChevronLeft, ChevronRight, ChevronDown, Users, UserPlus,
    Loader2, Edit2, ChevronsLeft, X, ArrowUpDown, ArrowUp, ArrowDown,
    CheckCircle2, AlertCircle, Shield, Mail, User, Key, Database,
    FolderOpen, Globe, Lock, Tag, Info, Eye, EyeOff, KeyRound, UserCog,
    Briefcase, Building2, Hash, MapPin, ToggleLeft, GraduationCap, Layers, Save, Download
} from 'lucide-react';
import EditUserProfileModal from '../components/EditUserProfileModal.jsx';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import { PageHeader, Tabs, DataTable, Pagination, Button, Input, Modal, useToast } from '../components/ui';
import UserExportTab from './UserExportPage';
import { USER_GRADES, DESIGNATION_OPTIONS, fetchDepartments, getLocations } from '../data/nabardMetadata.js';

// ─── Fetch all users across pages (Documentum REST caps at 2000/page) ────────
async function fetchAllUsers(officeTypeFilter, locationFilter, deptNames) {
    const PAGE_SIZE = 2000;
    let page = 1;
    let all = [];
    while (true) {
        const params = { page, size: PAGE_SIZE };
        if (officeTypeFilter) params.officeTypeFilter = officeTypeFilter;
        if (locationFilter)   params.locationFilter   = locationFilter;
        if (deptNames)        params.deptNames         = deptNames;
        const res = await api.get('/users/profiles', { params });
        const users = res.data.users || [];
        all = all.concat(users);
        if (!res.data.hasNext) break;
        page++;
    }
    return all;
}

// ─── Privilege options for dm_user ───────────────────────────────────────────
const PRIVILEGE_OPTIONS = [
    { value: 0,  label: 'None',          description: 'Regular user with no special privileges' },
    { value: 1,  label: 'Create Type',   description: 'Can create new object types' },
    { value: 2,  label: 'Create Cabinet',description: 'Can create cabinets in the repository' },
    { value: 4,  label: 'Create Group',  description: 'Can create new groups' },
    { value: 8,  label: 'Sysadmin',      description: 'System administrator privileges' },
    { value: 16, label: 'Superuser',     description: 'Full superuser access' },
];

// ─── Source label helper ──────────────────────────────────────────────────────
const DM_SOURCE_LABELS = { 0: 'Local', 1: 'LDAP', 3: 'OTDS' };
const DM_STATE_LABELS  = { 0: 'Active', 1: 'Inactive' };

// ─── Edit dm_user Modal ───────────────────────────────────────────────────────
const EditDmUserModal = ({ user, isOpen, onClose, onSaved, onToast }) => {
    const [form, setForm]               = useState({});
    const [loading, setLoading]         = useState(false);
    const [loadingState, setLoadingState] = useState(false);
    const [error, setError]             = useState(null);

    useEffect(() => {
        if (!isOpen || !user) return;
        setForm({
            user_address:   user.user_address   || '',
            user_privileges: user.user_privileges ?? 0,
            user_state:     0,   // default Active; overwritten once OTDS status loads
            description:    user.description    || '',
            user_os_name:   user.user_os_name   || '',
            user_db_name:   user.user_db_name   || '',
            default_folder: user.default_folder || '',
            home_docbase:   user.home_docbase   || '',
            acl_name:       user.acl_name       || '',
        });
        setError(null);

        // Fetch OTDS accountDisabled to initialise User State dropdown
        if (user.user_login_name) {
            setLoadingState(true);
            const userId = encodeURIComponent(user.user_login_name + '@DCTMPartitions');
            api.get(`/users/otds/inspect?userId=${userId}`)
                .then(res => {
                    const values = res.data?.values || [];
                    const attr = values.find(v => v.name === 'accountDisabled');
                    const isDisabled = attr?.values?.[0] === 'true';
                    setForm(f => ({ ...f, user_state: isDisabled ? 1 : 0 }));
                })
                .catch(() => { /* keep default Active on error */ })
                .finally(() => setLoadingState(false));
        }
    }, [isOpen, user]);

    const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await api.patch(`/users/dm/${encodeURIComponent(user.user_name)}`, {
                ...form,
                user_login_name: user.user_login_name,
            });
            if (res.data?.otdsWarning) {
                onToast({ type: 'error', message: `Documentum updated. OTDS warning: ${res.data.otdsWarning}` });
            } else {
                onToast({ type: 'success', message: `dm_user "${user.user_name}" updated${form.user_state === 1 ? ' and OTDS account disabled' : ''}.` });
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update user.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy bg-white';
    const Lbl = ({ children }) => <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{children}</label>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <UserCog size={16} className="text-canopy" />
                            Edit Documentum User
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{user?.user_name} · {user?.user_login_name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {error && <div className="mb-4 p-3 bg-danger-tint text-danger rounded-lg text-sm border border-danger-tint">{error}</div>}
                    <form id="editDmUserForm" onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <Lbl>Email / User Address</Lbl>
                            <input type="text" value={form.user_address}
                                onChange={e => set('user_address', e.target.value)}
                                placeholder="e.g. user@nabard.org"
                                className={inputCls} />
                        </div>
                        <div className="space-y-1">
                            <Lbl className="flex items-center gap-2">
                                User State (OTDS)
                                {loadingState && <Loader2 size={11} className="animate-spin text-slate-400 inline ml-1" />}
                            </Lbl>
                            <CustomSelect
                                value={form.user_state}
                                disabled={loadingState}
                                onChange={v => set('user_state', Number(v))}
                                options={[
                                    { value: 0, label: 'Active' },
                                    { value: 1, label: 'Inactive' },
                                ]}
                            />
                            {form.user_state === 1 && !loadingState && (
                                <p className="text-xs text-harvest flex items-center gap-1 mt-1">
                                    <AlertCircle size={12} /> Saving will disable the OTDS account.
                                </p>
                            )}
                            {form.user_state === 0 && !loadingState && (
                                <p className="text-xs text-canopy flex items-center gap-1 mt-1">
                                    <CheckCircle2 size={12} /> Saving will enable the OTDS account.
                                </p>
                            )}
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="editDmUserForm" disabled={loading}
                        className="px-4 py-2 bg-canopy text-white rounded-lg text-sm font-medium hover:bg-canopy-dark disabled:opacity-50 flex items-center gap-2 transition-colors">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── dm_user Sub-Tab ──────────────────────────────────────────────────────────
const DmUserTab = ({ onToast }) => {
    const [allUsers, setAllUsers]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [searchQuery, setSearchQuery]   = useState('');
    const [currentPage, setCurrentPage]   = useState(1);
    const [pageSize]                      = useState(15);
    const [sortConfig, setSortConfig]     = useState({ key: 'user_name', direction: 'asc' });
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditOpen, setIsEditOpen]     = useState(false);

    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const fetchDmUsers = async (officeTypeFilter) => {
        setLoading(true);
        try {
            const PAGE_SIZE = 2000;
            let page = 1, all = [];
            while (true) {
                const params = { page, size: PAGE_SIZE };
                if (officeTypeFilter) params.officeTypeFilter = officeTypeFilter;
                const res = await api.get('/users/dm', { params });
                const users = res.data.users || [];
                all = all.concat(users);
                if (!res.data.hasNext) break;
                page++;
            }
            setAllUsers(all);
        } catch (err) {
            console.error('Error fetching dm_users', err);
            setAllUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) {
            fetchDmUsers(null);
            return;
        }
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const officeType = res.data?.office_type || '';
                fetchDmUsers(officeType === 'HO' ? 'HO' : 'RO');
            })
            .catch(() => fetchDmUsers(null));
    }, [isLocalAdmin, loginUsername]);

    const processed = useMemo(() => {
        let result = [...allUsers];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(u =>
                (u.user_name?.toLowerCase()       || '').includes(q) ||
                (u.user_login_name?.toLowerCase() || '').includes(q) ||
                (u.user_address?.toLowerCase()    || '').includes(q)
            );
        }
        if (sortConfig.key) {
            result.sort((a, b) => {
                const av = String(a[sortConfig.key] ?? '');
                const bv = String(b[sortConfig.key] ?? '');
                if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'asc' ? 1  : -1;
                return 0;
            });
        }
        return result;
    }, [allUsers, searchQuery, sortConfig]);

    const totalItems   = processed.length;
    const totalPages   = Math.ceil(totalItems / pageSize);
    const rangeStart   = (currentPage - 1) * pageSize;
    const rangeEnd     = rangeStart + pageSize;
    const currentUsers = processed.slice(rangeStart, rangeEnd);

    const handleSort = (key) => setSortConfig(c => ({
        key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc',
    }));

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey)
            return <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-canopy ml-1" />
            : <ArrowDown size={14} className="text-canopy ml-1" />;
    };

    const SortableHeader = ({ label, columnKey, className = '' }) => (
        <th className={`px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group select-none ${className}`}
            onClick={() => handleSort(columnKey)}>
            <div className="flex items-center">{label}<SortIcon columnKey={columnKey} /></div>
        </th>
    );

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="text-sm text-slate-500 font-medium">
                    {!loading && <span><span className="text-slate-900 font-semibold">{totalItems}</span> dm_users found</span>}
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search by name, login, email..."
                        className="w-full sm:w-72 pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy shadow-sm" />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700 w-12">#</th>
                                <SortableHeader label="User Name"   columnKey="user_name" />
                                <SortableHeader label="Login Name"  columnKey="user_login_name" />
                                <SortableHeader label="Email"       columnKey="user_address" />
                                <SortableHeader label="Source"      columnKey="user_source" />
                                <th className="px-4 py-3 font-semibold text-slate-700 w-16 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="px-4 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <Loader2 size={32} className="animate-spin text-canopy mb-3" />
                                        <p className="text-sm font-medium">Loading Documentum users...</p>
                                    </div>
                                </td></tr>
                            ) : currentUsers.length === 0 ? (
                                <tr><td colSpan="5" className="px-4 py-16 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <Users className="h-12 w-12 text-slate-200 mb-3" />
                                        <p className="text-base font-medium text-slate-600">No users found</p>
                                        <p className="text-sm mt-1">Try adjusting your search terms</p>
                                    </div>
                                </td></tr>
                            ) : currentUsers.map((user, idx) => (
                                <tr key={user.user_name || idx} className="hover:bg-canopy-tint/30 transition-colors group">
                                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{rangeStart + idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-slate-900">{user.user_name}</span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.user_login_name || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600 text-xs">{user.user_address || '-'}</td>
                                    <td className="px-4 py-3">
                                        {user.user_source !== undefined && user.user_source !== null ? (
                                            <span className="px-2 py-0.5 bg-canopy-tint text-canopy rounded text-xs font-medium border border-canopy/20">
                                                {DM_SOURCE_LABELS[user.user_source] || user.user_source}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => { setSelectedUser(user); setIsEditOpen(true); }}
                                            className="p-2 hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-canopy hover:shadow-sm rounded-lg transition-all"
                                            title="Edit dm_user">
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-sm text-slate-500">
                        {totalItems > 0 ? (
                            <>Showing <span className="font-medium text-slate-900">{rangeStart + 1}</span> to <span className="font-medium text-slate-900">{Math.min(rangeEnd, totalItems)}</span> of <span className="font-medium text-slate-900">{totalItems}</span> results</>
                        ) : 'No results'}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1 || loading}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-canopy disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition-colors">
                            <ChevronsLeft size={16} />
                        </button>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || loading}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-canopy disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 min-w-[3rem] text-center shadow-sm">
                            {currentPage}
                        </div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading || totalPages === 0}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-canopy disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <EditDmUserModal
                user={selectedUser}
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                onSaved={fetchDmUsers}
                onToast={onToast}
            />
        </div>
    );
};

// ─── User Directory Tab (wrapper with cms_user_profile + dm_user sub-tabs) ────
const UserDirectoryTab = ({ onToast }) => {
    const [subTab, setSubTab] = useState('profiles');
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <CmsProfileTab onToast={onToast} />
        </div>
    );
};

const OFFICE_TYPE_LABELS = { HO: 'HO — Head Office', RO: 'RO — Regional Office', TE: 'TE — Training Establishment' };

const PROFILE_PAGE_SIZES = [15, 25, 50];

// Debounce a fast-changing value (e.g. a text input) for server-side querying.
function useDebouncedValue(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ─── cms_user_profile Sub-Tab (was UserDirectoryTab) ─────────────────────────
// Server-side paginated / filtered / sorted — one small page per request keeps
// the initial load well under a second (the old bulk 2 000-row fetch took ~7 s).
const CmsProfileTab = ({ onToast }) => {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(null);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [refreshKey, setRefreshKey] = useState(0);
    const [filterName, setFilterName] = useState('');
    const [filterUin, setFilterUin] = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [filterOfficeType, setFilterOfficeType] = useState('');
    const [filterDeptCode, setFilterDeptCode] = useState('');
    const [filterRoCode, setFilterRoCode] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'object_name', direction: 'asc' });
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const fetchIdRef = useRef(0); // guard against stale / duplicate fetches

    const debouncedName = useDebouncedValue(filterName.trim(), 300);
    const debouncedUin  = useDebouncedValue(filterUin.trim(), 300);

    const storedUser   = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole    = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx]           = useState(isLocalAdmin ? null : {});
    const [profileOfficeType, setProfileOfficeType] = useState('');
    const [profileLocation, setProfileLocation] = useState('');
    const [allDepts, setAllDepts]               = useState([]);
    const [hoDeptList, setHoDeptList]           = useState([]); // Super Admin HO department options

    // Local Admin: resolve the fixed office / location / department scope
    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                setProfileOfficeType(ctx.office_type || '');
                setProfileLocation(ctx.location || '');
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // Super Admin: HO department filter options (static metadata, not scanned from rows)
    useEffect(() => {
        if (isLocalAdmin) return;
        fetchDepartments('HO').then(setHoDeptList).catch(() => setHoDeptList([]));
    }, [isLocalAdmin]);

    // Local Admin: departments for their office / location
    useEffect(() => {
        if (!isLocalAdmin || !profileOfficeType) return;
        if ((profileOfficeType === 'RO' || profileOfficeType === 'TE') && !profileLocation) return;
        fetchDepartments(profileOfficeType, profileLocation).then(setAllDepts);
    }, [isLocalAdmin, profileOfficeType, profileLocation]);

    const filteredDepts = useMemo(() => {
        if (!isLocalAdmin || !profileCtx) return allDepts;
        const raw = profileCtx.department_short_code_multi;
        const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
            .map(s => s.toLowerCase());
        return allDepts.filter(d => allowed.includes(d.shortCode.toLowerCase()));
    }, [isLocalAdmin, profileCtx, allDepts]);

    const localAdminDeptNames = useMemo(() => (
        isLocalAdmin && profileOfficeType === 'HO' && filteredDepts.length > 0
            ? filteredDepts.map(d => d.name).join(',')
            : ''
    ), [isLocalAdmin, profileOfficeType, filteredDepts]);

    // The server-side scope is ready once a Local Admin's context has resolved.
    const scopeReady = !isLocalAdmin
        ? true
        : !!(profileCtx && profileOfficeType && (
            profileOfficeType === 'HO' ? !!localAdminDeptNames : !!profileLocation
        ));

    // ── One consolidated server-side fetch: page + filters + sort ──────────────
    useEffect(() => {
        if (!scopeReady) return;
        const myFetchId = ++fetchIdRef.current;

        const load = async () => {
            setLoading(true);
            const params = {
                page: currentPage,
                size: pageSize,
                sortBy: sortConfig.key || 'object_name',
                sortDir: sortConfig.direction || 'asc',
                'include-total': true,
            };
            if (debouncedName) params.query = debouncedName;
            if (debouncedUin)  params.uin = debouncedUin;
            if (filterGrade)   params.grade = filterGrade;

            if (isLocalAdmin) {
                if (profileOfficeType === 'HO') {
                    params.officeTypeFilter = 'HO';
                    params.deptNames = localAdminDeptNames;
                    if (filterDeptCode) params.deptCode = filterDeptCode;
                } else {
                    params.officeTypeFilter = profileOfficeType;
                    params.locationFilter = profileLocation;
                }
            } else {
                if (filterOfficeType) params.officeTypeFilter = filterOfficeType;
                if (filterDeptCode)   params.deptCode = filterDeptCode;
                if (filterRoCode)     params.roCode = filterRoCode;
            }

            try {
                const res = await api.get('/users/profiles', { params });
                if (fetchIdRef.current !== myFetchId) return;
                setUsers(res.data.users || []);
                setHasNext(!!res.data.hasNext);
                setTotal(res.data.total != null ? Number(res.data.total) : null);
            } catch (err) {
                if (fetchIdRef.current !== myFetchId) return;
                console.error('Error fetching users', err);
                setUsers([]); setHasNext(false); setTotal(null);
                onToast?.({ type: 'error', message: 'Failed to load user directory.' });
            } finally {
                if (fetchIdRef.current === myFetchId) setLoading(false);
            }
        };

        load();
    }, [scopeReady, isLocalAdmin, currentPage, pageSize, sortConfig, refreshKey,
        debouncedName, debouncedUin, filterGrade, filterOfficeType, filterDeptCode, filterRoCode,
        profileOfficeType, profileLocation, localAdminDeptNames, onToast]);

    // Modal callback — refetch the current page (keeps filters / page position)
    const handleRefreshUsers = () => setRefreshKey(k => k + 1);

    const gradeOptions = useMemo(
        () => USER_GRADES.map(g => ({ value: g.value, label: g.label })),
        []
    );

    const roCodeOptions = useMemo(() => {
        const seen = new Set();
        return [...getLocations('RO'), ...getLocations('TE')]
            .filter(l => l.shortCode && !seen.has(l.shortCode) && seen.add(l.shortCode))
            .map(l => ({ value: l.shortCode, label: `${l.location} (${l.shortCode})` }));
    }, []);

    const officeTypeOptions = useMemo(
        () => ['HO', 'RO', 'TE'].map(o => ({ value: o, label: OFFICE_TYPE_LABELS[o] || o })),
        []
    );

    // Super Admin HO department options (from metadata, not from loaded rows)
    const hoDeptOptions = useMemo(
        () => hoDeptList
            .map(d => ({ value: d.shortCode, label: `${d.name} (${d.shortCode})` }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        [hoDeptList]
    );

    const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
    const rangeStart = (currentPage - 1) * pageSize;
    const currentUsers = users;

    const handlePageChange = (p) => {
        if (p < 1) return;
        if (totalPages != null) { if (p <= totalPages) setCurrentPage(p); return; }
        if (p <= currentPage || hasNext) setCurrentPage(p);
    };

    const hasActiveFilters = filterName || filterUin || filterGrade || filterOfficeType || filterDeptCode || filterRoCode;
    const clearAllFilters = () => {
        setFilterName(''); setFilterUin(''); setFilterGrade(''); setFilterOfficeType('');
        setFilterDeptCode(''); setFilterRoCode('');
        setCurrentPage(1);
    };

    const filterLabelCls = 'text-caption font-medium uppercase tracking-wide text-slate-500';

    const columns = [
        {
            key: 'idx', header: '#', mono: true, width: 'w-12', card: 'hide',
            render: (_u, i) => rangeStart + i + 1,
        },
        {
            key: 'object_name', header: 'Name', primary: true, sortable: true,
            render: (u) => (
                <div className="flex flex-col">
                    <span className="font-medium text-ink">{u.object_name}</span>
                    <span className="text-caption text-slate-500">{u.user_login_name}</span>
                </div>
            ),
        },
        { key: 'uin', header: 'UIN', mono: true, sortable: true, render: (u) => u.uin || '—' },
        {
            key: 'user_grade', header: 'Grade', sortable: true,
            render: (u) => u.user_grade
                ? <span className="rounded border border-line bg-paper px-2 py-0.5 text-caption font-medium text-slate-600">{u.user_grade}</span>
                : '—',
        },
        { key: 'designation', header: 'Designation', sortable: true, render: (u) => u.designation || '—' },
        { key: 'department_short_code', header: 'Department', mono: true, sortable: true, render: (u) => u.department_short_code || '—' },
        { key: 'ro_short_code', header: 'RO Code', mono: true, sortable: true, render: (u) => u.ro_short_code || '—' },
        {
            key: 'actions', header: '', align: 'right', card: 'footer',
            render: (u) => (
                <Button
                    size="sm" variant="secondary"
                    onClick={() => { setSelectedUser(u); setIsEditModalOpen(true); }}
                >
                    <Edit2 size={13} /> Edit
                </Button>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Per-column filters */}
            <div className="rounded-card border border-line bg-white p-3 shadow-card">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Name */}
                    <div className="flex min-w-[160px] flex-1 flex-col gap-1 sm:flex-none">
                        <label className={filterLabelCls}>Name</label>
                        <div className="relative">
                            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input value={filterName}
                                onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                                placeholder="Search name…"
                                className="pl-7 pr-7" />
                            {filterName && <button onClick={() => { setFilterName(''); setCurrentPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink"><X size={12} /></button>}
                        </div>
                    </div>

                    {/* UIN */}
                    <div className="flex min-w-[130px] flex-1 flex-col gap-1 sm:flex-none">
                        <label className={filterLabelCls}>UIN</label>
                        <div className="relative">
                            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input value={filterUin}
                                onChange={e => { setFilterUin(e.target.value); setCurrentPage(1); }}
                                placeholder="Search UIN…"
                                className="pl-7 pr-7" />
                            {filterUin && <button onClick={() => { setFilterUin(''); setCurrentPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink"><X size={12} /></button>}
                        </div>
                    </div>

                    {/* Office Type (HO/RO/TE) — hidden for Local Admins (scope is fixed) */}
                    {!isLocalAdmin && (
                        <div className="flex min-w-[190px] flex-col gap-1">
                            <label className={filterLabelCls}>Office Type</label>
                            <CustomSelect value={filterOfficeType}
                                onChange={v => { setFilterOfficeType(v); setFilterDeptCode(''); setFilterRoCode(''); setCurrentPage(1); }}
                                placeholder="All office types" options={officeTypeOptions} />
                        </div>
                    )}

                    {/* Department — HO only (Super Admin from data; Local Admin from their scope) */}
                    {(isLocalAdmin ? filteredDepts.length > 1 : filterOfficeType === 'HO') && (
                        <div className="flex min-w-[200px] flex-col gap-1">
                            <label className={filterLabelCls}>Department</label>
                            <CustomSelect value={filterDeptCode}
                                onChange={v => { setFilterDeptCode(v); setCurrentPage(1); }}
                                placeholder={isLocalAdmin ? "All my depts" : "All departments"}
                                options={isLocalAdmin
                                    ? filteredDepts.map(d => ({ value: d.shortCode, label: `${d.name} (${d.shortCode})` }))
                                    : hoDeptOptions} />
                        </div>
                    )}

                    {/* RO Code — RO/TE only */}
                    {(filterOfficeType === 'RO' || filterOfficeType === 'TE') && roCodeOptions.length > 0 && (
                        <div className="flex min-w-[130px] flex-col gap-1">
                            <label className={filterLabelCls}>RO Code</label>
                            <CustomSelect value={filterRoCode} onChange={v => { setFilterRoCode(v); setCurrentPage(1); }}
                                placeholder="All RO codes" options={roCodeOptions} />
                        </div>
                    )}

                    {/* Grade */}
                    <div className="flex min-w-[150px] flex-col gap-1">
                        <label className={filterLabelCls}>Grade</label>
                        <CustomSelect value={filterGrade} onChange={v => { setFilterGrade(v); setCurrentPage(1); }}
                            placeholder="All grades" options={gradeOptions} />
                    </div>

                    {/* Count + Clear */}
                    <div className="ml-auto flex items-center gap-2 self-end">
                        {!loading && total != null && <span className="whitespace-nowrap text-body text-slate-500">
                            <span className="font-mono text-canopy">{total}</span> users
                        </span>}
                        {hasActiveFilters && (
                            <Button size="sm" variant="ghost" onClick={clearAllFilters}>
                                <X size={12} /> Clear all
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
                <DataTable
                    columns={columns}
                    rows={currentUsers}
                    rowKey={(u, i) => u.r_object_id || i}
                    loading={loading}
                    skeletonRows={pageSize}
                    sort={sortConfig.key ? { key: sortConfig.key, dir: sortConfig.direction } : null}
                    onSortChange={(next) => {
                        setSortConfig(next ? { key: next.key, direction: next.dir } : { key: '', direction: 'asc' });
                        setCurrentPage(1);
                    }}
                    empty={{
                        icon: Users,
                        title: 'No users found',
                        description: hasActiveFilters ? 'Try adjusting your filters.' : 'There are no user profiles to show.',
                    }}
                    className="px-1"
                />
                {(total == null ? currentUsers.length > 0 : total > 0) && (
                    <Pagination
                        page={currentPage}
                        pageSize={pageSize}
                        total={total}
                        hasNext={hasNext}
                        onPageChange={handlePageChange}
                        onPageSizeChange={(n) => { setPageSize(n); setCurrentPage(1); }}
                        pageSizes={PROFILE_PAGE_SIZES}
                        loading={loading}
                    />
                )}
            </div>

            <EditUserProfileModal
                user={selectedUser}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onUpdate={handleRefreshUsers}
            />
        </div>
    );
};

// ─── Create User Tab (3-step wizard) ─────────────────────────────────────────
const SOURCE_OPTIONS = [
    { value: 'OTDS',             label: 'OTDS',             description: 'OpenText Directory Services' },
];

const USER_GRADE_OPTIONS = [
    { value: '', label: '— Select grade —', level: '' },
    ...USER_GRADES.map(g => ({ value: g.value, label: g.label, level: g.gradeLevel })),
];

const STATE_OPTIONS = [
    { value: 0, label: 'Active' },
    { value: 1, label: 'Inactive' },
];

const EMPTY_FORM = {
    user_name: '', user_login_name: '', user_address: '', description: '',
    user_source: 'OTDS', user_password: '', user_os_name: '', user_db_name: '',
    user_global_unique_id: '', default_folder: '', home_docbase: '', acl_name: '',
    user_privileges: 4, user_state: 0,
    // OTDS-specific (only used when user_source === 'OTDS')
    otds_password: '', otds_confirm_pw: '', otds_partition: 'DCTMPartitions', otds_no_reset: true,
    // Step 4 — cms_user_profile fields
    profile_designation: '', profile_hindi_designation: '', profile_uin: '', profile_location: '',
    profile_hindi_user_name: '',
    profile_office_type: '', profile_ro_short_code: '', profile_is_active: true,
    profile_user_grade: '', profile_grade_level: '', profile_department_name: '',
    profile_department_short_code: '',
    profile_department_names: [],
    profile_department_short_code_multi: [],
};

const SelectField = ({ value, onChange, options, className = '' }) => (
    <CustomSelect
        value={value}
        onChange={onChange}
        className={className}
        options={options.map(opt => ({
            value: opt.value,
            label: opt.description ? `${opt.label} — ${opt.description}` : opt.label,
            disabled: opt.disabled,
        }))}
    />
);

const FormField = ({ label, icon: Icon, required, error, hint, children }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
                <Icon size={14} className="text-slate-400" />
                {label}
                {required && <span className="text-danger/70">*</span>}
                {!required && <span className="text-xs font-normal text-slate-400">(optional)</span>}
            </span>
        </label>
        {children}
        {error && <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
);

const inputCls = (hasError) =>
    `w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy ${
        hasError ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;


// ─── Stepper indicator ───────────────────────────────────────────────────────
const STEPS = [
    { num: 1, label: 'Identity',       sub: 'Name & login'              },
    { num: 2, label: 'Authentication', sub: 'Credentials & repository'  },
    { num: 3, label: 'Profile',        sub: 'Role & department'         },
];

const StepIndicator = ({ step }) => (
    <div className="flex items-center justify-start gap-0 mb-8">
        {STEPS.map((s, i) => {
            const done    = step > s.num;
            const active  = step === s.num;
            return (
                <div key={s.num} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                            done   ? 'bg-canopy border-canopy text-white' :
                            active ? 'bg-white border-canopy text-canopy' :
                                     'bg-white border-slate-200 text-slate-400'
                        }`}>
                            {done ? <CheckCircle2 size={16} /> : s.num}
                        </div>
                        <div className="mt-1.5 text-center">
                            <div className={`text-xs font-semibold ${active ? 'text-canopy' : done ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</div>
                            <div className="text-xs text-slate-400">{s.sub}</div>
                        </div>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`h-px w-16 sm:w-24 mx-2 mb-6 transition-all duration-300 ${step > s.num ? 'bg-canopy' : 'bg-slate-200'}`} />
                    )}
                </div>
            );
        })}
    </div>
);

// ─── Inline source+password block ────────────────────────────────────────────
const SourcePasswordBlock = ({ form, handleChange, showPassword, setShowPassword,
                               showOtdsConfirm, setShowOtdsConfirm, errors }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
                <Globe size={14} className="text-slate-400" />
                User Source
                <span className="text-danger/70">*</span>
            </span>
        </label>
        <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy transition-all">
            <div className="flex items-center bg-white">
                <div className="relative flex-1">
                    <select
                        value={form.user_source}
                        onChange={e => { handleChange('user_source', e.target.value); handleChange('user_password', ''); handleChange('otds_password', ''); handleChange('otds_confirm_pw', ''); setShowPassword(false); }}
                        className="w-full px-4 py-2.5 text-sm bg-transparent appearance-none pr-10 cursor-pointer focus:outline-none"
                    >
                        {SOURCE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                <div className="px-3 shrink-0">
                    {form.user_source === 'OTDS' && <span className="px-2 py-0.5 bg-canopy-tint text-canopy text-xs font-semibold rounded-full">OTDS</span>}
                    {form.user_source === 'inline password' && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">Inline Password</span>}
                </div>
            </div>
            {form.user_source === 'inline password' ? (
                /* Inline Password — password field */
                <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <Lock size={13} className="text-slate-400 shrink-0" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.user_password}
                            onChange={e => handleChange('user_password', e.target.value)}
                            placeholder="Set a password"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                            tabIndex={-1} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {errors?.user_password && <p className="text-xs text-danger mt-1 ml-5">{errors.user_password}</p>}
                </div>
            ) : form.user_source === 'OTDS' ? (
                /* OTDS — initial password, confirm, partition, no-reset checkbox */
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    {/* Password */}
                    <div>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy transition-all">
                            <Key size={13} className="text-slate-400 shrink-0" />
                            <input type={showPassword ? 'text' : 'password'} value={form.otds_password}
                                onChange={e => handleChange('otds_password', e.target.value)}
                                placeholder="Initial OTDS password"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                            <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {errors?.otds_password && <p className="text-xs text-danger mt-1">{errors.otds_password}</p>}
                    </div>
                    {/* Confirm Password */}
                    <div>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy transition-all">
                            <Key size={13} className="text-slate-400 shrink-0" />
                            <input type={showOtdsConfirm ? 'text' : 'password'} value={form.otds_confirm_pw}
                                onChange={e => handleChange('otds_confirm_pw', e.target.value)}
                                placeholder="Confirm OTDS password"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                            <button type="button" onClick={() => setShowOtdsConfirm(p => !p)} tabIndex={-1}
                                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                                {showOtdsConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {errors?.otds_confirm_pw && <p className="text-xs text-danger mt-1">{errors.otds_confirm_pw}</p>}
                    </div>
                    {/* Partition */}
                    <div>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 transition-all">
                            <Database size={13} className="text-slate-400 shrink-0" />
                            <input type="text" value={form.otds_partition}
                                readOnly
                                className="flex-1 bg-transparent text-sm outline-none text-slate-500 cursor-not-allowed" />
                        </div>
                        {errors?.otds_partition && <p className="text-xs text-danger mt-1">{errors.otds_partition}</p>}
                    </div>
                    {/* No-reset always true — hidden */}
                </div>
            ) : null}
        </div>
    </div>
);

// ─── Main wizard component ────────────────────────────────────────────────────
const UserCreateTab = ({ onToast }) => {
    const [step, setStep]               = useState(1);
    const [form, setForm]               = useState(EMPTY_FORM);
    const [errors, setErrors]           = useState({});
    const [submitting, setSubmitting]     = useState(false);
    const [showPassword, setShowPassword]   = useState(false);
    const [showOtdsConfirm, setShowOtdsConfirm] = useState(false);
    const [profileOpen, setProfileOpen]     = useState(false);
    const [repoName, setRepoName]         = useState('');
    // Track which Hindi fields have been manually edited so auto-fill doesn't overwrite them
    const hindiTouched = useRef({ profile_hindi_user_name: false, profile_hindi_designation: false });
    const [checkingUin, setCheckingUin] = useState(false);

    const checkUinExists = async (uin) => {
        const val = uin.trim();
        if (!val) return;
        setCheckingUin(true);
        try {
            const res = await api.get('/users/check-uin', { params: { uin: val } });
            if (res.data?.exists) {
                setErrors(e => ({ ...e, profile_uin: `UIN already exists (${res.data.userName})` }));
            }
        } catch { /* ignore */ }
        finally { setCheckingUin(false); }
    };

    // Fetch repository name from backend and auto-set home_docbase
    useEffect(() => {
        api.get('/auth/current-user').then(res => {
            const repo = res.data?.repository || '';
            setRepoName(repo);
            setForm(f => ({ ...f, home_docbase: repo }));
        }).catch(() => {});
    }, []);

    const handleChange = (field, value) => {
        if (field === 'profile_hindi_user_name' || field === 'profile_hindi_designation') {
            hindiTouched.current[field] = true;
        }
        setForm(f => {
            const updated = { ...f, [field]: value };
            // Auto-populate user_address from user_login_name
            if (field === 'user_login_name') {
                const login = value.trim();
                updated.user_address = login ? `${login}@nabard.org` : '';
            }
            return updated;
        });
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
        if (field === 'user_login_name' && errors.user_address) setErrors(e => ({ ...e, user_address: undefined }));
    };

    // Debounced transliteration: user_name → profile_hindi_user_name
    useEffect(() => {
        if (hindiTouched.current.profile_hindi_user_name) return;
        if (!form.user_name.trim()) {
            setForm(f => ({ ...f, profile_hindi_user_name: '' }));
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await api.get(`/transliterate?text=${encodeURIComponent(form.user_name.trim())}`);
                if (!hindiTouched.current.profile_hindi_user_name && res.data?.result) {
                    setForm(f => ({ ...f, profile_hindi_user_name: res.data.result }));
                }
            } catch { /* silent — user can fill manually */ }
        }, 500);
        return () => clearTimeout(timer);
    }, [form.user_name]);

    // Auto-populate Hindi designation from lookup when designation changes
    useEffect(() => {
        if (hindiTouched.current.profile_hindi_designation) return;
        const opt = DESIGNATION_OPTIONS.find(d => d.value === form.profile_designation);
        setForm(f => ({ ...f, profile_hindi_designation: opt?.hindi || '' }));
    }, [form.profile_designation]);

    const validatePassword = (pw) => {
        if (!pw) return 'Password is required';
        if (pw.length < 16) return 'Password must be at least 16 characters';
        if (pw.length > 64) return 'Password must not exceed 64 characters';
        if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
        if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
        if (!/[0-9]/.test(pw)) return 'Password must contain at least one numeric digit';
        if (!/[@|_\-]/.test(pw)) return 'Password must contain at least one special character (@ | _ -)';
        return null;
    };

    const validateStep = (s) => {
        const e = {};
        if (s === 1) {
            if (!form.user_name.trim())       e.user_name       = 'User name is required';
            if (!form.user_login_name.trim()) e.user_login_name = 'Login name is required';
            if (!form.user_address.trim())    e.user_address    = 'User address is required';
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.user_address.trim()))
                e.user_address = 'Please enter a valid email address';
        }
        if (s === 2) {
            if (!form.home_docbase) e.home_docbase = 'Home Docbase is required';
            if (form.user_source === 'inline password') {
                const pwErr = validatePassword(form.user_password);
                if (pwErr) e.user_password = pwErr;
            }
            if (form.user_source === 'OTDS') {
                const pwErr = validatePassword(form.otds_password);
                if (pwErr) e.otds_password = pwErr;
                if (!e.otds_password && form.otds_password !== form.otds_confirm_pw)
                    e.otds_confirm_pw = 'Passwords do not match';
                if (!form.otds_partition.trim())
                    e.otds_partition = 'Partition name is required';
            }
        }
        if (s === 3) {
            if (!form.profile_designation.trim())           e.profile_designation           = 'Designation is required';
            if (!form.profile_hindi_designation.trim())     e.profile_hindi_designation     = 'Hindi designation is required';
            if (!form.profile_hindi_user_name.trim())       e.profile_hindi_user_name       = 'Hindi user name is required';
            if (!form.profile_uin.trim())                   e.profile_uin                   = 'UIN is required';
            else if (errors.profile_uin && errors.profile_uin.startsWith('UIN already'))
                                                            e.profile_uin                   = errors.profile_uin;
            if (!form.profile_user_grade)                   e.profile_user_grade            = 'User grade is required';
            if (form.profile_grade_level === '')            e.profile_grade_level           = 'Grade level is required';
        }
        return e;
    };

    const goNext = () => {
        const e = validateStep(step);
        if (Object.keys(e).length) { setErrors(e); return; }
        setErrors({});
        setStep(s => s + 1);
    };

    const goBack = () => { setErrors({}); setStep(s => s - 1); };

    const handleReset = () => {
        setForm(EMPTY_FORM);
        setErrors({});
        setStep(1);
        setShowPassword(false);
        setShowOtdsConfirm(false);
        hindiTouched.current = { profile_hindi_user_name: false, profile_hindi_designation: false };
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        // Build a clean payload — only Documentum fields, no OTDS-specific keys
        const loginName = form.user_login_name.trim();
        const payload = {
            user_name:            form.user_name.trim(),
            user_login_name:      loginName,
            user_address:         form.user_address.trim(),
            user_source:          form.user_source,
            user_privileges:      Number(form.user_privileges),
            user_state:           Number(form.user_state),
            description:          form.description,
            user_os_name:         form.user_os_name,
            user_db_name:         form.user_db_name,
            user_global_unique_id:form.user_global_unique_id,
            default_folder:       form.default_folder,
            home_docbase:         form.home_docbase,
            acl_name:             form.acl_name,
            ...(form.user_source === 'inline password' && { user_password: form.user_password }),
            // Profile fields for office-type group assignment
            profile_office_type:              form.profile_office_type,
            profile_ro_short_code:            form.profile_ro_short_code,
            profile_department_short_code:    form.profile_department_short_code,
            profile_department_short_code_multi: form.profile_department_short_code_multi,
        };
        try {
            await api.post('/users', payload);

            if (form.user_source === 'inline password') {
                // Set the password via the existing update-password API after creation
                try {
                    const storedUsr = JSON.parse(localStorage.getItem('user') || '{}');
                    const adminUser = storedUsr.properties?.user_name || storedUsr.user_name || 'Admin';
                    await api.patch(`/users/${loginName}/inline-password`, { password: form.user_password, adminUser });
                    onToast({ type: 'success', message: `User "${form.user_name}" created successfully.` });
                } catch (pwErr) {
                    const pwMsg = pwErr.response?.data?.message || pwErr.message || 'Password update failed';
                    onToast({ type: 'error', message: `User created but password could not be set: ${pwMsg}` });
                }
            } else if (form.user_source === 'OTDS') {
                try {
                    await api.post('/users/otds/setup', {
                        loginName:             loginName,
                        displayName:           form.user_name.trim(),
                        email:                 form.user_address.trim(),
                        password:              form.otds_password,
                        partition:             form.otds_partition.trim(),
                        requirePasswordChange: !form.otds_no_reset,
                    });
                    onToast({ type: 'success', message: `User "${form.user_name}" created in Documentum and provisioned in OTDS.` });
                } catch (otdsErr) {
                    const otdsMsg = otdsErr.response?.data?.message || otdsErr.message || 'OTDS setup failed';
                    onToast({ type: 'error', message: `User created in Documentum but OTDS setup failed: ${otdsMsg}` });
                }
            } else {
                onToast({ type: 'success', message: `User "${form.user_name}" created successfully.` });
            }

            // Create cms_user_profile object for all user types
            try {
                await api.post('/users/profile', {
                    object_name:              form.user_name.trim(),
                    user_login_name:          loginName,
                    user_email_address:       form.user_address.trim(),
                    designation:              form.profile_designation.trim(),
                    hindi_designation:        form.profile_hindi_designation.trim(),
                    hindi_user_name:          form.profile_hindi_user_name.trim(),
                    uin:                      form.profile_uin.trim(),
                    location:                 form.profile_location.trim(),
                    office_type:              form.profile_office_type,
                    ro_short_code:            form.profile_ro_short_code.trim(),
                    is_active:                form.profile_is_active,
                    user_grade:               form.profile_user_grade.trim(),
                    grade_level:              Number(form.profile_grade_level),
                    department_name:          ['RO','TE'].includes(form.profile_office_type)
                                                  ? (form.profile_department_names[0] || '')
                                                  : form.profile_department_name.trim(),
                    department_short_code:    form.profile_department_short_code.trim(),
                    ...(['RO','TE'].includes(form.profile_office_type) && {
                        department_short_code_multi: form.profile_department_short_code_multi,
                    }),
                });
            } catch (profileErr) {
                const profileMsg = profileErr.response?.data?.message || profileErr.message || 'Profile creation failed';
                onToast({ type: 'error', message: `User created but profile setup failed: ${profileMsg}` });
            }

            handleReset();
        } catch (err) {
            const status = err.response?.status;
            const msg    = err.response?.data?.message || err.message || 'Failed to create user';

            // 409 — login name already exists: surface on the Login Name field at step 1
            if (status === 409 || msg.includes('E_CREATE_USER_EXIST') || msg.toLowerCase().includes('already exists')) {
                setErrors({ user_login_name: 'User Name already exists.' });
                setStep(1);
            } else {
                onToast({ type: 'error', message: msg });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="pb-6">
            <div className="w-full">

                    {/* Step indicator */}
                    <StepIndicator step={step} />

                    {/* Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* ── Step 1: Identity ── */}
                        {step === 1 && (
                            <>
                                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm shrink-0">
                                        <User size={17} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">User Identity</p>
                                        <p className="text-xs text-slate-500">Core identifiers for the dm_user object</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="User Name" icon={User} required error={errors.user_name}>
                                            <input autoFocus type="text" value={form.user_name}
                                                onChange={e => handleChange('user_name', e.target.value)}
                                                placeholder="e.g. John Doe"
                                                className={inputCls(errors.user_name)} />
                                        </FormField>
                                        <FormField label="Login Name" icon={Key} required error={errors.user_login_name}
                                            hint="Used to authenticate into Documentum">
                                            <input type="text" value={form.user_login_name}
                                                onChange={e => handleChange('user_login_name', e.target.value)}
                                                placeholder="e.g. john.doe"
                                                className={`${inputCls(errors.user_login_name)} font-mono`} />
                                        </FormField>
                                    </div>
                                    <FormField label="User Address" icon={Mail} required error={errors.user_address} hint="Auto-populated from Login Name">
                                        <input type="text" readOnly value={form.user_address}
                                            placeholder="e.g. john.doe@nabard.org"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-default font-mono" />
                                    </FormField>
                                </div>
                            </>
                        )}

                        {/* ── Step 2: Authentication & Repository ── */}
                        {step === 2 && (
                            <>
                                <div className="px-6 py-5 border-b border-slate-100 bg-canopy-tint/50 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm shrink-0">
                                        <Shield size={17} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Authentication & Repository</p>
                                        <p className="text-xs text-slate-500">Source, credentials, and repository settings</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <SourcePasswordBlock form={form} handleChange={handleChange}
                                        showPassword={showPassword} setShowPassword={setShowPassword}
                                        showOtdsConfirm={showOtdsConfirm} setShowOtdsConfirm={setShowOtdsConfirm}
                                        errors={errors} />
                                    {/* ── Repository settings ── */}
                                    <div className="border-t border-slate-100 pt-4 space-y-4">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Repository & Permissions</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                            <FormField label="Repository Name" icon={Globe} required error={errors.home_docbase}>
                                                <input type="text" value={repoName}
                                                    readOnly
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
                                            </FormField>
                                            {/* User Privileges — fixed at Create Group (4), hidden */}
                                            {/* User State — always Active (0), shown as disabled */}
                                            <FormField label="User State" icon={User} required hint="User can log in to the repository">
                                                <div className="relative">
                                                    <select disabled value={0}
                                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-10">
                                                        <option value={0}>Active</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                                                        <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Summary card */}
                                    <div className="mt-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Review dm_user Creation:</p>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                                            {[
                                                ['User Name',   form.user_name],
                                                ['Login Name',  form.user_login_name],
                                                ['Source',      SOURCE_OPTIONS.find(s => s.value === form.user_source)?.label || 'Local'],
                                                ['Privileges',  'Create Group (4)'],
                                                ['State',       'Active'],
                                                ['Address',     form.user_address || '—'],
                                            ].map(([k, v]) => (
                                                <div key={k} className="flex items-baseline gap-1.5 min-w-0">
                                                    <span className="text-slate-400 text-xs shrink-0">{k}:</span>
                                                    <span className="text-slate-700 font-medium truncate text-xs">{v || '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Step 3: User Profile ── */}
                        {step === 3 && (
                            <>
                                <div className="px-6 py-5 border-b border-slate-100 bg-canopy-tint/50 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-harvest flex items-center justify-center shadow-sm shrink-0">
                                        <Briefcase size={17} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">User Profile</p>
                                        <p className="text-xs text-slate-500">Role, department and organisational details</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <FormField label="Designation" icon={Briefcase} required error={errors.profile_designation}>
                                            <SelectField value={form.profile_designation}
                                                onChange={v => handleChange('profile_designation', v)}
                                                options={DESIGNATION_OPTIONS} />
                                        </FormField>
                                        <FormField label="Hindi Designation" icon={Briefcase} required error={errors.profile_hindi_designation}>
                                            <input type="text" value={form.profile_hindi_designation}
                                                onChange={e => handleChange('profile_hindi_designation', e.target.value)}
                                                className={inputCls(errors.profile_hindi_designation)} />
                                        </FormField>
                                        <FormField label="Hindi User Name" icon={User} required error={errors.profile_hindi_user_name}>
                                            <input type="text" value={form.profile_hindi_user_name}
                                                onChange={e => handleChange('profile_hindi_user_name', e.target.value)}
                                                className={inputCls(errors.profile_hindi_user_name)} />
                                        </FormField>
                                        <FormField label="UIN" icon={Hash} required error={errors.profile_uin}>
                                            <div className="relative">
                                                <input type="text" value={form.profile_uin}
                                                    onChange={e => handleChange('profile_uin', e.target.value)}
                                                    onBlur={e => checkUinExists(e.target.value)}
                                                    placeholder="e.g. 3405"
                                                    className={`${inputCls(errors.profile_uin)} font-mono`} />
                                                {checkingUin && (
                                                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                                                )}
                                            </div>
                                        </FormField>
                                        <FormField label="User Grade" icon={GraduationCap} required error={errors.profile_user_grade}>
                                            <SelectField value={form.profile_user_grade}
                                                onChange={v => {
                                                    handleChange('profile_user_grade', v);
                                                    const opt = USER_GRADE_OPTIONS.find(o => o.value === v);
                                                    handleChange('profile_grade_level', opt?.level ?? '');
                                                }}
                                                options={USER_GRADE_OPTIONS} />
                                        </FormField>
                                        <FormField label="Grade Level" icon={Hash} required error={errors.profile_grade_level}>
                                            <input type="number" min="0" readOnly
                                                value={form.profile_grade_level}
                                                className={`${inputCls(errors.profile_grade_level)} bg-slate-50 cursor-default`} />
                                        </FormField>
                                    </div>

                                    {/* ── Office & Department (hidden for now, may enable later) ── */}
                                    {false && <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <button type="button"
                                            onClick={() => setProfileOpen(o => !o)}
                                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                                <Building2 size={13} className="text-slate-400" />
                                                Office &amp; Department Details
                                            </span>
                                            <ChevronDown size={15} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {profileOpen && (
                                            <div className="p-4 space-y-4 border-t border-slate-200">
                                                <FormField label="Office Type" icon={Building2}>
                                                    <div className="relative">
                                                        <select disabled value={form.profile_office_type}
                                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-10">
                                                            <option value="">— Select office type —</option>
                                                            <option value="HO">HO — Head Office</option>
                                                            <option value="RO">RO — Regional Office</option>
                                                            <option value="TE">TE — Training Establishment</option>
                                                        </select>
                                                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                                                            <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </FormField>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label="Location" icon={MapPin}>
                                                        <input type="text" disabled value={form.profile_location}
                                                            placeholder="—"
                                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed" />
                                                    </FormField>
                                                    <FormField label="RO/TE Short Code" icon={Tag}>
                                                        <input type="text" disabled value={form.profile_ro_short_code}
                                                            placeholder="—"
                                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed font-mono" />
                                                    </FormField>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label="Department Name" icon={Layers}>
                                                        <input type="text" disabled
                                                            value={['RO','TE'].includes(form.profile_office_type)
                                                                ? form.profile_department_names.join(', ')
                                                                : form.profile_department_name}
                                                            placeholder="—"
                                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed" />
                                                    </FormField>
                                                    <FormField label="Department Short Code" icon={Tag}>
                                                        <input type="text" disabled
                                                            value={['RO','TE'].includes(form.profile_office_type)
                                                                ? form.profile_department_short_code_multi.join(',')
                                                                : form.profile_department_short_code}
                                                            placeholder="—"
                                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed font-mono" />
                                                    </FormField>
                                                </div>
                                            </div>
                                        )}
                                    </div>}
                                    {/* Active user — always true, hidden */}
                                </div>
                            </>
                        )}

                        {/* Footer nav */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={handleReset}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-all">
                                    Reset
                                </button>
                                {step > 1 && (
                                    <button type="button" onClick={goBack}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all">
                                        <ChevronLeft size={15} /> Back
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Step dots */}
                                <div className="flex gap-1 mr-2">
                                    {STEPS.map(s => (
                                        <div key={s.num} className={`w-1.5 h-1.5 rounded-full transition-all ${step === s.num ? 'bg-canopy w-4' : step > s.num ? 'bg-canopy opacity-40' : 'bg-slate-200'}`} />
                                    ))}
                                </div>
                                {step < 3 ? (
                                    <button type="button" onClick={goNext}
                                        className="flex items-center gap-1.5 px-5 py-2 bg-canopy hover:bg-canopy-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                                        Next <ChevronRight size={15} />
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleSubmit} disabled={submitting || checkingUin ||
                                        !form.profile_designation.trim() || !form.profile_hindi_designation.trim() ||
                                        !form.profile_hindi_user_name.trim() || !form.profile_uin.trim() ||
                                        !form.profile_user_grade || form.profile_grade_level === '' ||
                                        (errors.profile_uin && errors.profile_uin.startsWith('UIN already'))}
                                        className="flex items-center gap-2 px-6 py-2 bg-canopy hover:bg-canopy-dark active:bg-canopy-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                        {submitting
                                            ? <><Loader2 size={15} className="animate-spin" /> Creating...</>
                                            : <><UserPlus size={15} /> Create User</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
};

// ─── Update Password Tab ──────────────────────────────────────────────────────
const UpdatePasswordTab = ({ onToast }) => {
    const [searchQuery, setSearchQuery]         = useState('');
    const [allUsers, setAllUsers]               = useState([]);
    const [loadingUsers, setLoadingUsers]       = useState(false);
    const [showDropdown, setShowDropdown]       = useState(false);
    const [selectedUser, setSelectedUser]       = useState(null);
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew]                 = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [submitting, setSubmitting]           = useState(false);
    const [errors, setErrors]                   = useState({});

    // Fetch OTDS users once
    useEffect(() => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then(users => setAllUsers(users))
            .catch(() => setAllUsers([]))
            .finally(() => setLoadingUsers(false));
    }, []);

    const otdsUsers = useMemo(() =>
        allUsers.filter(u => u.user_login_name),
    [allUsers]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return otdsUsers.slice(0, 8);
        return otdsUsers.filter(u =>
            (u.object_name?.toLowerCase() || '').includes(q) ||
            (u.user_login_name?.toLowerCase() || '').includes(q)
        ).slice(0, 8);
    }, [otdsUsers, searchQuery]);

    const selectUser = (user) => {
        setSelectedUser(user);
        setSearchQuery(user.object_name || user.user_login_name);
        setShowDropdown(false);
        setErrors({});
    };

    const clearUser = () => {
        setSelectedUser(null);
        setSearchQuery('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
    };

    const validate = () => {
        const e = {};
        if (!selectedUser)             e.user = 'Please select a user';
        if (!newPassword)              e.newPassword = 'New password is required';
        else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
        if (!confirmPassword)          e.confirmPassword = 'Please confirm the password';
        else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSubmitting(true);
        try {
            const storedUsr = JSON.parse(localStorage.getItem('user') || '{}');
            const adminUser = storedUsr.properties?.user_name || storedUsr.user_name || 'Admin';
            await api.patch(`/users/${encodeURIComponent(selectedUser.user_login_name)}/password`, {
                password: newPassword,
                adminUser,
            });
            onToast({ type: 'success', message: `Password updated for "${selectedUser.object_name || selectedUser.user_login_name}".` });
            clearUser();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to update password';
            onToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const pwStrength = (pw) => {
        if (!pw) return null;
        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { label: 'Weak',   color: 'bg-danger/70',    text: 'text-danger',    bars: 1 };
        if (score <= 2) return { label: 'Fair',   color: 'bg-harvest/70',  text: 'text-harvest',  bars: 2 };
        if (score <= 3) return { label: 'Good',   color: 'bg-harvest/70', text: 'text-harvest', bars: 3 };
        if (score <= 4) return { label: 'Strong', color: 'bg-canopy/70',text: 'text-canopy',bars: 4 };
        return { label: 'Very Strong', color: 'bg-canopy', text: 'text-canopy', bars: 5 };
    };

    const strength = pwStrength(newPassword);

    return (
        <div className="pb-6">
            <div className="w-full">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 bg-canopy-tint/50 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-harvest flex items-center justify-center shadow-sm shrink-0">
                                <KeyRound size={17} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Update User Password</p>
                                <p className="text-xs text-slate-500">Change the Documentum password for a user account</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">

                            {/* User search */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <User size={14} className="text-slate-400" />
                                        Select User
                                        <span className="text-danger/70">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.user ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy`}>
                                    <Search size={15} className="ml-3 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); if (selectedUser) setSelectedUser(null); }}
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                                        placeholder={loadingUsers ? 'Loading users...' : 'Search by name or login name…'}
                                        className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {selectedUser && (
                                        <button type="button" onClick={clearUser} className="mr-2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                {errors.user && (
                                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{errors.user}</p>
                                )}

                                {/* Dropdown */}
                                {showDropdown && !selectedUser && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                        {filtered.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-400 text-center">No users found</div>
                                        ) : filtered.map((u, i) => (
                                            <button
                                                key={u.r_object_id || i}
                                                type="button"
                                                onMouseDown={() => selectUser(u)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-canopy-tint text-left transition-colors border-b border-slate-50 last:border-0"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-canopy/10 flex items-center justify-center shrink-0">
                                                    <User size={13} className="text-canopy" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{u.object_name || u.user_login_name}</p>
                                                    <p className="text-xs text-slate-500 font-mono truncate">{u.user_login_name}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected user card */}
                            {selectedUser && (
                                <div className="flex items-center gap-3 p-3 bg-canopy-tint border border-canopy/20 rounded-xl">
                                    <div className="w-9 h-9 rounded-full bg-canopy flex items-center justify-center shrink-0 text-white font-bold text-sm">
                                        {(selectedUser.object_name || selectedUser.user_login_name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800">{selectedUser.object_name}</p>
                                        <p className="text-xs text-slate-500 font-mono">{selectedUser.user_login_name}</p>
                                        {selectedUser.department_name && (
                                            <p className="text-xs text-slate-400">{selectedUser.department_name}</p>
                                        )}
                                    </div>
                                    <CheckCircle2 size={16} className="ml-auto text-canopy shrink-0" />
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-slate-100" />

                            {/* New / Confirm password — paired */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        New Password
                                        <span className="text-danger/70">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.newPassword ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy`}>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => { setNewPassword(e.target.value); if (errors.newPassword) setErrors(v => ({ ...v, newPassword: undefined })); }}
                                        placeholder="Enter new password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    <button type="button" onClick={() => setShowNew(p => !p)}
                                        className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {errors.newPassword && (
                                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{errors.newPassword}</p>
                                )}

                                {/* Strength meter */}
                                {newPassword && strength && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1,2,3,4,5].map(n => (
                                                <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength.bars ? strength.color : 'bg-slate-100'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-medium ${strength.text}`}>{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        Confirm Password
                                        <span className="text-danger/70">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.confirmPassword ? 'border-danger/40 bg-danger-tint' : confirmPassword && confirmPassword === newPassword ? 'border-canopy/40 bg-canopy-tint/30' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy`}>
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(v => ({ ...v, confirmPassword: undefined })); }}
                                        placeholder="Re-enter the password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {confirmPassword && confirmPassword === newPassword ? (
                                        <CheckCircle2 size={15} className="mr-3 text-canopy shrink-0" />
                                    ) : (
                                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                                            className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    )}
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{errors.confirmPassword}</p>
                                )}
                            </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={clearUser}
                                    className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                                    Clear
                                </button>
                                <button type="submit" disabled={submitting}
                                    className="flex items-center gap-2 px-6 py-2 bg-harvest hover:bg-harvest active:bg-harvest text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                    {submitting
                                        ? <><Loader2 size={15} className="animate-spin" /> Updating…</>
                                        : <><KeyRound size={15} /> Update Password</>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    );
};

// ─── Bulk Password Update Tab ─────────────────────────────────────────────────
const BulkPasswordTab = ({ onToast }) => {
    const [searchQuery, setSearchQuery]         = useState('');
    const [allUsers, setAllUsers]               = useState([]);
    const [loadingUsers, setLoadingUsers]       = useState(false);
    const [showDropdown, setShowDropdown]       = useState(false);
    const [selectedUsers, setSelectedUsers]     = useState([]);
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew]                 = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [errors, setErrors]                   = useState({});
    const [updating, setUpdating]               = useState(false);
    const [results, setResults]                 = useState([]);
    const dropdownRef                           = useRef(null);

    useEffect(() => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then(users => setAllUsers(users))
            .catch(() => setAllUsers([]))
            .finally(() => setLoadingUsers(false));
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDropdown]);

    const otdsUsers = useMemo(() => allUsers.filter(u => u.user_login_name), [allUsers]);

    const selectedIdSet = useMemo(() => new Set(selectedUsers.map(u => u.r_object_id)), [selectedUsers]);

    // ALL matching users — no limit (used by Add All checkbox)
    const filteredAll = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return otdsUsers;
        return otdsUsers.filter(u =>
            (u.object_name?.toLowerCase() || '').includes(q) ||
            (u.user_login_name?.toLowerCase() || '').includes(q)
        );
    }, [otdsUsers, searchQuery]);

    // Unselected users for display in dropdown list (capped at 100 for performance)
    const filtered = useMemo(() =>
        filteredAll.filter(u => !selectedIdSet.has(u.r_object_id)).slice(0, 100),
    [filteredAll, selectedIdSet]);

    const allChecked = filteredAll.length > 0 && filteredAll.every(u => selectedIdSet.has(u.r_object_id));
    const someChecked = !allChecked && filteredAll.some(u => selectedIdSet.has(u.r_object_id));

    const toggleAddAll = (checked) => {
        if (checked) {
            const toAdd = filteredAll.filter(u => !selectedIdSet.has(u.r_object_id));
            setSelectedUsers(prev => [...prev, ...toAdd]);
        } else {
            const ids = new Set(filteredAll.map(u => u.r_object_id));
            setSelectedUsers(prev => prev.filter(u => !ids.has(u.r_object_id)));
        }
        if (errors.users) setErrors(v => ({ ...v, users: undefined }));
    };

    const addUser = (user) => {
        setSelectedUsers(prev => [...prev, user]);
        // Keep dropdown open; clear search so next query is easy
        setSearchQuery('');
        if (errors.users) setErrors(v => ({ ...v, users: undefined }));
    };

    const removeUser = (userId) => setSelectedUsers(prev => prev.filter(u => u.r_object_id !== userId));

    const validate = () => {
        const e = {};
        if (selectedUsers.length === 0) e.users = 'Please select at least one user';
        if (!newPassword)               e.newPassword = 'New password is required';
        else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
        if (!confirmPassword)           e.confirmPassword = 'Please confirm the password';
        else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
        return e;
    };

    const handleUpdateAll = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setUpdating(true);
        setResults(selectedUsers.map(u => ({ user: u, status: 'pending', message: '' })));
        let successCount = 0;
        for (let i = 0; i < selectedUsers.length; i++) {
            const user = selectedUsers[i];
            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r));
            try {
                const storedUsr = JSON.parse(localStorage.getItem('user') || '{}');
                const adminUser = storedUsr.properties?.user_name || storedUsr.user_name || 'Admin';
                await api.patch(`/users/${encodeURIComponent(user.user_login_name)}/password`, { password: newPassword, adminUser });
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success' } : r));
                successCount++;
            } catch (err) {
                const msg = err.response?.data?.message || err.message || 'Failed';
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', message: msg } : r));
            }
        }
        setUpdating(false);
        const failCount = selectedUsers.length - successCount;
        if (failCount === 0) {
            onToast({ type: 'success', message: `Passwords updated for ${successCount} user${successCount > 1 ? 's' : ''}.` });
        } else {
            onToast({ type: 'error', message: `${successCount} succeeded, ${failCount} failed. See details below.` });
        }
    };

    const pwStrength = (pw) => {
        if (!pw) return null;
        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { label: 'Weak',        color: 'bg-danger/70',     text: 'text-danger',     bars: 1 };
        if (score <= 2) return { label: 'Fair',        color: 'bg-harvest/70',   text: 'text-harvest',   bars: 2 };
        if (score <= 3) return { label: 'Good',        color: 'bg-harvest/70',  text: 'text-harvest',  bars: 3 };
        if (score <= 4) return { label: 'Strong',      color: 'bg-canopy/70', text: 'text-canopy', bars: 4 };
        return             { label: 'Very Strong', color: 'bg-canopy', text: 'text-canopy', bars: 5 };
    };
    const strength = pwStrength(newPassword);

    const clearAll = () => {
        setSelectedUsers([]);
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
        setResults([]);
        setSearchQuery('');
    };

    const doneCount    = results.filter(r => r.status === 'success' || r.status === 'error').length;
    const successCount = results.filter(r => r.status === 'success').length;

    return (
        <div className="pb-6">
            <div className="w-full space-y-4">

                    {/* Main card */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 bg-canopy-tint/50 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm shrink-0">
                                <UserCog size={17} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Bulk Password Update</p>
                                <p className="text-xs text-slate-500">Update password for multiple users at once</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">

                            {/* User search */}
                            <div className="relative" ref={dropdownRef}>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Users size={14} className="text-slate-400" />
                                        Add Users
                                        <span className="text-danger/70">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.users ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy`}>
                                    <Search size={15} className="ml-3 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder={loadingUsers ? 'Loading users...' : 'Search and add users…'}
                                        className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {selectedUsers.length > 0 && (
                                        <span className="mr-3 px-2 py-0.5 bg-canopy-tint text-canopy text-xs font-semibold rounded-full shrink-0">
                                            {selectedUsers.length} added
                                        </span>
                                    )}
                                </div>
                                {errors.users && (
                                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{errors.users}</p>
                                )}

                                {/* Dropdown */}
                                {showDropdown && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-80">

                                        {/* Add All checkbox header */}
                                        <label className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={allChecked}
                                                ref={el => { if (el) el.indeterminate = someChecked; }}
                                                onChange={e => toggleAddAll(e.target.checked)}
                                                className="w-4 h-4 rounded accent-canopy cursor-pointer"
                                            />
                                            <span className="text-xs font-semibold text-slate-700">
                                                Add All
                                                <span className="ml-1.5 text-slate-400 font-normal">
                                                    ({filteredAll.length} {searchQuery ? 'matching' : 'users'})
                                                </span>
                                            </span>
                                        </label>

                                        {/* User list */}
                                        <div className="overflow-y-auto flex-1">
                                            {filtered.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-slate-400 text-center">
                                                    {allChecked ? 'All matching users added' : searchQuery ? 'No matching users' : 'All users already added'}
                                                </div>
                                            ) : filtered.map((u, i) => (
                                                <button
                                                    key={u.r_object_id || i}
                                                    type="button"
                                                    onClick={() => addUser(u)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-canopy-tint text-left transition-colors border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-canopy/10 flex items-center justify-center shrink-0">
                                                        <User size={13} className="text-canopy" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{u.object_name || u.user_login_name}</p>
                                                        <p className="text-xs text-slate-500 font-mono truncate">{u.user_login_name}</p>
                                                    </div>
                                                    <span className="text-xs text-canopy font-semibold shrink-0">+ Add</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Done button footer */}
                                        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                            <span className="text-xs text-slate-500">
                                                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowDropdown(false)}
                                                className="px-4 py-1.5 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-colors">
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected users chips */}
                            {selectedUsers.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-slate-600">
                                            {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                                        </p>
                                        <button type="button" onClick={() => setSelectedUsers([])}
                                            className="text-xs text-slate-400 hover:text-danger transition-colors">
                                            Remove all
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedUsers.map(u => (
                                            <div key={u.r_object_id}
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-canopy-tint border border-canopy/20 rounded-lg text-xs font-medium text-canopy">
                                                <span>{u.object_name || u.user_login_name}</span>
                                                <button type="button" onClick={() => removeUser(u.r_object_id)}
                                                    className="text-canopy/70 hover:text-danger transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-slate-100" />

                            {/* New / Confirm password — paired */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        New Password
                                        <span className="text-danger/70">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.newPassword ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy`}>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => { setNewPassword(e.target.value); if (errors.newPassword) setErrors(v => ({ ...v, newPassword: undefined })); }}
                                        placeholder="Enter new password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    <button type="button" onClick={() => setShowNew(p => !p)}
                                        className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {errors.newPassword && (
                                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{errors.newPassword}</p>
                                )}
                                {newPassword && strength && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1,2,3,4,5].map(n => (
                                                <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength.bars ? strength.color : 'bg-slate-100'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-medium ${strength.text}`}>{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        Confirm Password
                                        <span className="text-danger/70">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.confirmPassword ? 'border-danger/40 bg-danger-tint' : confirmPassword && confirmPassword === newPassword ? 'border-canopy/40 bg-canopy-tint/30' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-canopy/20 focus-within:border-canopy`}>
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(v => ({ ...v, confirmPassword: undefined })); }}
                                        placeholder="Re-enter the password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {confirmPassword && confirmPassword === newPassword ? (
                                        <CheckCircle2 size={15} className="mr-3 text-canopy shrink-0" />
                                    ) : (
                                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                                            className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    )}
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{errors.confirmPassword}</p>
                                )}
                            </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-slate-400">
                                    {selectedUsers.length > 0 ? `Will update ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}` : 'No users selected'}
                                </p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={clearAll}
                                        className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                                        Clear All
                                    </button>
                                    <button type="button" onClick={handleUpdateAll}
                                        disabled={updating || selectedUsers.length === 0}
                                        className="flex items-center gap-2 px-6 py-2 bg-canopy hover:bg-canopy active:bg-canopy-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                        {updating
                                            ? <><Loader2 size={15} className="animate-spin" /> Updating…</>
                                            : <><KeyRound size={15} /> Update All{selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ''}</>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results card */}
                    {results.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Update Results</p>
                                    <p className="text-xs text-slate-500">
                                        {doneCount < results.length
                                            ? `Updating… ${doneCount} / ${results.length}`
                                            : `${successCount} of ${results.length} updated successfully`}
                                    </p>
                                </div>
                                {doneCount === results.length && (
                                    <div className={`text-xs font-semibold px-3 py-1 rounded-full ${successCount === results.length ? 'bg-canopy-tint text-canopy' : 'bg-harvest/10 text-harvest'}`}>
                                        {successCount === results.length ? 'All done' : `${results.length - successCount} failed`}
                                    </div>
                                )}
                            </div>
                            <div className="divide-y divide-slate-50">
                                {results.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3 px-6 py-3">
                                        <div className="shrink-0">
                                            {r.status === 'pending'    && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                                            {r.status === 'processing' && <Loader2 size={16} className="animate-spin text-canopy" />}
                                            {r.status === 'success'    && <CheckCircle2 size={16} className="text-canopy" />}
                                            {r.status === 'error'      && <AlertCircle size={16} className="text-danger" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-800 truncate">{r.user.object_name || r.user.user_login_name}</p>
                                            <p className="text-xs text-slate-500 font-mono truncate">{r.user.user_login_name}</p>
                                        </div>
                                        <div className="text-xs font-medium shrink-0">
                                            {r.status === 'pending'    && <span className="text-slate-400">Waiting…</span>}
                                            {r.status === 'processing' && <span className="text-canopy">Updating…</span>}
                                            {r.status === 'success'    && <span className="text-canopy">Updated</span>}
                                            {r.status === 'error'      && <span className="text-danger" title={r.message}>Failed — {r.message?.slice(0, 40)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
    );
};

// ─── Update Password (merged Single / Multiple) ───────────────────────────────
const PasswordTab = ({ onToast }) => {
    const [mode, setMode] = useState('single');
    return (
        <div className="flex flex-col">
            {/* Sub-nav */}
            <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
                {[
                    { id: 'single',   label: 'Single User',   icon: User    },
                    { id: 'multiple', label: 'Multiple User', icon: UserCog },
                ].map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setMode(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                            mode === id
                                ? 'border-canopy text-canopy'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}>
                        <Icon size={16} />{label}
                    </button>
                ))}
            </div>
            {mode === 'single'   && <UpdatePasswordTab onToast={onToast} />}
            {mode === 'multiple' && <BulkPasswordTab   onToast={onToast} />}
        </div>
    );
};

// ─── User Access Tab ─────────────────────────────────────────────────────────
const UserAccessTab = ({ onToast }) => {
    const [officeType,    setOfficeType]    = useState('');
    const [users,         setUsers]         = useState([]);
    const [loading,       setLoading]       = useState(false);
    const [searchQuery,   setSearchQuery]   = useState('');
    const [currentPage,   setCurrentPage]   = useState(1);
    const [actionInProgress, setActionInProgress] = useState(null); // {user, action} with pending action
    const [localAdmins,   setLocalAdmins]   = useState(new Set()); // set of object_names in ecm_local_admin
    const fetchIdRef = useRef(0); // guard against stale fetches
    const [cgmSects,      setCgmSects]      = useState(new Set()); // set of object_names in cgm_sec groups
    const [loadingCgm,    setLoadingCgm]    = useState(false);
    const [exportOpen,    setExportOpen]    = useState(false);     // export dropdown visibility
    const [exportingRole, setExportingRole] = useState(null);      // 'localAdmin' | 'cgmSect' while fetching
    const exportRef = useRef(null);
    const PAGE_SIZE = 15;

    // Close export dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Local Admin role & profile context ──────────────────────────────────
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx]           = useState(null);
    const [profileLocation, setProfileLocation] = useState('');
    const [allDepartments, setAllDepartments]   = useState([]);

    // ─── Super Admin filters (location + department) ─────────────────────────
    const [filterLocation,   setFilterLocation]   = useState('');
    const [filterDeptName,   setFilterDeptName]    = useState('');
    const [filterDepartments, setFilterDepartments] = useState([]);
    const [roleFilter,       setRoleFilter]        = useState('');  // '', 'localAdmin', 'cgmSect'

    // Locations list based on chosen office type
    const filterLocations = useMemo(() => getLocations(officeType), [officeType]);
    const isRoTe = officeType === 'RO' || officeType === 'TE';

    // Fetch departments when office type or location changes (for Super Admin filter)
    useEffect(() => {
        if (isLocalAdmin) return;
        if (!officeType) { setFilterDepartments([]); return; }
        if (isRoTe && !filterLocation) { setFilterDepartments([]); return; }
        const loc = isRoTe ? filterLocation : '';
        fetchDepartments(officeType, loc).then(setFilterDepartments);
    }, [isLocalAdmin, officeType, filterLocation]);
    // ─── End Super Admin filters ─────────────────────────────────────────────

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const ot  = ctx.office_type || '';
                const loc = ctx.location    || '';
                if (ot) setOfficeType(ot);
                if (loc) setProfileLocation(loc);
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    useEffect(() => {
        if (!isLocalAdmin || !officeType) return;
        if (isRoTe && !profileLocation) return;
        fetchDepartments(officeType, profileLocation).then(setAllDepartments);
    }, [isLocalAdmin, officeType, profileLocation]);

    const departments = isLocalAdmin && profileCtx
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            return allDepartments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
          })()
        : allDepartments;

    const localAdminDeptNames = isLocalAdmin && officeType === 'HO' && departments.length > 0
        ? departments.map(d => d.name).join(',')
        : '';
    // ─── End Local Admin ─────────────────────────────────────────────────────

    // Fetch ecm_local_admin group members on mount
    useEffect(() => {
        api.get('/groups/ecm_local_admin/members')
            .then(res => {
                const members = res.data?.users || [];
                setLocalAdmins(new Set(members.map(m => m.name)));
            })
            .catch(() => {}); // non-fatal — just won't show badge
    }, []);

    // Fetch cgm_sec group members when users load — derive group names from user profiles
    useEffect(() => {
        if (users.length === 0) { setCgmSects(new Set()); setLoadingCgm(false); return; }
        const groupNames = new Set();
        for (const u of users) {
            const ot = (u.office_type || '').toUpperCase();
            if (ot === 'HO') {
                const dsc = (u.department_short_code || '').toLowerCase();
                if (dsc) groupNames.add(`ecm_ho_${dsc}_cgm_sec`);
            } else if (ot === 'RO' || ot === 'TE') {
                const rsc = (u.ro_short_code || '').toLowerCase();
                if (rsc) groupNames.add(`ecm_${rsc}_cgm_sec`);
            }
        }
        if (groupNames.size === 0) { setCgmSects(new Set()); setLoadingCgm(false); return; }
        setLoadingCgm(true);
        Promise.allSettled(
            [...groupNames].map(g => api.get(`/groups/${g}/members`))
        ).then(results => {
            const allMembers = new Set();
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    for (const m of (r.value.data?.users || [])) {
                        allMembers.add(m.name);
                    }
                }
            }
            setCgmSects(allMembers);
            setLoadingCgm(false);
        });
    }, [users]);

    const fetchUsersByOfficeType = async (ot, loc, deptNamesParam) => {
        const myFetchId = ++fetchIdRef.current;
        setLoading(true);
        setUsers([]);
        setSearchQuery('');
        setCurrentPage(1);
        try {
            const PAGE = 2000;
            let page = 1;
            let all  = [];
            while (true) {
                const params = { page, size: PAGE, officeTypeFilter: ot };
                if (loc)            params.locationFilter = loc;
                if (deptNamesParam) params.deptNames      = deptNamesParam;
                const res = await api.get('/users/profiles', { params });
                if (fetchIdRef.current !== myFetchId) return; // stale — discard
                all = all.concat(res.data.users || []);
                if (!res.data.hasNext) break;
                page++;
            }
            if (fetchIdRef.current !== myFetchId) return;
            setUsers(all);
        } catch {
            if (fetchIdRef.current !== myFetchId) return;
            onToast({ type: 'error', message: 'Failed to load users.' });
        } finally {
            if (fetchIdRef.current === myFetchId) setLoading(false);
        }
    };

    // Auto-fetch for Local Admin once profile context is ready
    useEffect(() => {
        if (!isLocalAdmin) return;
        if (!profileCtx || !officeType) return;
        if (officeType === 'HO') {
            if (!localAdminDeptNames) return;
            fetchUsersByOfficeType(officeType, '', localAdminDeptNames);
        } else {
            if (!profileLocation) return;
            fetchUsersByOfficeType(officeType, profileLocation, '');
        }
    }, [isLocalAdmin, profileCtx, officeType, profileLocation, localAdminDeptNames]);

    const handleOfficeTypeChange = (ot) => {
        setOfficeType(ot);
        setFilterLocation('');
        setFilterDeptName('');
        setFilterDepartments([]);
        if (ot) fetchUsersByOfficeType(ot, '', '');
        else { setUsers([]); setSearchQuery(''); setCurrentPage(1); }
    };

    const handleLocationChange = (loc) => {
        setFilterLocation(loc);
        setFilterDeptName('');
        if (officeType && loc) {
            fetchUsersByOfficeType(officeType, loc, '');
        } else if (officeType) {
            fetchUsersByOfficeType(officeType, '', '');
        }
    };

    const handleDeptChange = (deptName) => {
        setFilterDeptName(deptName);
        const loc = isRoTe ? filterLocation : '';
        if (officeType) {
            fetchUsersByOfficeType(officeType, loc, deptName || '');
        }
    };

    const handleMarkLocalAdmin = async (user) => {
        setActionInProgress({ user: user.object_name, action: 'markAdmin' });
        try {
            await api.post('/groups/ecm_local_admin/members', {
                memberName: user.object_name,   // Documentum users_names stores object_name
                memberType: 'user',
            });
            setLocalAdmins(prev => new Set([...prev, user.object_name]));
            onToast({ type: 'success', message: `'${user.object_name}' marked as Local Admin.` });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to mark as Local Admin.';
            onToast({ type: 'error', message: msg });
        } finally {
            setActionInProgress(null);
        }
    };

    const handleRemoveLocalAdmin = async (user) => {
        setActionInProgress({ user: user.object_name, action: 'removeAdmin' });
        try {
            await api.delete(`/groups/ecm_local_admin/members/${encodeURIComponent(user.object_name)}`, {
                params: { memberType: 'user' },
            });
            setLocalAdmins(prev => { const s = new Set(prev); s.delete(user.object_name); return s; });
            onToast({ type: 'success', message: `Local Admin removed from '${user.object_name}'.` });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to remove Local Admin.';
            onToast({ type: 'error', message: msg });
        } finally {
            setActionInProgress(null);
        }
    };

    // CGM Sect. — derive group names based on user's office type
    const getCgmSecGroups = (user) => {
        const ot  = (user.office_type || '').toUpperCase();
        const dsc = (user.department_short_code || '').toLowerCase();
        const rsc = (user.ro_short_code || '').toLowerCase();
        if (ot === 'HO' && dsc) {
            return [`ecm_ho_${dsc}_cgm_sec`, `ecm_digidak_ho_${dsc}_cgm_ps`];
        } else if ((ot === 'RO' || ot === 'TE') && rsc) {
            return [`ecm_${rsc}_cgm_sec`, `ecm_digidak_ro_${rsc}_cgm_ps`];
        }
        return [];
    };

    const handleMarkCGMSect = async (user) => {
        const groups = getCgmSecGroups(user);
        if (groups.length === 0) {
            onToast({ type: 'error', message: 'Cannot determine CGM Sect. groups for this user.' });
            return;
        }
        setActionInProgress({ user: user.object_name, action: 'markCgm' });
        try {
            await Promise.all(groups.map(g =>
                api.post(`/groups/${g}/members`, { memberName: user.object_name, memberType: 'user' })
            ));
            setCgmSects(prev => new Set([...prev, user.object_name]));
            onToast({ type: 'success', message: `'${user.object_name}' marked as CGM Sect.` });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to mark as CGM Sect.';
            onToast({ type: 'error', message: msg });
        } finally {
            setActionInProgress(null);
        }
    };

    const handleRemoveCGMSect = async (user) => {
        const groups = getCgmSecGroups(user);
        if (groups.length === 0) {
            onToast({ type: 'error', message: 'Cannot determine CGM Sect. groups for this user.' });
            return;
        }
        setActionInProgress({ user: user.object_name, action: 'removeCgm' });
        try {
            await Promise.all(groups.map(g =>
                api.delete(`/groups/${g}/members/${encodeURIComponent(user.object_name)}`, {
                    params: { memberType: 'user' },
                })
            ));
            setCgmSects(prev => { const s = new Set(prev); s.delete(user.object_name); return s; });
            onToast({ type: 'success', message: `CGM Sect. removed from '${user.object_name}'.` });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to remove CGM Sect.';
            onToast({ type: 'error', message: msg });
        } finally {
            setActionInProgress(null);
        }
    };

    const filtered = users.filter(u => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (u.object_name || '').toLowerCase().includes(q)
            || (u.user_login_name || '').toLowerCase().includes(q)
            || (u.designation || '').toLowerCase().includes(q)
            || (Array.isArray(u.department_short_code_multi) && u.department_short_code_multi.some(d => (d || '').toLowerCase().includes(q)))
            || (u.location || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (roleFilter === 'localAdmin') return localAdmins.has(u.object_name);
        if (roleFilter === 'cgmSect')    return cgmSects.has(u.object_name);
        return true;
    });

    const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged        = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const start        = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end          = Math.min(currentPage * PAGE_SIZE, filtered.length);

    const csvEscape = (val) => {
        const s = String(val ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const downloadCsv = (headers, rows, filename) => {
        const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        const headers = ['Name', 'Login', 'Designation', isRoTe ? 'Location' : 'Department', 'Local Admin', 'CGM Sect.'];
        const rows = filtered.map(u => [
            u.object_name || '',
            u.user_login_name || '',
            u.designation || '',
            (isRoTe ? u.location : u.department_name) || '',
            localAdmins.has(u.object_name) ? 'Yes' : 'No',
            cgmSects.has(u.object_name) ? 'Yes' : 'No',
        ]);
        const roleSuffix = roleFilter ? `_${roleFilter}` : '';
        const locSuffix = filterLocation ? `_${filterLocation}` : '';
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadCsv(headers, rows, `user-access_${officeType}${locSuffix}${roleSuffix}_${dateStr}.csv`);
    };

    // One row per department (HO) or per location (RO/TE); members stacked within each row
    const groupRoleMembers = (list) => {
        const groups = new Map();
        for (const u of list) {
            const ot = (u.office_type || '').toUpperCase() || '—';
            const groupName = (ot === 'HO' ? u.department_name : u.location) || '— Unspecified —';
            const key = `${ot}||${groupName}`;
            if (!groups.has(key)) groups.set(key, { officeType: ot, groupName, members: [] });
            groups.get(key).members.push(u);
        }
        for (const g of groups.values()) {
            g.members.sort((a, b) => (a.object_name || '').localeCompare(b.object_name || ''));
        }
        return [...groups.values()].sort(
            (a, b) => a.officeType.localeCompare(b.officeType) || a.groupName.localeCompare(b.groupName)
        );
    };

    const downloadGroupedXlsx = async (groups, filename) => {
        // Loaded on demand so the library is not part of the initial bundle
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        wb.created = new Date();

        const thin   = { style: 'thin', color: { argb: 'FF808080' } };
        const boxed  = { top: thin, left: thin, bottom: thin, right: thin };

        // One sheet per office type (HO, RO, TE), in that order
        const officeTypes = [...new Set(groups.map(g => g.officeType))].sort();

        for (const ot of officeTypes) {
            const ws = wb.addWorksheet(ot === '—' ? 'Other' : ot);
            ws.columns = [
                { header: ot === 'HO' ? 'Department' : 'Location', key: 'groupName', width: 46 },
                { header: 'Name',                                  key: 'names',     width: 40 },
            ];

            const headerRow = ws.getRow(1);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: 'middle' };
            headerRow.height = 20;
            headerRow.eachCell(cell => { cell.border = boxed; });

            for (const g of groups.filter(g => g.officeType === ot)) {
                ws.addRow({
                    groupName: g.groupName,
                    // One member per line within the cell
                    names:     g.members.map(m => m.object_name || '—').join('\n'),
                });
            }

            ws.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                row.alignment = { vertical: 'top', wrapText: true };
                row.eachCell(cell => { cell.border = boxed; });
            });

            ws.views = [{ state: 'frozen', ySplit: 1 }];
        }

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Export ALL members of a role group (Local Admin / CGM Sect.), independent of filters
    const handleExportRole = async (role) => {
        setExportOpen(false);
        setExportingRole(role);
        try {
            const PAGE = 500;
            let page = 1;
            let all  = [];
            while (true) {
                const res = await api.get('/users/role-members', { params: { role, page, size: PAGE } });
                all = all.concat(res.data.users || []);
                if (!res.data.hasNext) break;
                page++;
            }
            if (all.length === 0) {
                onToast({ type: 'error', message: 'No users found for this export.' });
                return;
            }
            const groups = groupRoleMembers(all);
            const label  = role === 'localAdmin' ? 'local-admins' : 'cgm-sect';
            await downloadGroupedXlsx(groups, `${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            const sheets = [...new Set(groups.map(g => g.officeType))].sort().join(', ');
            onToast({
                type: 'success',
                message: `Exported ${all.length} user${all.length !== 1 ? 's' : ''} across ${groups.length} groups (sheets: ${sheets}).`,
            });
        } catch {
            onToast({ type: 'error', message: 'Export failed. Please try again.' });
        } finally {
            setExportingRole(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden gap-4">
            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-end gap-4 flex-wrap">
                <div className="min-w-[180px]">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                        Office Type
                    </label>
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

                {/* Location filter — visible for RO/TE (Super Admin only) */}
                {!isLocalAdmin && isRoTe && (
                    <div className="min-w-[200px]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                            <MapPin size={11} className="inline -mt-0.5 mr-0.5" />
                            Location
                        </label>
                        <CustomSelect
                            value={filterLocation}
                            onChange={handleLocationChange}
                            placeholder="— All locations —"
                            options={filterLocations.map(l => ({ value: l.location, label: l.location }))}
                        />
                    </div>
                )}

                {/* Department filter — visible for HO always, for RO/TE once location is chosen (Super Admin only) */}
                {!isLocalAdmin && officeType && (officeType === 'HO' || filterLocation) && filterDepartments.length > 0 && (
                    <div className="min-w-[180px]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                            <Building2 size={11} className="inline -mt-0.5 mr-0.5" />
                            Department
                        </label>
                        <CustomSelect
                            value={filterDeptName}
                            onChange={handleDeptChange}
                            placeholder="— All departments —"
                            options={filterDepartments.map(d => ({ value: d.shortCode, label: d.name }))}
                        />
                    </div>
                )}

                {users.length > 0 && !isLocalAdmin && (
                    <div className="min-w-[160px]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                            <Shield size={11} className="inline -mt-0.5 mr-0.5" />
                            Role
                        </label>
                        <CustomSelect
                            value={roleFilter}
                            onChange={v => { setRoleFilter(v); setCurrentPage(1); }}
                            placeholder="— All users —"
                            options={[
                                { value: 'localAdmin', label: 'Local Admin' },
                                { value: 'cgmSect', label: 'CGM Sect.' },
                            ]}
                        />
                    </div>
                )}

                {users.length > 0 && (
                    <div className="flex-1 min-w-[220px]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                            Search
                        </label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                placeholder="Search by name, login, designation…"
                                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy"
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {users.length > 0 && !loading && (
                    <span className="text-xs text-slate-500 pb-2">
                        <span className="font-semibold text-slate-800">{filtered.length}</span> user{filtered.length !== 1 ? 's' : ''}
                    </span>
                )}

                {users.length > 0 && (
                    <div className="relative mb-0.5" ref={exportRef}>
                        <button
                            onClick={() => setExportOpen(o => !o)}
                            disabled={!!exportingRole}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-canopy border border-canopy/30 rounded-lg hover:bg-canopy-tint transition-colors disabled:opacity-60 disabled:cursor-wait"
                        >
                            {exportingRole
                                ? <><Loader2 size={13} className="animate-spin" /> Exporting…</>
                                : <><Download size={13} /> Export <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} /></>}
                        </button>
                        {exportOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-30 text-sm">
                                <button
                                    onClick={() => { setExportOpen(false); handleExport(); }}
                                    disabled={filtered.length === 0 || loading}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Download size={14} className="text-slate-400" /> Current view <span className="ml-auto text-[10px] text-slate-400">.csv</span>
                                </button>
                                {!isLocalAdmin && (
                                    <>
                                        <button
                                            onClick={() => handleExportRole('localAdmin')}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 border-t border-slate-100"
                                        >
                                            <Shield size={14} className="text-canopy" /> All Local Admins <span className="ml-auto text-[10px] text-slate-400">.xlsx</span>
                                        </button>
                                        <button
                                            onClick={() => handleExportRole('cgmSect')}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 border-t border-slate-100"
                                        >
                                            <Shield size={14} className="text-purple-600" /> All CGM Sect. <span className="ml-auto text-[10px] text-slate-400">.xlsx</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                {!officeType && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400 py-16">
                        <Shield size={36} strokeWidth={1.5} />
                        <p className="text-sm">Select an office type to view users</p>
                    </div>
                )}

                {officeType && loading && (
                    <div className="flex items-center justify-center flex-1 py-16">
                        <Loader2 size={24} className="animate-spin text-canopy" />
                    </div>
                )}

                {officeType && !loading && users.length === 0 && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400 py-16">
                        <Users size={36} strokeWidth={1.5} />
                        <p className="text-sm">No users found for {officeType}</p>
                    </div>
                )}

                {officeType && !loading && users.length > 0 && (
                    <>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-600 w-10 text-center">#</th>
                                        <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                                        <th className="px-4 py-3 font-semibold text-slate-600">Login</th>
                                        <th className="px-4 py-3 font-semibold text-slate-600">Designation</th>
                                        {!isRoTe && <th className="px-4 py-3 font-semibold text-slate-600">Department</th>}
                                        {isRoTe && <th className="px-4 py-3 font-semibold text-slate-600">Location</th>}
                                        {!isLocalAdmin && <th className="px-4 py-3 font-semibold text-slate-600 text-center">Local Admin</th>}
                                        <th className="px-4 py-3 font-semibold text-slate-600 text-center">CGM Sect.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paged.map((u, idx) => {
                                        const isAdmin    = localAdmins.has(u.object_name);
                                        const isCgmSect  = cgmSects.has(u.object_name);
                                        const adminInProgress = actionInProgress?.user === u.object_name && (actionInProgress?.action === 'markAdmin' || actionInProgress?.action === 'removeAdmin');
                                        const cgmInProgress   = actionInProgress?.user === u.object_name && (actionInProgress?.action === 'markCgm' || actionInProgress?.action === 'removeCgm');
                                        const inProgress      = actionInProgress?.user === u.object_name;
                                        return (
                                        <tr key={u.user_login_name || idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 text-center text-xs">
                                                {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    {u.object_name || '—'}
                                                    {isAdmin && (
                                                        <span className="px-1.5 py-0.5 text-xs bg-canopy-tint text-canopy rounded font-medium flex items-center gap-1">
                                                            <Shield size={10} /> Local Admin
                                                        </span>
                                                    )}
                                                    {isCgmSect && (
                                                        <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded font-medium flex items-center gap-1">
                                                            <Shield size={10} /> CGM Sect.
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{u.user_login_name || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{u.designation || '—'}</td>
                                            {!isRoTe && <td className="px-4 py-3 text-slate-600">{u.department_name || '—'}</td>}
                                            {isRoTe && <td className="px-4 py-3 text-slate-600">{u.location || '—'}</td>}
                                            {!isLocalAdmin && <td className="px-4 py-3 text-center">
                                                {isAdmin ? (
                                                    <button
                                                        onClick={() => handleRemoveLocalAdmin(u)}
                                                        disabled={inProgress}
                                                        title="Remove from Local Admin group"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-tint hover:bg-danger-tint text-danger border border-danger/20 text-xs font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mx-auto"
                                                    >
                                                        {adminInProgress
                                                            ? <><Loader2 size={12} className="animate-spin" /> Removing…</>
                                                            : <><X size={12} /> Remove Local Admin</>
                                                        }
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleMarkLocalAdmin(u)}
                                                        disabled={inProgress}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mx-auto"
                                                    >
                                                        {adminInProgress
                                                            ? <><Loader2 size={12} className="animate-spin" /> Marking…</>
                                                            : <><Shield size={12} /> Mark as Local Admin</>
                                                        }
                                                    </button>
                                                )}
                                            </td>}
                                            <td className="px-4 py-3 text-center">
                                                {loadingCgm ? (
                                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                                                        <Loader2 size={12} className="animate-spin" />
                                                    </div>
                                                ) : isCgmSect ? (
                                                    <button
                                                        onClick={() => handleRemoveCGMSect(u)}
                                                        disabled={inProgress}
                                                        title="Remove CGM Sect. groups"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-tint hover:bg-danger-tint text-danger border border-danger/20 text-xs font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mx-auto"
                                                    >
                                                        {cgmInProgress
                                                            ? <><Loader2 size={12} className="animate-spin" /> Removing…</>
                                                            : <><X size={12} /> Remove CGM Sect.</>
                                                        }
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleMarkCGMSect(u)}
                                                        disabled={inProgress}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mx-auto"
                                                    >
                                                        {cgmInProgress
                                                            ? <><Loader2 size={12} className="animate-spin" /> Marking…</>
                                                            : <><Shield size={12} /> Mark as CGM Sect.</>
                                                        }
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-white text-xs text-slate-500">
                                <span>Showing {start}–{end} of {filtered.length}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronLeft size={15} />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i-1] > 1) acc.push('…'); acc.push(p); return acc; }, [])
                                        .map((item, i) => item === '…'
                                            ? <span key={`e${i}`} className="px-1">…</span>
                                            : <button key={item} onClick={() => setCurrentPage(item)}
                                                className={`min-w-[28px] h-7 rounded-lg font-medium ${item === currentPage ? 'bg-canopy text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                                                {item}
                                              </button>
                                        )
                                    }
                                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronRight size={15} />
                                    </button>
                                </div>
                                <span>Page {currentPage} of {totalPages}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Alternate CGM Tab ───────────────────────────────────────────────────────
const AlternateCgmTab = ({ onToast }) => {
    const [users,            setUsers]            = useState([]);
    const [loading,          setLoading]          = useState(false);
    // Map<object_name, string[]> — dept codes each user is already Alt CGM for
    const [alternateCgmMap,  setAlternateCgmMap]  = useState(new Map());
    const [loadingAltCgm,    setLoadingAltCgm]    = useState(false);
    const [departments,      setDepartments]      = useState([]);
    const [searchQuery,      setSearchQuery]      = useState('');
    const [currentPage,      setCurrentPage]      = useState(1);
    // user being managed in the modal (null = closed)
    const [managingUser,     setManagingUser]     = useState(null);
    const [modalDeptSelect,  setModalDeptSelect]  = useState('');
    const [actionInProgress, setActionInProgress] = useState(null); // { user, action, deptCode }

    const PAGE_SIZE = 15;

    useEffect(() => {
        setLoading(true);
        fetchAllUsers('HO', '', '')
            .then(all => setUsers(all.filter(u => u.user_grade === 'grade_f')))
            .catch(() => onToast({ type: 'error', message: 'Failed to load users.' }))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchDepartments('HO').then(setDepartments).catch(() => {});
    }, []);

    // Once departments are loaded, fetch ALL alternate CGM groups to build the membership map
    useEffect(() => {
        if (!departments.length) return;
        setLoadingAltCgm(true);
        const groupEntries = departments
            .map(d => ({ deptCode: d.shortCode.toLowerCase(), groupName: `ecm_${d.shortCode.toLowerCase()}_alternate_cgm` }));
        Promise.allSettled(groupEntries.map(e => api.get(`/groups/${e.groupName}/members`)))
            .then(results => {
                const map = new Map();
                results.forEach((r, i) => {
                    if (r.status === 'fulfilled') {
                        const deptCode = groupEntries[i].deptCode;
                        (r.value.data?.users || []).forEach(m => {
                            if (!map.has(m.name)) map.set(m.name, []);
                            map.get(m.name).push(deptCode);
                        });
                    }
                });
                setAlternateCgmMap(map);
            })
            .finally(() => setLoadingAltCgm(false));
    }, [departments]);

    const handleAddAltCgm = async (user) => {
        const deptCode = modalDeptSelect.toLowerCase();
        if (!deptCode) { onToast({ type: 'error', message: 'Select a department first.' }); return; }
        const groupName = `ecm_${deptCode}_alternate_cgm`;
        setActionInProgress({ user: user.object_name, action: 'add', deptCode });
        try {
            await api.post(`/groups/${groupName}/members`, { memberName: user.object_name, memberType: 'user' });
            setAlternateCgmMap(prev => {
                const next = new Map(prev);
                const codes = next.get(user.object_name) ? [...next.get(user.object_name)] : [];
                if (!codes.includes(deptCode)) codes.push(deptCode);
                next.set(user.object_name, codes);
                return next;
            });
            setModalDeptSelect('');
            onToast({ type: 'success', message: `'${user.object_name}' added as Alternate CGM for ${deptCode.toUpperCase()}.` });
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || 'Failed to add to Alternate CGM.' });
        } finally { setActionInProgress(null); }
    };

    const handleRemoveAltCgm = async (user, deptCode) => {
        const groupName = `ecm_${deptCode}_alternate_cgm`;
        setActionInProgress({ user: user.object_name, action: 'remove', deptCode });
        try {
            await api.delete(`/groups/${groupName}/members/${encodeURIComponent(user.object_name)}`, { params: { memberType: 'user' } });
            setAlternateCgmMap(prev => {
                const next = new Map(prev);
                const codes = (next.get(user.object_name) || []).filter(c => c !== deptCode);
                if (codes.length > 0) next.set(user.object_name, codes);
                else next.delete(user.object_name);
                return next;
            });
            onToast({ type: 'success', message: `'${user.object_name}' removed from Alternate CGM for ${deptCode.toUpperCase()}.` });
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || 'Failed to remove from Alternate CGM.' });
        } finally { setActionInProgress(null); }
    };

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return users.filter(u =>
            !q || [u.object_name, u.user_login_name, u.uin, u.designation, u.department_name]
                .some(f => (f || '').toLowerCase().includes(q))
        );
    }, [users, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged      = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const rangeEnd   = Math.min(currentPage * PAGE_SIZE, filtered.length);

    return (
        <div className="flex-1 flex flex-col overflow-hidden gap-4">
            {/* Filters bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-end gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Search</label>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search by name, login, UIN, designation…"
                            className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy"
                        />
                        {searchQuery && (
                            <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
                {!loading && users.length > 0 && (
                    <span className="text-xs text-slate-500 pb-2">
                        <span className="font-semibold text-slate-800">{filtered.length}</span> user{filtered.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Manage Alt CGM Modal */}
            <Modal
                isOpen={!!managingUser}
                onClose={() => { setManagingUser(null); setModalDeptSelect(''); }}
                size="md"
                title={<span className="flex items-center gap-2"><Shield size={16} className="text-canopy" />Alternate CGM Departments</span>}
                footer={
                    <button onClick={() => { setManagingUser(null); setModalDeptSelect(''); }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                        Close
                    </button>
                }
            >
                {managingUser && (() => {
                    const u             = managingUser;
                    const assignedCodes  = alternateCgmMap.get(u.object_name) || [];
                    const availableDepts = departments.filter(d => !assignedCodes.includes(d.shortCode.toLowerCase()));
                    const inProgress    = actionInProgress?.user === u.object_name;
                    const addInProg     = inProgress && actionInProgress.action === 'add';
                    return (
                        <>
                            <p className="text-caption text-slate-500 mb-4">{u.object_name}</p>

                            {/* Existing assignments */}
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Current Assignments</p>
                                {assignedCodes.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic py-2">No alternate CGM departments assigned.</p>
                                ) : (
                                    <div className="space-y-2 max-h-52 overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
                                        {assignedCodes.map(code => {
                                            const deptObj = departments.find(d => d.shortCode.toLowerCase() === code);
                                            const isRemovingThis = inProgress && actionInProgress.action === 'remove' && actionInProgress.deptCode === code;
                                            return (
                                                <div key={code} className="flex items-center justify-between px-3 py-2 bg-harvest/10 border border-harvest/25 rounded-lg">
                                                    <div>
                                                        <span className="text-sm font-semibold text-harvest">{code.toUpperCase()}</span>
                                                        {deptObj && <span className="ml-2 text-xs text-harvest">{deptObj.name}</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveAltCgm(u, code)}
                                                        disabled={inProgress}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-danger bg-white border border-danger/20 hover:bg-danger-tint rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isRemovingThis ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                                                        {isRemovingThis ? 'Removing…' : 'Remove'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Add new department */}
                            {availableDepts.length > 0 && (
                                <div className="mt-4 border-t border-line pt-4">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Department</p>
                                    <div className="flex gap-2">
                                        <CustomSelect
                                            value={modalDeptSelect}
                                            onChange={setModalDeptSelect}
                                            disabled={inProgress}
                                            placeholder="— Select department —"
                                            className="flex-1"
                                            options={availableDepts.map(d => ({ value: d.shortCode.toLowerCase(), label: d.name }))}
                                        />
                                        <button
                                            onClick={() => handleAddAltCgm(u)}
                                            disabled={!modalDeptSelect || inProgress}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-canopy hover:bg-canopy-dark text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {addInProg ? <><Loader2 size={13} className="animate-spin" /> Adding…</> : <><Shield size={13} /> Add</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}
            </Modal>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center flex-1 py-16">
                        <Loader2 size={24} className="animate-spin text-canopy" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400 py-16">
                        <Users size={36} strokeWidth={1.5} />
                        <p className="text-sm">No Grade-F users found</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-700 w-10 text-center">#</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">UIN</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Designation</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Department</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Alternate CGM Depts.</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700 w-20 text-center">Manage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paged.map((u, idx) => {
                                        const assignedCodes = alternateCgmMap.get(u.object_name) || [];
                                        return (
                                            <tr key={u.user_login_name || idx} className="hover:bg-canopy-tint/40 transition-colors group">
                                                <td className="px-4 py-3 text-slate-400 font-mono text-xs text-center">
                                                    {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-900">{u.object_name || '—'}</div>
                                                    <div className="text-xs text-slate-500 group-hover:text-canopy transition-colors">{u.user_login_name}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.uin || '—'}</td>
                                                <td className="px-4 py-3 text-slate-600">{u.designation || '—'}</td>
                                                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.department_short_code || <span className="text-slate-400">—</span>}</td>
                                                <td className="px-4 py-3">
                                                    {loadingAltCgm ? (
                                                        <Loader2 size={13} className="animate-spin text-slate-300" />
                                                    ) : assignedCodes.length === 0 ? (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {assignedCodes.map(code => (
                                                                <span key={code} className="px-2 py-0.5 bg-harvest/15 text-harvest border border-harvest/25 rounded-full text-xs font-medium">
                                                                    {code.toUpperCase()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => { setManagingUser(u); setModalDeptSelect(''); }}
                                                        className="p-2 hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-canopy hover:shadow-sm rounded-lg transition-all"
                                                        title="Manage Alternate CGM departments"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50 text-sm text-slate-500">
                                <span>Showing <span className="font-medium text-slate-900">{rangeStart}</span> to <span className="font-medium text-slate-900">{rangeEnd}</span> of <span className="font-medium text-slate-900">{filtered.length}</span> results</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-canopy disabled:opacity-40 text-slate-500 transition-colors">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 min-w-[3rem] text-center shadow-sm">
                                        {currentPage}
                                    </div>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-canopy disabled:opacity-40 text-slate-500 transition-colors">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Main UsersPage ───────────────────────────────────────────────────────────
const UsersPage = () => {
    const toast = useToast();

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;

    const allTabs = [
        { id: 'creation',  label: 'User Creation',        icon: UserPlus, roles: ['Super Admin'] },
        { id: 'directory', label: 'User Directory',       icon: Users,    roles: ['Super Admin', 'Local Admin'] },
        { id: 'access',    label: 'User Access',          icon: Shield,   roles: ['Super Admin', 'Local Admin'] },
        { id: 'export',    label: 'User Data Export',     icon: Download, roles: ['Super Admin'] },
        { id: 'alternateCgm', label: 'Alternate CGM',     icon: Layers,   roles: ['Super Admin'] },
        { id: 'password',  label: 'User Password Update', icon: KeyRound, roles: ['Super Admin'] },
    ];

    const tabs = allTabs.filter(tab => tab.roles.includes(adminRole));

    const [activeTab, setActiveTab] = useState(() => tabs[0]?.id || '');

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader title="Users" icon={Users} description="Create, browse and manage Documentum user accounts." />

            <Tabs
                tabs={tabs.map(({ id, label, icon }) => ({ id, label, icon }))}
                value={activeTab}
                onChange={setActiveTab}
                className="mb-5"
            />

            {/* Tab content */}
            <div className="flex flex-1 flex-col">
                {activeTab === 'creation'  && <UserCreateTab    onToast={toast.show} />}
                {activeTab === 'password'  && <PasswordTab      onToast={toast.show} />}
                {activeTab === 'directory' && <UserDirectoryTab  onToast={toast.show} />}
                {activeTab === 'access'    && <UserAccessTab     onToast={toast.show} />}
                {activeTab === 'export'    && <UserExportTab     onToast={toast.show} />}
                {activeTab === 'alternateCgm' && <AlternateCgmTab onToast={toast.show} />}
            </div>
        </div>
    );
};

export default UsersPage;
