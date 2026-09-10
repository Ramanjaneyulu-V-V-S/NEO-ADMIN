import { useState, useEffect, useMemo, useCallback, Component } from 'react';
import { motion } from 'framer-motion';
import {
    FileBarChart2, Filter, X, Search, ChevronLeft, ChevronRight,
    ChevronsLeft, FileText, ClipboardList, Download, AlertCircle
} from 'lucide-react';
import axios from '../api/axios';
import { downloadXlsx } from '../utils/userExport';
import { recordExport } from '../utils/audit';
import { formatDate } from '../utils/datetime';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import { CaseDetailsModal, MovementRegisterModal } from './DelegatePage';
import { PageHeader, Tabs } from '../components/ui';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const EASE_SMOOTH = [0.32, 0.72, 0, 1];

// Error boundary class component
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ReportsPage Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6">
                    <div className="bg-danger-tint border border-danger/20 rounded-lg p-6 flex items-start gap-3">
                        <AlertCircle className="text-danger flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="text-danger font-semibold mb-2">An Error Occurred</h3>
                            <p className="text-danger text-sm mb-3">{this.state.error?.message || 'Unknown error'}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-3 py-1.5 bg-danger text-white rounded text-sm font-medium hover:bg-danger"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const STATUS_OPTIONS   = ['In-Progress', 'Approved', 'Closed', 'Cancelled'];
const PRIORITY_OPTIONS = ['Ordinary', 'Urgent'];
const LANGUAGE_OPTIONS = ['Bilingual', 'English', 'Hindi', 'Others'];

// ─── Digidak Movement Register Modal ──────────────────────────────────────────
const DigidakMovementRegisterModal = ({ digidakItem, onClose }) => {
    const [movement, setMovement] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!digidakItem) return;
        setLoading(true);
        axios.get(`/digidak/${digidakItem.r_object_id}/movement`)
            .then(res => setMovement(Array.isArray(res.data) ? res.data : []))
            .catch(err => {
                console.error('Error fetching digidak movement:', err);
                setMovement([]);
            })
            .finally(() => setLoading(false));
    }, [digidakItem]);

    if (!digidakItem) return null;

    const movCols = [
        { key: 'type_category', label: 'Type Category' },
        { key: 'letter_subject', label: 'Letter Subject' },
        { key: 'performer', label: 'Performer' },
        { key: 'status', label: 'Status' },
        { key: 'assigned_user', label: 'Assigned User' },
        { key: 'entry_type', label: 'Entry Type' },
        { key: 'received_date', label: 'Received Date' },
        { key: 'completed_date', label: 'Completed Date' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm">
                            <ClipboardList size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{digidakItem.letter_subject || digidakItem.uid_number}</p>
                            <p className="text-xs text-slate-500">Digidak Movement Register</p>
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
                            <div className="animate-spin text-canopy" style={{width: '18px', height: '18px'}}>
                                ⟳
                            </div>
                            <span className="text-sm">Loading movement register…</span>
                        </div>
                    ) : movement.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                            No movement register records found for this digidak.
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

const ReportsPage = () => {
    const reduceMotion = usePrefersReducedMotion();
    // ── Tab state ─────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('cases'); // 'cases', 'digidak', or 'rajbhasha'
    const [digidakSubTab, setDigidakSubTab] = useState('inbox'); // 'inbox', 'outbox', or 'draft'

    // ── Local Admin Context ────────────────────────────────────────────────────
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';
    const [profileCtx, setProfileCtx] = useState(null);

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        axios.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const ot  = ctx.office_type || '';
                const loc = ctx.location    || '';
                if (ot) {
                    setOfficeType(ot);
                    setDigidakOfficeType(ot);
                    setRajbhashaOfficeType(ot);
                    if (loc) {
                        setLocation(loc);
                        setDigidakLocation(loc);
                        setRajbhashaLocation(loc);
                    }
                }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // ── Cases Report Filter state ─────────────────────────────────────────────
    const [officeType,   setOfficeType]   = useState('');
    const [location,     setLocation]     = useState('');
    const [deptName,     setDeptName]     = useState('');
    const [departments,  setDepartments]  = useState([]);
    const [vertical,     setVertical]     = useState([]);
    const [verticals,    setVerticals]    = useState([]);
    const [fromDate,     setFromDate]     = useState('');
    const [toDate,       setToDate]       = useState('');
    const [statusFilter,   setStatusFilter]   = useState([]);
    const [priorityFilter, setPriorityFilter] = useState([]);
    const [languageFilter, setLanguageFilter] = useState([]);

    // ── Digidak Report Filter state ───────────────────────────────────────────
    const [digidakOfficeType,   setDigidakOfficeType]   = useState('');
    const [digidakLocation,     setDigidakLocation]     = useState('');
    const [digidakDeptName,     setDigidakDeptName]     = useState('');
    const [digidakDepartments,  setDigidakDepartments]  = useState([]);
    const [digidakFromDate,     setDigidakFromDate]     = useState('');
    const [digidakToDate,       setDigidakToDate]       = useState('');
    const [digidakLanguage,     setDigidakLanguage]     = useState([]);
    const [digidakModeOfReceipt,setDigidakModeOfReceipt]= useState([]);
    const [digidakPriority,     setDigidakPriority]     = useState([]);
    const [digidakSecrecy,      setDigidakSecrecy]      = useState([]);
    const [digidakStatus,        setDigidakStatus]        = useState([]);
    const [digidakTypeCategory,  setDigidakTypeCategory]  = useState([]);
    const [digidakEntryType,     setDigidakEntryType]     = useState([]);
    const [digidakSourceVertical,setDigidakSourceVertical]= useState([]);
    const [digidakSourceVerticals,setDigidakSourceVerticals]= useState([]);
    const [digidakSentTo,        setDigidakSentTo]        = useState([]);
    const [digidakSentToOptions, setDigidakSentToOptions] = useState([]);
    const [digidakReceivedFrom,  setDigidakReceivedFrom]  = useState([]);
    const [digidakReceivedFromOptions, setDigidakReceivedFromOptions] = useState([]);
    const [digidakRegion,        setDigidakRegion]        = useState([]);
    const [digidakInboxRegion,   setDigidakInboxRegion]   = useState([]);
    const digidakRegionOptions = ['Region A', 'Region B', 'Region C'];
    const [digidakMetadata,     setDigidakMetadata]     = useState({
        languages: [], mode_of_receipt: [], priority: [], secrecy: [], status: [], type_category: [], entry_type: [], source_vertical: []
    });
    const [digidakInboxUsername, setDigidakInboxUsername] = useState('');
    const [digidakInboxUsers,   setDigidakInboxUsers]   = useState([]);

    // ── Rajbhasha Report Filter state ────────────────────────────────────────
    const [rajbhashaOfficeType,  setRajbhashaOfficeType]  = useState('');
    const [rajbhashaLocation,    setRajbhashaLocation]    = useState('');
    const [rajbhashaDeptName,    setRajbhashaDeptName]    = useState('');
    const [rajbhashaDepartments, setRajbhashaDepartments] = useState([]);
    const [rajbhashaFromDate,    setRajbhashaFromDate]    = useState('');
    const [rajbhashaToDate,      setRajbhashaToDate]      = useState('');
    const [rajbhashaReport,      setRajbhashaReport]      = useState(null);

    // ── Results state ─────────────────────────────────────────────────────────
    const [cases,          setCases]          = useState([]);
    const [allCases,       setAllCases]       = useState([]); // holds full export dataset
    const [casesTotalCount, setCasesTotalCount] = useState(0);
    const [caseCountLoading, setCaseCountLoading] = useState(false);
    const [digidakResults, setDigidakResults] = useState([]);
    const [digidakTotalCount, setDigidakTotalCount] = useState(0);
    const [countLoading,   setCountLoading]   = useState(false);
    const [loading,        setLoading]        = useState(false);
    const [exporting,      setExporting]      = useState(false);
    const [page,           setPage]           = useState(1);
    const [pageSize,       setPageSize]       = useState(10);
    const [hasNextPage,    setHasNextPage]    = useState(false);
    const [filtersApplied, setFiltersApplied] = useState(false);
    const [error,          setError]          = useState('');

    // ── Modal state ───────────────────────────────────────────────────────────
    const [detailCase,      setDetailCase]      = useState(null);
    const [movementCase,    setMovementCase]    = useState(null);
    const [digidakMovement, setDigidakMovement] = useState(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const locations      = useMemo(() => getLocations(officeType), [officeType]);
    const isRoTe         = officeType === 'RO' || officeType === 'TE';
    const locationShortCode = useMemo(
        () => locations.find(l => l.location === location)?.shortCode || '',
        [locations, location]
    );

    useEffect(() => {
        setDeptName('');
        setDepartments([]);
        setVertical('');
        setVerticals([]);
        if (!officeType) return;
        if (isRoTe && !location) return;
        fetchDepartments(officeType, isRoTe ? location : '')
            .then(depts => {
                setDepartments(depts || []);
            })
            .catch(err => {
                console.error('Error fetching departments (Cases):', err);
                setDepartments([]);
            });
    }, [officeType, location, isRoTe]);

    // For Local Admin: filter departments to only those in their profile (HO only)
    const filteredDepartments = isLocalAdmin && profileCtx && !isRoTe
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            const filtered = departments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
            // If filtering results in empty list, show all departments (fallback for data consistency)
            return filtered.length > 0 ? filtered : departments;
          })()
        : departments;

    // Fetch verticals for HO when department is selected
    useEffect(() => {
        setVertical('');
        setVerticals([]);
        if (officeType !== 'HO' || !deptName) return;
        axios.get('/groups/verticals', { params: { officeType: 'HO', deptName } })
            .then(res => {
                const all = res.data || [];
                setVerticals(all.filter(g =>
                    !g.group_name.includes('vertical_head') &&
                    !g.group_name.includes('_grade_') &&
                    !g.group_name.includes('_cgm_sec')
                ));
            })
            .catch(err => {
                console.error('Error fetching verticals:', err);
                setVerticals([]);
            });
    }, [officeType, deptName]);

    // ── Digidak Departments ───────────────────────────────────────────────────
    const digidakLocations = useMemo(() => getLocations(digidakOfficeType), [digidakOfficeType]);
    const digidakIsRoTe = digidakOfficeType === 'RO' || digidakOfficeType === 'TE';

    useEffect(() => {
        setDigidakDeptName('');
        setDigidakDepartments([]);
        if (!digidakOfficeType) return;
        if (digidakIsRoTe && !digidakLocation) return;
        fetchDepartments(digidakOfficeType, digidakIsRoTe ? digidakLocation : '')
            .then(depts => {
                setDigidakDepartments(depts || []);
            })
            .catch(err => {
                console.error('Error fetching departments (Digidak):', err);
                setDigidakDepartments([]);
            });
    }, [digidakOfficeType, digidakLocation, digidakIsRoTe]);

    // For Local Admin: filter departments to only those in their profile (HO only)
    const filteredDigidakDepartments = isLocalAdmin && profileCtx && !digidakIsRoTe
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            const filtered = digidakDepartments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
            // If filtering results in empty list, show all departments (fallback for data consistency)
            return filtered.length > 0 ? filtered : digidakDepartments;
          })()
        : digidakDepartments;

    // ── Rajbhasha Departments ────────────────────────────────────────────────
    const rajbhashaLocations = useMemo(() => getLocations(rajbhashaOfficeType), [rajbhashaOfficeType]);
    const rajbhashaIsRoTe = rajbhashaOfficeType === 'RO' || rajbhashaOfficeType === 'TE';

    useEffect(() => {
        setRajbhashaDeptName('');
        setRajbhashaDepartments([]);
        if (!rajbhashaOfficeType) return;
        if (rajbhashaIsRoTe && !rajbhashaLocation) return;
        fetchDepartments(rajbhashaOfficeType, rajbhashaIsRoTe ? rajbhashaLocation : '')
            .then(depts => {
                setRajbhashaDepartments(depts || []);
            })
            .catch(err => {
                console.error('Error fetching departments (Rajbhasha):', err);
                setRajbhashaDepartments([]);
            });
    }, [rajbhashaOfficeType, rajbhashaLocation, rajbhashaIsRoTe]);

    // For Local Admin: filter departments to only those in their profile (HO only)
    const filteredRajbhashaDepartments = isLocalAdmin && profileCtx && !rajbhashaIsRoTe
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            return rajbhashaDepartments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
          })()
        : rajbhashaDepartments;

    // ── Fetch Digidak Source Verticals (Outbox only) ───────────────────────────
    useEffect(() => {
        setDigidakSourceVertical('');
        setDigidakSourceVerticals([]);
        if (digidakSubTab !== 'outbox') return;
        if (!digidakOfficeType) return;
        if (digidakIsRoTe && !digidakLocation) return;
        if (!digidakIsRoTe && !digidakDeptName) return;

        const params = {
            officeType: digidakOfficeType,
            location: digidakIsRoTe ? digidakLocation : '',
            deptName: !digidakIsRoTe ? digidakDeptName : ''
        };
        axios.get('/digidak/verticals', { params })
            .then(res => {
                const verticals = (res.data || []).map(v => v.name || v.value || v);
                setDigidakSourceVerticals(verticals.filter(v => typeof v === 'string'));
            })
            .catch(err => {
                console.error('Error fetching source verticals:', err);
                setDigidakSourceVerticals([]);
            });
    }, [digidakOfficeType, digidakLocation, digidakDeptName, digidakIsRoTe, digidakSubTab]);

    // ── Fetch Digidak Metadata ────────────────────────────────────────────────
    useEffect(() => {
        axios.get('/digidak/metadata')
            .then(res => {
                setDigidakMetadata(res.data || {});
            })
            .catch(err => {
                console.error('Error fetching Digidak metadata:', err);
                setDigidakMetadata({
                    languages: [], mode_of_receipt: [], priority: [], secrecy: [], status: [], type_category: [], entry_type: [], source_vertical: []
                });
            });
    }, []);

    // ── Fetch Sent To Options ─────────────────────────────────────────────────
    useEffect(() => {
        axios.get('/digidak/sent-to-options')
            .then(res => {
                setDigidakSentToOptions(res.data || []);
            })
            .catch(err => {
                console.error('Error fetching Sent To options:', err);
                setDigidakSentToOptions([]);
            });
    }, []);

    // ── Fetch Received From Options ────────────────────────────────────────────
    useEffect(() => {
        axios.get('/digidak/received-from-options')
            .then(res => {
                setDigidakReceivedFromOptions(res.data || []);
            })
            .catch(err => {
                console.error('Error fetching Received From options:', err);
                setDigidakReceivedFromOptions([]);
            });
    }, []);

    // ── Fetch Digidak Inbox Users ─────────────────────────────────────────────
    useEffect(() => {
        setDigidakInboxUsername('');
        setDigidakInboxUsers([]);
        if (!digidakOfficeType) return;
        if (digidakIsRoTe && !digidakLocation) return;
        if (!digidakIsRoTe && !digidakDeptName) return;

        let endpoint = '';
        let params = {};
        if (digidakIsRoTe && digidakLocation) {
            endpoint = '/users/by-location';
            params = { location: digidakLocation, officeType: digidakOfficeType };
        } else if (!digidakIsRoTe && digidakDeptName) {
            const dept = digidakDepartments.find(d => d.name === digidakDeptName);
            if (dept && dept.shortCode) {
                endpoint = '/users/by-dept';
                params = { shortCode: dept.shortCode, officeType: digidakOfficeType };
            }
        }

        if (endpoint) {
            axios.get(endpoint, { params })
                .then(res => {
                    const users = (res.data || []).map(u => u.object_name || u.user_name || u.user_login_name || u.name || u);
                    setDigidakInboxUsers(users.filter(u => typeof u === 'string'));
                })
                .catch(err => {
                    console.error('Error fetching Inbox users:', err);
                    setDigidakInboxUsers([]);
                });
        }
    }, [digidakOfficeType, digidakLocation, digidakDeptName, digidakDepartments, digidakIsRoTe]);

    // ── Clear Digidak filters on tab change ────────────────────────────────────
    useEffect(() => {
        // For local admins, preserve Office Type and Location (they're auto-set from profile)
        if (!isLocalAdmin) {
            setDigidakOfficeType('');
            setDigidakLocation('');
        }
        setDigidakDeptName('');
        // NOTE: Do NOT clear digidakDepartments here - departments are based on office type/location,
        // not the tab. Clearing them breaks the department dropdown when switching tabs.
        // setDigidakDepartments([]);
        setDigidakSourceVertical([]);
        setDigidakSourceVerticals([]);
        setDigidakFromDate('');
        setDigidakToDate('');
        setDigidakLanguage([]);
        setDigidakModeOfReceipt([]);
        setDigidakPriority([]);
        setDigidakSecrecy([]);
        setDigidakStatus([]);
        setDigidakTypeCategory([]);
        setDigidakEntryType([]);
        setDigidakSentTo([]);
        setDigidakReceivedFrom([]);
        setDigidakRegion([]);
        setDigidakInboxRegion([]);
        setDigidakInboxUsername('');
        setDigidakResults([]);
        setDigidakTotalCount(0);
        setFiltersApplied(false);
        setPage(1);
        setError('');
    }, [digidakSubTab, isLocalAdmin]);

    // ── Cases Handlers ────────────────────────────────────────────────────────
    const handleOfficeTypeChange = (val) => {
        setOfficeType(val);
        setLocation('');
        setDeptName('');
        setDepartments([]);
        setVertical('');
        setVerticals([]);
    };

    const handleLocationChange = (val) => {
        setLocation(val);
        setDeptName('');
        setDepartments([]);
        setVertical('');
        setVerticals([]);
    };

    // ── Digidak Handlers ──────────────────────────────────────────────────────
    const handleDigidakOfficeTypeChange = (val) => {
        setDigidakOfficeType(val);
        setDigidakLocation('');
        setDigidakDeptName('');
        setDigidakDepartments([]);
    };

    const handleDigidakLocationChange = (val) => {
        setDigidakLocation(val);
        setDigidakDeptName('');
        setDigidakDepartments([]);
    };

    // ── Rajbhasha Handlers ─────────────────────────────────────────────────────
    const handleRajbhashaOfficeTypeChange = (val) => {
        setRajbhashaOfficeType(val);
        setRajbhashaLocation('');
        setRajbhashaDeptName('');
        setRajbhashaDepartments([]);
    };

    const handleRajbhashaLocationChange = (val) => {
        setRajbhashaLocation(val);
        setRajbhashaDeptName('');
        setRajbhashaDepartments([]);
    };

    const buildParams = useCallback(() => {
        const p = {};
        if (officeType)            p.hoRo      = officeType;
        if (isRoTe && location)    p.location  = location;
        if (deptName)              p.deptNames = deptName;
        if (vertical && vertical.length > 0)              p.functions = vertical.join(',');
        if (fromDate)              p.fromDate  = fromDate;
        if (toDate)                p.toDate    = toDate;
        if (statusFilter && statusFilter.length > 0)          p.status    = statusFilter.join(',');
        if (priorityFilter && priorityFilter.length > 0)        p.priority  = priorityFilter.join(',');
        if (languageFilter && languageFilter.length > 0)        p.language  = languageFilter.join(',');
        return p;
    }, [officeType, isRoTe, location, deptName, vertical, fromDate, toDate,
        statusFilter, priorityFilter, languageFilter]);

    const fetchReport = useCallback(async (pageNum, size) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await axios.get('/cases/report', {
                params: { ...buildParams(), page: pageNum, size }
            });
            setCases(data.cases || []);
            setHasNextPage(data.hasNext || false);
            setFiltersApplied(true);
            setPage(pageNum);
        } catch {
            setError('Failed to load report. Please try again.');
            setCases([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    const fetchCasesCount = useCallback(async () => {
        setCaseCountLoading(true);
        try {
            const { data } = await axios.get('/cases/count', {
                params: buildParams(),
                timeout: 60000
            });
            setCasesTotalCount(data.total || 0);
        } catch (err) {
            console.error('Error fetching cases count:', err);
            setCasesTotalCount(0);
        } finally {
            setCaseCountLoading(false);
        }
    }, [buildParams]);

    const handleApply = () => {
        fetchReport(1, pageSize);
        fetchCasesCount();
    };

    const handleClear = () => {
        setOfficeType(''); setLocation(''); setDeptName(''); setDepartments([]);
        setVertical([]); setVerticals([]);
        setFromDate(''); setToDate('');
        setStatusFilter([]); setPriorityFilter([]); setLanguageFilter([]);
        setCases([]); setAllCases([]);
        setCasesTotalCount(0);
        setFiltersApplied(false); setError(''); setPage(1);
    };

    // ── Digidak Report Functions ──────────────────────────────────────────────
    const buildDigidakParams = useCallback(() => {
        const p = {};
        if (digidakOfficeType)        p.hoRo = digidakOfficeType;
        if (digidakIsRoTe && digidakLocation) p.location = digidakLocation;
        if (digidakDeptName)          p.deptNames = digidakDeptName;
        if (digidakFromDate)          p.fromDate = digidakFromDate;
        if (digidakToDate)            p.toDate = digidakToDate;
        if (digidakLanguage && digidakLanguage.length > 0)          p.language = digidakLanguage.join(',');
        if (digidakModeOfReceipt && digidakModeOfReceipt.length > 0)     p.modeOfReceipt = digidakModeOfReceipt.join(',');
        if (digidakPriority && digidakPriority.length > 0)          p.priority = digidakPriority.join(',');
        if (digidakSecrecy && digidakSecrecy.length > 0)           p.secrecy = digidakSecrecy.join(',');
        if (digidakStatus && digidakStatus.length > 0)            p.status = digidakStatus.join(',');
        if (digidakTypeCategory && digidakTypeCategory.length > 0)      p.typeCategory = digidakTypeCategory.join(',');
        if (digidakEntryType && digidakEntryType.length > 0)          p.entryType = digidakEntryType.join(',');

        // Outbox: Region/Sent To handling
        if (digidakSubTab === 'outbox') {
            if (digidakRegion && digidakRegion.length > 0) {
                p.region = digidakRegion.join(',');
            } else if (digidakSentTo && digidakSentTo.length > 0) {
                p.sentTo = digidakSentTo.join(',');
            }
        }

        // Inbox: Region/Received From handling
        if (digidakSubTab === 'inbox') {
            if (digidakInboxRegion && digidakInboxRegion.length > 0) {
                p.region = digidakInboxRegion.join(',');
            } else if (digidakReceivedFrom && digidakReceivedFrom.length > 0) {
                p.receivedFrom = digidakReceivedFrom.join(',');
            }
        } else {
            if (digidakReceivedFrom && digidakReceivedFrom.length > 0) p.receivedFrom = digidakReceivedFrom.join(',');
        }

        if (digidakInboxUsername)     p.username = digidakInboxUsername;
        if (digidakSourceVertical && digidakSourceVertical.length > 0 && digidakSubTab === 'outbox') p.sourceVertical = digidakSourceVertical.join(',');
        // For Outbox report, add decisionType parameter
        if (digidakSubTab === 'outbox') p.decisionType = 'outbox';
        return p;
    }, [digidakOfficeType, digidakIsRoTe, digidakLocation, digidakDeptName,
        digidakFromDate, digidakToDate, digidakLanguage, digidakModeOfReceipt,
        digidakPriority, digidakSecrecy, digidakStatus, digidakTypeCategory, digidakEntryType, digidakSentTo, digidakRegion, digidakInboxRegion, digidakReceivedFrom, digidakInboxUsername,
        digidakSourceVertical, digidakSubTab]);

    const fetchDigidakReport = useCallback(async (pageNum = 1, size = 10) => {
        setLoading(true);
        setError('');
        try {
            let endpoint;
            if (digidakSubTab === 'inbox') {
                endpoint = '/digidak/inbox';
            } else if (digidakSubTab === 'draft') {
                endpoint = '/digidak/draft';
            } else {
                endpoint = '/digidak/report';
            }
            const { data } = await axios.get(endpoint, {
                params: { ...buildDigidakParams(), page: pageNum, size }
            });
            setDigidakResults(data.items || []);
            setHasNextPage(data.hasNext || false);
            setFiltersApplied(true);
            setPage(pageNum);
        } catch {
            setError('Failed to load Digidak report. Please try again.');
            setDigidakResults([]);
        } finally {
            setLoading(false);
        }
    }, [buildDigidakParams, digidakSubTab]);

    const fetchDigidakCount = useCallback(async () => {
        setCountLoading(true);
        try {
            let endpoint = '/digidak/count';
            if (digidakSubTab === 'inbox') {
                endpoint = '/digidak/inbox/count';
            } else if (digidakSubTab === 'draft') {
                endpoint = '/digidak/draft/count';
            }
            const { data } = await axios.get(endpoint, {
                params: buildDigidakParams(),
                timeout: 60000
            });
            setDigidakTotalCount(data.total || 0);
        } catch (err) {
            console.error('Error fetching Digidak count:', err);
            setDigidakTotalCount(0);
        } finally {
            setCountLoading(false);
        }
    }, [buildDigidakParams, digidakSubTab]);

    const handleDigidakApply = () => {
        if (!digidakOfficeType) {
            setError('Office Type is required');
            return;
        }
        setError('');
        fetchDigidakReport(1, pageSize);
        fetchDigidakCount();
    };

    const handleDigidakClear = () => {
        setDigidakOfficeType(''); setDigidakLocation(''); setDigidakDeptName('');
        setDigidakDepartments([]);
        setDigidakFromDate(''); setDigidakToDate('');
        setDigidakLanguage([]); setDigidakModeOfReceipt([]); setDigidakPriority([]);
        setDigidakSecrecy([]); setDigidakStatus([]); setDigidakTypeCategory([]); setDigidakSourceVertical([]);
        setDigidakInboxUsername('');
        setDigidakResults([]);
        setDigidakTotalCount(0);
        setFiltersApplied(false); setError(''); setPage(1);
    };

    // ── Rajbhasha Report Functions ─────────────────────────────────────────────
    const formatDateToDDMMYYYY = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr.includes('-')) {
            // YYYY-MM-DD format → dd/mm/yyyy
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    };

    const fetchRajbhashaReport = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Apply default dates if not provided (as per requirement)
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            const fromDateYYYYMMDD = rajbhashaFromDate || '2025-01-01'; // Default: 01/01/2025
            const toDateYYYYMMDD = rajbhashaToDate || today; // Default: today

            // Convert to dd/mm/yyyy format as required
            const finalFromDate = formatDateToDDMMYYYY(fromDateYYYYMMDD);
            const finalToDate = formatDateToDDMMYYYY(toDateYYYYMMDD);

            const params = {
                hoRo: rajbhashaOfficeType,
                deptNames: rajbhashaDeptName,
                fromDate: finalFromDate,
                toDate: finalToDate
            };

            // Only add location for RO/TE, not for HO
            if (rajbhashaOfficeType !== 'HO' && rajbhashaLocation) {
                params.location = rajbhashaLocation;
            }

            const { data } = await axios.get('/rajbhasha/report', { params });
            if (data.success) {
                setRajbhashaReport({
                    grid1: data.grid1 || null,
                    grid2: data.grid2 || null,
                    grid3: data.grid3 || null
                });
                setFiltersApplied(true);
            } else {
                setError(data.error || 'Failed to load Rajbhasha report');
                setRajbhashaReport(null);
            }
        } catch (err) {
            setError('Failed to load Rajbhasha report. Please try again.');
            setRajbhashaReport(null);
        } finally {
            setLoading(false);
        }
    }, [rajbhashaOfficeType, rajbhashaLocation, rajbhashaDeptName, rajbhashaFromDate, rajbhashaToDate]);

    const handleRajbhashaApply = () => {
        if (!rajbhashaOfficeType) {
            setError('Office Type is required');
            return;
        }
        if (rajbhashaIsRoTe && !rajbhashaLocation) {
            setError('Location is required for RO/TE');
            return;
        }
        if (!rajbhashaIsRoTe && !rajbhashaDeptName) {
            setError('Department is required for HO');
            return;
        }
        setError('');
        fetchRajbhashaReport();
    };

    const handleRajbhashaClear = () => {
        setRajbhashaOfficeType('');
        setRajbhashaLocation('');
        setRajbhashaDeptName('');
        setRajbhashaDepartments([]);
        setRajbhashaFromDate('');
        setRajbhashaToDate('');
        setRajbhashaReport(null);
        setFiltersApplied(false);
        setError('');
    };

    const handleRajbhashaExport = async () => {
        if (!rajbhashaReport) {
            setError('Please apply filters and generate report first');
            return;
        }

        setExporting(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const fromDateYYYYMMDD = rajbhashaFromDate || '2025-01-01';
            const toDateYYYYMMDD = rajbhashaToDate || today;

            const params = new URLSearchParams({
                hoRo: rajbhashaOfficeType,
                deptNames: rajbhashaDeptName,
                fromDate: formatDateToDDMMYYYY(fromDateYYYYMMDD),
                toDate: formatDateToDDMMYYYY(toDateYYYYMMDD)
            });

            if (rajbhashaOfficeType !== 'HO' && rajbhashaLocation) {
                params.append('location', rajbhashaLocation);
            }

            const response = await axios.get(`/rajbhasha/report/export?${params}`, {
                responseType: 'blob'
            });

            // Create blob link and download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Rajbhasha_Report_${new Date().toISOString().split('T')[0]}.docx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to export report');
            console.error('Export error:', err);
        } finally {
            setExporting(false);
        }
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        fetchReport(1, newSize);
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const fetchAllForExport = async () => {
        setExporting(true);
        try {
            // Fetch up to 1000 records for export (single large page)
            const { data } = await axios.get('/cases/report', {
                params: { ...buildParams(), page: 1, size: 1000 }
            });
            return data.cases || [];
        } catch {
            return [];
        } finally {
            setExporting(false);
        }
    };

    const exportToCSV = async () => {
        const rows = await fetchAllForExport();
        if (!rows.length) return;
        const cols = ['object_name', 'description', 'ho_ro', 'department_name',
                      'status', 'task_priority', 'language_type', 'r_creation_date',
                      'r_creator_name', 'case_nature', 'disposal_level', 'file_number',
                      'types', 'functions'];
        const headers = ['Case Number', 'Description', 'Office Type', 'Department',
                         'Status', 'Priority', 'Language', 'Date Created',
                         'Created By', 'Case Nature', 'Disposal Level', 'File No',
                         'Types', 'Functions'];
        const csvRows = [headers.join(',')];
        rows.forEach(r => {
            csvRows.push(cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `cases_report_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        recordExport({ action: 'Export Cases report', targetType: 'report', count: rows.length, detail: 'CSV' });
    };

    const exportToExcel = async () => {
        const rows = await fetchAllForExport();
        if (!rows.length) return;
        const sheetData = rows.map((r, i) => ({
            '#':               i + 1,
            'Case Number':     r.object_name      ?? '',
            'Description':     r.description      ?? '',
            'Office Type':     r.ho_ro            ?? '',
            'Department':      r.department_name  ?? '',
            'Status':          r.status           ?? '',
            'Priority':        r.task_priority    ?? '',
            'Language':        r.language_type    ?? '',
            'Date Created':    r.r_creation_date  ?? '',
            'Created By':      r.r_creator_name   ?? '',
            'Case Nature':     r.case_nature      ?? '',
            'Disposal Level':  r.disposal_level   ?? '',
            'File No':         r.file_number      ?? '',
            'Types':           r.types            ?? '',
            'Functions':       r.functions        ?? '',
        }));
        const columns = Object.keys(sheetData[0]).map(k => ({
            header: k,
            key: k,
            width: k === 'Description' ? 40 : k === '#' ? 6 : 18,
        }));
        await downloadXlsx(
            [{ name: 'Cases Report', columns, rows: sheetData }],
            `cases_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
        recordExport({ action: 'Export Cases report', targetType: 'report', count: rows.length, detail: 'XLSX' });
    };

    // ── Digidak Export Functions ──────────────────────────────────────────────
    const fetchAllDigidakForExport = async () => {
        setExporting(true);
        try {
            let endpoint;
            if (digidakSubTab === 'inbox') {
                endpoint = '/digidak/inbox';
            } else if (digidakSubTab === 'draft') {
                endpoint = '/digidak/draft';
            } else {
                endpoint = '/digidak/report';
            }
            const allItems = [];
            let page = 1;
            let hasNext = true;

            while (hasNext) {
                const params = { ...buildDigidakParams(), page, size: 100 };
                if (digidakSubTab === 'outbox' || digidakSubTab === 'inbox' || digidakSubTab === 'draft') {
                    params.export = true;
                }
                const { data } = await axios.get(endpoint, { params });
                const items = data.items || [];
                allItems.push(...items);
                hasNext = data.hasNext || false;
                page++;
            }

            // Deduplicate by r_object_id, keeping last occurrence
            const lastOccurrence = new Map();
            for (const item of allItems) {
                lastOccurrence.set(item.r_object_id, item);
            }
            return Array.from(lastOccurrence.values());
        } catch (err) {
            console.error('Error fetching Digidak for export:', err);
            return [];
        } finally {
            setExporting(false);
        }
    };

    const exportDigidakToExcel = async () => {
        const rows = await fetchAllDigidakForExport();
        if (!rows.length) return;
        const sheetData = rows.map((r, i) => {
            const row = {
                '#':               i + 1,
                'Object ID':       r.r_object_id      ?? '',
                'UID Number':      r.uid_number       ?? '',
                'Letter Subject':  r.letter_subject   ?? '',
                'Initiator':       r.initiator        ?? '',
                'File Number':     r.file_number      ?? '',
                'Type Category':   r.type_category    ?? '',
                'Type':            r.entry_type       ?? '',
                'Language':        r.languages        ?? '',
                'Mode of Dispatch':r.mode_of_receipt  ?? '',
                'Priority':        r.priority         ?? '',
                'Secrecy':         r.secrecy          ?? '',
                'Status':          r.status           ?? '',
            };
            // Include Sent To only for Inbox and Outbox (not Draft)
            if (digidakSubTab !== 'draft') {
                row['Sent To'] = r.selected_region ?? '';
            }
            // Include Received From only for Inbox and Outbox (not Draft)
            if (digidakSubTab !== 'draft') {
                row['Received From'] = r.login_region ?? '';
            }
            // Include Vertical/Department only for Inbox
            if (digidakSubTab === 'inbox') {
                const vertical = r.vertical ?? '';
                const transformedVertical = vertical ? vertical.replace(/_/g, '-').toUpperCase() : '';
                row['Vertical/Department'] = transformedVertical;
            }
            // Include Source Vertical only for Outbox
            if (digidakSubTab === 'outbox') {
                row['Source Vertical'] = r.source_vertical ?? '';
            }
            if (digidakSubTab !== 'inbox') {
                row['Decision'] = r.decision ?? '';
            }
            row['Date Created'] = r.r_creation_date ?? '';
            return row;
        });
        const columns = Object.keys(sheetData[0]).map(k => ({
            header: k,
            key: k,
            width: k === 'Letter Subject' ? 40 : k === 'Object ID' ? 22 : k === '#' ? 6 : 16,
        }));
        const sheetName = `${digidakSubTab.charAt(0).toUpperCase() + digidakSubTab.slice(1)} Report`;
        await downloadXlsx(
            [{ name: sheetName, columns, rows: sheetData }],
            `digidak_${digidakSubTab}_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
        recordExport({
            action: 'Export Digidak report',
            target: digidakSubTab,
            targetType: 'report',
            count: rows.length,
            detail: 'XLSX',
        });
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const selectCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-canopy bg-white';

    return (
        <ErrorBoundary>
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE_SMOOTH }}
            className="flex flex-col"
        >
            <PageHeader
                title="Reports"
                icon={FileBarChart2}
                description="Generate case reports with custom filters"
            />

            <Tabs
                className="mb-6"
                value={activeTab}
                onChange={setActiveTab}
                tabs={[
                    { id: 'cases', label: 'Cases Report' },
                    { id: 'digidak', label: 'Digidak' },
                    ...(!isLocalAdmin ? [{ id: 'rajbhasha', label: 'Rajbhasha Report' }] : []),
                ]}
            />

            {/* Cases Report Section */}
            {activeTab === 'cases' && (
            <>
            {/* Filter Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Filters</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
                    {/* Office Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Office Type</label>
                        <CustomSelect value={officeType} onChange={handleOfficeTypeChange} disabled={isLocalAdmin}
                            placeholder="Select"
                            options={[
                                { value: 'HO', label: 'HO' },
                                { value: 'RO', label: 'RO' },
                                { value: 'TE', label: 'TE' },
                            ]} />
                    </div>

                    {/* Location — RO/TE only */}
                    {isRoTe && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                            <CustomSelect value={location} onChange={handleLocationChange} disabled={isLocalAdmin}
                                placeholder="Select Location"
                                options={locations.map(l => ({ value: l.location, label: l.location }))} />
                        </div>
                    )}

                    {/* Department */}
                    {officeType && filteredDepartments.length > 0 && (!isRoTe || location) && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                            <CustomSelect value={deptName} onChange={setDeptName}
                                placeholder="Select Department"
                                options={filteredDepartments.map(d => ({ value: d.name, label: d.name }))} />
                        </div>
                    )}

                    {/* Vertical — HO only, shown when dept is selected and verticals loaded */}
                    {officeType === 'HO' && deptName && verticals.length > 0 && (
                        <MultiSelectDropdown
                            label="Vertical"
                            options={verticals.map(g => g.object_name || g.group_name)}
                            selectedValues={vertical}
                            onChange={setVertical}
                            placeholder="Select Vertical"
                        />
                    )}

                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                            className={selectCls} />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                            className={selectCls} />
                    </div>

                    {/* Status */}
                    <MultiSelectDropdown
                        label="Status"
                        options={STATUS_OPTIONS}
                        selectedValues={statusFilter}
                        onChange={setStatusFilter}
                        placeholder="Select Status"
                    />

                    {/* Priority */}
                    <MultiSelectDropdown
                        label="Priority"
                        options={PRIORITY_OPTIONS}
                        selectedValues={priorityFilter}
                        onChange={setPriorityFilter}
                        placeholder="Select Priority"
                    />

                    {/* Language */}
                    <MultiSelectDropdown
                        label="Language"
                        options={LANGUAGE_OPTIONS}
                        selectedValues={languageFilter}
                        onChange={setLanguageFilter}
                        placeholder="Select Language"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleApply} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-canopy text-white text-sm font-medium rounded-lg hover:bg-canopy-dark disabled:opacity-50 transition-colors">
                        <Search size={14} />
                        Apply Filters
                    </button>
                    <button onClick={handleClear} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                        <X size={14} />
                        Clear
                    </button>

                    {/* Export buttons — only visible after results are loaded */}
                    {filtersApplied && cases.length > 0 && (
                        <div className="ml-auto">
                            <button onClick={exportToExcel} disabled={exporting}
                                className="flex items-center gap-1.5 px-3 py-2 border border-canopy/20 text-canopy bg-canopy-tint text-sm font-medium rounded-lg hover:bg-canopy-tint transition-colors disabled:opacity-50">
                                <Download size={13} />
                                Export Excel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Cases Total Count Card */}
            {filtersApplied && (
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: -10 }}
                    animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: EASE_SMOOTH }}
                    className="bg-gradient-to-r from-canopy-tint to-canopy-tint rounded-xl border border-canopy/20 shadow-sm p-4 mb-6"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-canopy flex items-center justify-center shadow-sm">
                                <FileBarChart2 size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-canopy">Total Records</p>
                                <p className="text-2xl font-bold text-slate-900">{casesTotalCount.toLocaleString()}</p>
                            </div>
                        </div>
                        {caseCountLoading && (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-canopy"></div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Results Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {!filtersApplied && !loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileBarChart2 size={48} className="mb-3 opacity-30" />
                        <p className="text-sm">Apply filters to view the report</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-auto scrollbar-thin max-h-[70vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Case Number</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Office / Dept</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Created</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                {Array.from({ length: 8 }).map((__, j) => (
                                                    <td key={j} className="px-4 py-3">
                                                        <div className="h-3 bg-slate-200 rounded w-full" />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : cases.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">
                                                No cases found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        cases.map((c, idx) => (
                                            <tr key={c.r_object_id || idx} className="hover:bg-canopy-tint/30 transition-colors group">
                                                <td className="px-4 py-2.5 text-slate-400 text-xs">
                                                    {(page - 1) * pageSize + idx + 1}
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-slate-900">{c.object_name}</td>
                                                <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate" title={c.description}>
                                                    {c.description || c.subject || '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{c.ho_ro}</span>
                                                        {c.department_name && <span className="text-xs text-slate-400">{c.department_name}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {c.status ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-canopy-tint text-canopy">
                                                            {c.status}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{c.task_priority || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{formatDate(c.r_creation_date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => setDetailCase(c)} title="Case Details"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors">
                                                            <FileText size={15} />
                                                        </button>
                                                        <button onClick={() => setMovementCase(c)} title="Movement Register"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors">
                                                            <ClipboardList size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filtersApplied && !loading && cases.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span>Rows per page:</span>
                                    <select value={pageSize} onChange={e => handlePageSizeChange(Number(e.target.value))}
                                        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-canopy">
                                        {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fetchReport(1, pageSize)} disabled={page === 1}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronsLeft size={16} />
                                    </button>
                                    <button onClick={() => fetchReport(page - 1, pageSize)} disabled={page === 1}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium min-w-[2rem] text-center">
                                        {page}
                                    </span>
                                    <button onClick={() => fetchReport(page + 1, pageSize)} disabled={!hasNextPage}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>
            </>
            )}

            {/* Digidak Report Section */}
            {activeTab === 'digidak' && (
            <>
            {/* Digidak Sub-tabs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
                <div className="flex gap-4 border-b border-slate-200">
                    <button
                        onClick={() => setDigidakSubTab('inbox')}
                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                            digidakSubTab === 'inbox'
                                ? 'border-canopy text-canopy'
                                : 'border-transparent text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        Inbox Report
                    </button>
                    <button
                        onClick={() => setDigidakSubTab('outbox')}
                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                            digidakSubTab === 'outbox'
                                ? 'border-canopy text-canopy'
                                : 'border-transparent text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        Outbox Report
                    </button>
                    <button
                        onClick={() => setDigidakSubTab('draft')}
                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                            digidakSubTab === 'draft'
                                ? 'border-canopy text-canopy'
                                : 'border-transparent text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        Draft Report
                    </button>
                </div>
            </div>

            {/* Digidak Filter Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Filters</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
                    {/* Office Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Office Type</label>
                        <CustomSelect value={digidakOfficeType} onChange={handleDigidakOfficeTypeChange} disabled={isLocalAdmin}
                            placeholder="Select"
                            options={[
                                { value: 'HO', label: 'HO' },
                                { value: 'RO', label: 'RO' },
                                { value: 'TE', label: 'TE' },
                            ]} />
                    </div>

                    {/* Location — RO/TE only */}
                    {digidakIsRoTe && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                            <CustomSelect value={digidakLocation} onChange={handleDigidakLocationChange} disabled={isLocalAdmin}
                                placeholder="Select Location"
                                options={digidakLocations.map(l => ({ value: l.location, label: l.location }))} />
                        </div>
                    )}

                    {/* Department — show for HO only (hide if RO/TE in Inbox) */}
                    {digidakOfficeType && !digidakIsRoTe && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                            <CustomSelect value={digidakDeptName} onChange={setDigidakDeptName}
                                placeholder="Select Department"
                                options={filteredDigidakDepartments.length > 0
                                    ? filteredDigidakDepartments.map(d => ({ value: d.name, label: d.name }))
                                    : [{ value: '', label: digidakIsRoTe ? 'No departments available for this location' : 'No departments available', disabled: true }]} />
                        </div>
                    )}

                    {/* Username — Inbox only */}
                    {digidakSubTab === 'inbox' && digidakOfficeType && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                            <CustomSelect value={digidakInboxUsername} onChange={setDigidakInboxUsername}
                                placeholder="Select Username"
                                options={(digidakInboxUsers || []).map(user => ({ value: user, label: user }))} />
                        </div>
                    )}

                    {/* Source Vertical — Outbox only */}
                    {digidakSubTab === 'outbox' && digidakSourceVerticals.length > 0 && (
                        <MultiSelectDropdown
                            label="Source Vertical"
                            options={digidakSourceVerticals || []}
                            selectedValues={digidakSourceVertical}
                            onChange={setDigidakSourceVertical}
                            placeholder="Select Source Vertical"
                        />
                    )}

                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                        <input type="date" value={digidakFromDate} onChange={e => setDigidakFromDate(e.target.value)} className={selectCls} />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                        <input type="date" value={digidakToDate} onChange={e => setDigidakToDate(e.target.value)} className={selectCls} />
                    </div>

                    {/* Language */}
                    <MultiSelectDropdown
                        label="Language"
                        options={digidakMetadata.languages || []}
                        selectedValues={digidakLanguage}
                        onChange={setDigidakLanguage}
                        placeholder="Select Language"
                    />

                    {/* Mode of Dispatch */}
                    <MultiSelectDropdown
                        label="Mode of Dispatch"
                        options={digidakMetadata.mode_of_receipt || []}
                        selectedValues={digidakModeOfReceipt}
                        onChange={setDigidakModeOfReceipt}
                        placeholder="Select Mode"
                    />

                    {/* Priority */}
                    <MultiSelectDropdown
                        label="Priority"
                        options={digidakMetadata.priority || []}
                        selectedValues={digidakPriority}
                        onChange={setDigidakPriority}
                        placeholder="Select Priority"
                    />

                    {/* Secrecy */}
                    <MultiSelectDropdown
                        label="Secrecy"
                        options={digidakMetadata.secrecy || []}
                        selectedValues={digidakSecrecy}
                        onChange={setDigidakSecrecy}
                        placeholder="Select Secrecy"
                    />

                    {/* Status - Hidden for Draft Report */}
                    {digidakSubTab !== 'draft' && (
                    <MultiSelectDropdown
                        label="Status"
                        options={digidakMetadata.status || []}
                        selectedValues={digidakStatus}
                        onChange={setDigidakStatus}
                        placeholder="Select Status"
                    />
                    )}

                    {/* Type Category */}
                    <MultiSelectDropdown
                        label="Type Category"
                        options={digidakMetadata.type_category || []}
                        selectedValues={digidakTypeCategory}
                        onChange={setDigidakTypeCategory}
                        placeholder="Select Type Category"
                    />

                    {/* Type (Entry Type) */}
                    <MultiSelectDropdown
                        label="Type"
                        options={digidakMetadata.entry_type || []}
                        selectedValues={digidakEntryType}
                        onChange={setDigidakEntryType}
                        placeholder="Select Type"
                    />

                    {/* Region - Only for Outbox (disabled if Sent To selected) */}
                    {digidakSubTab === 'outbox' && (
                    <div className={digidakSentTo.length > 0 ? 'opacity-50 pointer-events-none' : ''}>
                        <MultiSelectDropdown
                            label="Region"
                            options={digidakRegionOptions}
                            selectedValues={digidakSentTo.length > 0 ? [] : digidakRegion}
                            onChange={setDigidakRegion}
                            placeholder="Select Region"
                            disabled={digidakSentTo.length > 0}
                        />
                    </div>
                    )}

                    {/* Sent To - Only for Outbox (disabled if Region selected) */}
                    {digidakSubTab === 'outbox' && (
                    <div className={digidakRegion.length > 0 ? 'opacity-50 pointer-events-none' : ''}>
                        <MultiSelectDropdown
                            label="Sent To"
                            options={digidakSentToOptions || []}
                            selectedValues={digidakRegion.length > 0 ? [] : digidakSentTo}
                            onChange={setDigidakSentTo}
                            placeholder="Select Sent To"
                            disabled={digidakRegion.length > 0}
                        />
                    </div>
                    )}

                    {/* Region - Only for Inbox (disabled if Received From selected) */}
                    {digidakSubTab === 'inbox' && (
                    <div className={digidakReceivedFrom.length > 0 ? 'opacity-50 pointer-events-none' : ''}>
                        <MultiSelectDropdown
                            label="Region"
                            options={digidakRegionOptions}
                            selectedValues={digidakReceivedFrom.length > 0 ? [] : digidakInboxRegion}
                            onChange={setDigidakInboxRegion}
                            placeholder="Select Region"
                            disabled={digidakReceivedFrom.length > 0}
                        />
                    </div>
                    )}

                    {/* Received From - Only for Inbox (disabled if Region selected) */}
                    {digidakSubTab === 'inbox' && (
                    <div className={digidakInboxRegion.length > 0 ? 'opacity-50 pointer-events-none' : ''}>
                        <MultiSelectDropdown
                            label="Received From"
                            options={digidakReceivedFromOptions || []}
                            selectedValues={digidakInboxRegion.length > 0 ? [] : digidakReceivedFrom}
                            onChange={setDigidakReceivedFrom}
                            placeholder="Select Received From"
                            disabled={digidakInboxRegion.length > 0}
                        />
                    </div>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleDigidakApply}
                        disabled={!digidakOfficeType || (digidakSubTab !== 'inbox' && !digidakIsRoTe && !digidakDeptName) || (digidakSubTab !== 'inbox' && digidakIsRoTe && !digidakLocation)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                            !digidakOfficeType || (digidakSubTab !== 'inbox' && !digidakIsRoTe && !digidakDeptName) || (digidakSubTab !== 'inbox' && digidakIsRoTe && !digidakLocation)
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-canopy hover:bg-canopy-dark'
                        }`}>
                        <Search size={15} /> Apply Filters
                    </button>
                    <button onClick={handleDigidakClear}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                        <X size={15} /> Clear
                    </button>
                    {/* Error message — displayed next to buttons */}
                    {error && (
                        <div className="text-danger text-sm flex items-center gap-1.5">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    {/* Export button — only visible after results are loaded */}
                    {filtersApplied && digidakResults.length > 0 && (
                        <button onClick={exportDigidakToExcel} disabled={exporting}
                            className="flex items-center gap-1.5 px-3 py-2 border border-canopy/20 text-canopy bg-canopy-tint text-sm font-medium rounded-lg hover:bg-canopy-tint transition-colors disabled:opacity-50 ml-auto">
                            <Download size={13} />
                            Export Excel
                        </button>
                    )}
                </div>
            </div>

            {/* Digidak Total Count Card */}
            {filtersApplied && (
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: -10 }}
                    animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: EASE_SMOOTH }}
                    className="bg-gradient-to-r from-canopy-tint to-canopy-tint rounded-xl border border-canopy/20 shadow-sm p-4 mb-6"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-canopy flex items-center justify-center shadow-sm">
                                <FileBarChart2 size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-canopy">Total Records</p>
                                <p className="text-2xl font-bold text-slate-900">{digidakTotalCount.toLocaleString()}</p>
                            </div>
                        </div>
                        {countLoading && (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-canopy"></div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Digidak Results */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-canopy"></div>
                    </div>
                ) : !filtersApplied ? (
                    <div className="px-6 py-12 text-center text-slate-400">
                        <p className="text-sm">Apply filters to view Digidak {digidakSubTab} report</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-auto scrollbar-thin max-h-[70vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">#</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">UID Number</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Letter Subject</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Initiator</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">File Number</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Type Category</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Language</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Mode of Dispatch</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Priority</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Secrecy</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Status</th>
                                        {digidakSubTab === 'outbox' && (
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Sent To</th>
                                        )}
                                        {digidakSubTab !== 'inbox' && (
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Decision</th>
                                        )}
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Date Created</th>
                                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {digidakResults.length === 0 ? (
                                        <tr>
                                            <td colSpan={digidakSubTab === 'inbox' ? 12 : 14} className="px-4 py-16 text-center text-slate-400 text-sm">
                                                No Digidak records found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        digidakResults.map((item, idx) => (
                                            <tr key={`${item.r_object_id}-${idx}`} className="hover:bg-canopy-tint/30 transition-colors">
                                                <td className="px-4 py-2.5 text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</td>
                                                <td className="px-4 py-2.5 font-medium text-slate-900 font-mono">{item.uid_number || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 max-w-[250px] truncate" title={item.letter_subject}>{item.letter_subject || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{item.initiator || '-'}</td>
                                                <td className="px-4 py-2.5 font-mono text-sm text-slate-600">{item.file_number || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{item.type_category || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{item.languages || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{item.mode_of_receipt || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{item.priority || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{item.secrecy || '-'}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-canopy-tint text-canopy">
                                                        {item.status || '-'}
                                                    </span>
                                                </td>
                                                {digidakSubTab === 'outbox' && (
                                                    <td className="px-4 py-2.5 text-slate-600 text-xs">{item.selected_region || '-'}</td>
                                                )}
                                                {digidakSubTab !== 'inbox' && (
                                                    <td className="px-4 py-2.5 text-xs">
                                                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                                                            item.decision === 'Inward' ? 'bg-canopy-tint text-canopy' : 'bg-harvest/10 text-harvest'
                                                        }`}>
                                                            {item.decision || '-'}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{formatDate(item.r_creation_date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center justify-center">
                                                        <button onClick={() => setDigidakMovement(item)} title="Movement Register"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors">
                                                            <ClipboardList size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filtersApplied && !loading && digidakResults.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span>Rows per page:</span>
                                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); fetchDigidakReport(1, Number(e.target.value)); }}
                                        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-canopy">
                                        {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fetchDigidakReport(1, pageSize)} disabled={page === 1}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronsLeft size={16} />
                                    </button>
                                    <button onClick={() => fetchDigidakReport(page - 1, pageSize)} disabled={page === 1}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium min-w-[2rem] text-center">
                                        {page}
                                    </span>
                                    <button onClick={() => fetchDigidakReport(page + 1, pageSize)} disabled={!hasNextPage}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>
            </>
            )}

            {/* Rajbhasha Report Section */}
            {activeTab === 'rajbhasha' && !isLocalAdmin && (
            <>
            {/* Filter Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Filters</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
                    {/* Office Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Office Type</label>
                        <CustomSelect value={rajbhashaOfficeType} onChange={handleRajbhashaOfficeTypeChange} disabled={isLocalAdmin}
                            placeholder="Select"
                            options={[
                                { value: 'HO', label: 'HO' },
                                { value: 'RO', label: 'RO' },
                                { value: 'TE', label: 'TE' },
                            ]} />
                    </div>

                    {/* Location — RO/TE only */}
                    {rajbhashaIsRoTe && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                            <CustomSelect value={rajbhashaLocation} onChange={handleRajbhashaLocationChange} disabled={isLocalAdmin}
                                placeholder="Select Location"
                                options={rajbhashaLocations.map(l => ({ value: l.location, label: l.location }))} />
                        </div>
                    )}

                    {/* Department — HO only */}
                    {rajbhashaOfficeType && filteredRajbhashaDepartments.length > 0 && !rajbhashaIsRoTe && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                            <CustomSelect value={rajbhashaDeptName} onChange={setRajbhashaDeptName}
                                placeholder="Select Department"
                                options={filteredRajbhashaDepartments.map(d => ({ value: d.name, label: d.name }))} />
                        </div>
                    )}

                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                        <input type="date" value={rajbhashaFromDate} onChange={e => setRajbhashaFromDate(e.target.value)} className={selectCls} />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                        <input type="date" value={rajbhashaToDate} onChange={e => setRajbhashaToDate(e.target.value)} className={selectCls} />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleRajbhashaApply} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-canopy text-white text-sm font-medium rounded-lg hover:bg-canopy-dark disabled:opacity-50 transition-colors">
                        <Search size={14} />
                        Apply Filters
                    </button>
                    <button onClick={handleRajbhashaClear} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                        <X size={14} />
                        Clear
                    </button>
                    {filtersApplied && rajbhashaReport && (
                        <button onClick={handleRajbhashaExport} disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-canopy text-white text-sm font-medium rounded-lg hover:bg-canopy disabled:opacity-50 transition-colors">
                            <Download size={14} />
                            Export
                        </button>
                    )}
                    {error && (
                        <div className="text-danger text-sm flex items-center gap-1.5">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {!filtersApplied && !loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileBarChart2 size={48} className="mb-3 opacity-30" />
                        <p className="text-sm">Apply filters to view the report</p>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-canopy"></div>
                    </div>
                ) : rajbhashaReport ? (
                    <div className="space-y-8">
                        {/* Grid 1 */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-auto scrollbar-thin max-h-[70vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Summary</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rajbhashaReport.grid1?.rows && rajbhashaReport.grid1.rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-canopy-tint/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900">{row.summary}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-canopy">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Grid 2 */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-auto scrollbar-thin max-h-[70vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No. of English Letters</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Replied in Hindi</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Replied in English</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Not Replied To</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rajbhashaReport.grid2?.rows && rajbhashaReport.grid2.rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-canopy-tint/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900">{row.summary}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-canopy">{row.no_of_letters_english}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-harvest">{row.replied_in_hindi}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-canopy">{row.replied_in_english}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-danger">{row.not_replied_to}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Grid 3 */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-auto scrollbar-thin max-h-[70vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">In Hindi/Bilingual</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">In English Only</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Letters Issued</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">% Hindi/Bilingual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rajbhashaReport.grid3?.rows && rajbhashaReport.grid3.rows.map((row, idx) => (
                                        <tr key={idx} className={`${row.summary === 'Total' ? 'bg-slate-100 font-semibold' : 'hover:bg-canopy-tint/30'} transition-colors`}>
                                            <td className="px-4 py-3 font-medium text-slate-900">{row.summary}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-canopy">{row.hindi_bilingual}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-harvest">{row.english_only}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-canopy">{row.total_letters_issued}</td>
                                            <td className="px-4 py-3 text-slate-700 text-lg font-semibold text-canopy">{row.percentage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="px-6 py-12 text-center text-slate-400">
                        <p className="text-sm">No data found for the selected filters.</p>
                    </div>
                )}
            </div>
            </>
            )}

            {/* Modals */}
            {detailCase   && <CaseDetailsModal      caseItem={detailCase}   onClose={() => setDetailCase(null)}   />}
            {movementCase && <MovementRegisterModal  caseItem={movementCase} onClose={() => setMovementCase(null)} />}
            {digidakMovement && <DigidakMovementRegisterModal  digidakItem={digidakMovement} onClose={() => setDigidakMovement(null)} />}
        </motion.div>
        </ErrorBoundary>
    );
};

export default ReportsPage;
