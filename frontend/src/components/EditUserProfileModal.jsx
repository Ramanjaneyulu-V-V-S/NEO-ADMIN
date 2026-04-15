import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { X, Save, Loader2, User, Building2, MapPin, Tag, Layers, AlertCircle, ArrowRightLeft, Users, ChevronDown } from 'lucide-react';
import { USER_GRADES, DESIGNATION_OPTIONS, getLocations, fetchDepartments, RO_LOCATIONS, TE_LOCATIONS } from '../data/nabardMetadata.js';

const USER_GRADE_OPTIONS = [
    { value: '', label: '— Select grade —', level: '' },
    ...USER_GRADES.map(g => ({ value: g.value, label: g.label, level: g.gradeLevel })),
];

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white';
const readonlyCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-default font-mono';
const selectCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none cursor-pointer';
const disabledSelectCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none';

const Label = ({ children, required }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const errorCls = 'w-full px-3 py-2 border border-red-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-500 bg-white';

const SelectWrapper = ({ children }) => (
    <div className="relative">
        {children}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
);

const EditUserProfileModal = ({ user, isOpen, onClose, onUpdate }) => {
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadingForm, setLoadingForm] = useState(false);
    const [error, setError] = useState(null);
    const [errors, setErrors] = useState({});
    const [designationChanged, setDesignationChanged] = useState(false);
    const originalGroupInfoRef = useRef({ officeType: '', roShortCode: '', deptCodes: [], designation: '' });

    // Pending cases / delegate state
    const [checkingInbox,       setCheckingInbox]       = useState(false);
    const [pendingCases,        setPendingCases]        = useState([]);
    const [showPendingBlock,    setShowPendingBlock]    = useState(false);

    // Office type change — pending cases block
    const [checkingOfficeInbox,    setCheckingOfficeInbox]    = useState(false);
    const [officePendingCases,     setOfficePendingCases]     = useState([]);
    const [showOfficeBlock,        setShowOfficeBlock]        = useState(false);

    // Department change — pending cases block
    const [checkingDeptInbox,      setCheckingDeptInbox]      = useState(false);
    const [deptPendingCases,       setDeptPendingCases]       = useState([]);
    const [showDeptBlock,          setShowDeptBlock]          = useState(false);

    // Location change — pending cases block
    const [checkingLocationInbox,  setCheckingLocationInbox]  = useState(false);
    const [locationPendingCases,   setLocationPendingCases]   = useState([]);
    const [showLocationBlock,      setShowLocationBlock]      = useState(false);

    // Delegate modal state
    const [delegateTask,         setDelegateTask]         = useState(null);
    const [delegateUsers,        setDelegateUsers]        = useState([]);
    const [loadingDelegateUsers, setLoadingDelegateUsers] = useState(false);
    const [delegateSelectedUser, setDelegateSelectedUser] = useState('');
    const [delegatingCaseId,     setDelegatingCaseId]     = useState(null);
    const [delegateError,        setDelegateError]        = useState(null);
    const [deptOptions,          setDeptOptions]          = useState([]);

    useEffect(() => {
        if (!isOpen || !user) return;
        setLoadingForm(true);
        setPendingCases([]);
        setShowPendingBlock(false);
        setOfficePendingCases([]);
        setShowOfficeBlock(false);
        setDeptPendingCases([]);
        setShowDeptBlock(false);
        setLocationPendingCases([]);
        setShowLocationBlock(false);
        setDelegateTask(null);
        setDesignationChanged(false);
        api.get(`/users/profiles/${user.r_object_id}`)
            .then(res => initForm({ ...user, ...res.data }))
            .catch(() => initForm(user));
    }, [isOpen, user]);

    // Auto-populate hindi_designation when designation changes
    useEffect(() => {
        if (!form.designation) return;
        const designationObj = DESIGNATION_OPTIONS.find(opt => opt.value === form.designation);
        if (designationObj && designationObj.hindi) {
            set('hindi_designation', designationObj.hindi);
        }
    }, [form.designation]);

    const initForm = async (profile) => {
        const officeType = profile.office_type || '';
        const location   = profile.location   || '';
        const deptName   = profile.department_name || '';

        const locs        = getLocations(officeType);
        const locObj      = locs.find(l => l.location === location);
        const roShortCode = locObj ? locObj.shortCode : (profile.ro_short_code || '');

        const depts  = officeType ? await fetchDepartments(officeType, location) : [];
        setDeptOptions(depts);
        const isROTE = ['RO', 'TE'].includes(officeType);

        let deptShortCode      = '';
        let deptShortCodeMulti = [];

        if (isROTE) {
            const multiCodes = Array.isArray(profile.department_short_code_multi)
                ? profile.department_short_code_multi
                : (profile.department_short_code ? [profile.department_short_code] : []);
            deptShortCodeMulti = multiCodes;
            deptShortCode      = multiCodes[0] || '';
            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: multiCodes, designation: profile.designation || '' };
        } else {
            // For HO users: try to get department_short_code from multiple sources
            const deptObj = depts.find(d => d.name === deptName);

            // Try: 1) match by name, 2) first code from multi array, 3) direct department_short_code
            if (deptObj) {
                deptShortCode = deptObj.shortCode;
            } else if (Array.isArray(profile.department_short_code_multi) && profile.department_short_code_multi.length > 0) {
                deptShortCode = profile.department_short_code_multi[0];
                deptShortCodeMulti = profile.department_short_code_multi;
            } else {
                deptShortCode = profile.department_short_code || '';
            }

            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: deptShortCode ? [deptShortCode] : [], designation: profile.designation || '' };
        }

        const gradeObj   = USER_GRADES.find(g => g.value === profile.user_grade);
        const gradeLevel = gradeObj !== undefined ? gradeObj.gradeLevel : (profile.grade_level ?? '');

        setForm({
            object_name:                 profile.object_name            || '',
            uin:                         profile.uin                    || '',
            designation:                 profile.designation            || '',
            hindi_designation:           profile.hindi_designation      || '',
            hindi_user_name:             profile.hindi_user_name        || '',
            user_role:                   profile.user_role              || '',
            user_email_address:          profile.user_email_address     || '',
            primary_mobile_number:       profile.primary_mobile_number  || '',
            office_type:                 officeType,
            location:                    officeType === 'HO' ? 'Mumbai' : location,
            ro_short_code:               officeType === 'HO' ? '' : roShortCode,
            department_name:             deptName,
            department_short_code:       deptShortCode,
            department_short_code_multi: deptShortCodeMulti,
            user_grade:                  profile.user_grade             || '',
            grade_level:                 gradeLevel,
            is_active:                   profile.is_active              ?? false,
        });
        setError(null);
        setErrors({});
        setPendingCases([]);
        setShowPendingBlock(false);
        setLoadingForm(false);
    };

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    // When status dropdown changes — if switching to inactive, check inbox
    const handleStatusChange = async (value) => {
        const goingInactive = value === false || value === 'false';

        // Always clear the pending block when user changes the dropdown
        setShowPendingBlock(false);
        setPendingCases([]);
        set('is_active', !goingInactive);

        if (goingInactive && user?.object_name) {
            setCheckingInbox(true);
            try {
                const res = await api.get('/inbox/tasklist', {
                    params: { username: user.object_name, page: 1, start: 0 }
                });
                const data = res.data || {};
                let items = [];
                if (Array.isArray(data.entries)) {
                    items = data.entries.map(e => {
                        const props = e?.content?.properties || e?.properties || e;
                        return { ...props, _raw: e };
                    });
                } else if (Array.isArray(data.tasks)) {
                    items = data.tasks;
                }
                if (items.length > 0) {
                    setPendingCases(items);
                    setShowPendingBlock(true);
                    // Keep dropdown at Inactive — save is blocked until cases are delegated
                }
            } catch {
                // Inbox check failed — allow proceeding
            } finally {
                setCheckingInbox(false);
            }
        }
    };

    // ── Delegate helpers ──────────────────────────────────────────────────────
    const pf = (task, f) => task[`packagescase_folder${f}`] || task[f] || '';

    const handleDelegateClick = async (task) => {
        // Use the delegating user's (form) office type and location/department, not the case properties
        const offType = form.office_type || 'HO';
        const roCode = (form.ro_short_code || '').toLowerCase();
        const deptCode = (form.department_short_code || '').toLowerCase();
        const isRoTe = offType === 'RO' || offType === 'TE';

        // In EditUserProfileModal context, the current performer is the user being edited
        // Use form.object_name which is the loaded profile display name
        const currentPerformer = form.object_name || '';

        setDelegateTask(task);
        setDelegateSelectedUser('');
        setDelegateUsers([]);
        setDelegateError(null);
        setLoadingDelegateUsers(true);
        try {
            if (isRoTe) {
                const allLocs = offType === 'TE' ? TE_LOCATIONS : RO_LOCATIONS;
                const locObj  = allLocs.find(l => l.shortCode === roCode);
                const location = locObj?.location || roCode;
                const res = await api.get('/users/by-location', { params: { location, page: 1, size: 500 } });
                // For RO/TE: show all location users (no department filter)
                // Only filter out current performer
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
                const res = await api.get('/users/by-dept', { params: { shortCode: deptCode, officeType: offType, page: 1, size: 500 } });
                // Filter out the current performer - check multiple name fields
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
            setDelegateError('Failed to load users.');
        } finally {
            setLoadingDelegateUsers(false);
        }
    };

    const handleDelegateConfirm = async () => {
        if (!delegateSelectedUser || !delegateTask) return;
        const caseId = pf(delegateTask, 'id') || delegateTask.id || delegateTask.r_object_id;
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';
        const assignedUser = `NEO Admin (${loginUsername})`;
        setDelegatingCaseId(caseId);
        try {
            await api.post('/delegate', { caseId, performerDisplayName: delegateSelectedUser, loginUsername: assignedUser });
            const filterOut = (list) => list.filter(t => {
                const tid = pf(t, 'id') || t.id || t.r_object_id;
                return tid !== caseId;
            });
            const remaining = filterOut(pendingCases);
            setPendingCases(remaining);
            if (remaining.length === 0 && showPendingBlock) {
                setShowPendingBlock(false);
                set('is_active', false);
            }
            const officeRemaining = filterOut(officePendingCases);
            setOfficePendingCases(officeRemaining);
            if (officeRemaining.length === 0) {
                setShowOfficeBlock(false);
            }
            const deptRemaining = filterOut(deptPendingCases);
            setDeptPendingCases(deptRemaining);
            if (deptRemaining.length === 0) {
                setShowDeptBlock(false);
            }
            const locationRemaining = filterOut(locationPendingCases);
            setLocationPendingCases(locationRemaining);
            if (locationRemaining.length === 0) {
                setShowLocationBlock(false);
            }
            setDelegateTask(null);
        } catch (err) {
            setDelegateError(err.response?.data?.message || 'Delegation failed.');
        } finally {
            setDelegatingCaseId(null);
        }
    };

    // Check inbox for cases matching specific department codes
    const checkDeptInbox = async (removedDeptCodes) => {
        if (!removedDeptCodes.length || !user?.object_name) {
            setShowDeptBlock(false);
            setDeptPendingCases([]);
            return;
        }
        setCheckingDeptInbox(true);
        setShowDeptBlock(false);
        setDeptPendingCases([]);
        try {
            const res = await api.get('/inbox/tasklist', {
                params: { username: user.object_name, page: 1, start: 0 }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(e => {
                    const props = e?.content?.properties || e?.properties || e;
                    return { ...props, _raw: e };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }
            // Filter cases that belong to any of the removed department codes
            const lowerCodes = removedDeptCodes.map(c => c.toLowerCase());
            const offType = form.office_type;
            const matched = items.filter(task => {
                const caseName = pf(task, 'object_name') || task.caseName || '';
                const parts = caseName.split('-');
                // HO: parts[1] is dept code; RO/TE: parts[3] is dept code
                const caseDept = (offType === 'HO' ? parts[1] : parts[3] || '').toLowerCase();
                return lowerCodes.includes(caseDept);
            });
            if (matched.length > 0) {
                setDeptPendingCases(matched);
                setShowDeptBlock(true);
            }
        } catch {
            // Inbox check failed — allow proceeding
        } finally {
            setCheckingDeptInbox(false);
        }
    };

    const handleOfficeTypeChange = async (v) => {
        set('office_type',               v);
        set('location',                  v === 'HO' ? 'Mumbai' : '');
        set('ro_short_code',             '');
        set('department_name',           '');
        setShowDeptBlock(false);
        setDeptPendingCases([]);
        set('department_short_code',     '');
        set('department_names',          []);
        set('department_short_code_multi', []);
        if (v === 'HO') {
            setDeptOptions(await fetchDepartments('HO'));
        } else {
            setDeptOptions([]);
        }

        // Check inbox when office type changes from original value
        const originalOfficeType = originalGroupInfoRef.current.officeType;
        if (v !== originalOfficeType && user?.object_name) {
            setCheckingOfficeInbox(true);
            setShowOfficeBlock(false);
            setOfficePendingCases([]);
            try {
                const res = await api.get('/inbox/tasklist', {
                    params: { username: user.object_name, page: 1, start: 0 }
                });
                const data = res.data || {};
                let items = [];
                if (Array.isArray(data.entries)) {
                    items = data.entries.map(e => {
                        const props = e?.content?.properties || e?.properties || e;
                        return { ...props, _raw: e };
                    });
                } else if (Array.isArray(data.tasks)) {
                    items = data.tasks;
                }
                if (items.length > 0) {
                    setOfficePendingCases(items);
                    setShowOfficeBlock(true);
                }
            } catch {
                // Inbox check failed — allow proceeding
            } finally {
                setCheckingOfficeInbox(false);
            }
        } else {
            // Reverted back to original office type — clear block
            setShowOfficeBlock(false);
            setOfficePendingCases([]);
        }
    };

    // Check inbox for cases matching specific location (RO/TE only)
    const checkLocationInbox = async (oldLocation) => {
        if (!oldLocation || form.office_type === 'HO' || !user?.object_name) {
            setShowLocationBlock(false);
            setLocationPendingCases([]);
            return;
        }

        setCheckingLocationInbox(true);
        setShowLocationBlock(false);
        setLocationPendingCases([]);
        try {
            const res = await api.get('/inbox/tasklist', {
                params: { username: user.object_name, page: 1, start: 0 }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(e => {
                    const props = e?.content?.properties || e?.properties || e;
                    return { ...props, _raw: e };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }

            // Find the old location's short code to match against case names
            const locs = getLocations(form.office_type);
            const oldLocObj = locs.find(l => l.location === oldLocation);
            const oldLocCode = oldLocObj?.shortCode?.toLowerCase();

            if (!oldLocCode) {
                setShowLocationBlock(false);
                setLocationPendingCases([]);
                setCheckingLocationInbox(false);
                return;
            }

            // Filter cases that belong to the old location (RO/TE: parts[2] is location code)
            const matched = items.filter(task => {
                const caseName = pf(task, 'object_name') || task.caseName || '';
                const parts = caseName.split('-');
                const caseLocCode = (parts[2] || '').toLowerCase();
                return caseLocCode === oldLocCode;
            });

            if (matched.length > 0) {
                setLocationPendingCases(matched);
                setShowLocationBlock(true);
            }
        } catch {
            // Inbox check failed — allow proceeding
        } finally {
            setCheckingLocationInbox(false);
        }
    };

    const handleLocationChange = async (v) => {
        set('location', v);
        const locs = getLocations(form.office_type);
        const loc  = locs.find(l => l.location === v);
        set('ro_short_code',             loc ? loc.shortCode : '');
        set('department_name',           '');
        set('department_short_code',     '');
        set('department_names',          []);
        set('department_short_code_multi', []);
        if (v && form.office_type) {
            setDeptOptions(await fetchDepartments(form.office_type, v));
        } else {
            setDeptOptions([]);
        }

        // Check inbox when location changes from original value (RO/TE only)
        // Always check against the ORIGINAL location, not the immediate previous location
        const originalLocation = originalGroupInfoRef.current.roShortCode
            ? getLocations(form.office_type).find(l => l.shortCode === originalGroupInfoRef.current.roShortCode)?.location
            : null;

        if (v !== originalLocation && originalLocation && ['RO', 'TE'].includes(form.office_type) && user?.object_name) {
            // Check for cases from the ORIGINAL location when changing away from it
            await checkLocationInbox(originalLocation);
        } else {
            // Reverted back to original location — clear block
            setShowLocationBlock(false);
            setLocationPendingCases([]);
        }
    };

    const handleDepartmentChange = (v) => {
        set('department_name', v);
        const dept = deptOptions.find(d => d.name === v);
        const newDeptCode = dept ? dept.shortCode : '';
        set('department_short_code', newDeptCode);

        // HO: check inbox for cases in the original department if it's being changed away
        if (form.office_type === 'HO') {
            const originalDeptCodes = originalGroupInfoRef.current.deptCodes;
            const originalCode = (originalDeptCodes[0] || '').toLowerCase();
            if (originalCode && newDeptCode.toLowerCase() !== originalCode) {
                checkDeptInbox(originalDeptCodes);
            } else {
                setShowDeptBlock(false);
                setDeptPendingCases([]);
            }
        }
    };

    const handleGradeChange = (v) => {
        set('user_grade', v);
        const opt = USER_GRADE_OPTIONS.find(o => o.value === v);
        set('grade_level', opt?.level ?? '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (showPendingBlock) return; // block save if pending cases exist
        if (showOfficeBlock) return;  // block save if office type changed with pending cases
        if (showDeptBlock) return;    // block save if department changed with pending cases
        if (showLocationBlock) return; // block save if location changed with pending cases
        const v = {};
        if (!form.designation?.trim())        v.designation        = 'Designation is required';
        if (!form.uin?.trim())                v.uin                = 'UIN is required';
        if (!form.user_email_address?.trim()) v.user_email_address = 'Email is required';
        if (!form.hindi_user_name?.trim())    v.hindi_user_name    = 'Hindi Name is required';
        if (!form.hindi_designation?.trim())  v.hindi_designation  = 'Hindi Designation is required';
        if (Object.keys(v).length > 0) { setErrors(v); return; }
        setErrors({});
        setLoading(true);
        setError(null);
        try {
            const isROTE = ['RO', 'TE'].includes(form.office_type);
            const { department_short_code_multi, ...rest } = form;
            const payload = {
                ...rest,
                ...(isROTE && { department_short_code_multi }),
            };
            await api.patch(`/users/profiles/${user.r_object_id}`, payload);

            const getGroups = (offType, roCode, codes) => {
                const groups = [];
                if (offType === 'HO') {
                    for (const c of codes) if (c) groups.push(`ecm_ho_${c.toLowerCase()}`);
                } else if (['RO', 'TE'].includes(offType) && roCode) {
                    const ro = roCode.toLowerCase();
                    if (codes.length > 0) groups.push(`ecm_${ro}`);
                    for (const c of codes) if (c) groups.push(`ecm_${ro}_${c.toLowerCase()}`);
                }
                return groups;
            };

            const loginName = user.user_login_name;
            const old = originalGroupInfoRef.current;
            const newDeptCodes = isROTE
                ? (form.department_short_code_multi || [])
                : (form.department_short_code ? [form.department_short_code] : []);
            const newRoShortCode = (form.ro_short_code || '').toLowerCase();

            const oldGroups = getGroups(old.officeType, old.roShortCode, old.deptCodes);
            const newGroups = getGroups(form.office_type, newRoShortCode, newDeptCodes);

            for (const g of oldGroups) {
                if (!newGroups.includes(g))
                    api.delete(`/groups/${g}/members`, { params: { memberName: loginName, memberType: 'user' } }).catch(() => {});
            }
            for (const g of newGroups) {
                if (!oldGroups.includes(g))
                    api.post(`/groups/${g}/members`, { memberName: loginName, memberType: 'user' }).catch(() => {});
            }

            // ── CGM group management based on designation change ──────────
            const getCgmGroup = (offType, roCode, deptCodes) => {
                if (offType === 'HO') {
                    const dc = (deptCodes[0] || '').toLowerCase();
                    return dc ? `ecm_digidak_ho_${dc}_cgm` : '';
                } else if (['RO', 'TE'].includes(offType) && roCode) {
                    return `ecm_digidak_${offType.toLowerCase()}_${roCode.toLowerCase()}_cgm`;
                }
                return '';
            };

            const oldDesignation = (old.designation || '').toUpperCase();
            const newDesignation = (form.designation || '').toUpperCase();
            const wasCGM = oldDesignation === 'CGM';
            const isCGM  = newDesignation === 'CGM';

            if (isCGM && !wasCGM) {
                // Designation changed TO CGM — add CGM group
                const cgmGroup = getCgmGroup(form.office_type, newRoShortCode, newDeptCodes);
                if (cgmGroup) {
                    api.post(`/groups/${cgmGroup}/members`, { memberName: loginName, memberType: 'user' }).catch(() => {});
                }
            } else if (wasCGM && !isCGM) {
                // Designation changed FROM CGM — remove old CGM group
                const cgmGroup = getCgmGroup(old.officeType, old.roShortCode, old.deptCodes);
                if (cgmGroup) {
                    api.delete(`/groups/${cgmGroup}/members`, { params: { memberName: loginName, memberType: 'user' } }).catch(() => {});
                }
            }

            onUpdate();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const storedUser  = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole   = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isSuperAdmin = adminRole === 'Super Admin';
    const isLocalAdmin = adminRole === 'Local Admin';

    const depts     = deptOptions;
    const needsLoc  = ['RO', 'TE'].includes(form.office_type) && !form.location;
    const locations = getLocations(form.office_type);
    const isHO      = form.office_type === 'HO';
    const isROTE    = ['RO', 'TE'].includes(form.office_type);

    // Delegate case modal
    const DelegateCaseModal = () => {
        if (!delegateTask) return null;
        const caseName   = pf(delegateTask, 'object_name') || delegateTask.caseName || '—';
        const deptName   = pf(delegateTask, 'department_name') || delegateTask.department_name || '';
        const parts      = caseName.split('-');

        // Determine office type from delegateTask.ho_ro property, or fallback to parsing case name
        // Case format: NB-DEPTCODE-... (HO) or NB-RO/TE-LOCATION-DEPTCODE-... (RO/TE)
        let offType = 'HO'; // default
        let roCode = '';
        let deptCode = '';

        // Check if we have ho_ro property from task
        if (delegateTask.ho_ro) {
            offType = delegateTask.ho_ro;
        } else if (parts[1] === 'RO' || parts[1] === 'TE') {
            // Parse from case name if ho_ro not available
            offType = parts[1];
        }

        const isRoTe = offType === 'RO' || offType === 'TE';

        if (isRoTe) {
            roCode = (parts[2] || '').toLowerCase();
            deptCode = (parts[3] || '').toLowerCase();
        } else {
            // HO: parts[1] is dept code
            deptCode = (parts[1] || '').toLowerCase();
        }

        const allLocs = offType === 'TE' ? TE_LOCATIONS : RO_LOCATIONS;
        const locLabel = isRoTe ? (allLocs.find(l => l.shortCode === roCode)?.location || roCode.toUpperCase()) : null;

        // Extract dept code from department name if available
        if (deptName) {
            const deptMatch = deptName.match(/\(([^)]+)\)$/);
            if (deptMatch) {
                deptCode = deptMatch[1].toLowerCase();
            }
        }
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
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
                    <div className="p-6 space-y-4">
                        <div className="text-xs text-slate-500 space-y-1">
                            {isRoTe && locLabel && (
                                <div>Location: <span className="font-semibold text-slate-700">{locLabel}</span> <span className="text-slate-400">({offType})</span></div>
                            )}
                            {deptName && (
                                <div>Department: <span className="font-semibold text-slate-700">{deptName}</span>
                                    {deptCode && <span className="ml-1 text-slate-400">({deptCode})</span>}
                                </div>
                            )}
                        </div>
                        {delegateError && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{delegateError}</div>
                        )}
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                                <Users size={12} /> Select User to Delegate
                            </label>
                            {loadingDelegateUsers ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                    <Loader2 size={14} className="animate-spin" /> Loading users…
                                </div>
                            ) : delegateUsers.length === 0 ? (
                                <div className="text-xs text-slate-400 py-2">No users found for this department.</div>
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <DelegateCaseModal />
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <User size={16} className="text-[#0A66C2]" />
                        Edit User Profile
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
                    )}
                    <form id="editProfileForm" onSubmit={handleSubmit} className="space-y-5">

                        {/* ── Basic Info ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Information</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Name</Label>
                                    <input type="text" value={form.object_name} readOnly
                                        className={readonlyCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label required>UIN</Label>
                                    <input type="text" value={form.uin}
                                        onChange={e => { set('uin', e.target.value); setErrors(p => ({ ...p, uin: undefined })); }}
                                        className={errors.uin ? errorCls : inputCls} />
                                    {errors.uin && <p className="text-xs text-red-500">{errors.uin}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label required>Designation</Label>
                                    <SelectWrapper>
                                        <select value={form.designation}
                                            onChange={e => {
                                                const newDesignation = e.target.value;
                                                set('designation', newDesignation);
                                                setErrors(p => ({ ...p, designation: undefined }));
                                                // Track if designation was actually changed from original
                                                setDesignationChanged(newDesignation !== originalGroupInfoRef.current.designation);
                                                // Reset hindi_designation touched so it can auto-populate
                                                hindiTouched.current.hindi_designation = false;
                                            }}
                                            className={errors.designation ? errorCls : selectCls} >
                                            {DESIGNATION_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                    {errors.designation && <p className="text-xs text-red-500">{errors.designation}</p>}
                                    {designationChanged && <p className="text-xs text-amber-600 font-medium mt-1">💡 Change user grade if required</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>User Role</Label>
                                    <input type="text" value={form.user_role}
                                        onChange={e => set('user_role', e.target.value)}
                                        className={inputCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label>User Grade</Label>
                                    <SelectWrapper>
                                        <select value={form.user_grade} onChange={e => handleGradeChange(e.target.value)} className={selectCls}>
                                            {USER_GRADE_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                </div>
                                <div className="space-y-1">
                                    <Label>Grade Level</Label>
                                    <input type="number" readOnly value={form.grade_level}
                                        placeholder="Auto-filled"
                                        className={readonlyCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label required>Email</Label>
                                    <input type="email" value={form.user_email_address}
                                        onChange={e => { set('user_email_address', e.target.value); setErrors(p => ({ ...p, user_email_address: undefined })); }}
                                        className={errors.user_email_address ? errorCls : inputCls} />
                                    {errors.user_email_address && <p className="text-xs text-red-500">{errors.user_email_address}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Mobile</Label>
                                    <input type="text" value={form.primary_mobile_number}
                                        onChange={e => set('primary_mobile_number', e.target.value)}
                                        className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* ── Hindi ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Hindi Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label required>Hindi Name</Label>
                                    <input type="text" value={form.hindi_user_name}
                                        onChange={e => { set('hindi_user_name', e.target.value); setErrors(p => ({ ...p, hindi_user_name: undefined })); }}
                                        className={errors.hindi_user_name ? errorCls : inputCls} />
                                    {errors.hindi_user_name && <p className="text-xs text-red-500">{errors.hindi_user_name}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label required>Hindi Designation</Label>
                                    <input type="text" value={form.hindi_designation}
                                        readOnly
                                        className={readonlyCls} />
                                </div>
                            </div>
                        </div>

                        {/* ── Office ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Building2 size={12} /> Office &amp; Location
                            </p>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label>Office Type</Label>
                                    <SelectWrapper>
                                        <select value={form.office_type}
                                            onChange={e => handleOfficeTypeChange(e.target.value)}
                                            disabled={checkingOfficeInbox || isLocalAdmin}
                                            className={(checkingOfficeInbox || isLocalAdmin) ? disabledSelectCls : selectCls}>
                                            <option value="">— Select office type —</option>
                                            <option value="HO">HO — Head Office</option>
                                            <option value="RO">RO — Regional Office</option>
                                            <option value="TE">TE — Training Establishment</option>
                                        </select>
                                    </SelectWrapper>
                                    {checkingOfficeInbox && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <Loader2 size={12} className="animate-spin" /> Checking case inbox…
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label><MapPin size={10} className="inline mr-0.5" />Location</Label>
                                        {isHO ? (
                                            <SelectWrapper>
                                                <select disabled className={disabledSelectCls}>
                                                    <option>Mumbai</option>
                                                </select>
                                            </SelectWrapper>
                                        ) : (
                                            <>
                                                <SelectWrapper>
                                                    <select value={form.location} onChange={e => handleLocationChange(e.target.value)} disabled={checkingLocationInbox || isLocalAdmin} className={(checkingLocationInbox || isLocalAdmin) ? disabledSelectCls : selectCls}>
                                                        <option value="">— Select location —</option>
                                                        {locations.map(l => (
                                                            <option key={l.location} value={l.location}>{l.location}</option>
                                                        ))}
                                                    </select>
                                                </SelectWrapper>
                                                {checkingLocationInbox && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                        <Loader2 size={12} className="animate-spin" /> Checking inbox…
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label><Tag size={10} className="inline mr-0.5" />RO/TE Short Code</Label>
                                        <input type="text" readOnly value={isHO ? '' : form.ro_short_code}
                                            disabled={isHO || !form.office_type}
                                            placeholder="Auto-filled"
                                            className={readonlyCls} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label><Layers size={10} className="inline mr-0.5" />Department</Label>
                                        {isROTE ? (
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                {needsLoc ? (
                                                    <p className="px-3 py-2 text-sm text-slate-400">— Select location first —</p>
                                                ) : !form.office_type ? (
                                                    <p className="px-3 py-2 text-sm text-slate-400">— Select office type first —</p>
                                                ) : (
                                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                        {depts.map(d => (
                                                            <label key={d.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(form.department_short_code_multi || []).includes(d.shortCode)}
                                                                    onChange={() => {
                                                                        const currentCodes = form.department_short_code_multi || [];
                                                                        const isRemoving = currentCodes.includes(d.shortCode);
                                                                        const newCodes = isRemoving
                                                                            ? currentCodes.filter(c => c !== d.shortCode)
                                                                            : [...currentCodes, d.shortCode];
                                                                        const firstDept = depts.find(dept => dept.shortCode === newCodes[0]);
                                                                        set('department_short_code',       newCodes[0] || '');
                                                                        set('department_short_code_multi', newCodes);
                                                                        set('department_name',             firstDept?.name || '');

                                                                        // RO/TE: check inbox for all departments removed vs original
                                                                        const originalCodes = originalGroupInfoRef.current.deptCodes.map(c => c.toLowerCase());
                                                                        const removedCodes = originalCodes.filter(c => !newCodes.map(n => n.toLowerCase()).includes(c));
                                                                        if (removedCodes.length > 0) {
                                                                            checkDeptInbox(removedCodes);
                                                                        } else {
                                                                            setShowDeptBlock(false);
                                                                            setDeptPendingCases([]);
                                                                        }
                                                                    }}
                                                                    className="rounded accent-[#0A66C2]"
                                                                />
                                                                <span className="text-sm text-slate-700">{d.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <SelectWrapper>
                                                <select value={form.department_name}
                                                    onChange={e => handleDepartmentChange(e.target.value)}
                                                    disabled={!form.office_type}
                                                    className={!form.office_type ? disabledSelectCls : selectCls}>
                                                    <option value="">
                                                        {!form.office_type ? '— Select office type first —' : '— Select department —'}
                                                    </option>
                                                    {depts.map(d => (
                                                        <option key={d.name} value={d.name}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </SelectWrapper>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label><Tag size={10} className="inline mr-0.5" />Dept. Short Code</Label>
                                        <input type="text" readOnly
                                            value={isROTE
                                                ? (form.department_short_code_multi || []).join(',')
                                                : (form.department_short_code || '')}
                                            placeholder="Auto-filled"
                                            className={readonlyCls} />
                                    </div>
                                </div>
                                {checkingDeptInbox && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                        <Loader2 size={12} className="animate-spin" /> Checking case inbox for department…
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Office type change — pending cases block */}
                        {showOfficeBlock && officePendingCases.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                    <span>Cannot change Office Type — this user has pending cases. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{officePendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {officePendingCases.map((task, idx) => {
                                            const caseName = pf(task, 'object_name') || task.caseName || '—';
                                            const desc     = pf(task, 'description') || '';
                                            const status   = pf(task, 'status') || task.status || '';
                                            const priority = pf(task, 'task_priority') || task.priority || '';
                                            return (
                                                <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
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
                                                            type="button"
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
                            </div>
                        )}

                        {/* Department change — pending cases block */}
                        {showDeptBlock && deptPendingCases.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                    <span>Cannot change department — this user has pending cases in the department. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{deptPendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {deptPendingCases.map((task, idx) => {
                                            const caseName = pf(task, 'object_name') || task.caseName || '—';
                                            const desc     = pf(task, 'description') || '';
                                            const status   = pf(task, 'status') || task.status || '';
                                            const priority = pf(task, 'task_priority') || task.priority || '';
                                            return (
                                                <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
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
                                                            type="button"
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
                            </div>
                        )}

                        {/* Location change — pending cases block (RO/TE only) */}
                        {showLocationBlock && locationPendingCases.length > 0 && ['RO', 'TE'].includes(form.office_type) && (
                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                    <span>Cannot change location — this user has pending cases from the current location. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{locationPendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {locationPendingCases.map((task, idx) => {
                                            const caseName = pf(task, 'object_name') || task.caseName || '—';
                                            const desc     = pf(task, 'description') || '';
                                            const status   = pf(task, 'status') || task.status || '';
                                            const priority = pf(task, 'task_priority') || task.priority || '';
                                            return (
                                                <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
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
                                                            type="button"
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
                            </div>
                        )}

                        {/* ── User State (Super Admin only) ── */}
                        {isSuperAdmin && <div className="space-y-3">
                            <div className="space-y-1">
                                <Label>User State</Label>
                                <SelectWrapper>
                                    <select
                                        value={String(form.is_active ?? false)}
                                        onChange={e => handleStatusChange(e.target.value)}
                                        disabled={checkingInbox}
                                        className={checkingInbox ? disabledSelectCls : selectCls}
                                    >
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </SelectWrapper>
                                {checkingInbox && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                        <Loader2 size={12} className="animate-spin" /> Checking inbox…
                                    </div>
                                )}
                            </div>

                            {/* Pending cases block */}
                            {showPendingBlock && pendingCases.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                        <span>Delegate the pending cases to make this user inactive.</span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{pendingCases.length}</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                            {pendingCases.map((task, idx) => {
                                                const caseName = pf(task, 'object_name') || task.caseName || '—';
                                                const desc     = pf(task, 'description') || '';
                                                const status   = pf(task, 'status') || task.status || '';
                                                const priority = pf(task, 'task_priority') || task.priority || '';
                                                return (
                                                    <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
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
                                                                type="button"
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
                                </div>
                            )}
                        </div>}

                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="editProfileForm" disabled={loading || loadingForm || checkingInbox || checkingOfficeInbox || checkingDeptInbox || checkingLocationInbox || (isSuperAdmin && showPendingBlock) || showOfficeBlock || showDeptBlock || showLocationBlock}
                        className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 flex items-center gap-2 transition-colors">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditUserProfileModal;
