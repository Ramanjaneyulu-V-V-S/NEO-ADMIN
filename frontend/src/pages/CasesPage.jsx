import React, { useState, useCallback, useEffect } from 'react';
import axios from '../api/axios';
import {
    Search, ChevronLeft, ChevronRight, Briefcase,
    ChevronsLeft, Loader2, X, Eye, RefreshCw,
    FileText, CheckCircle, AlertCircle, PlayCircle, Clock,
    AlertTriangle, Inbox, ArrowRightLeft, ClipboardList
} from 'lucide-react';
import { CaseInboxContent } from './CaseInbox2Page';
import { DelegateContent, CaseDetailsModal, MovementRegisterModal } from './DelegatePage';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';

const CasesPage = () => {
    const [activeTab, setActiveTab] = useState('cases');
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalEstimate, setTotalEstimate] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [isDefaultLoad, setIsDefaultLoad] = useState(true);
    const [defaultLoadMonths, setDefaultLoadMonths] = useState(3);

    const [caseNumber, setCaseNumber] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    // Modal state
    const [selectedCase, setSelectedCase] = useState(null);
    const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
    const [workflowData, setWorkflowData] = useState(null);
    const [loadingWorkflow, setLoadingWorkflow] = useState(false);
    const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0);
    const [actionLoading, setActionLoading] = useState(null); // 'restart-wfID' or 'retry-actID'

    // Log Modal State
    const [logModalOpen, setLogModalOpen] = useState(false);
    const [selectedLogItem, setSelectedLogItem] = useState(null);

    // Case Details & Movement Register modals
    const [detailCase, setDetailCase] = useState(null);
    const [movementCase, setMovementCase] = useState(null);

    // ─── Local Admin role & profile context ──────────────────────────────────────
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);
    const [officeType, setOfficeType] = useState('');
    const [location, setLocation]     = useState('');
    const [allDepartments, setAllDepartments] = useState([]);

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        axios.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const ot  = ctx.office_type || '';
                const loc = ctx.location    || '';
                if (ot) { setOfficeType(ot); if (loc) setLocation(loc); }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    const locations = getLocations(officeType);
    const isRoTe    = officeType === 'RO' || officeType === 'TE';

    const locationShortCode = isLocalAdmin && location
        ? (locations.find(l => l.location === location)?.shortCode || '')
        : '';

    useEffect(() => {
        if (!isLocalAdmin) return;
        if (!officeType || (isRoTe && !location)) { setAllDepartments([]); return; }
        fetchDepartments(officeType, location).then(setAllDepartments);
    }, [isLocalAdmin, officeType, location]);

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

    // ─── End Local Admin ─────────────────────────────────────────────────────────

    const fetchCases = useCallback(async (searchTerm, pageNum) => {
        setLoading(true);
        setHasSearched(true);

        try {
            const params = {
                page: pageNum,
                size: pageSize
            };
            if (searchTerm && searchTerm.trim() !== '') params.caseNumber = searchTerm.trim();

            // Local Admin filters
            if (isLocalAdmin) {
                if (officeType) params.hoRo = officeType;
                if (officeType === 'HO') {
                    if (localAdminDeptNames) params.deptNames = localAdminDeptNames;
                } else if (locationShortCode) {
                    params.roShortCode = locationShortCode;
                }
            }

            const response = await axios.get('/cases/search', { params });

            const data = response.data;
            setCases(data.cases || []);
            setHasNextPage(data.hasNext || false);
            const currentCount = (data.cases || []).length;
            const minTotal = (pageNum - 1) * pageSize + currentCount;
            setTotalEstimate(data.hasNext ? `${minTotal}+` : minTotal.toString());
        } catch (error) {
            console.error("Error fetching cases", error);
            setCases([]);
            setHasNextPage(false);
            setTotalEstimate('0');
        } finally {
            setLoading(false);
        }
    }, [pageSize, isLocalAdmin, officeType, locationShortCode, localAdminDeptNames]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get('/settings');
                if (response.data.cases?.defaultLoadMonths) {
                    setDefaultLoadMonths(response.data.cases.defaultLoadMonths);
                }
            } catch (error) {
                console.error("Error fetching settings", error);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (isLocalAdmin) {
            if (!profileCtx) return; // wait for profile context
            if (officeType === 'HO') {
                if (!localAdminDeptNames) return; // wait for departments
            } else {
                if (!locationShortCode) return; // wait for location
            }
        }
        fetchCases('', 1);
    }, [fetchCases, isLocalAdmin, profileCtx, officeType, locationShortCode, localAdminDeptNames]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (caseNumber.trim()) {
            setActiveSearch(caseNumber.trim());
            setIsDefaultLoad(false);
            setPage(1);
            fetchCases(caseNumber.trim(), 1);
        }
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(activeSearch, newPage);
    };

    const clearSearch = () => {
        setCaseNumber('');
        setActiveSearch('');
        setIsDefaultLoad(true);
        setPage(1);
        fetchCases('', 1);
    };

    const loadWorkflowData = async (caseItem) => {
        setLoadingWorkflow(true);
        setWorkflowData(null);
        setActiveWorkflowIndex(0);

        try {
            const response = await axios.get(`/workflows/case/${caseItem.r_object_id}`);
            setWorkflowData(response.data);
        } catch (error) {
            console.error("Error fetching workflow data", error);
            setWorkflowData({ error: "Failed to load workflow information" });
        } finally {
            setLoadingWorkflow(false);
        }
    };

    const handleViewWorkflow = (caseItem) => {
        setSelectedCase(caseItem);
        setIsWorkflowModalOpen(true);
        loadWorkflowData(caseItem);
    };

    const handleRestartWorkflow = async (workflowId) => {
        if (!confirm("Are you sure you want to restart this workflow?")) return;
        
        setActionLoading(`restart-${workflowId}`);
        try {
            await axios.post(`/workflows/${workflowId}/restart`);
            // Refresh data
            await loadWorkflowData(selectedCase);
            alert("Workflow restart signal sent successfully.");
        } catch (error) {
            console.error("Error restarting workflow", error);
            alert("Failed to restart workflow.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRetryActivity = async (workflowId, activityId) => {
        setActionLoading(`retry-${activityId}`);
        try {
            await axios.post(`/workflows/${workflowId}/activity/${activityId}/retry`);
            // Refresh data
            await loadWorkflowData(selectedCase);
            alert("Activity retry signal sent successfully.");
        } catch (error) {
            console.error("Error retrying activity", error);
            alert("Failed to retry activity.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewLogs = (item) => {
        setSelectedLogItem(item);
        setLogModalOpen(true);
    };

    const getStatusBadge = (status) => {
        // Handle numeric status codes (Documentum runtime states)
        // 0 = dormant, 1 = running, 2 = finished, 3 = terminated, 4 = halted, 5 = failed
        let s = '';
        if (typeof status === 'number') {
            if (status === 1) s = 'running';
            else if (status === 2) s = 'finished';
            else if (status === 4) s = 'halted';
            else if (status === 5) s = 'failed';
            else if (status === 3) s = 'terminated';
            else s = 'unknown';
        } else {
            s = (status || '').toString().toLowerCase();
        }

        if (s === 'running' || s === 'active') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><PlayCircle size={12} /> Running</span>;
        if (s === 'halted' || s === 'paused') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle size={12} /> Halted</span>;
        if (s === 'failed') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle size={12} /> Failed</span>;
        if (s === 'finished' || s === 'completed') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><CheckCircle size={12} /> Finished</span>;
        if (s === 'terminated') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800"><XCircle size={12} /> Terminated</span>;
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status || 'Unknown'}</span>;
    };

    const rangeStart = cases.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd = (page - 1) * pageSize + cases.length;

    const activeWorkflow = workflowData?.workflows && workflowData.workflows.length > 0 
        ? workflowData.workflows[activeWorkflowIndex] 
        : null;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="text-[#0A66C2]" />
                    Case Management
                </h1>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('cases')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'cases'
                            ? 'border-[#0A66C2] text-[#0A66C2]'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <Briefcase size={16} />
                    Cases
                </button>
                {!isLocalAdmin && (
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'inbox'
                            ? 'border-[#0A66C2] text-[#0A66C2]'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <Inbox size={16} />
                    Case Inbox
                </button>
                )}
                <button
                    onClick={() => setActiveTab('delegate')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'delegate'
                            ? 'border-[#0A66C2] text-[#0A66C2]'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <ArrowRightLeft size={16} />
                    Delegate Case
                </button>
            </div>

            {/* Case Inbox Tab */}
            {!isLocalAdmin && activeTab === 'inbox' && <CaseInboxContent />}

            {/* Delegate Case Tab */}
            {activeTab === 'delegate' && <DelegateContent />}

            {/* Cases Tab */}
            {activeTab === 'cases' && (
            <>
            {/* Search */}
            <div className="flex items-center justify-end gap-4 mb-6">
                <div>
                
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={caseNumber}
                            onChange={(e) => setCaseNumber(e.target.value)}
                            placeholder="Search case number..."
                            className="w-72 pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] shadow-sm transition-all"
                        />
                        {caseNumber && (
                            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!caseNumber.trim() || loading}
                        className="px-5 py-2.5 bg-[#0A66C2] text-white rounded-lg text-sm font-semibold hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Search
                    </button>
                </form>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {!hasSearched ? (
                    <div className="py-20 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">Search for Cases</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-1">Enter a case number above to find workflows, manage activities, and view logs.</p>
                    </div>
                ) : (
                    <>
                        {/* Results Meta */}
                        {totalEstimate && !loading && (
                            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-sm backdrop-blur-sm">
                                <span className="text-slate-600">
                                    <span className="font-semibold text-[#0A66C2]">{totalEstimate}</span> {isDefaultLoad ? `recent cases` : `results found`}
                                </span>
                                {cases.length > 0 && <span className="text-slate-400 text-xs">Showing {rangeStart}-{rangeEnd}</span>}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-slate-700 w-16">#</th>
                                        <th className="px-6 py-3 font-semibold text-slate-700">Case Number</th>
                                        <th className="px-6 py-3 font-semibold text-slate-700">Description</th>
                                        <th className="px-6 py-3 font-semibold text-slate-700">Office / Dept</th>
                                        <th className="px-6 py-3 font-semibold text-slate-700 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(3)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-2.5"><div className="h-4 bg-slate-100 rounded w-8"></div></td>
                                                <td className="px-6 py-2.5"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                                <td className="px-6 py-2.5"><div className="h-4 bg-slate-100 rounded w-40"></div></td>
                                                <td className="px-6 py-2.5"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                <td className="px-6 py-2.5"><div className="h-4 bg-slate-100 rounded w-16 mx-auto"></div></td>
                                            </tr>
                                        ))
                                    ) : cases.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                                <p className="font-medium">No cases found</p>
                                                <p className="text-xs mt-1">Try a different search term</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        cases.map((c, idx) => (
                                            <tr key={c.r_object_id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-2.5 text-slate-400 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</td>
                                                <td className="px-6 py-2.5 font-medium text-slate-900">{c.object_name || '-'}</td>
                                                <td className="px-6 py-2.5 text-slate-500 max-w-xs truncate" title={c.description}>{c.description || '-'}</td>
                                                <td className="px-6 py-2.5 text-slate-500">
                                                    <div className="flex flex-col">
                                                        <span>{c.ho_ro}</span>
                                                        <span className="text-xs text-slate-400">{c.department_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2.5">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => setDetailCase(c)} title="Case Details"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 transition-all">
                                                            <FileText size={15} />
                                                        </button>
                                                        <button onClick={() => setMovementCase(c)} title="Movement Register"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
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
                        {cases.length > 0 && (
                            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-sm">
                                <select
                                    value={pageSize}
                                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); if (activeSearch) fetchCases(activeSearch, 1); }}
                                    className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                >
                                    <option value={5}>5 per page</option>
                                    <option value={10}>10 per page</option>
                                    <option value={25}>25 per page</option>
                                    <option value={50}>50 per page</option>
                                </select>
                                
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handlePageChange(1)} disabled={page === 1 || loading} className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600"><ChevronsLeft size={16} /></button>
                                    <button onClick={() => handlePageChange(page - 1)} disabled={page === 1 || loading} className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600"><ChevronLeft size={16} /></button>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium min-w-[2rem] text-center">{page}</span>
                                    <button onClick={() => handlePageChange(page + 1)} disabled={!hasNextPage || loading} className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Workflow Master Modal */}
            {isWorkflowModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Briefcase className="text-[#0A66C2]" size={24} />
                                    Workflow Details
                                </h2>
                                {selectedCase && (
                                    <p className="text-sm text-slate-500 mt-1">
                                        Case: <span className="font-medium text-slate-900">{selectedCase.object_name}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setIsWorkflowModalOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full">
                            {loadingWorkflow ? (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <Loader2 size={48} className="animate-spin text-[#0A66C2] mb-4" />
                                    <p className="text-slate-600 font-medium">Loading workflow topology...</p>
                                </div>
                            ) : workflowData?.error ? (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                                        <AlertTriangle size={40} className="text-red-500" />
                                    </div>
                                    <p className="text-xl font-bold text-slate-900 mb-2">Failed to Load Workflows</p>
                                    <p className="text-slate-600">{workflowData.error}</p>
                                </div>
                            ) : !workflowData?.workflows || workflowData.workflows.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                        <Briefcase size={40} className="text-slate-400" />
                                    </div>
                                    <p className="text-xl font-bold text-slate-900 mb-2">No Workflows Found</p>
                                    <p className="text-slate-500">This case is not currently associated with any workflows.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Sidebar for multiple workflows */}
                                    {workflowData.workflows.length > 1 && (
                                        <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50 overflow-y-auto overscroll-contain">
                                            <div className="p-4 border-b border-slate-200">
                                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Workflows ({workflowData.workflows.length})</h3>
                                            </div>
                                            <div className="p-2 space-y-1">
                                                {workflowData.workflows.map((wf, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setActiveWorkflowIndex(idx)}
                                                        className={`w-full text-left p-3 rounded-lg text-sm transition-all ${
                                                            activeWorkflowIndex === idx 
                                                            ? 'bg-white shadow-sm ring-1 ring-slate-200 text-[#0A66C2] font-medium' 
                                                            : 'hover:bg-slate-200/50 text-slate-600'
                                                        }`}
                                                    >
                                                        <div className="truncate mb-1">{wf.process_name || 'Untitled Process'}</div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-slate-400 font-mono">{wf.r_object_id?.substring(0, 8)}...</span>
                                                            {getStatusBadge(wf.r_runtime_state)}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Main Detail Area */}
                                    <div className="flex-1 overflow-y-auto overscroll-contain bg-white p-6 md:p-8">
                                        {/* Active Workflow Header */}
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 border-b border-slate-100 pb-8">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-900 mb-2">{activeWorkflow.process_name}</h3>
                                                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <Briefcase size={16} className="text-slate-400" />
                                                        ID: <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{activeWorkflow.r_object_id}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={16} className="text-slate-400" />
                                                        Started: <span>{activeWorkflow.r_start_date ? new Date(activeWorkflow.r_start_date).toLocaleString() : 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Eye size={16} className="text-slate-400" />
                                                        Supervisor: <span>{activeWorkflow.supervisor_name || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-end mr-4">
                                                    <span className="text-xs font-semibold text-slate-500 uppercase mb-1">Current State</span>
                                                    {getStatusBadge(activeWorkflow.r_runtime_state)}
                                                </div>
                                                
                                                <button
                                                    onClick={() => handleRestartWorkflow(activeWorkflow.r_object_id)}
                                                    disabled={actionLoading === `restart-${activeWorkflow.r_object_id}`}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all"
                                                >
                                                    {actionLoading === `restart-${activeWorkflow.r_object_id}` ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCw size={16} />
                                                    )}
                                                    Restart Workflow
                                                </button>
                                            </div>
                                        </div>

                                        {/* Activities / Work Items Table */}
                                        <div>
                                            <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                                <div className="w-1 h-6 bg-[#0A66C2] rounded-full"></div>
                                                Activity History & Queue Items
                                            </h4>
                                            
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold text-slate-700 w-16 text-center">Seq</th>
                                                            <th className="px-4 py-3 font-semibold text-slate-700">Activity Name</th>
                                                            <th className="px-4 py-3 font-semibold text-slate-700">Performer</th>
                                                            <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                                                            <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                                                            <th className="px-4 py-3 font-semibold text-slate-700 w-32 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {activeWorkflow.workItems && activeWorkflow.workItems.length > 0 ? (
                                                            activeWorkflow.workItems.map((item, i) => (
                                                                <tr key={item.r_object_id || i} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">{item.r_act_seqno}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-900">{item.r_act_name}</td>
                                                                    <td className="px-4 py-3 text-slate-600">{item.r_performer_name || '-'}</td>
                                                                    <td className="px-4 py-3">{getStatusBadge(item.r_runtime_state || item.a_wi_status)}</td>
                                                                    <td className="px-4 py-3 text-slate-600 text-xs">
                                                                        {item.r_creation_date ? new Date(item.r_creation_date).toLocaleString() : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <button
                                                                                onClick={() => handleViewLogs(item)}
                                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                                title="View Logs"
                                                                            >
                                                                                <FileText size={16} />
                                                                            </button>
                                                                            
                                                                            {(item.r_runtime_state === 'failed' || item.r_runtime_state === 'halted') && (
                                                                                <button
                                                                                    onClick={() => handleRetryActivity(activeWorkflow.r_object_id, item.r_object_id)}
                                                                                    disabled={actionLoading === `retry-${item.r_object_id}`}
                                                                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                                                                    title="Retry Activity"
                                                                                >
                                                                                    {actionLoading === `retry-${item.r_object_id}` ? (
                                                                                        <Loader2 size={16} className="animate-spin" />
                                                                                    ) : (
                                                                                        <RefreshCw size={16} />
                                                                                    )}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="6" className="px-4 py-8 text-center text-slate-400 italic">
                                                                    No activities found for this workflow.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Log Details Modal */}
            {logModalOpen && selectedLogItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="text-slate-500" />
                                Activity Log
                            </h3>
                            <button onClick={() => setLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-[60vh] overflow-y-auto overscroll-contain">
                            <p className="mb-2 text-slate-500"># System Log for WorkItem: {selectedLogItem.r_object_id}</p>
                            <p className="mb-2 text-slate-500"># Activity: {selectedLogItem.r_act_name}</p>
                            <div className="space-y-1">
                                <span className="text-green-400">[INFO]</span> Activity started at {selectedLogItem.r_creation_date}<br/>
                                <span className="text-blue-400">[DEBUG]</span> Performer assigned: {selectedLogItem.r_performer_name}<br/>
                                <span className="text-green-400">[INFO]</span> Status changed to: {selectedLogItem.r_runtime_state}<br/>
                                {selectedLogItem.r_runtime_state === 'failed' && (
                                    <>
                                        <span className="text-red-400">[ERROR]</span> Activity execution failed.<br/>
                                        <span className="text-red-400">[ERROR]</span> Exception details not available in mock.<br/>
                                    </>
                                )}
                                <span className="text-slate-500">... End of log</span>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setLogModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}
            </>
            )}

            {/* Case Details Modal */}
            {detailCase && <CaseDetailsModal caseItem={detailCase} onClose={() => setDetailCase(null)} />}

            {/* Movement Register Modal */}
            {movementCase && <MovementRegisterModal caseItem={movementCase} onClose={() => setMovementCase(null)} />}
        </div>
    );
};

export default CasesPage;