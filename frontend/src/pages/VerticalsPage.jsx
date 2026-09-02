import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import {
    Layers, Tag, Users, UserPlus, X, Loader2, Check,
    CheckCircle2, AlertCircle, Building2, MapPin,
    UserCheck, UsersRound, Star, ClipboardList, ArrowRightLeft,
} from 'lucide-react';
import { RO_LOCATIONS, TE_LOCATIONS, getLocations, fetchDepartments } from '../data/nabardMetadata.js';
import { PageHeader, Tabs, useToast } from '../components/ui';
import CustomSelect from '../components/ui/CustomSelect.jsx';

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeSuffix(raw) {
    return raw.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

/** 'ecm_ho_ddsi_common_cmd' → 'ecm_ho_vertical_head_ddsi_common_cmd' */
function toVerticalHeadName(groupName) {
    if (!groupName.startsWith('ecm_ho_')) return '';
    const rest = groupName.slice('ecm_ho_'.length);
    return `ecm_ho_vertical_head_${rest}`;
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

const Label = ({ children, icon: Icon }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={11} />}{children}
    </label>
);

// Cascading dropdown primitive — the app-standard hardened CustomSelect
const Select = CustomSelect;

const MultiSelectUsers = ({ value = [], onChange, disabled, placeholder, options = [], showSelectAll = false, selectAllLabel = 'Select all', showClear = false, clearLabel = 'Clear selection' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const allValues = options.map(o => o.value);
    const allSelected = allValues.length > 0 && allValues.every(v => value.includes(v));
    const toggleAll = () => onChange(allSelected ? [] : allValues);

    const toggleUser = (optionValue) => {
        if (value.includes(optionValue)) {
            onChange(value.filter(v => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    };

    const removeUser = (optionValue) => {
        onChange(value.filter(v => v !== optionValue));
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className={`border rounded-xl bg-white transition-all ${
                isOpen ? 'border-canopy ring-2 ring-canopy/20' : 'border-slate-200'
            } ${disabled ? 'bg-slate-100' : ''}`}>
                <div className="p-2 flex flex-wrap gap-1 min-h-10">
                    {value.map(val => {
                        const opt = options.find(o => o.value === val);
                        return (
                            <div key={val} className="flex items-center gap-1 px-2.5 py-1 bg-canopy-tint text-canopy rounded-lg text-xs font-medium">
                                <span>{opt?.label.split('(')[0].trim() || val}</span>
                                <button
                                    onClick={() => removeUser(val)}
                                    className="text-canopy hover:text-canopy-dark ml-0.5"
                                    disabled={disabled}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                    <input
                        type="text"
                        placeholder={value.length === 0 ? placeholder : 'Search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        disabled={disabled}
                        className="flex-1 outline-none text-sm py-1 px-1 min-w-32 bg-transparent"
                    />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                    {showSelectAll && options.length > 0 && (
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="w-full text-left px-4 py-2 text-sm font-medium text-canopy hover:bg-slate-100 transition-colors flex items-center gap-2 border-b border-slate-200 sticky top-0 bg-white z-10"
                        >
                            <Check size={16} className={`flex-shrink-0 ${allSelected ? 'text-canopy' : 'opacity-0'}`} />
                            <span>{allSelected ? 'Clear all' : selectAllLabel}</span>
                        </button>
                    )}
                    {showClear && !showSelectAll && value.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="w-full text-left px-4 py-2 text-sm font-medium text-canopy hover:bg-slate-100 transition-colors flex items-center gap-2 border-b border-slate-200 sticky top-0 bg-white z-10"
                        >
                            <X size={16} className="flex-shrink-0" />
                            <span>{clearLabel} ({value.length})</span>
                        </button>
                    )}
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => toggleUser(opt.value)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors flex items-center gap-2 border-b border-slate-100 last:border-b-0 ${
                                    value.includes(opt.value) ? 'bg-canopy-tint text-canopy font-medium' : 'text-slate-800'
                                }`}
                            >
                                <Check size={16} className={`flex-shrink-0 ${value.includes(opt.value) ? 'text-canopy' : 'opacity-0'}`} />
                                <span>{opt.label}</span>
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-xs text-slate-400 text-center">No users found</div>
                    )}
                </div>
            )}
        </div>
    );
};

const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>
        {children}
    </div>
);

const SectionTitle = ({ children }) => (
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{children}</p>
);

const MemberTag = ({ type }) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
        type === 'user' ? 'bg-canopy-tint text-canopy' : 'bg-canopy-tint text-canopy'
    }`}>{type}</span>
);

// ─── Vertical Creation Tab ────────────────────────────────────────────────────
const VerticalCreationTab = ({ setToast }) => {
    const [dept,               setDept]               = useState('');
    const [suffix,             setSuffix]             = useState('');
    const [verticalFullName,   setVerticalFullName]   = useState('');
    const [verticalShortcode,  setVerticalShortcode]  = useState('');
    const [creating,           setCreating]           = useState(false);
    const [hoDepts,            setHoDepts]            = useState([]);

    useEffect(() => { fetchDepartments('HO').then(setHoDepts); }, []);

    const deptObj         = hoDepts.find(d => d.name === dept);
    const prefix          = deptObj ? `ecm_ho_${deptObj.shortCode.toLowerCase()}_` : 'ecm_ho_';
    const cleanVerticalShortcode = normalizeSuffix(verticalShortcode);
    const groupName       = deptObj && cleanVerticalShortcode ? `${prefix}${cleanVerticalShortcode.toLowerCase()}` : '';
    const groupDisplayName = groupName ? groupName.replace(/_/g, '-').toUpperCase() : '';
    const canCreate       = !!deptObj && cleanVerticalShortcode.length > 0
                            && verticalFullName.trim().length > 0
                            && verticalShortcode.trim().length > 0;

    const handleCreate = async () => {
        setCreating(true);
        try {
            const groupRes = await api.post('/groups', { group_name: groupName, group_display_name: groupDisplayName });

            // Check if group already exists
            if (groupRes.data?.exists) {
                setToast({
                    type: 'error',
                    message: `Group '${groupName}' already exists. Please provide a different vertical shortcode.`
                });
                setCreating(false);
                return;
            }

            // Check if creation failed
            if (!groupRes.data?.success) {
                setToast({
                    type: 'error',
                    message: groupRes.data?.message || 'Failed to create vertical group.'
                });
                setCreating(false);
                return;
            }

            // Create the associated dm_folder
            try {
                await api.post('/groups/vertical-folder', {
                    verticalFullName:  verticalFullName.trim(),
                    verticalShortcode: verticalShortcode.trim(),
                    groupName,
                    deptName: dept,
                });
            } catch (folderErr) {
                const folderMsg = folderErr.response?.data?.message || folderErr.message;
                setToast({ type: 'error', message: `Vertical created but folder creation failed: ${folderMsg}` });
                setDept(''); setSuffix(''); setVerticalFullName(''); setVerticalShortcode('');
                setCreating(false);
                return;
            }

            setToast({ type: 'success', message: `Vertical '${groupName}' and folder created successfully.` });
            setDept(''); setSuffix(''); setVerticalFullName(''); setVerticalShortcode('');
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message;
            const isConflict = err.response?.status === 409;
            const message = isConflict
                ? `Group already exists. Please provide a different vertical shortcode.`
                : `Failed to create vertical: ${errMsg}`;
            setToast({ type: 'error', message });
        } finally {
            setCreating(false);
        }
    };

    return (
        <Card className="space-y-5">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-fit text-sm text-slate-600">
                <Building2 size={14} className="text-slate-400" />
                Office Type: <span className="font-semibold text-slate-800">HO — Head Office</span>
            </div>

            <div>
                <Label icon={Layers}>Department <span className="text-danger">*</span></Label>
                <Select
                    value={dept} onChange={v => { setDept(v); setSuffix(''); }}
                    placeholder="— Select department —"
                    options={hoDepts.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label icon={Tag}>Vertical Full Name <span className="text-danger">*</span></Label>
                    <input type="text" value={verticalFullName} onChange={e => setVerticalFullName(e.target.value)}
                        placeholder="e.g. Digital Initiatives and Technology"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy bg-white" />
                </div>

                <div>
                    <Label icon={Tag}>Vertical Shortcode <span className="text-danger">*</span></Label>
                    <input type="text" value={verticalShortcode} onChange={e => setVerticalShortcode(e.target.value)}
                        placeholder="e.g. DIT"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy bg-white" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label icon={Tag}>Group Name <span className="normal-case font-normal text-slate-400">(auto-filled)</span></Label>
                    <input type="text" readOnly value={groupName}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 text-slate-600 cursor-default" />
                </div>

                <div>
                    <Label icon={Tag}>Group Display Name <span className="normal-case font-normal text-slate-400">(auto-filled)</span></Label>
                    <input type="text" readOnly value={groupDisplayName}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 text-slate-600 cursor-default" />
                </div>
            </div>

            <button onClick={handleCreate} disabled={!canCreate || creating}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-canopy hover:bg-canopy-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : 'Create Vertical'}
            </button>
        </Card>
    );
};

// ─── Add Members Tab ──────────────────────────────────────────────────────────
const AddMembersTab = ({ setToast }) => {
    const storedUser   = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole    = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);

    const [officeType,        setOfficeType]        = useState('HO');
    const [location,          setLocation]          = useState('');
    const [roShortCode,       setRoShortCode]       = useState('');
    const [dept,              setDept]              = useState('');
    const [verticals,         setVerticals]         = useState([]);
    const [selectedVerticals, setSelectedVerticals] = useState([]);
    const [users,             setUsers]             = useState([]);
    const [selectedUsers,     setSelectedUsers]     = useState([]);

    const [verticalMembers,   setVerticalMembers]   = useState({ users: [], groups: [] });
    const [vhGroupName,           setVhGroupName]           = useState('');
    const [vhExists,              setVhExists]              = useState(false);
    const [vhMembers,             setVhMembers]             = useState([]);
    const [vhCurrentDisplayName,  setVhCurrentDisplayName]  = useState('');
    const [modifyVHSelectedUser,  setModifyVHSelectedUser]  = useState('');
    const [modifyingVH,           setModifyingVH]           = useState(false);

    const [loadingVerticals,  setLoadingVerticals]  = useState(false);
    const [loadingUsers,      setLoadingUsers]      = useState(false);
    const [loadingMembers,    setLoadingMembers]    = useState(false);
    const [adding,            setAdding]            = useState(false);
    const [creatingVH,        setCreatingVH]        = useState(false);
    const [deptOptions,       setDeptOptions]       = useState([]);
    const [allDeptOptions,    setAllDeptOptions]    = useState([]);

    const isROTE = ['RO', 'TE'].includes(officeType);
    // Per-vertical panels (members list, vertical-head group) only apply when exactly one vertical is chosen.
    const singleVertical = selectedVerticals.length === 1 ? selectedVerticals[0] : '';

    // Local Admin: fetch profile context and auto-set office type & location
    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const ot  = ctx.office_type || '';
                const loc = ctx.location    || '';
                if (ot) setOfficeType(ot);
                if (loc) {
                    setLocation(loc);
                    const locs = getLocations(ot);
                    const locObj = locs.find(l => l.location === loc);
                    if (locObj) setRoShortCode(locObj.shortCode);
                }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // Load departments dynamically when officeType or location changes
    useEffect(() => {
        if (!officeType || (isROTE && !location)) { setAllDeptOptions([]); setDeptOptions([]); return; }
        fetchDepartments(officeType, location).then(all => {
            setAllDeptOptions(all);
            if (isLocalAdmin && profileCtx) {
                const raw = profileCtx.department_short_code_multi;
                const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                    .map(s => s.toLowerCase());
                setDeptOptions(all.filter(d => allowed.includes(d.shortCode.toLowerCase())));
            } else {
                setDeptOptions(all);
            }
        });
    }, [officeType, location, isLocalAdmin, profileCtx]);

    // Local Admin RO/TE: auto-fetch users + verticals when location is set from profile
    useEffect(() => {
        if (!isLocalAdmin || !profileCtx || !isROTE || !location || !roShortCode) return;
        setLoadingUsers(true); setLoadingVerticals(true);
        Promise.allSettled([
            api.get('/users/by-location', { params: { location } }),
            api.get('/groups/by-prefix',  { params: { prefix: `ecm_${roShortCode.toLowerCase()}` } }),
        ]).then(([uRes, vRes]) => {
            if (uRes.status === 'fulfilled') setUsers(uRes.value.data || []);
            if (vRes.status === 'fulfilled') {
                const all = vRes.value.data || [];
                setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec')));
            }
            setLoadingUsers(false); setLoadingVerticals(false);
        });
    }, [isLocalAdmin, profileCtx, isROTE, location, roShortCode]);

    const resetBelow = (level) => {
        if (level === 'location') { setLocation(''); setRoShortCode(''); }
        setDept('');
        setSelectedVerticals([]); setVerticals([]);
        setSelectedUsers([]); setUsers([]);
        setVerticalMembers({ users: [], groups: [] });
        setVhGroupName(''); setVhExists(false); setVhMembers([]);
        setVhCurrentDisplayName(''); setModifyVHSelectedUser('');
    };

    const handleOfficeTypeChange = (v) => {
        setOfficeType(v);
        resetBelow('location');
    };

    // RO/TE: on location change → fetch users by location
    const handleLocationChange = async (v) => {
        const locs   = getLocations(officeType);
        const locObj = locs.find(l => l.location === v);
        const roCode = locObj?.shortCode || '';
        setLocation(v);
        setRoShortCode(roCode);
        resetBelow('dept');
        if (!v || !roCode) return;

        // Fetch users by location + verticals by ecm_<roShortCode> in parallel
        setLoadingUsers(true); setLoadingVerticals(true);
        const [uRes, vRes] = await Promise.allSettled([
            api.get('/users/by-location', { params: { location: v } }),
            api.get('/groups/by-prefix',  { params: { prefix: `ecm_${roCode.toLowerCase()}` } }),
        ]);
        if (uRes.status === 'fulfilled') setUsers(uRes.value.data || []);
        else setUsers([]);
        if (vRes.status === 'fulfilled') {
            const all = vRes.value.data || [];
            setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec')));
        } else setVerticals([]);
        setLoadingUsers(false); setLoadingVerticals(false);
    };

    // On dept change — fetch verticals (for HO also fetch users by dept)
    const handleDeptChange = async (v) => {
        setDept(v);
        setSelectedVerticals([]); setVerticals([]);
        setVerticalMembers({ users: [], groups: [] });
        setVhGroupName(''); setVhExists(false); setVhMembers([]);
        if (!v) return;
        const d = deptOptions.find(d => d.name === v);
        if (!d) return;

        setLoadingVerticals(true);
        try {
            // Fetch verticals from ECM CONFIG folder structure
            const res = await api.get('/groups/verticals', {
                params: {
                    officeType: officeType,
                    deptName: d.name
                }
            });
            const all = res.data || [];
            setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec')));
        } catch { setVerticals([]); }
        finally { setLoadingVerticals(false); }

        // Fetch users by office type and department
        setUsers([]); setSelectedUsers([]);
        setLoadingUsers(true);
        try {
            if (officeType === 'HO') {
                // HO: fetch users by department and office type
                const res = await api.get('/users/by-dept', {
                    params: {
                        shortCode: d.shortCode.toLowerCase(),
                        officeType: 'HO'
                    }
                });
                setUsers(res.data || []);
            } else {
                // RO/TE: fetch users by location, then filter by department on frontend
                const res = await api.get('/users/by-location', { params: { location: location } });
                const allUsers = res.data || [];
                // Filter users by department_short_code_multi (array of department codes)
                const deptShortCodeLower = d.shortCode.toLowerCase();
                const filteredUsers = allUsers.filter(u => {
                    const deptMulti = u.department_short_code_multi || [];
                    // Check if array contains the selected department (case-insensitive)
                    return Array.isArray(deptMulti)
                        ? deptMulti.some(dept => dept?.toLowerCase() === deptShortCodeLower)
                        : (deptMulti?.toLowerCase?.() === deptShortCodeLower);
                });
                setUsers(filteredUsers);
            }
        } catch { setUsers([]); }
        finally { setLoadingUsers(false); }
    };

    // On vertical selection change (array). The per-vertical panels + head-group data
    // load only when exactly one vertical is selected.
    const handleVerticalChange = useCallback(async (arr) => {
        const next = Array.isArray(arr) ? arr : (arr ? [arr] : []);
        setSelectedVerticals(next);
        setVerticalMembers({ users: [], groups: [] });
        setVhGroupName(''); setVhExists(false); setVhMembers([]);
        setVhCurrentDisplayName(''); setModifyVHSelectedUser('');
        if (next.length !== 1) return;

        const v = next[0];
        const vhName = toVerticalHeadName(v);
        setVhGroupName(vhName);

        setLoadingMembers(true);
        const [membersRes, vhRes, vhMembersRes] = await Promise.allSettled([
            api.get(`/groups/${v}/members`),
            api.get(`/groups/exists/${vhName}`),
            api.get(`/groups/${vhName}/members`),
        ]);
        setLoadingMembers(false);

        if (membersRes.status === 'fulfilled') {
            setVerticalMembers({
                users:  membersRes.value.data.users  || [],
                groups: membersRes.value.data.groups || [],
            });
        }
        if (vhRes.status === 'fulfilled') {
            setVhExists(vhRes.value.data.exists);
            const vhProps = vhRes.value.data.properties;
            setVhCurrentDisplayName(vhProps?.group_display_name || '');
        }
        if (vhMembersRes.status === 'fulfilled') {
            setVhMembers(vhMembersRes.value.data.users || []);
        }
    }, []);

    // Get users already in the group
    const getUsersAlreadyInGroup = () => {
        return selectedUsers.filter(loginName =>
            verticalMembers.users.some(u => {
                const memberLoginName = u.user_login_name || u.login_name || '';
                return memberLoginName.toLowerCase() === loginName.toLowerCase();
            })
        );
    };

    const usersAlreadyInGroup = getUsersAlreadyInGroup();

    const handleAddToGroup = async () => {
        if (selectedVerticals.length === 0 || selectedUsers.length === 0) return;
        // Pre-check duplicates only when a single vertical is selected (members list is loaded then).
        if (singleVertical && usersAlreadyInGroup.length > 0) {
            const alreadyMemberNames = usersAlreadyInGroup.join(', ');
            setToast({ type: 'error', message: `'${alreadyMemberNames}' already member(s) of '${singleVertical}'.` });
            return;
        }
        setAdding(true);
        let added = 0;
        const failures = [];
        try {
            for (const vertical of selectedVerticals) {
                for (const loginName of selectedUsers) {
                    try {
                        await api.post(`/groups/${vertical}/members`, {
                            memberName: loginName, memberType: 'user',
                        });
                        added++;
                        const userObj = users.find(u => u.user_login_name === loginName);
                        const userProfileId = userObj?.r_object_id || '';
                        if (userProfileId) {
                            api.post(`/users/profiles/${userProfileId}/vertical-ids`, {
                                verticalGroupName: vertical,
                            }).catch(e => console.warn('vertical_ids update failed:', e?.response?.data?.message || e.message));
                        }
                    } catch (e) {
                        const m = e.response?.data?.message || e.message || '';
                        // "already a member" is not a real failure for a bulk add
                        if (!/already/i.test(m)) failures.push(`${loginName} → ${vertical}`);
                    }
                }
            }
            if (failures.length > 0) {
                setToast({ type: 'error', message: `Added ${added}; failed: ${failures.join(', ')}` });
            } else {
                setToast({
                    type: 'success',
                    message: selectedVerticals.length === 1
                        ? `${selectedUsers.length} user(s) added to '${selectedVerticals[0]}'.`
                        : `${selectedUsers.length} user(s) added to ${selectedVerticals.length} verticals.`,
                });
            }
            setSelectedUsers([]);
            // Refresh the members list only when a single vertical is on screen
            if (singleVertical) {
                const membersRes = await api.get(`/groups/${singleVertical}/members`);
                if (membersRes.data) setVerticalMembers({ users: membersRes.data.users || [], groups: membersRes.data.groups || [] });
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to add members.';
            setToast({ type: 'error', message: msg });
        } finally { setAdding(false); }
    };

    const handleMarkVerticalHead = async () => {
        if (!singleVertical || selectedUsers.length === 0) return;
        const firstUser = selectedUsers[0];
        const userObj = users.find(u => u.user_login_name === firstUser);
        const userDisplayName = userObj?.object_name || firstUser;
        setCreatingVH(true);
        try {
            const vhDisplayName = singleVertical.replace(/_/g, '-').toUpperCase() + ` -${userDisplayName}`;
            try {
                await api.post('/groups', { group_name: vhGroupName, group_display_name: vhDisplayName });
            } catch (createErr) {
                const msg = createErr.response?.data?.message || '';
                if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exist')) {
                    throw createErr;
                }
            }
            await api.post(`/groups/${vhGroupName}/members`, { memberName: firstUser, memberType: 'user' });
            setToast({ type: 'success', message: `Vertical head '${vhGroupName}' created and '${firstUser}' assigned.` });
            setVhExists(true);
            const vhMembersRes = await api.get(`/groups/${vhGroupName}/members`);
            if (vhMembersRes.data) setVhMembers(vhMembersRes.data.users || []);
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Failed to create vertical head.' });
        } finally { setCreatingVH(false); }
    };

    const handleModifyVerticalHead = async () => {
        if (!vhGroupName || !modifyVHSelectedUser) return;
        setModifyingVH(true);
        const newUserObj = users.find(u => u.user_login_name === modifyVHSelectedUser);
        const newObjectName = newUserObj?.object_name || modifyVHSelectedUser;
        try {
            // 1. Add new user to VH group
            await api.post(`/groups/${vhGroupName}/members`, {
                memberName: modifyVHSelectedUser, memberType: 'user',
            });
            // 2. Remove all existing VH members (except the one just added)
            for (const m of vhMembers) {
                await api.delete(`/groups/${vhGroupName}/members/${m.name}`, {
                    params: { memberType: 'user' },
                });
            }
            // 3. Update display name: replace part after last ' -' with new user's name
            const dashIdx = vhCurrentDisplayName.lastIndexOf(' -');
            const prefix  = dashIdx >= 0 ? vhCurrentDisplayName.substring(0, dashIdx) : vhCurrentDisplayName;
            const newDisplayName = `${prefix} -${newObjectName}`;
            await api.put(`/groups/${vhGroupName}/display-name`, { displayName: newDisplayName });

            setModifyVHSelectedUser('');
            setToast({ type: 'success', message: `Vertical head updated to '${newObjectName}'.` });

            // Refresh VH details from server to get updated display name and members
            const [detailsRes, membersRes, verticalMembersRes] = await Promise.allSettled([
                api.get(`/groups/${vhGroupName}`),
                api.get(`/groups/${vhGroupName}/members`),
                api.get(`/groups/${singleVertical}/members`), // Refresh main vertical members to update badges
            ]);

            if (detailsRes.status === 'fulfilled') {
                const vhProps = detailsRes.value.data?.properties;
                if (vhProps?.group_display_name) {
                    setVhCurrentDisplayName(vhProps.group_display_name);
                }
            }

            if (membersRes.status === 'fulfilled') {
                setVhMembers(membersRes.value.data?.users || []);
            }

            // Refresh the main vertical members to update UI badges
            if (verticalMembersRes.status === 'fulfilled') {
                setVerticalMembers({
                    users: verticalMembersRes.value.data?.users || [],
                    groups: verticalMembersRes.value.data?.groups || [],
                });
            }
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Failed to update vertical head.' });
        } finally { setModifyingVH(false); }
    };

    const showMarkVHButton = singleVertical && selectedUsers.length === 1;
    const canAdd = selectedVerticals.length > 0 && selectedUsers.length > 0
        && (!singleVertical || usersAlreadyInGroup.length === 0);

    return (
        <div className="space-y-5">
            {/* ── Step 1: Office Type + Location + Department + Vertical + User ── */}
            <Card className="space-y-4">
                <SectionTitle>Selection</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Office Type */}
                    <div>
                        <Label icon={Building2}>Office Type</Label>
                        <Select value={officeType} onChange={handleOfficeTypeChange}
                            disabled={isLocalAdmin}
                            placeholder="— Select office type —"
                            options={[
                                { value: 'HO', label: 'HO — Head Office' },
                            ]} />
                    </div>
                    {/* Location (RO/TE only) */}
                    {isROTE && (
                        <div>
                            <Label icon={MapPin}>Location</Label>
                            <Select value={location} onChange={handleLocationChange}
                                disabled={!officeType || isLocalAdmin}
                                placeholder="— Select location —"
                                options={getLocations(officeType).map(l => ({ value: l.location, label: l.location }))} />
                        </div>
                    )}
                    {/* Department */}
                    <div>
                        <Label icon={Layers}>Department</Label>
                        <Select value={dept} onChange={handleDeptChange}
                            disabled={!officeType || (isROTE && !location)}
                            placeholder={!officeType ? '— Select office type first —' : (isROTE && !location) ? '— Select location first —' : '— Select dept —'}
                            options={deptOptions.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Verticals (multi-select) */}
                    <div>
                        <Label icon={UsersRound}>Verticals <span className="normal-case font-normal text-slate-400">(select multiple)</span></Label>
                        {loadingVerticals
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <MultiSelectUsers value={selectedVerticals} onChange={handleVerticalChange}
                                showSelectAll selectAllLabel="Select all verticals"
                                disabled={(isROTE ? !location : !dept) || verticals.length === 0}
                                placeholder={isROTE ? (!location ? '— Select location first —' : verticals.length === 0 ? 'No verticals found' : '— Select verticals —') : (!dept ? '— Select dept first —' : verticals.length === 0 ? 'No verticals found' : '— Select verticals —')}
                                options={verticals.map(g => ({ value: g.group_name, label: g.object_name || g.group_name }))} />
                        }
                    </div>
                    {/* User */}
                    <div>
                        <Label icon={Users}>Users <span className="normal-case font-normal text-slate-400">(select multiple)</span></Label>
                        {loadingUsers
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <>
                                <MultiSelectUsers
                                    value={selectedUsers}
                                    onChange={setSelectedUsers}
                                    showClear
                                    clearLabel="Clear selection"
                                    disabled={!officeType || users.length === 0}
                                    placeholder={!officeType ? '— Select office type first —' : users.length === 0 ? 'No users found' : 'Search and select users...'}
                                    options={users.map(u => ({ value: u.user_login_name, label: `${u.object_name} (${u.user_login_name})` }))}
                                />
                                {usersAlreadyInGroup.length > 0 && (
                                    <p className="text-xs text-harvest mt-2 flex items-center gap-1">
                                        <AlertCircle size={13} /> {usersAlreadyInGroup.join(', ')} already member(s)
                                    </p>
                                )}
                              </>
                        }
                    </div>
                </div>
            </Card>

            {/* ── Step 2: Info panels (members + vertical head) — single-vertical only ── */}
            {singleVertical && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

                    {/* 1 — Vertical Members */}
                    {singleVertical && (
                        <Card>
                            <SectionTitle>Vertical Members</SectionTitle>
                            {loadingMembers
                                ? <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                                : [...verticalMembers.users, ...verticalMembers.groups].length === 0
                                    ? <p className="text-xs text-slate-400 text-center py-3">No members</p>
                                    : <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {[...verticalMembers.users, ...verticalMembers.groups].map(m => (
                                            <div key={`${m.type}-${m.name}`} className="flex items-center gap-2 text-xs">
                                                <MemberTag type={m.type} />
                                                <span className="font-mono text-slate-700 truncate">{m.name}</span>
                                            </div>
                                        ))}
                                    </div>
                            }
                        </Card>
                    )}

                    {/* 2 — Vertical Head Group */}
                    {singleVertical && (
                        <Card>
                            <SectionTitle>Vertical Head Group</SectionTitle>
                            <p className="text-xs font-mono text-slate-400 mb-2 break-all">{vhGroupName}</p>
                            {loadingMembers
                                ? <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
                                : vhExists
                                    ? <>
                                        <div className="flex items-center gap-1.5 text-xs text-canopy bg-canopy-tint border border-canopy/20 rounded-lg px-2.5 py-1.5 mb-2">
                                            <CheckCircle2 size={12} /> Exists
                                        </div>
                                        {vhMembers.length > 0 && (
                                            <div className="space-y-1 mb-3">
                                                {vhMembers.map(m => (
                                                    <div key={m.name} className="flex items-center gap-2 text-xs">
                                                        <MemberTag type="user" />
                                                        <span className="font-mono text-slate-700 truncate">{m.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Modify Vertical Head */}
                                        <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modify Vertical Head</p>
                                            <Select
                                                value={modifyVHSelectedUser}
                                                onChange={setModifyVHSelectedUser}
                                                placeholder="— Select new head —"
                                                options={verticalMembers.users.map(u => {
                                                    const obj = users.find(x => x.user_login_name === u.name);
                                                    return { value: u.name, label: obj ? `${obj.object_name} (${u.name})` : u.name };
                                                })}
                                            />
                                            <button
                                                onClick={handleModifyVerticalHead}
                                                disabled={!modifyVHSelectedUser || modifyingVH}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-harvest hover:bg-harvest text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {modifyingVH
                                                    ? <><Loader2 size={12} className="animate-spin" /> Updating…</>
                                                    : <><Star size={12} /> Update Vertical Head</>}
                                            </button>
                                        </div>
                                    </>
                                    : <div className="flex items-center gap-1.5 text-xs text-harvest bg-harvest/10 border border-harvest/25 rounded-lg px-2.5 py-1.5">
                                        <AlertCircle size={12} /> Not yet created
                                    </div>
                            }
                        </Card>
                    )}

                </div>
            )}

            {/* ── Step 3: Action buttons ── */}
            {selectedVerticals.length > 0 && selectedUsers.length > 0 && (
                <Card className="space-y-3">
                    <SectionTitle>Actions</SectionTitle>

                    <div className="flex flex-wrap gap-3">
                        {/* Add to Group */}
                        <button onClick={handleAddToGroup} disabled={!canAdd || adding}
                            className="flex items-center gap-2 px-5 py-2.5 bg-canopy hover:bg-canopy-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {adding
                                ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
                                : <><UserPlus size={14} /> Add to Vertical</>}
                        </button>

                        {/* Mark Vertical Head */}
                        {showMarkVHButton && (
                            <button onClick={handleMarkVerticalHead} disabled={creatingVH || vhExists}
                                className="flex items-center gap-2 px-5 py-2.5 bg-harvest hover:bg-harvest text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {creatingVH
                                    ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                                    : <><Star size={14} /> Mark Vertical Head</>}
                            </button>
                        )}

                    </div>

                    <p className="text-xs text-slate-400">
                        Adding <span className="font-mono text-slate-600">{selectedUsers.length} user(s)</span> to <span className="font-mono text-slate-600">{
                            singleVertical
                                ? (verticals.find(g => g.group_name === singleVertical)?.object_name || singleVertical)
                                : `${selectedVerticals.length} verticals`
                        }</span>
                        {singleVertical && vhGroupName && <> · Vertical head group: <span className="font-mono text-slate-600">{vhGroupName}</span>{vhExists ? ' (exists)' : ''}</>}
                    </p>
                </Card>
            )}
        </div>
    );
};

// ─── Remove Members Tab ───────────────────────────────────────────────────────
const RemoveMembersTab = ({ setToast }) => {
    const storedUser   = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole    = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);

    const [officeType,     setOfficeType]     = useState('HO');
    const [location,       setLocation]       = useState('');
    const [roShortCode,    setRoShortCode]    = useState('');
    const [dept,           setDept]           = useState('');
    const [verticals,      setVerticals]      = useState([]);
    const [selectedGroup,  setSelectedGroup]  = useState('');
    const [members,        setMembers]        = useState({ users: [], groups: [] });
    const [loadingVerts,   setLoadingVerts]   = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [pendingRemove,  setPendingRemove]  = useState(null);
    const [inboxTasks,     setInboxTasks]     = useState([]);
    const [inboxTotal,     setInboxTotal]     = useState(0);
    const [loadingInbox,   setLoadingInbox]   = useState(false);
    const [removing,       setRemoving]       = useState(false);

    // Delegate case modal state
    const [delegateTask,          setDelegateTask]          = useState(null);
    const [delegateUsers,         setDelegateUsers]         = useState([]);
    const [loadingDelegateUsers,  setLoadingDelegateUsers]  = useState(false);
    const [delegateSelectedUser,  setDelegateSelectedUser]  = useState('');
    const [delegatingCaseId,      setDelegatingCaseId]      = useState(null);
    const [deptOptions,           setDeptOptions]           = useState([]);

    // Vertical head modal state
    const [showVerticalHeadModal, setShowVerticalHeadModal] = useState(false);
    const [verticalHeadUser,      setVerticalHeadUser]      = useState(null);
    const [selectedNewHead,       setSelectedNewHead]       = useState('');
    const [availableHeads,        setAvailableHeads]        = useState([]);
    const [loadingHeads,          setLoadingHeads]          = useState(false);
    const [updatingHead,          setUpdatingHead]          = useState(false);

    // Vertical head members state
    const [verticalHeadMembers,   setVerticalHeadMembers]   = useState([]);

    const pfield = (task, f) => task[`packagescase_folder${f}`] || task[f] || '';

    const handleDelegateClick = async (task) => {
        // Use the delegating user's own office type and location/department context
        const offType = officeType || 'HO';
        const isRoTe = offType === 'RO' || offType === 'TE';

        // In RemoveMembersTab context, the current performer is the pendingRemove user
        const currentPerformer = pendingRemove?.name || '';

        setDelegateTask(task);
        setDelegateSelectedUser('');
        setDelegateUsers([]);
        setLoadingDelegateUsers(true);
        try {
            if (isRoTe) {
                // For RO/TE: show all users from the delegating user's location (no department filter)
                const res = await api.get('/users/by-location', { params: { location } });
                const allUsers = res.data?.users || res.data || [];
                const filteredUsers = allUsers.filter(u => {
                    // Check if not current performer
                    const userName = u.name?.trim().toLowerCase() || '';
                    const userObjName = u.object_name?.trim().toLowerCase() || '';
                    const currentName = currentPerformer?.trim().toLowerCase() || '';
                    const notCurrentPerformer = userName !== currentName && userObjName !== currentName;

                    return notCurrentPerformer;
                });
                setDelegateUsers(filteredUsers);
            } else {
                // For HO: Try to get department from user profile, fallback to extracting from case name
                let deptCode = '';
                const deptMulti = profileCtx?.department_short_code_multi || [];

                if (Array.isArray(deptMulti) && deptMulti.length > 0) {
                    // Use first department from user's profile
                    deptCode = deptMulti[0];
                } else {
                    // Fallback: extract department from case name
                    const caseName = pfield(task, 'object_name') || task.caseName || '';
                    const parts = caseName.split('-');
                    // HO case format: NB-{DEPT}-...
                    deptCode = (parts[1] || '').toLowerCase();
                }

                if (!deptCode) {
                    setToast({ type: 'error', message: 'Department code not found.' });
                    setLoadingDelegateUsers(false);
                    return;
                }

                const res = await api.get('/users/by-dept', { params: { shortCode: deptCode, officeType: offType } });
                const allUsers = res.data?.users || res.data || [];
                const filteredUsers = allUsers.filter(u => {
                    const userName = u.name?.trim().toLowerCase() || '';
                    const userObjName = u.object_name?.trim().toLowerCase() || '';
                    const currentName = currentPerformer?.trim().toLowerCase() || '';
                    return userName !== currentName && userObjName !== currentName;
                });
                setDelegateUsers(filteredUsers);
            }
        } catch {
            setToast({ type: 'error', message: 'Failed to load users.' });
        } finally {
            setLoadingDelegateUsers(false);
        }
    };

    const handleDelegateConfirm = async () => {
        if (!delegateSelectedUser || !delegateTask) return;
        const caseId = pfield(delegateTask, 'id') || delegateTask.id || delegateTask.r_object_id;
        setDelegatingCaseId(caseId);
        try {
            const res = await api.post('/delegate', { caseId, performerDisplayName: delegateSelectedUser, loginUsername });
            setToast({ type: 'success', message: res.data?.message || 'Case delegated successfully.' });
            setInboxTasks(prev => prev.filter(t => {
                const tid = pfield(t, 'id') || t.id || t.r_object_id;
                return tid !== caseId;
            }));
            setInboxTotal(prev => Math.max(0, prev - 1));
            setDelegateTask(null);
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Delegation failed.' });
        } finally {
            setDelegatingCaseId(null);
        }
    };

    const isROTE = ['RO', 'TE'].includes(officeType);

    // Local Admin: fetch profile context and auto-set office type & location
    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const ot  = ctx.office_type || '';
                const loc = ctx.location    || '';
                if (ot) setOfficeType(ot);
                if (loc) {
                    setLocation(loc);
                    const locs = getLocations(ot);
                    const locObj = locs.find(l => l.location === loc);
                    if (locObj) setRoShortCode(locObj.shortCode);
                }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // Load departments dynamically when officeType or location changes
    useEffect(() => {
        if (!officeType || (isROTE && !location)) { setDeptOptions([]); return; }
        fetchDepartments(officeType, location).then(all => {
            if (isLocalAdmin && profileCtx) {
                const raw = profileCtx.department_short_code_multi;
                const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                    .map(s => s.toLowerCase());
                setDeptOptions(all.filter(d => allowed.includes(d.shortCode.toLowerCase())));
            } else {
                setDeptOptions(all);
            }
        });
    }, [officeType, location, isLocalAdmin, profileCtx]);

    // Local Admin RO/TE: auto-fetch verticals when location is set from profile
    useEffect(() => {
        if (!isLocalAdmin || !profileCtx || !isROTE || !location || !roShortCode) return;
        setLoadingVerts(true);
        api.get('/groups/by-prefix', { params: { prefix: `ecm_${roShortCode.toLowerCase()}` } })
            .then(res => {
                const all = res.data || [];
                setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('cgm_sec')));
            })
            .catch(() => setVerticals([]))
            .finally(() => setLoadingVerts(false));
    }, [isLocalAdmin, profileCtx, isROTE, location, roShortCode]);

    const resetBelow = (level) => {
        if (level === 'officeType') { setLocation(''); setRoShortCode(''); }
        setDept(''); setSelectedGroup(''); setVerticals([]); setMembers({ users: [], groups: [] });
        setPendingRemove(null); setInboxTasks([]); setInboxTotal(0);
    };

    const handleOfficeTypeChange = (v) => {
        setOfficeType(v);
        resetBelow('officeType');
    };

    const handleLocationChange = async (v) => {
        const locs   = getLocations(officeType);
        const locObj = locs.find(l => l.location === v);
        const roCode = locObj?.shortCode || '';
        setLocation(v);
        setRoShortCode(roCode);
        setDept(''); setSelectedGroup(''); setVerticals([]); setMembers({ users: [], groups: [] });
        if (!v || !roCode) return;
        // Note: For RO/TE location change, we'll fetch verticals when department is selected
        // since we need deptShortCode for the ECM CONFIG path
        setVerticals([]);
    };

    const handleDeptChange = async (v) => {
        setDept(v); setSelectedGroup(''); setVerticals([]); setMembers({ users: [], groups: [] });
        if (!v) return;
        const d = deptOptions.find(d => d.name === v);
        if (!d) return;
        setLoadingVerts(true);
        try {
            // Fetch verticals from ECM CONFIG folder structure
            const res = await api.get('/groups/verticals', {
                params: {
                    officeType: officeType,
                    deptName: d.name
                }
            });
            const all = res.data || [];
            setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('cgm_sec')));
        } catch { setVerticals([]); }
        finally { setLoadingVerts(false); }
    };

    const handleGroupChange = async (v) => {
        setSelectedGroup(v);
        setMembers({ users: [], groups: [] });
        setVerticalHeadMembers([]);
        setPendingRemove(null);
        setInboxTasks([]);
        setInboxTotal(0);
        if (!v) return;
        setLoadingMembers(true);
        try {
            const res = await api.get(`/groups/${v}/members`);
            setMembers({ users: res.data.users || [], groups: res.data.groups || [] });

            // Also fetch vertical head members for this vertical
            const verticalHeadGroup = getVerticalHeadGroupName(v);
            if (verticalHeadGroup) {
                try {
                    const headRes = await api.get(`/groups/${verticalHeadGroup}/members`);
                    setVerticalHeadMembers(headRes.data?.users || []);
                } catch {
                    setVerticalHeadMembers([]);
                }
            }
        } catch { setMembers({ users: [], groups: [] }); }
        finally { setLoadingMembers(false); }
    };

    /**
     * Compute the case object_name prefix filter for the currently selected group.
     * HO  → NB-<DEPTSC>-<VERTICALSUFFIX>-   e.g. NB-DDSI-DTV-
     * RO/TE → NB-<OFFICETYPE>-<ROSHORTCODE>-<DEPTSC>-  e.g. NB-RO-TN-DIT-
     */
    const computeCasePrefix = () => {
        const deptObj = deptOptions.find(d => d.name === dept);
        const deptSC  = (deptObj?.shortCode || '').toUpperCase();

        if (officeType === 'HO') {
            // group: ecm_ho_<deptSC_lower>_<verticalSuffix>
            const base   = `ecm_ho_${deptSC.toLowerCase()}_`;
            const suffix = selectedGroup.startsWith(base)
                ? selectedGroup.slice(base.length).toUpperCase()
                : '';
            return deptSC && suffix ? `NB-${deptSC}-${suffix}-` : '';
        } else {
            // RO / TE
            const roSC = roShortCode.toUpperCase();
            return deptSC && roSC ? `NB-${officeType}-${roSC}-${deptSC}-` : '';
        }
    };

    // Step 1: clicking X opens inbox check panel instead of removing immediately
    const handleRemoveClick = async (member) => {
        if (pendingRemove?.name === member.name) { setPendingRemove(null); setInboxTasks([]); setInboxTotal(0); return; }
        setPendingRemove(member);
        setInboxTasks([]);
        setInboxTotal(0);
        if (member.type !== 'user') return; // groups have no inbox — allow directly
        setLoadingInbox(true);
        try {
            const res = await api.get('/inbox/tasklist', { params: { username: member.name, page: 1, start: 0 } });
            const data = res.data || {};
            let allTasks = [];
            if (Array.isArray(data.entries)) {
                allTasks = data.entries.map(entry => {
                    const props = entry?.content?.properties || entry?.properties || entry;
                    return props;
                });
            } else if (Array.isArray(data.tasks)) {
                allTasks = data.tasks;
            }
            const prefix = computeCasePrefix();
            const getCaseName = (t) => t.packagescase_folderobject_name || t.object_name || t.caseName || '';
            const filtered = prefix
                ? allTasks.filter(t => getCaseName(t).toUpperCase().startsWith(prefix))
                : allTasks;
            setInboxTasks(filtered);
            setInboxTotal(filtered.length);
        } catch { setInboxTasks([]); setInboxTotal(0); }
        finally { setLoadingInbox(false); }
    };

    // Step 2: confirmed removal (only reachable when inbox is empty or member is a group)
    const handleConfirmRemove = async () => {
        if (!pendingRemove) return;
        setRemoving(true);
        try {
            await api.delete(`/groups/${selectedGroup}/members/${pendingRemove.name}`, {
                params: { memberType: pendingRemove.type },
            });
            setToast({ type: 'success', message: `'${pendingRemove.name}' removed from '${selectedGroup}'.` });
            setMembers(prev => ({
                users:  prev.users.filter(u => u.name !== pendingRemove.name),
                groups: prev.groups.filter(g => g.name !== pendingRemove.name),
            }));
            if (pendingRemove.type === 'user') {
                api.delete('/users/profile-vertical-ids', {
                    params: { userLoginName: pendingRemove.name, verticalGroupName: selectedGroup },
                }).catch(e => console.warn('vertical_ids remove failed:', e?.response?.data?.message || e.message));
            }
            setPendingRemove(null); setInboxTasks([]); setInboxTotal(0);
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Failed to remove member.' });
        } finally { setRemoving(false); }
    };

    const hasPendingCases = inboxTotal > 0;
    const allMembers = [...members.users, ...members.groups];

    // Helper: Derive vertical head group name from vertical group name
    // e.g., ecm_ho_dit_adm -> ecm_ho_vertical_head_dit_adm
    // e.g., ecm_tn_adm -> ecm_tn_vertical_head_adm
    const getVerticalHeadGroupName = (verticalGroup) => {
        if (!verticalGroup) return '';
        const parts = verticalGroup.split('_');
        // Find where to insert 'vertical_head'
        if (verticalGroup.startsWith('ecm_ho_')) {
            // HO format: ecm_ho_<dept>_<suffix> -> ecm_ho_vertical_head_<dept>_<suffix>
            return verticalGroup.replace('ecm_ho_', 'ecm_ho_vertical_head_');
        } else {
            // RO/TE format: ecm_<rocode>_<dept>_<suffix> -> ecm_<rocode>_vertical_head_<dept>_<suffix>
            // e.g., ecm_tn_adm -> ecm_tn_vertical_head_adm
            const match = verticalGroup.match(/^ecm_([a-z]+)_(.+)$/);
            if (match) {
                return `ecm_${match[1]}_vertical_head_${match[2]}`;
            }
        }
        return '';
    };

    // Check if user is a vertical head and handle head assignment if needed
    const handleRemoveClickWithHeadCheck = async (member) => {
        if (pendingRemove?.name === member.name) {
            setPendingRemove(null);
            setInboxTasks([]);
            setInboxTotal(0);
            return;
        }

        // Check if this user is a vertical head
        const verticalHeadGroup = getVerticalHeadGroupName(selectedGroup);
        if (verticalHeadGroup && member.type === 'user') {
            try {
                const res = await api.get(`/groups/${verticalHeadGroup}/members`);
                const headMembers = res.data?.users || [];
                const isVerticalHead = headMembers.some(u => u.name === member.name);

                if (isVerticalHead) {
                    // User is a vertical head - show modal to assign new head
                    setVerticalHeadUser(member);
                    setSelectedNewHead('');
                    setAvailableHeads(members.users.filter(u => u.name !== member.name));
                    setShowVerticalHeadModal(true);
                    return;
                }
            } catch (err) {
                console.warn('Failed to check vertical head status:', err);
            }
        }

        // Continue with normal remove process
        await handleRemoveClick(member);
    };

    // Handle updating vertical head and then removing user
    const handleConfirmNewHead = async () => {
        if (!selectedNewHead || !verticalHeadUser) return;

        const verticalHeadGroup = getVerticalHeadGroupName(selectedGroup);
        if (!verticalHeadGroup) {
            setToast({ type: 'error', message: 'Failed to determine vertical head group.' });
            return;
        }

        setUpdatingHead(true);
        try {
            // Find the new head user object to get display name
            const newHeadObj = members.users.find(u => u.name === selectedNewHead);
            const newHeadDisplayName = newHeadObj?.name || selectedNewHead;

            // 1. Remove old head from vertical head group
            await api.delete(`/groups/${verticalHeadGroup}/members/${verticalHeadUser.name}`, {
                params: { memberType: 'user' },
            });

            // 2. Add new head to vertical head group
            await api.post(`/groups/${verticalHeadGroup}/members`, {
                memberName: selectedNewHead,
                memberType: 'user',
            });

            // 3. Update the vertical head group's display name with new user
            try {
                const newDisplayName = selectedGroup.replace(/_/g, '-').toUpperCase() + ` -${newHeadDisplayName}`;
                await api.put(`/groups/${verticalHeadGroup}/display-name`, { displayName: newDisplayName });
            } catch (displayErr) {
                console.warn('Failed to update display name:', displayErr);
                // Don't fail the entire operation if display name update fails
            }

            setToast({ type: 'success', message: `Vertical head updated to '${newHeadDisplayName}'.` });
            setShowVerticalHeadModal(false);

            // Refresh both vertical members AND vertical head members to update the UI
            const [membersRes, vhMembersRes] = await Promise.allSettled([
                api.get(`/groups/${selectedGroup}/members`),
                api.get(`/groups/${verticalHeadGroup}/members`),
            ]);

            if (membersRes.status === 'fulfilled') {
                setMembers({
                    users: membersRes.value.data?.users || [],
                    groups: membersRes.value.data?.groups || [],
                });
            }

            // Refresh vertical head members to update the badge
            if (vhMembersRes.status === 'fulfilled') {
                setVerticalHeadMembers(vhMembersRes.value.data?.users || []);
            }

            // Now proceed with removing the old head user
            await handleRemoveClick(verticalHeadUser);
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Failed to update vertical head.' });
        } finally {
            setUpdatingHead(false);
        }
    };

    // ── Delegate Case Modal ──────────────────────────────────────────────────
    const DelegateCaseModal = () => {
        if (!delegateTask) return null;
        const caseName   = pfield(delegateTask, 'object_name') || delegateTask.caseName || '—';
        const deptName   = pfield(delegateTask, 'department_name') || '';
        const parts      = caseName.split('-');
        const offType    = (parts[1] || '').toUpperCase();
        const isRoTe     = offType === 'RO' || offType === 'TE';
        const roCode     = (parts[2] || '').toLowerCase();
        const allLocs    = offType === 'TE' ? TE_LOCATIONS : RO_LOCATIONS;
        const locLabel   = isRoTe ? (allLocs.find(l => l.shortCode === roCode)?.location || roCode.toUpperCase()) : null;
        const deptShortCode = isRoTe ? parts[3] : parts[1] || '';
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm">
                                <ArrowRightLeft size={17} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">Delegate Case</p>
                                <p className="text-xs text-slate-500 font-mono">{caseName}</p>
                            </div>
                        </div>
                        <button onClick={() => setDelegateTask(null)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        <div className="text-xs text-slate-500 space-y-1">
                            {isRoTe && locLabel && (
                                <div>Location: <span className="font-semibold text-slate-700">{locLabel}</span> <span className="text-slate-400">({offType})</span></div>
                            )}
                            {deptName && (
                                <div>Department: <span className="font-semibold text-slate-700">{deptName}</span>
                                    {deptShortCode && <span className="ml-1 text-slate-400">({deptShortCode})</span>}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                                <Users size={12} /> Select User to Delegate
                            </label>
                            {loadingDelegateUsers ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                    <Loader2 size={14} className="animate-spin" /> Loading users…
                                </div>
                            ) : delegateUsers.length === 0 ? (
                                <div className="text-xs text-slate-400 py-2">No users found for {isRoTe ? <><span className="font-semibold">{locLabel || roCode.toUpperCase()}</span> ({offType})</> : <>department <span className="font-semibold">{deptShortCode}</span></>}.</div>
                            ) : (
                                <Select
                                    value={delegateSelectedUser}
                                    onChange={setDelegateSelectedUser}
                                    placeholder="— Select user —"
                                    options={delegateUsers.map(u => ({ value: u.object_name, label: u.object_name }))}
                                />
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-6 pb-5">
                        <button onClick={() => setDelegateTask(null)}
                            className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleDelegateConfirm}
                            disabled={!delegateSelectedUser || !!delegatingCaseId}
                            className="flex items-center gap-1.5 px-4 py-2 bg-canopy hover:bg-canopy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all">
                            {delegatingCaseId ? <><Loader2 size={12} className="animate-spin" /> Delegating…</> : <><ArrowRightLeft size={12} /> Delegate</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Vertical Head Assignment Modal ──────────────────────────────────────────
    const VerticalHeadModal = () => {
        if (!showVerticalHeadModal || !verticalHeadUser) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50">
                        <h2 className="text-lg font-bold text-slate-900">Assign New Vertical Head</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {verticalHeadUser.name} is a vertical head. Assign a new head before removing.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                                Select New Vertical Head <span className="text-danger">*</span>
                            </label>
                            <Select
                                value={selectedNewHead}
                                onChange={setSelectedNewHead}
                                placeholder="— Select new head —"
                                options={availableHeads.map((user) => ({ value: user.name, label: user.name }))}
                            />
                        </div>

                        <div className="p-3 bg-canopy-tint border border-canopy/20 rounded-lg">
                            <p className="text-xs text-canopy">
                                <strong>Note:</strong> The selected user will be assigned as the new vertical head before {verticalHeadUser.name} is removed from the vertical.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                        <button
                            onClick={() => {
                                setShowVerticalHeadModal(false);
                                setVerticalHeadUser(null);
                                setSelectedNewHead('');
                            }}
                            disabled={updatingHead}
                            className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-all disabled:opacity-40">
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmNewHead}
                            disabled={!selectedNewHead || updatingHead}
                            className="flex items-center gap-2 px-4 py-2 bg-canopy hover:bg-canopy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all">
                            {updatingHead ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Updating…
                                </>
                            ) : (
                                <>
                                    <Check size={14} />
                                    Assign Head
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-5">
            <DelegateCaseModal />
            <VerticalHeadModal />
            <Card className="space-y-4">
                <SectionTitle>Select Group</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <Label icon={Building2}>Office Type</Label>
                        <Select value={officeType} onChange={handleOfficeTypeChange}
                            disabled={isLocalAdmin}
                            placeholder="— Select office type —"
                            options={[
                                { value: 'HO', label: 'HO — Head Office' },
                            ]} />
                    </div>
                    {isROTE && (
                        <div>
                            <Label icon={MapPin}>Location</Label>
                            <Select value={location} onChange={handleLocationChange}
                                disabled={!officeType || isLocalAdmin}
                                placeholder="— Select location —"
                                options={getLocations(officeType).map(l => ({ value: l.location, label: l.location }))} />
                        </div>
                    )}
                    <div>
                        <Label icon={Layers}>Department</Label>
                        <Select value={dept} onChange={handleDeptChange}
                            disabled={!officeType || (isROTE && !location)}
                            placeholder={!officeType ? '— Select office type first —' : (isROTE && !location) ? '— Select location first —' : '— Select dept —'}
                            options={deptOptions.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))} />
                    </div>
                </div>
                <div>
                    <Label icon={UsersRound}>Vertical / Group</Label>
                    {loadingVerts
                        ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                        : <Select value={selectedGroup} onChange={handleGroupChange}
                            disabled={!officeType || (isROTE ? !location : !dept) || verticals.length === 0}
                            placeholder={
                                !officeType ? '— Select office type first —'
                                : (isROTE && !location) ? '— Select location first —'
                                : verticals.length === 0 ? 'No groups found'
                                : '— Select group —'
                            }
                            options={verticals.map(g => ({ value: g.group_name, label: g.object_name || g.group_name }))} />
                    }
                </div>
            </Card>

            {selectedGroup && (
                <Card>
                    <div className="flex items-center justify-between mb-3">
                        <SectionTitle>Members of <span className="font-mono normal-case">{verticals.find(g => g.group_name === selectedGroup)?.object_name || selectedGroup}</span></SectionTitle>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">{allMembers.length}</span>
                    </div>

                    {loadingMembers
                        ? <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
                        : allMembers.length === 0
                            ? <p className="text-sm text-slate-400 text-center py-4">No members in this group</p>
                            : <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                {allMembers.map(m => (
                                    <div key={`${m.type}-${m.name}`}>
                                        {/* Member row */}
                                        <div className={`flex items-center justify-between px-4 py-2.5 transition-colors ${pendingRemove?.name === m.name ? 'bg-danger-tint/60' : ''}`}>
                                            <div className="flex items-center gap-2.5">
                                                <MemberTag type={m.type} />
                                                <span className="text-sm text-slate-700 font-mono">{m.name}</span>
                                                {m.type === 'user' && verticalHeadMembers.some(h => h.name === m.name) && (
                                                    <span className="px-2 py-0.5 bg-harvest/15 text-harvest text-xs font-semibold rounded-full whitespace-nowrap">
                                                        Vertical Head
                                                    </span>
                                                )}
                                            </div>
                                            <button onClick={() => handleRemoveClickWithHeadCheck(m)}
                                                className={`p-1.5 rounded-lg transition-colors ${pendingRemove?.name === m.name ? 'text-danger/70 bg-danger-tint' : 'text-slate-400 hover:text-danger hover:bg-danger-tint'}`}
                                                title={pendingRemove?.name === m.name ? 'Cancel' : 'Remove'}>
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Inline inbox panel — shown only for the pending member */}
                                        {pendingRemove?.name === m.name && (
                                            <div className="border-t border-danger-tint bg-slate-50 px-4 py-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                                        <ClipboardList size={11} /> Case Inbox — {m.name}
                                                    </p>
                                                    {computeCasePrefix() && (
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                            filter: {computeCasePrefix()}*
                                                        </span>
                                                    )}
                                                </div>

                                                {loadingInbox && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                                        <Loader2 size={14} className="animate-spin" /> Checking inbox…
                                                    </div>
                                                )}

                                                {!loadingInbox && m.type === 'user' && (
                                                    <>
                                                        {hasPendingCases ? (
                                                            <>
                                                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-harvest/10 border border-harvest/25 rounded-xl text-sm text-harvest">
                                                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-harvest" />
                                                                    <span>Kindly delegate the pending cases to remove this user from the vertical.</span>
                                                                </div>
                                                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                                                        <span className="px-2 py-0.5 text-xs bg-harvest/15 text-harvest rounded-full font-medium">{inboxTotal}</span>
                                                                    </div>
                                                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                                                        {inboxTasks.map((task, idx) => {
                                                                            const pf = (f) => task[`packagescase_folder${f}`] || task[f] || '';
                                                                            const caseName = pf('object_name') || task.caseName || '—';
                                                                            const desc     = pf('description') || '';
                                                                            const status   = pf('status') || task.status || '';
                                                                            const priority = pf('task_priority') || task.priority || '';
                                                                            return (
                                                                            <div key={pf('id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-medium text-slate-800 truncate">{caseName}</p>
                                                                                    <p className="text-xs text-slate-500 truncate">{desc}</p>
                                                                                </div>
                                                                                <div className="shrink-0 flex items-center gap-1.5">
                                                                                    {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium whitespace-nowrap">{status}</span>}
                                                                                    {priority && (
                                                                                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                                            priority === 'High' ? 'bg-danger-tint text-danger' :
                                                                                            priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                                                            'bg-slate-100 text-slate-600'
                                                                                        }`}>{priority}</span>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => handleDelegateClick(task)}
                                                                                        className="flex items-center gap-1 px-2 py-1 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap">
                                                                                        <ArrowRightLeft size={11} /> Delegate
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-sm text-canopy bg-canopy-tint border border-canopy/20 rounded-xl px-3 py-2.5">
                                                                <CheckCircle2 size={14} className="shrink-0" />
                                                                No pending cases. Safe to remove.
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                <div className="flex items-center gap-2 pt-1">
                                                    <button
                                                        onClick={handleConfirmRemove}
                                                        disabled={hasPendingCases || removing || loadingInbox}
                                                        title={hasPendingCases ? 'Delegate pending cases first' : ''}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                        {removing ? <><Loader2 size={12} className="animate-spin" /> Removing…</> : 'Remove'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setPendingRemove(null); setInboxTasks([]); setInboxTotal(0); }}
                                                        className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                    }
                </Card>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const VerticalsPage = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole  = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isSuperAdmin = adminRole === 'Super Admin';

    const [pageTab,  setPageTab]  = useState(isSuperAdmin ? 'creation' : 'members');
    const [innerTab, setInnerTab] = useState('add');
    const globalToast = useToast();
    const [toast, setToast] = useState(null);
    useEffect(() => { if (toast) globalToast.show(toast); }, [toast, globalToast]);

    const PAGE_TABS = isSuperAdmin
        ? [
            { key: 'creation', label: 'Vertical Creation' },
            { key: 'members',  label: 'Manage Members'    },
          ]
        : [
            { key: 'members',  label: 'Manage Members'    },
          ];
    const INNER_TABS = [
        { key: 'add',    label: 'Add Members',    icon: UserPlus   },
        { key: 'remove', label: 'Remove Members', icon: UserCheck  },
    ];

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader
                title="Verticals"
                icon={Layers}
                description="Manage HO verticals (dm_group) and their members"
            />

            <Tabs
                className="mb-6"
                value={pageTab}
                onChange={setPageTab}
                tabs={PAGE_TABS.map(t => ({ id: t.key, label: t.label }))}
            />

            {pageTab === 'creation' && <VerticalCreationTab setToast={setToast} />}

            {pageTab === 'members' && (
                <>
                    {/* Inner tabs for Manage Members */}
                    <Tabs
                        className="mb-5"
                        value={innerTab}
                        onChange={setInnerTab}
                        tabs={INNER_TABS.map(t => ({ id: t.key, label: t.label, icon: t.icon }))}
                    />
                    {innerTab === 'add'    && <AddMembersTab    setToast={setToast} />}
                    {innerTab === 'remove' && <RemoveMembersTab setToast={setToast} />}
                </>
            )}
        </div>
    );
};

export default VerticalsPage;
