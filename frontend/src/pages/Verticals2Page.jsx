import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import {
    Layers, Tag, Users, UserPlus, X, Loader2, Check,
    CheckCircle2, AlertCircle, ChevronDown, Building2, MapPin,
    UserCheck, UsersRound, Star, ClipboardList, ArrowRightLeft,
} from 'lucide-react';
import { RO_LOCATIONS, TE_LOCATIONS, getLocations, fetchDepartments } from '../data/nabardMetadata.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeSuffix(raw) {
    return raw.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Converts group name to vertical head group name.
 * HO: 'ecm_ho_ddsi' → 'ecm_ho_vertical_head_ddsi'
 * RO/TE: 'ecm_mp_fad' → 'ecm_mp_vertical_head_fad'
 */
function toVerticalHeadName(groupName) {
    if (!groupName) {
        console.warn('[toVerticalHeadName] Empty/null groupName:', { groupName, type: typeof groupName });
        return '';
    }

    const normalized = String(groupName).trim().toLowerCase();

    if (!normalized.startsWith('ecm_')) {
        console.warn('[toVerticalHeadName] Invalid format (not ecm_*):', {
            original: groupName,
            normalized
        });
        return '';
    }

    // HO pattern: ecm_ho_<anything>
    if (normalized.startsWith('ecm_ho_')) {
        const rest = normalized.slice(7); // 'ecm_ho_'.length = 7
        const result = `ecm_ho_vertical_head_${rest}`;
        console.log('[toVerticalHeadName] HO:', { groupName, rest, result });
        return result;
    }

    // RO/TE pattern: ecm_<location>_<dept>[_suffix]
    // Split and assume 2-letter location code (parts[1])
    const parts = normalized.split('_');
    console.log('[toVerticalHeadName] RO/TE split:', { groupName, normalized, parts, length: parts.length });

    if (parts.length < 3) {
        // ecm_<location> with no dept — invalid
        console.warn('[toVerticalHeadName] RO/TE: not enough parts (need ≥3):', {
            groupName,
            parts,
            length: parts.length
        });
        return '';
    }

    // parts[0]='ecm', parts[1]=location, parts[2]=dept, parts[3+]=suffix
    const prefix = `${parts[0]}_${parts[1]}_`; // 'ecm_<loc>_'
    const rest = parts.slice(2).join('_');    // 'dept[_suffix]'
    const result = `${prefix}vertical_head_${rest}`;

    console.log('[toVerticalHeadName] RO/TE result:', {
        original: groupName,
        normalized,
        prefix,
        rest,
        result
    });
    return result;
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

const Label = ({ children, icon: Icon }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={11} />}{children}
    </label>
);

const Select = ({ value, onChange, disabled, placeholder, options = [], className = '' }) => (
    <div className="relative">
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm appearance-none pr-10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] cursor-pointer
                ${disabled ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'}
                ${className}`}
        >
            <option value="">{placeholder}</option>
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
);

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
        type === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
    }`}>{type}</span>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(onDismiss, toast.type === 'success' ? 3000 : 5000);
        return () => clearTimeout(t);
    }, [toast, onDismiss]);
    if (!toast) return null;
    const styles = { success: 'bg-green-50 text-green-800 border-green-200', error: 'bg-red-50 text-red-800 border-red-200' };
    const Icon = toast.type === 'success' ? CheckCircle2 : AlertCircle;
    return (
        <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-start gap-3 px-4 py-3 border rounded-xl shadow-lg max-w-sm ${styles[toast.type]}`}>
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
    );
};

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
            await api.post('/groups', { group_name: groupName, group_display_name: groupDisplayName });

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
                return;
            }

            setToast({ type: 'success', message: `Vertical '${groupName}' and folder created successfully.` });
            setDept(''); setSuffix(''); setVerticalFullName(''); setVerticalShortcode('');
        } catch (err) {
            setToast({ type: 'error', message: `Failed: ${err.response?.data?.message || err.message}` });
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
                <Label icon={Layers}>Department <span className="text-red-500">*</span></Label>
                <Select
                    value={dept} onChange={v => { setDept(v); setSuffix(''); }}
                    placeholder="— Select department —"
                    options={hoDepts.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label icon={Tag}>Vertical Full Name <span className="text-red-500">*</span></Label>
                    <input type="text" value={verticalFullName} onChange={e => setVerticalFullName(e.target.value)}
                        placeholder="e.g. Digital Initiatives and Technology"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] bg-white" />
                </div>

                <div>
                    <Label icon={Tag}>Vertical Shortcode <span className="text-red-500">*</span></Label>
                    <input type="text" value={verticalShortcode} onChange={e => setVerticalShortcode(e.target.value)}
                        placeholder="e.g. DIT"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] bg-white" />
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
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : 'Create Vertical'}
            </button>
        </Card>
    );
};

// ─── Multi-Select Users Component ─────────────────────────────────────────────
const MultiSelectUsers = ({ value = [], onChange, disabled, placeholder, options = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);
    const panelRef     = useRef(null);
    const [panelStyle, setPanelStyle] = useState({});

    const openPanel = () => {
        if (containerRef.current) {
            const r = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - r.bottom - 8;
            const panelH = Math.min(options.length * 36 + 8, 256);
            const top = spaceBelow >= panelH ? r.bottom + 4 : Math.max(8, r.top - panelH - 4);
            setPanelStyle({ top, left: r.left, width: r.width, maxHeight: Math.min(panelH, 256) });
        }
        setIsOpen(true);
    };

    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            if (containerRef.current && !containerRef.current.contains(e.target) &&
                panelRef.current && !panelRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className={`border rounded-xl bg-white transition-all ${
                isOpen ? 'border-[#0A66C2] ring-2 ring-blue-500/20' : 'border-slate-200'
            } ${disabled ? 'bg-slate-100' : ''}`}>
                <div className="p-2 flex flex-wrap gap-1 min-h-10">
                    {value.map(val => {
                        const opt = options.find(o => o.value === val);
                        return (
                            <div key={val} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                                <span>{opt?.label.split('(')[0].trim() || val}</span>
                                <button
                                    onClick={() => removeUser(val)}
                                    className="text-blue-600 hover:text-blue-800 ml-0.5"
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
                        onFocus={openPanel}
                        disabled={disabled}
                        className="flex-1 outline-none text-sm py-1 px-1 min-w-32 bg-transparent"
                    />
                </div>
            </div>

            {isOpen && !disabled && (
                <div ref={panelRef} style={panelStyle} className="fixed bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-y-auto overscroll-contain">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => toggleUser(opt.value)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors flex items-center gap-2 border-b border-slate-100 last:border-b-0 ${
                                    value.includes(opt.value) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-800'
                                }`}
                            >
                                <Check size={16} className={`flex-shrink-0 ${value.includes(opt.value) ? 'text-blue-600' : 'opacity-0'}`} />
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

// ─── Add Members Tab ──────────────────────────────────────────────────────────
const AddMembersTab = ({ setToast }) => {
    const storedUser   = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole    = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);

    const [officeType,        setOfficeType]        = useState('');
    const [location,          setLocation]          = useState('');
    const [roShortCode,       setRoShortCode]       = useState('');
    const [dept,              setDept]              = useState('');
    const [verticals,         setVerticals]         = useState([]);
    const [selectedVertical,  setSelectedVertical]  = useState('');
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
        setSelectedVertical(''); setVerticals([]);
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
        setSelectedVertical(''); setVerticals([]);
        setVerticalMembers({ users: [], groups: [] });
        setVhGroupName(''); setVhExists(false); setVhMembers([]);
        if (!v) return;
        const d = deptOptions.find(d => d.name === v);
        if (!d) return;

        const prefix = officeType === 'HO'
            ? `ecm_ho_${d.shortCode.toLowerCase()}`
            : `ecm_${roShortCode.toLowerCase()}_${d.shortCode.toLowerCase()}`;

        console.log('handleDeptChange:', { v, officeType, deptShortCode: d.shortCode, roShortCode, prefix });

        setLoadingVerticals(true);
        try {
            const res = await api.get('/groups/by-prefix', { params: { prefix } });
            console.log('API response for groups/by-prefix:', res.data);
            const all = res.data || [];
            const filtered = all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec'));
            console.log('Filtered verticals:', filtered);
            setVerticals(filtered);
            // Auto-select if only one group exists
            if (filtered.length === 1) {
                const singleGroupName = filtered[0].group_name;
                setSelectedVertical(singleGroupName);
                console.log('[handleDeptChange] Auto-selecting single vertical:', singleGroupName);
                // Use updateVerticalInfo to calculate vhGroupName and fetch members
                await updateVerticalInfo(singleGroupName);
            } else {
                // Multiple groups: clear vertical head info until user selects one
                setVerticalMembers({ users: [], groups: [] });
                setVhGroupName('');
                setVhExists(false);
                setVhMembers([]);
                setVhCurrentDisplayName('');
            }
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

    // Shared logic to update vertical info (called from both handleVerticalChange and auto-select)
    const updateVerticalInfo = useCallback(async (verticalGroupName) => {
        if (!verticalGroupName) {
            setVerticalMembers({ users: [], groups: [] });
            setVhGroupName('');
            setVhExists(false);
            setVhMembers([]);
            setVhCurrentDisplayName('');
            return;
        }

        // Calculate vertical head name
        const vhName = toVerticalHeadName(verticalGroupName);
        console.log('[updateVerticalInfo] Calculated vhName:', {
            verticalGroupName,
            vhName,
            vhNameLength: vhName ? vhName.length : 0
        });

        if (!vhName) {
            console.error('[updateVerticalInfo] WARNING: toVerticalHeadName returned empty for:', {
                input: verticalGroupName,
                type: typeof verticalGroupName,
                length: String(verticalGroupName).length
            });
        }

        // Set the vertical head group name
        setVhGroupName(vhName);

        // Fetch members and vertical head info in parallel
        setLoadingMembers(true);
        try {
            const [membersRes, vhRes, vhMembersRes] = await Promise.allSettled([
                api.get(`/groups/${verticalGroupName}/members`),
                vhName ? api.get(`/groups/exists/${vhName}`) : Promise.resolve({ status: 'fulfilled', value: { data: { exists: false } } }),
                vhName ? api.get(`/groups/${vhName}/members`) : Promise.resolve({ status: 'fulfilled', value: { data: { users: [] } } }),
            ]);

            console.log('[updateVerticalInfo] API responses:', {
                membersStatus: membersRes.status,
                vhStatus: vhRes.status,
                vhMembersStatus: vhMembersRes.status
            });

            if (membersRes.status === 'fulfilled') {
                setVerticalMembers({
                    users:  membersRes.value.data.users  || [],
                    groups: membersRes.value.data.groups || [],
                });
            }
            if (vhRes.status === 'fulfilled') {
                const exists = vhRes.value.data.exists;
                setVhExists(exists);
                const vhProps = vhRes.value.data.properties;
                const displayName = vhProps?.group_display_name || '';
                setVhCurrentDisplayName(displayName);
                console.log('[updateVerticalInfo] VH exists:', { exists, displayName });
            } else if (vhRes.status === 'rejected') {
                console.warn('[updateVerticalInfo] VH check failed:', vhRes.reason?.message);
            }
            if (vhMembersRes.status === 'fulfilled') {
                setVhMembers(vhMembersRes.value.data.users || []);
            }
        } catch (err) {
            console.error('[updateVerticalInfo] Error:', err);
        } finally {
            setLoadingMembers(false);
        }
    }, []);

    // On vertical change (from dropdown selection)
    const handleVerticalChange = useCallback(async (v) => {
        console.log('[handleVerticalChange] Start:', { v });
        setSelectedVertical(v);
        setVerticalMembers({ users: [], groups: [] });
        setVhGroupName(''); setVhExists(false); setVhMembers([]);
        setVhCurrentDisplayName('');

        if (!v) {
            console.log('[handleVerticalChange] Empty selection, returning early');
            return;
        }

        await updateVerticalInfo(v);
    }, [updateVerticalInfo]);

    // On user change
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
        if (!selectedVertical || selectedUsers.length === 0) return;
        if (usersAlreadyInGroup.length > 0) {
            const alreadyMemberNames = usersAlreadyInGroup.join(', ');
            setToast({ type: 'error', message: `'${alreadyMemberNames}' already member(s) of '${selectedVertical}'.` });
            return;
        }
        setAdding(true);
        try {
            for (const loginName of selectedUsers) {
                await api.post(`/groups/${selectedVertical}/members`, {
                    memberName: loginName, memberType: 'user',
                });
                const userObj = users.find(u => u.user_login_name === loginName);
                const userProfileId = userObj?.r_object_id || '';
                if (userProfileId) {
                    api.post(`/users/profiles/${userProfileId}/vertical-ids`, {
                        verticalGroupName: selectedVertical,
                    }).catch(e => console.warn('vertical_ids update failed:', e?.response?.data?.message || e.message));
                }
            }
            setToast({ type: 'success', message: `${selectedUsers.length} user(s) added to '${selectedVertical}'.` });
            setSelectedUsers([]);
            // Refresh members
            const membersRes = await api.get(`/groups/${selectedVertical}/members`);
            if (membersRes.data) setVerticalMembers({ users: membersRes.data.users || [], groups: membersRes.data.groups || [] });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to add members.';
            setToast({ type: 'error', message: msg });
        } finally { setAdding(false); }
    };

    const handleMarkVerticalHead = async () => {
        console.log('[handleMarkVerticalHead] Start:', {
            selectedVertical,
            selectedUsers,
            vhGroupName,
            vhExists
        });

        if (!selectedVertical || selectedUsers.length === 0) {
            console.warn('[handleMarkVerticalHead] Missing required fields:', {
                selectedVertical,
                selectedUsersCount: selectedUsers.length
            });
            return;
        }

        if (!vhGroupName) {
            console.error('[handleMarkVerticalHead] vhGroupName is empty! This should have been set in handleVerticalChange');
            setToast({ type: 'error', message: 'Vertical head group name is not set. Please select a vertical first.' });
            return;
        }

        const firstUser = selectedUsers[0];
        const userObj = users.find(u => u.user_login_name === firstUser);
        const userDisplayName = userObj?.object_name || firstUser;

        setCreatingVH(true);
        try {
            const vhDisplayName = selectedVertical.replace(/_/g, '-').toUpperCase() + ` -${userDisplayName}`;
            console.log('[handleMarkVerticalHead] Creating VH:', {
                vhGroupName,
                vhDisplayName,
                firstUser,
                userDisplayName
            });

            // Try to create the group (it might already exist)
            try {
                const createRes = await api.post('/groups', {
                    group_name: vhGroupName,
                    group_display_name: vhDisplayName
                });
                console.log('[handleMarkVerticalHead] Group created:', createRes.data);
            } catch (createErr) {
                const msg = createErr.response?.data?.message || '';
                console.warn('[handleMarkVerticalHead] Group creation error (checking if already exists):', {
                    status: createErr.response?.status,
                    message: msg
                });
                // If it's an "already exists" error, continue — we just want to add the user
                if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exist')) {
                    throw createErr;
                }
            }

            // Add the user to the vertical head group
            await api.post(`/groups/${vhGroupName}/members`, {
                memberName: firstUser,
                memberType: 'user'
            });

            setToast({
                type: 'success',
                message: `Vertical head '${vhGroupName}' created and '${firstUser}' assigned.`
            });
            setVhExists(true);

            // Refresh vertical head members
            const vhMembersRes = await api.get(`/groups/${vhGroupName}/members`);
            if (vhMembersRes.data) {
                setVhMembers(vhMembersRes.data.users || []);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to create vertical head.';
            console.error('[handleMarkVerticalHead] Error:', { error: err, message: errorMsg });
            setToast({ type: 'error', message: errorMsg });
        } finally {
            setCreatingVH(false);
        }
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
                api.get(`/groups/${selectedVertical}/members`), // Refresh main vertical members to update badges
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

    const showMarkVHButton = selectedVertical && selectedUsers.length === 1;
    const canAdd = selectedVertical && selectedUsers.length > 0 && usersAlreadyInGroup.length === 0;

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
                                { value: 'RO', label: 'RO — Regional Office' },
                                { value: 'TE', label: 'TE — Training Establishment' },
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
                    {/* Group */}
                    <div>
                        <Label icon={UsersRound}>Group</Label>
                        {loadingVerticals
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <Select value={selectedVertical} onChange={handleVerticalChange}
                                disabled={(isROTE ? (!location || !dept) : !dept) || verticals.length === 0}
                                placeholder={isROTE ? (!location ? '— Select location first —' : !dept ? '— Select department first —' : verticals.length === 0 ? 'No verticals found' : '— Select vertical —') : (!dept ? '— Select dept first —' : verticals.length === 0 ? 'No verticals found' : '— Select vertical —')}
                                options={verticals.map(g => ({ value: g.group_name, label: g.group_name }))} />
                        }
                    </div>
                    {/* User */}
                    <div>
                        <Label icon={Users}>User</Label>
                        {loadingUsers
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <>
                                <MultiSelectUsers
                                    value={selectedUsers}
                                    onChange={setSelectedUsers}
                                    disabled={!officeType || users.length === 0}
                                    placeholder={!officeType ? '— Select office type first —' : users.length === 0 ? 'No users found' : 'Search and select users...'}
                                    options={users.map(u => ({ value: u.user_login_name, label: `${u.object_name} (${u.user_login_name})` }))}
                                />
                                {usersAlreadyInGroup.length > 0 && (
                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                        <AlertCircle size={13} /> {usersAlreadyInGroup.join(', ')} already member(s)
                                    </p>
                                )}
                              </>
                        }
                    </div>
                </div>
            </Card>

            {/* ── Step 2: Info panels (members + vertical head) ── */}
            {(selectedVertical || selectedUsers.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

                    {/* 1 — Vertical Members */}
                    {selectedVertical && (
                        <Card>
                            <SectionTitle>Vertical Members</SectionTitle>
                            {loadingMembers
                                ? <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                                : [...verticalMembers.users, ...verticalMembers.groups].length === 0
                                    ? <p className="text-xs text-slate-400 text-center py-3">No members</p>
                                    : <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain">
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
                    {selectedVertical && (
                        <Card>
                            <SectionTitle>Vertical Head Group</SectionTitle>
                            <p className="text-xs font-mono text-slate-400 mb-2 break-all">{vhGroupName}</p>
                            {loadingMembers
                                ? <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
                                : vhExists
                                    ? <>
                                        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 mb-2">
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
                                            <select
                                                value={modifyVHSelectedUser}
                                                onChange={e => setModifyVHSelectedUser(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2]"
                                            >
                                                <option value="">— Select new head —</option>
                                                {verticalMembers.users.map(u => {
                                                    const obj = users.find(x => x.user_login_name === u.name);
                                                    return (
                                                        <option key={u.name} value={u.name}>
                                                            {obj ? `${obj.object_name} (${u.name})` : u.name}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <button
                                                onClick={handleModifyVerticalHead}
                                                disabled={!modifyVHSelectedUser || modifyingVH}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {modifyingVH
                                                    ? <><Loader2 size={12} className="animate-spin" /> Updating…</>
                                                    : <><Star size={12} /> Update Vertical Head</>}
                                            </button>
                                        </div>
                                    </>
                                    : <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                        <AlertCircle size={12} /> Not yet created
                                    </div>
                            }
                        </Card>
                    )}

                </div>
            )}

            {/* ── Step 3: Action buttons ── */}
            {selectedVertical && selectedUsers.length > 0 && (
                <Card className="space-y-3">
                    <SectionTitle>Actions</SectionTitle>

                    <div className="flex flex-wrap gap-3">
                        {/* Add to Group */}
                        <button onClick={handleAddToGroup} disabled={!canAdd || adding}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {adding
                                ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
                                : <><UserPlus size={14} /> Add to Vertical</>}
                        </button>

                        {/* Mark Vertical Head */}
                        {showMarkVHButton && (
                            <button onClick={handleMarkVerticalHead} disabled={creatingVH || vhExists}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {creatingVH
                                    ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                                    : <><Star size={14} /> Mark Vertical Head</>}
                            </button>
                        )}

                    </div>

                    <p className="text-xs text-slate-400">
                        Adding <span className="font-mono text-slate-600">{selectedUsers.length} user(s)</span> to <span className="font-mono text-slate-600">{selectedVertical}</span>
                        {vhGroupName && <> · Vertical head group: <span className="font-mono text-slate-600">{vhGroupName}</span>{vhExists ? ' (exists)' : ''}</>}
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

    const [officeType,     setOfficeType]     = useState('');
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
            const res = await api.post('/delegate', { caseId, performerDisplayName: delegateSelectedUser });
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
                setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec')));
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
        // Fetch all RO/TE verticals by ecm_<roCode> prefix on location select
        setLoadingVerts(true);
        try {
            const res = await api.get('/groups/by-prefix', { params: { prefix: `ecm_${roCode.toLowerCase()}` } });
            const all = res.data || [];
            setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec')));
        } catch { setVerticals([]); }
        finally { setLoadingVerts(false); }
    };

    const handleDeptChange = async (v) => {
        setDept(v); setSelectedGroup(''); setVerticals([]); setMembers({ users: [], groups: [] });
        if (!v) return;
        const d = deptOptions.find(d => d.name === v);
        if (!d) return;
        const prefix = officeType === 'HO'
            ? `ecm_ho_${d.shortCode.toLowerCase()}`
            : `ecm_${roShortCode.toLowerCase()}_${d.shortCode.toLowerCase()}`;
        setLoadingVerts(true);
        try {
            const res = await api.get('/groups/by-prefix', { params: { prefix } });
            const all = res.data || [];
            const filtered = all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec'));
            setVerticals(filtered);
            // Auto-select if only one group exists
            if (filtered.length === 1) {
                setSelectedGroup(filtered[0].group_name);
                setLoadingMembers(true);
                try {
                    const membersRes = await api.get(`/groups/${filtered[0].group_name}/members`);
                    setMembers({ users: membersRes.data.users || [], groups: membersRes.data.groups || [] });
                } catch { setMembers({ users: [], groups: [] }); }
                finally { setLoadingMembers(false); }
            }
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
                // Refresh user groups
                api.get('/groups/by-user', { params: { username: pendingRemove.name } })
                    .then(res => setUserGroups(res.data || []))
                    .catch(e => console.warn('Failed to refresh user groups:', e?.response?.data?.message || e.message));
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
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm">
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
                                <div className="relative">
                                    <select
                                        value={delegateSelectedUser}
                                        onChange={e => setDelegateSelectedUser(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none pr-8 cursor-pointer"
                                    >
                                        <option value="">— Select user —</option>
                                        {delegateUsers.map(u => (
                                            <option key={u.r_object_id || u.user_login_name} value={u.object_name}>
                                                {u.object_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
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
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all">
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
                    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
                        <h2 className="text-lg font-bold text-slate-900">Assign New Vertical Head</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {verticalHeadUser.name} is a vertical head. Assign a new head before removing.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                                Select New Vertical Head <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedNewHead}
                                onChange={(e) => setSelectedNewHead(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none cursor-pointer">
                                <option value="">— Select new head —</option>
                                {availableHeads.map((user) => (
                                    <option key={user.name} value={user.name}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-700">
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
                            className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all">
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
                                { value: 'RO', label: 'RO — Regional Office' },
                                { value: 'TE', label: 'TE — Training Establishment' },
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
                    <Label icon={UsersRound}>Group</Label>
                    {loadingVerts
                        ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                        : <Select value={selectedGroup} onChange={handleGroupChange}
                            disabled={!officeType || (isROTE ? (!location || !dept) : !dept) || verticals.length === 0}
                            placeholder={
                                !officeType ? '— Select office type first —'
                                : (isROTE && !location) ? '— Select location first —'
                                : (isROTE && !dept) ? '— Select department first —'
                                : (!isROTE && !dept) ? '— Select department first —'
                                : verticals.length === 0 ? 'No groups found'
                                : '— Select group —'
                            }
                            options={verticals.map(g => ({ value: g.group_name, label: g.group_name }))} />
                    }
                </div>
            </Card>

            {selectedGroup && (
                <Card>
                    <div className="flex items-center justify-between mb-3">
                        <SectionTitle>Members of <span className="font-mono normal-case">{selectedGroup}</span></SectionTitle>
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
                                        <div className={`flex items-center justify-between px-4 py-2.5 transition-colors ${pendingRemove?.name === m.name ? 'bg-red-50/60' : ''}`}>
                                            <div className="flex items-center gap-2.5">
                                                <MemberTag type={m.type} />
                                                <span className="text-sm text-slate-700 font-mono">{m.name}</span>
                                                {m.type === 'user' && verticalHeadMembers.some(h => h.name === m.name) && (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full whitespace-nowrap">
                                                        Vertical Head
                                                    </span>
                                                )}
                                            </div>
                                            <button onClick={() => handleRemoveClickWithHeadCheck(m)}
                                                className={`p-1.5 rounded-lg transition-colors ${pendingRemove?.name === m.name ? 'text-red-400 bg-red-100' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                                                title={pendingRemove?.name === m.name ? 'Cancel' : 'Remove'}>
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Inline inbox panel — shown only for the pending member */}
                                        {pendingRemove?.name === m.name && (
                                            <div className="border-t border-red-100 bg-slate-50 px-4 py-4 space-y-3">
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
                                                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                                                    <span>Kindly delegate the pending cases to remove this user from the vertical.</span>
                                                                </div>
                                                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{inboxTotal}</span>
                                                                    </div>
                                                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto overscroll-contain">
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
                                                                                    {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">{status}</span>}
                                                                                    {priority && (
                                                                                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                                            priority === 'High' ? 'bg-red-100 text-red-700' :
                                                                                            priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                                            'bg-slate-100 text-slate-600'
                                                                                        }`}>{priority}</span>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => handleDelegateClick(task)}
                                                                                        className="flex items-center gap-1 px-2 py-1 bg-[#0A66C2] hover:bg-[#094d92] text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap">
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
                                                            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
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
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
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
const Verticals2Page = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole  = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isSuperAdmin = adminRole === 'Super Admin';

    const [pageTab,  setPageTab]  = useState('members');
    const [innerTab, setInnerTab] = useState('add');
    const [toast,    setToast]    = useState(null);

    const PAGE_TABS = [
        { key: 'members',  label: 'Manage Members'    },
    ];
    const INNER_TABS = [
        { key: 'add',    label: 'Add Members',    icon: UserPlus   },
        { key: 'remove', label: 'Remove Members', icon: UserCheck  },
    ];

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">RO/TE Department Assignment</h1>
                <p className="text-sm text-slate-500 mt-1">Manage RO/TE Department and their members</p>
            </div>

            {/* Top-level tabs */}
            <div className="flex gap-1 border-b border-slate-200 mb-6">
                {PAGE_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setPageTab(tab.key)}
                        className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                            pageTab === tab.key
                                ? 'border-[#0A66C2] text-[#0A66C2] bg-blue-50/40'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Inner tabs for Manage Members */}
            <div className="flex gap-2 mb-5">
                        {INNER_TABS.map(t => (
                            <button key={t.key} onClick={() => setInnerTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    innerTab === t.key
                                        ? 'bg-[#0A66C2] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                <t.icon size={13} /> {t.label}
                            </button>
                        ))}
                    </div>
            {innerTab === 'add'    && <AddMembersTab    setToast={setToast} />}
            {innerTab === 'remove' && <RemoveMembersTab setToast={setToast} />}
        </div>
    );
};

export default Verticals2Page;
