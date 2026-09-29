import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Save, Loader2, User, Building2, MapPin, Tag, Layers, AlertCircle, ArrowRightLeft, Users } from 'lucide-react';
import {
    USER_GRADES, DESIGNATION_OPTIONS, DESIGNATION_OTHER, getLocations, fetchDepartments, RO_LOCATIONS, TE_LOCATIONS, DDM_DISTRICTS,
    DESIGNATION_GRADE_MAPPING, DDM_DESIGNATION_OPTIONS, DDM_GRADE_DESIGNATION_MAPPING, GRADE_DESIGNATION_MAPPING,
} from '../data/nabardMetadata.js';
import { syncUserGroups } from '../utils/userGroupSync.js';
import { Modal } from './ui';
import CustomSelect from './ui/CustomSelect.jsx';

const USER_GRADE_OPTIONS = [
    { value: '', label: '— Select grade —', level: '' },
    ...USER_GRADES.map(g => ({ value: g.value, label: g.label, level: g.gradeLevel })),
];

const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy bg-surface';
const readonlyCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm bg-slate-50 text-slate-500 cursor-default font-mono';
const disabledSelectCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none';

const Label = ({ children, required }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {children}{required && <span className="text-danger ml-0.5">*</span>}
    </label>
);

const errorCls = 'w-full px-3 py-2 border border-danger/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-danger/70/20 focus:border-danger bg-surface';

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
    const [errors, setErrors] = useState({});
    const [error, setError] = useState(null);
    const [designationChanged, setDesignationChanged] = useState(false);
    // True while the Designation field shows the free-text "Other" input instead
    // of the dropdown value — set on load if the stored designation isn't one of
    // the known options, and toggled when the user picks "Other" manually.
    const [designationCustom, setDesignationCustom] = useState(false);
    const [gradeChanged, setGradeChanged] = useState(false);
    const originalGroupInfoRef = useRef({ officeType: '', roShortCode: '', deptCodes: [], designation: '', location: '', departmentName: '', deptShortCode: '' });
    const hindiTouched = useRef({});
    const lastManualChangeRef = useRef(null); // Track which field was last manually changed ('designation' or 'grade')

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

    // Retired user — pending cases block
    const [checkingRetiredInbox,   setCheckingRetiredInbox]   = useState(false);
    const [retiredPendingCases,    setRetiredPendingCases]    = useState([]);
    const [showRetiredBlock,       setShowRetiredBlock]       = useState(false);
    // Drives the toggle directly so it flips the instant it's clicked, before the
    // async inbox check resolves and independent of the office_type value (which
    // only becomes 'RETIRED' once applyRetiredFields runs).
    const [isRetiring,             setIsRetiring]             = useState(false);

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
        setRetiredPendingCases([]);
        setShowRetiredBlock(false);
        setIsRetiring(false);
        setDelegateTask(null);
        setDesignationChanged(false);
        setGradeChanged(false);
        lastManualChangeRef.current = null;
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

    // Auto-populate user_grade when designation changes (only if user manually changed designation, not during initial load)
    useEffect(() => {
        if (!form.designation || lastManualChangeRef.current !== 'designation') return;
        const mappedGrade = DESIGNATION_GRADE_MAPPING[form.designation];
        if (mappedGrade) {
            set('user_grade', mappedGrade);
            const opt = USER_GRADE_OPTIONS.find(o => o.value === mappedGrade);
            set('grade_level', opt?.level ?? '');
            setGradeChanged(false);
        }
    }, [form.designation]);

    // Auto-populate designation when user_grade changes (only if user manually changed grade, not during initial load)
    useEffect(() => {
        if (!form.user_grade || lastManualChangeRef.current !== 'grade') return;
        const isDDMUser = form.department_name === 'DDM' && ['RO', 'TE'].includes(form.office_type);
        const mappedDesignation = isDDMUser
            ? DDM_GRADE_DESIGNATION_MAPPING[form.user_grade]
            : GRADE_DESIGNATION_MAPPING[form.user_grade];
        if (mappedDesignation) {
            set('designation', mappedDesignation);
            const designationObj = DESIGNATION_OPTIONS.find(opt => opt.value === mappedDesignation);
            if (designationObj && designationObj.hindi) {
                set('hindi_designation', designationObj.hindi);
            }
            setGradeChanged(true);
        }
        // department_name/office_type only gate the DDM branch; re-running on them is not wanted
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.user_grade]);

    const initForm = async (profile) => {
        const officeType = profile.office_type || '';
        const location   = profile.location   || '';
        const deptName   = profile.department_name || '';
        const isDDMProfile = deptName === 'DDM';

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
            // For DDM users: store empty deptCodes so standard group logic doesn't process district names
            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: isDDMProfile ? [] : multiCodes, designation: profile.designation || '', location, departmentName: deptName, deptShortCode };
        } else {
            // For HO users: support multi-select departments
            const multiCodes = Array.isArray(profile.department_short_code_multi)
                ? profile.department_short_code_multi
                : (profile.department_short_code ? [profile.department_short_code] : []);
            deptShortCodeMulti = multiCodes;
            deptShortCode = multiCodes[0] || '';

            // If no multi codes but have department_name, try to find by name
            if (multiCodes.length === 0 && deptName) {
                const deptObj = depts.find(d => d.name === deptName);
                if (deptObj) {
                    deptShortCode = deptObj.shortCode;
                    deptShortCodeMulti = [deptObj.shortCode];
                }
            }

            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: deptShortCodeMulti, designation: profile.designation || '', location, departmentName: deptName, deptShortCode };
        }

        const gradeObj   = USER_GRADES.find(g => g.value === profile.user_grade);
        const gradeLevel = gradeObj !== undefined ? gradeObj.gradeLevel : (profile.grade_level ?? '');

        const finalForm = {
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
        };
        setForm(finalForm);
        // DDM designations are a fixed 3-value grade-linked set (no "Other" row there) —
        // only flag a custom/free-text designation for the general (non-DDM) dropdown.
        const isDDMDesignation = isDDMProfile && isROTE;
        setDesignationCustom(
            !isDDMDesignation && !!finalForm.designation &&
            !DESIGNATION_OPTIONS.some(o => o.value === finalForm.designation)
        );
        setIsRetiring(officeType === 'RETIRED');
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

    // ── Retired user ──────────────────────────────────────────────────────────
    // Retiring blanks the office identity to the literal 'RETIRED', deactivates the
    // account, and (on Save) drops every group. Toggle-off before Save restores the
    // values captured at load time.
    const applyRetiredFields = () => {
        set('office_type', 'RETIRED');
        set('location', 'RETIRED');
        set('ro_short_code', 'RETIRED');
        set('department_name', 'RETIRED');
        set('department_short_code', 'retired');
        set('department_short_code_multi', []);
        set('is_active', false);
    };

    const restoreFromRetired = () => {
        const orig = originalGroupInfoRef.current;
        // A user already retired in the DB has no pre-retirement office identity to
        // restore — clear the fields so the admin re-selects them.
        const wasAlreadyRetired = orig.officeType === 'RETIRED';
        set('office_type', wasAlreadyRetired ? '' : (orig.officeType || 'HO'));
        set('location', wasAlreadyRetired ? '' : (orig.location || ''));
        set('ro_short_code', wasAlreadyRetired ? '' : (orig.roShortCode || ''));
        set('department_name', wasAlreadyRetired ? '' : (orig.departmentName || ''));
        set('department_short_code', wasAlreadyRetired ? '' : (orig.deptShortCode || ''));
        set('department_short_code_multi', wasAlreadyRetired ? [] : (orig.deptCodes || []));
        set('is_active', true);
    };

    const handleRetiredChange = async (checked) => {
        setShowRetiredBlock(false);
        setRetiredPendingCases([]);
        setIsRetiring(checked); // reflect the click immediately, before the inbox check

        if (!checked) {
            restoreFromRetired();
            return;
        }

        if (!user?.object_name) {
            applyRetiredFields();
            return;
        }

        setCheckingRetiredInbox(true);
        try {
            const res = await api.get('/inbox/tasklist', {
                params: { username: user.object_name, page: 1, start: 0 }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(en => {
                    const props = en?.content?.properties || en?.properties || en;
                    return { ...props, _raw: en };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }
            if (items.length > 0) {
                setRetiredPendingCases(items);
                setShowRetiredBlock(true);
            } else {
                applyRetiredFields();
            }
        } catch {
            // Inbox check failed — proceed with retirement
            applyRetiredFields();
        } finally {
            setCheckingRetiredInbox(false);
        }
    };

    // ── Delegate helpers ──────────────────────────────────────────────────────
    const pf = (task, f) => task[`packagescase_folder${f}`] || task[f] || '';

    const handleDelegateClick = async (task) => {
        const caseNumber = pf(task, 'object_name') || task.object_name || task.case_number || task.case_id || '';
        const currentPerformer = form.object_name || '';

        // Use ORIGINAL profile values (stored at load time) for delegation, not edited form values
        // This allows users to delegate before saving profile changes
        const originalOfficeType = originalGroupInfoRef.current.officeType;
        const isHO = originalOfficeType === 'HO';
        const isROTE = originalOfficeType === 'RO' || originalOfficeType === 'TE';


        setDelegateTask(task);
        setDelegateSelectedUser('');
        setDelegateUsers([]);
        setDelegateError(null);
        setLoadingDelegateUsers(true);
        try {
            if (isHO) {
                // HO user: Always delegate to users in their own department
                const userDeptCode = originalGroupInfoRef.current.deptCodes[0];
                if (!userDeptCode || !userDeptCode.trim()) {
                    setDelegateError('Department code is not set for this user in their profile.');
                    setDelegateUsers([]);
                    return;
                }


                const res = await api.get('/users/by-dept', { params: { shortCode: userDeptCode.toLowerCase(), officeType: 'HO', page: 1, size: 500 } });
                const allUsers = Array.isArray(res.data?.users) ? res.data.users : (Array.isArray(res.data) ? res.data : []);


                if (allUsers.length === 0) {
                    setDelegateError(`No users found in department ${userDeptCode.toUpperCase()}.`);
                    setDelegateUsers([]);
                    return;
                }

                const filteredUsers = allUsers
                    .filter(u => {
                        const displayName = u.object_name || u.name || '';
                        return displayName.trim().length > 0;
                    })
                    .filter(u => {
                        const userName = u.name?.trim().toLowerCase() || '';
                        const userObjName = u.object_name?.trim().toLowerCase() || '';
                        const currentName = currentPerformer?.trim().toLowerCase() || '';
                        return userName !== currentName && userObjName !== currentName;
                    });

                setDelegateUsers(filteredUsers);
            } else if (isROTE) {
                // RO/TE user: Always delegate to users in their own location
                const roShortCode = originalGroupInfoRef.current.roShortCode;
                if (!roShortCode) {
                    setDelegateError('Location code is not set for this user in their profile.');
                    setDelegateUsers([]);
                    return;
                }

                // Convert ro_short_code back to location name
                const allLocs = [...RO_LOCATIONS, ...TE_LOCATIONS];
                const locObj = allLocs.find(l => l.shortCode?.toUpperCase() === roShortCode.toUpperCase());
                const userLocation = locObj?.location;

                if (!userLocation) {
                    setDelegateError(`Location not found for code: ${roShortCode}`);
                    setDelegateUsers([]);
                    return;
                }


                const res = await api.get('/users/by-location', { params: { location: userLocation, page: 1, size: 500 } });
                const allUsers = Array.isArray(res.data?.users) ? res.data.users : (Array.isArray(res.data) ? res.data : []);


                if (allUsers.length === 0) {
                    setDelegateError(`No users found in location ${userLocation}.`);
                    setDelegateUsers([]);
                    return;
                }

                const filteredUsers = allUsers
                    .filter(u => {
                        const displayName = u.object_name || u.name || '';
                        return displayName.trim().length > 0;
                    })
                    .filter(u => {
                        const userName = u.name?.trim().toLowerCase() || '';
                        const userObjName = u.object_name?.trim().toLowerCase() || '';
                        const currentName = currentPerformer?.trim().toLowerCase() || '';
                        return userName !== currentName && userObjName !== currentName;
                    });

                setDelegateUsers(filteredUsers);
            } else {
                setDelegateError('Could not determine office type for this user.');
                setDelegateUsers([]);
            }
        } catch (err) {
            console.error('[Delegate] Failed to load users:', { error: err.message, caseNumber, originalOfficeType, status: err.response?.status, data: err.response?.data });
            const errorMsg = err.response?.data?.message || err.message || 'Failed to load users. Please check the console for details.';
            setDelegateError(errorMsg);
        } finally {
            setLoadingDelegateUsers(false);
        }
    };

    const handleDelegateConfirm = async () => {
        if (!delegateSelectedUser || !delegateTask) return;
        const caseId = pf(delegateTask, 'id') || delegateTask.id || delegateTask.r_object_id;
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';
        setDelegatingCaseId(caseId);
        try {
            await api.post('/delegate', { caseId, performerDisplayName: delegateSelectedUser, loginUsername });
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
            const retiredRemaining = filterOut(retiredPendingCases);
            setRetiredPendingCases(retiredRemaining);
            if (retiredRemaining.length === 0 && showRetiredBlock) {
                setShowRetiredBlock(false);
                applyRetiredFields();
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
        // For DDM users: clear district; for others: clear department_name
        if (form.department_name !== 'DDM') {
            set('department_name',           '');
        }
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

    // Handle multi-select department changes for HO users
    const handleHODepartmentChange = (deptShortCode, isAdding) => {
        const currentCodes = form.department_short_code_multi || [];
        const newCodes = isAdding
            ? [...currentCodes, deptShortCode]
            : currentCodes.filter(c => c !== deptShortCode);

        const firstDept = deptOptions.find(dept => dept.shortCode === newCodes[0]);
        set('department_short_code', newCodes[0] || '');
        set('department_short_code_multi', newCodes);
        set('department_name', firstDept?.name || '');

        // Check inbox for departments removed vs original
        const originalCodes = originalGroupInfoRef.current.deptCodes.map(c => c.toLowerCase());
        const removedCodes = originalCodes.filter(c => !newCodes.map(n => n.toLowerCase()).includes(c));
        if (removedCodes.length > 0) {
            checkDeptInbox(removedCodes);
        } else {
            setShowDeptBlock(false);
            setDeptPendingCases([]);
        }
    };

    // Handle select/deselect all for HO departments
    const handleHODepartmentSelectAll = () => {
        const currentCodes = form.department_short_code_multi || [];
        const allSelected = currentCodes.length === deptOptions.length;
        const newCodes = allSelected ? [] : deptOptions.map(d => d.shortCode);
        const firstDept = deptOptions.find(dept => dept.shortCode === newCodes[0]);

        set('department_short_code', newCodes[0] || '');
        set('department_short_code_multi', newCodes);
        set('department_name', firstDept?.name || '');

        // Check inbox for departments removed vs original
        const originalCodes = originalGroupInfoRef.current.deptCodes.map(c => c.toLowerCase());
        const removedCodes = originalCodes.filter(c => !newCodes.map(n => n.toLowerCase()).includes(c));
        if (removedCodes.length > 0) {
            checkDeptInbox(removedCodes);
        } else {
            setShowDeptBlock(false);
            setDeptPendingCases([]);
        }
    };

    const handleDDMDistrictChange = (district) => {
        set('department_short_code', district);
        set('department_short_code_multi', district ? [district] : []);
        set('department_name', 'DDM');
    };

    const handleGradeChange = (v) => {
        lastManualChangeRef.current = 'grade';
        set('user_grade', v);
        const opt = USER_GRADE_OPTIONS.find(o => o.value === v);
        set('grade_level', opt?.level ?? '');
        // Reset to false; the useEffect will set it to true after auto-updating designation
        setGradeChanged(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (showPendingBlock) return; // block save if pending cases exist
        if (showOfficeBlock) return;  // block save if office type changed with pending cases
        if (showDeptBlock) return;    // block save if department changed with pending cases
        if (showLocationBlock) return; // block save if location changed with pending cases
        if (showRetiredBlock) return;  // block save while retiring with pending cases
        const isDDMUser = form.department_name === 'DDM' && ['RO', 'TE'].includes(form.office_type);
        // Retiring overwrites the office identity with 'RETIRED' and deactivates the
        // account — the profile-field checks don't apply and would only block a
        // retirement over an already-incomplete profile.
        if (!isRetiring) {
            const v = {};
            if (!form.designation?.trim())        v.designation        = 'Designation is required';
            if (!form.uin?.trim())                v.uin                = 'UIN is required';
            if (!form.user_email_address?.trim()) v.user_email_address = 'Email is required';
            if (!form.hindi_user_name?.trim())    v.hindi_user_name    = 'Hindi Name is required';
            if (!form.hindi_designation?.trim())  v.hindi_designation  = 'Hindi Designation is required';
            if (isDDMUser && !form.department_short_code?.trim()) v.department_short_code = 'District is required';
            if (Object.keys(v).length > 0) { setErrors(v); return; }
        }
        setErrors({});
        setLoading(true);
        setError(null);
        try {
            // ── Retiring the user ────────────────────────────────────────────────
            // Persist the RETIRED office identity, then drop every group the user is
            // in. This bypasses the standard DDM/CGM/Digidak group reconciliation.
            if (isRetiring || form.office_type === 'RETIRED') {
                const retiredPayload = {
                    ...form,
                    office_type: 'RETIRED',
                    location: 'RETIRED',
                    ro_short_code: 'RETIRED',
                    department_name: 'RETIRED',
                    department_short_code: 'retired',
                    department_short_code_multi: [],
                    is_active: false,
                };
                await api.patch(`/users/profiles/${user.r_object_id}`, retiredPayload);
                const loginName = user.user_login_name;
                if (loginName) {
                    try {
                        const res = await api.get('/groups/by-user', { params: { username: loginName } });
                        const userGroups = Array.isArray(res.data) ? res.data : [];
                        for (const g of userGroups) {
                            const gName = g.group_name || g.name || g;
                            if (gName) api.delete(`/groups/${gName}/members/${encodeURIComponent(loginName)}`).catch(() => {});
                        }
                    } catch { /* best-effort group cleanup */ }
                }
                onUpdate();
                onClose();
                return;
            }

            const isROTE = ['RO', 'TE'].includes(form.office_type);
            const isHO = form.office_type === 'HO';
            const { department_short_code_multi, ...rest } = form;
            const payload = {
                ...rest,
                ...(isHO && { department_short_code_multi: form.department_short_code_multi || [] }),
                ...(isROTE && !isDDMUser && { department_short_code_multi }),
                ...(isDDMUser && { department_short_code_multi: form.department_short_code ? [form.department_short_code] : [] }),
            };

            await api.patch(`/users/profiles/${user.r_object_id}`, payload);

            const memberName = user.user_login_name;
            await syncUserGroups({ old: originalGroupInfoRef.current, form, payload, memberName });

            if (groupFailures.length > 0) {
                toast(
                    `Profile saved, but group sync failed: could not ${groupFailures.join('; ')}. Profile and groups may be out of sync.`,
                    { icon: '⚠️', duration: 5000 }
                );
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
    const isDDMUser = form.department_name === 'DDM' && isROTE;

    // Delegate case modal — plain render function (not a nested component) so the Modal
    // keeps its identity across parent re-renders and doesn't replay its enter animation.
    const renderDelegateCaseModal = () => {
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
            <Modal
                isOpen
                onClose={() => setDelegateTask(null)}
                size="md"
                title={
                    <span className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm">
                            <ArrowRightLeft size={17} className="text-white" />
                        </span>
                        <span className="flex flex-col">
                            <span>Delegate Case</span>
                            <span className="font-mono text-xs font-normal text-slate-500">{caseName}</span>
                        </span>
                    </span>
                }
                footer={
                    <>
                        <button onClick={() => setDelegateTask(null)}
                            className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleDelegateConfirm}
                            disabled={!delegateSelectedUser || !!delegatingCaseId}
                            className="flex items-center gap-1.5 px-4 py-2 bg-canopy hover:bg-canopy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors">
                            {delegatingCaseId ? <><Loader2 size={12} className="animate-spin" /> Delegating…</> : <><ArrowRightLeft size={12} /> Delegate</>}
                        </button>
                    </>
                }
            >
                    <div className="space-y-4">
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
                            <div className="text-xs text-danger bg-danger-tint border border-danger/20 rounded-lg px-3 py-2">{delegateError}</div>
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
                                <CustomSelect
                                    value={delegateSelectedUser}
                                    onChange={setDelegateSelectedUser}
                                    placeholder="— Select user —"
                                    options={delegateUsers.map(u => ({ value: u.object_name, label: u.object_name }))}
                                />
                            )}
                        </div>
                    </div>
            </Modal>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            title={
                <span className="flex items-center gap-2">
                    <User size={16} className="text-canopy" />
                    Edit User Profile
                </span>
            }
            footer={
                <>
                    <button onClick={onClose}
                        className="px-4 py-2 bg-surface border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="editProfileForm" disabled={loading || loadingForm || checkingInbox || checkingOfficeInbox || checkingDeptInbox || checkingLocationInbox || checkingRetiredInbox || (isSuperAdmin && showPendingBlock) || showOfficeBlock || showDeptBlock || showLocationBlock || showRetiredBlock}
                        className="px-4 py-2 bg-canopy text-white rounded-lg text-sm font-medium hover:bg-canopy-dark disabled:opacity-50 flex items-center gap-2 transition-colors">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save Changes
                    </button>
                </>
            }
        >
            {renderDelegateCaseModal()}
            {error && (
                <div className="mb-4 p-3 bg-danger-tint text-danger rounded-lg text-sm border border-danger-tint">{error}</div>
            )}
            <form id="editProfileForm" onSubmit={handleSubmit} className="space-y-5">

                        {/* ── Basic Info ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Information</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                    {errors.uin && <p className="text-xs text-danger">{errors.uin}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label required>Designation</Label>
                                    <CustomSelect
                                        value={designationCustom ? DESIGNATION_OTHER : form.designation}
                                        invalid={!!errors.designation}
                                        onChange={newDesignation => {
                                            lastManualChangeRef.current = 'designation';
                                            if (newDesignation === DESIGNATION_OTHER) {
                                                setDesignationCustom(true);
                                                set('designation', '');
                                            } else {
                                                setDesignationCustom(false);
                                                set('designation', newDesignation);
                                            }
                                            setErrors(p => ({ ...p, designation: undefined }));
                                            // Track if designation was actually changed from original
                                            setDesignationChanged(newDesignation !== originalGroupInfoRef.current.designation);
                                            // Reset hindi_designation touched so it can auto-populate
                                            hindiTouched.current.hindi_designation = false;
                                        }}
                                        options={isDDMUser ? DDM_DESIGNATION_OPTIONS : DESIGNATION_OPTIONS}
                                    />
                                    {!isDDMUser && designationCustom && (
                                        <input type="text" value={form.designation}
                                            onChange={e => {
                                                set('designation', e.target.value);
                                                setErrors(p => ({ ...p, designation: undefined }));
                                            }}
                                            placeholder="Enter designation"
                                            className={errors.designation ? errorCls : inputCls}
                                            autoFocus />
                                    )}
                                    {errors.designation && <p className="text-xs text-danger">{errors.designation}</p>}
                                    {designationChanged && <p className="text-xs text-harvest font-medium mt-1">💡 User grade has been auto-updated based on designation</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>User Role</Label>
                                    <input type="text" value={form.user_role}
                                        onChange={e => set('user_role', e.target.value)}
                                        className={inputCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label>User Grade</Label>
                                    <CustomSelect
                                        value={form.user_grade}
                                        onChange={handleGradeChange}
                                        options={USER_GRADE_OPTIONS}
                                    />
                                    {gradeChanged && <p className="text-xs text-harvest font-medium mt-1">💡 Designation has been auto-updated based on grade</p>}
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
                                    {errors.user_email_address && <p className="text-xs text-danger">{errors.user_email_address}</p>}
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
                                    {errors.hindi_user_name && <p className="text-xs text-danger">{errors.hindi_user_name}</p>}
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
                                    <CustomSelect
                                        value={form.office_type}
                                        onChange={handleOfficeTypeChange}
                                        disabled={checkingOfficeInbox || isLocalAdmin}
                                        placeholder="— Select office type —"
                                        options={[
                                            { value: 'HO', label: 'HO — Head Office' },
                                            { value: 'RO', label: 'RO — Regional Office' },
                                            { value: 'TE', label: 'TE — Training Establishment' },
                                        ]}
                                    />
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
                                            <CustomSelect value="Mumbai" onChange={() => {}} disabled options={[{ value: 'Mumbai', label: 'Mumbai' }]} />
                                        ) : (
                                            <>
                                                <CustomSelect
                                                    value={form.location}
                                                    onChange={handleLocationChange}
                                                    disabled={checkingLocationInbox || isLocalAdmin}
                                                    placeholder="— Select location —"
                                                    options={locations.map(l => ({ value: l.location, label: l.location }))}
                                                />
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
                                        <Label><Layers size={10} className="inline mr-0.5" />{isDDMUser ? 'District' : 'Department'}</Label>
                                        {isROTE ? (
                                            // RO/TE: DDM option always visible, with conditional content below
                                            <div className="space-y-2">
                                                {/* DDM option - always visible for RO/TE */}
                                                {!needsLoc && form.office_type && (
                                                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer border border-canopy/20 rounded-lg bg-canopy-tint hover:bg-canopy-tint">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.department_name === 'DDM'}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    set('department_name', 'DDM');
                                                                    set('department_short_code', '');
                                                                    set('department_short_code_multi', []);
                                                                } else {
                                                                    set('department_name', '');
                                                                    set('department_short_code', '');
                                                                    set('department_short_code_multi', []);
                                                                }
                                                            }}
                                                            className="rounded accent-canopy"
                                                        />
                                                        <span className="text-sm font-semibold text-canopy">DDM — District Development Manager</span>
                                                    </label>
                                                )}

                                                {/* District dropdown for DDM users OR Department checkboxes for regular users */}
                                                {isDDMUser ? (
                                                    // District dropdown for checked DDM
                                                    <CustomSelect
                                                        value={form.department_short_code || ''}
                                                        onChange={handleDDMDistrictChange}
                                                        disabled={!form.location}
                                                        placeholder="— Select district —"
                                                        options={(DDM_DISTRICTS[form.location] || []).map(d => ({ value: d, label: d }))}
                                                    />
                                                ) : (
                                                    // Department checkboxes for unchecked DDM
                                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                        {needsLoc ? (
                                                            <p className="px-3 py-2 text-sm text-slate-400">— Select location first —</p>
                                                        ) : !form.office_type ? (
                                                            <p className="px-3 py-2 text-sm text-slate-400">— Select office type first —</p>
                                                        ) : (
                                                            <>
                                                                {depts.length > 0 && (
                                                                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 bg-slate-50 font-semibold">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={(form.department_short_code_multi || []).length === depts.length && depts.length > 0}
                                                                            ref={el => { if (el) el.indeterminate = (form.department_short_code_multi || []).length > 0 && (form.department_short_code_multi || []).length < depts.length; }}
                                                                            onChange={() => {
                                                                                const currentCodes = form.department_short_code_multi || [];
                                                                                const allSelected = currentCodes.length === depts.length;
                                                                                const newCodes = allSelected ? [] : depts.map(d => d.shortCode);
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
                                                                            className="rounded accent-canopy"
                                                                        />
                                                                        <span className="text-sm text-slate-700">{(form.department_short_code_multi || []).length === depts.length && depts.length > 0 ? 'Deselect All' : 'Select All'}</span>
                                                                    </label>
                                                                )}
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
                                                                                className="rounded accent-canopy"
                                                                            />
                                                                            <span className="text-sm text-slate-700">{d.name}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            // HO: Department checkboxes (multi-select)
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                {!form.office_type ? (
                                                    <p className="px-3 py-2 text-sm text-slate-400">— Select office type first —</p>
                                                ) : (isLocalAdmin && isHO) ? (
                                                    <p className="px-3 py-2 text-sm text-slate-400">— Not editable —</p>
                                                ) : (
                                                    <>
                                                        {deptOptions.length > 0 && (
                                                            <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 bg-slate-50 font-semibold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(form.department_short_code_multi || []).length === deptOptions.length && deptOptions.length > 0}
                                                                    ref={el => { if (el) el.indeterminate = (form.department_short_code_multi || []).length > 0 && (form.department_short_code_multi || []).length < deptOptions.length; }}
                                                                    onChange={handleHODepartmentSelectAll}
                                                                    className="rounded accent-canopy"
                                                                />
                                                                <span className="text-sm text-slate-700">{(form.department_short_code_multi || []).length === deptOptions.length && deptOptions.length > 0 ? 'Deselect All' : 'Select All'}</span>
                                                            </label>
                                                        )}
                                                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                            {deptOptions.map(d => (
                                                                <label key={d.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(form.department_short_code_multi || []).includes(d.shortCode)}
                                                                        onChange={(e) => handleHODepartmentChange(d.shortCode, e.target.checked)}
                                                                        className="rounded accent-canopy"
                                                                    />
                                                                    <span className="text-sm text-slate-700">{d.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label><Tag size={10} className="inline mr-0.5" />{isDDMUser ? 'District Code' : 'Dept. Short Code'}</Label>
                                        {(() => {
                                            const shortCodeText = isDDMUser
                                                ? (form.department_short_code || '')
                                                : (form.department_short_code_multi || []).join(', ');
                                            return (
                                                <div className={`${readonlyCls} min-h-[2.375rem] whitespace-pre-wrap break-words leading-relaxed`}>
                                                    {shortCodeText || <span className="text-slate-400">Auto-filled</span>}
                                                </div>
                                            );
                                        })()}
                                        {isDDMUser && errors.department_short_code && <p className="text-xs text-danger">{errors.department_short_code}</p>}
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
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-harvest/10 border border-harvest/25 rounded-xl text-sm text-harvest">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-harvest" />
                                    <span>Cannot change Office Type — this user has pending cases. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-harvest/15 text-harvest rounded-full font-medium">{officePendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto overscroll-contain">
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
                                                        {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium whitespace-nowrap">{status}</span>}
                                                        {priority && (
                                                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                priority === 'High' ? 'bg-danger-tint text-danger' :
                                                                priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>{priority}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelegateClick(task)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
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
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-harvest/10 border border-harvest/25 rounded-xl text-sm text-harvest">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-harvest" />
                                    <span>Cannot change department — this user has pending cases in the department. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-harvest/15 text-harvest rounded-full font-medium">{deptPendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto overscroll-contain">
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
                                                        {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium whitespace-nowrap">{status}</span>}
                                                        {priority && (
                                                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                priority === 'High' ? 'bg-danger-tint text-danger' :
                                                                priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>{priority}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelegateClick(task)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
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
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-harvest/10 border border-harvest/25 rounded-xl text-sm text-harvest">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-harvest" />
                                    <span>Cannot change location — this user has pending cases from the current location. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-harvest/15 text-harvest rounded-full font-medium">{locationPendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto overscroll-contain">
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
                                                        {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium whitespace-nowrap">{status}</span>}
                                                        {priority && (
                                                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                priority === 'High' ? 'bg-danger-tint text-danger' :
                                                                priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>{priority}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelegateClick(task)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
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

                        {/* ── Retired User (Super Admin only) ── */}
                        {isSuperAdmin && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-4 p-4 bg-paper border border-line rounded-card">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-ink">Retired User</p>
                                        <p className="text-xs text-slate-500">Marking the user as retired sets their office details to RETIRED, deactivates the account, and drops their associated groups on save.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input type="checkbox" className="sr-only peer"
                                            checked={isRetiring}
                                            onChange={e => handleRetiredChange(e.target.checked)}
                                            disabled={checkingRetiredInbox} />
                                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-canopy/20 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white dark:after:bg-slate-600 after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:bg-canopy peer-checked:after:translate-x-full peer-checked:after:border-white dark:peer-checked:after:bg-white"></div>
                                    </label>
                                </div>

                                {checkingRetiredInbox && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Loader2 size={12} className="animate-spin" /> Checking inbox…
                                    </div>
                                )}

                                {showRetiredBlock && retiredPendingCases.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-harvest/10 border border-harvest/25 rounded-xl text-sm text-harvest">
                                            <AlertCircle size={15} className="mt-0.5 shrink-0 text-harvest" />
                                            <span>Delegate the pending cases before retiring this user.</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                                <span className="px-2 py-0.5 text-xs bg-harvest/15 text-harvest rounded-full font-medium">{retiredPendingCases.length}</span>
                                            </div>
                                            <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                                {retiredPendingCases.map((task, idx) => {
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
                                                                {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium whitespace-nowrap">{status}</span>}
                                                                {priority && (
                                                                    <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                        priority === 'High' ? 'bg-danger-tint text-danger' :
                                                                        priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                                        'bg-slate-100 text-slate-600'
                                                                    }`}>{priority}</span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelegateClick(task)}
                                                                    className="flex items-center gap-1 px-2 py-1 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
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
                            </div>
                        )}

                        {/* ── User State (Super Admin only) ── */}
                        {isSuperAdmin && <div className="space-y-3">
                            <div className="space-y-1">
                                <Label>User State</Label>
                                <CustomSelect
                                    value={String(form.is_active ?? false)}
                                    onChange={handleStatusChange}
                                    disabled={checkingInbox}
                                    options={[
                                        { value: 'true', label: 'Active' },
                                        { value: 'false', label: 'Inactive' },
                                    ]}
                                />
                                {checkingInbox && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                        <Loader2 size={12} className="animate-spin" /> Checking inbox…
                                    </div>
                                )}
                            </div>

                            {/* Pending cases block */}
                            {showPendingBlock && pendingCases.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2.5 px-3 py-2.5 bg-harvest/10 border border-harvest/25 rounded-xl text-sm text-harvest">
                                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-harvest" />
                                        <span>Delegate the pending cases to make this user inactive.</span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                            <span className="px-2 py-0.5 text-xs bg-harvest/15 text-harvest rounded-full font-medium">{pendingCases.length}</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto overscroll-contain">
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
                                                            {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium whitespace-nowrap">{status}</span>}
                                                            {priority && (
                                                                <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                    priority === 'High' ? 'bg-danger-tint text-danger' :
                                                                    priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                                    'bg-slate-100 text-slate-600'
                                                                }`}>{priority}</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelegateClick(task)}
                                                                className="flex items-center gap-1 px-2 py-1 bg-canopy hover:bg-canopy-dark text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
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
        </Modal>
    );
};

export default EditUserProfileModal;
