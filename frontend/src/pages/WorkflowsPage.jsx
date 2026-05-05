import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import {
    Activity, Filter, ChevronLeft, ChevronRight, ChevronsLeft,
    CheckCircle, Clock, Loader2, RefreshCw, Search, X,
    PlayCircle, AlertTriangle, AlertCircle, User, Calendar,
    Hash, ArrowRight, Inbox, List, Info, RotateCcw, Briefcase, ExternalLink
} from 'lucide-react';

/* ────────────────────────────── helpers ────────────────────────────── */

const getStatusInfo = (code) => {
    const map = {
        0: { label: 'Dormant', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
        1: { label: 'Running', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
        2: { label: 'Finished', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
        3: { label: 'Halted', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
        4: { label: 'Terminated', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    };
    return map[code] ?? { label: `State ${code}`, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
};

const getWorkItemStatus = (state) => {
    if (typeof state === 'number') {
        const labels = { 0: 'Queued', 1: 'Acquired', 2: 'Finished', 3: 'Dormant', 4: 'Halted', 5: 'Failed' };
        const colors = {
            0: 'bg-slate-100 text-slate-600',
            1: 'bg-blue-100 text-blue-700',
            2: 'bg-green-100 text-green-700',
            3: 'bg-gray-100 text-gray-500',
            4: 'bg-yellow-100 text-yellow-700',
            5: 'bg-red-100 text-red-700',
        };
        return { label: labels[state] ?? `State ${state}`, color: colors[state] ?? 'bg-slate-100 text-slate-600' };
    }
    const s = (state || '').toLowerCase();
    if (s === 'running' || s === 'active') return { label: 'Running', color: 'bg-blue-100 text-blue-700' };
    if (s === 'halted') return { label: 'Halted', color: 'bg-yellow-100 text-yellow-700' };
    if (s === 'failed') return { label: 'Failed', color: 'bg-red-100 text-red-700' };
    if (s === 'finished' || s === 'completed') return { label: 'Finished', color: 'bg-green-100 text-green-700' };
    if (s === 'paused') return { label: 'Paused', color: 'bg-orange-100 text-orange-700' };
    return { label: state || 'Unknown', color: 'bg-slate-100 text-slate-600' };
};

/* Returns true if a queue-item state string/number represents "paused" */
const isPausedState = (state) => {
    if (typeof state === 'string') return state.toLowerCase() === 'paused';
    return false;
};

const fmt = (dateStr) => dateStr ? new Date(dateStr).toLocaleString() : '-';

const getSuggestedSolution = (errorLog) => {
    if (!errorLog) return null;

    // 1. User/ACL errors (DM_ACL_E_USER_NOT_EXIST)
    if (errorLog.includes('DM_ACL_E_USER_NOT_EXIST') || errorLog.includes('accessor_name') && errorLog.includes('does not exist')) {
        const match = errorLog.match(/accessor_name '([^']+)'/);
        const userName = match ? match[1] : 'the specified user/group';
        return {
            title: "User or Group Missing",
            description: `The system could not find the user or group "${userName}" required for this workflow activity.`,
            action: `Please check if the user "${userName}" exists in the Documentum User management. If this is a dynamic performer, ensure the attribute setting the performer is populated correctly.`
        };
    }

    // 2. BOF/Method failures
    if (errorLog.includes('Could not invoke the method') || errorLog.includes('InvocationTargetException')) {
        return {
            title: "Java Method/BOF Failure",
            description: "A custom Java class (BOF module) or workflow method failed to execute correctly.",
            action: "Check the server-side logs (JMS/Catalina) for the underlying Java stack trace. It usually indicates a database connection issue or a logic error in the code module."
        };
    }

    // 3. Permission issues
    if (errorLog.includes('DM_SESSION_E_AUTH_FAIL') || errorLog.includes('DM_ACL_E_ACCESS_DENIED')) {
        return {
            title: "Permission Denied",
            description: "The system account or the workflow supervisor lacks sufficient permissions to perform this operation.",
            action: "Ensure the supervisor or the system account has at least 'Write' or 'Relate' permission on the target objects."
        };
    }

    // Default generic response
    return {
        title: "Technical Error Detected",
        description: "The system encountered an unhandled exception in this workflow activity.",
        action: "Review the full error content below for technical details. You may need to restart the workflow after resolving data or permission issues."
    };
};

/* ─────────────────────────── sub-components ───────────────────────── */

const StatusBadge = ({ code, small = false }) => {
    const { label, color, dot } = getStatusInfo(code);
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold ${small ? 'text-xs' : 'text-xs'} ${color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
        </span>
    );
};

const WorkItemStatusBadge = ({ state }) => {
    const { label, color } = getWorkItemStatus(state);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {label}
        </span>
    );
};

const DetailRow = ({ icon: Icon, label, value, mono }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <div className="flex-shrink-0 w-7 h-7 bg-slate-50 rounded-md flex items-center justify-center mt-0.5">
            <Icon size={14} className="text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-sm text-slate-800 truncate mt-0.5 ${mono ? 'font-mono text-xs' : 'font-medium'}`} title={value}>
                {value || <span className="text-slate-400 italic font-normal">—</span>}
            </p>
        </div>
    </div>
);

/* ─────────────────────────── main component ───────────────────────── */

const WorkflowsPage = () => {
    /* ── left panel state ── */
    const [processes, setProcesses] = useState([]);
    const [selectedProcess, setSelectedProcess] = useState('');
    const [workflows, setWorkflows] = useState([]);
    const [loadingProcesses, setLoadingProcesses] = useState(false);
    const [loadingList, setLoadingList] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPrevPage, setHasPrevPage] = useState(false);

    /* ── direct ID lookup state ── */
    const [directId, setDirectId] = useState('');
    const [directIdInput, setDirectIdInput] = useState('');

    /* ── case number search state ── */
    const [caseNumberInput, setCaseNumberInput] = useState('');
    const [caseSearchLoading, setCaseSearchLoading] = useState(false);
    const [caseSearchResult, setCaseSearchResult] = useState(null);  // { caseNumber, caseObjectId, workflows[] }
    const [caseSearchError, setCaseSearchError] = useState(null);

    /* ── right panel state ── */
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [activeTab, setActiveTab] = useState('variables');
    const [actionLoading, setActionLoading] = useState(null);
    const detailRef = useRef(null);

    /* ── toast notifications ── */
    const [toasts, setToasts] = useState([]);
    const toastCounter = useRef(0);

    const showToast = (message, type = 'error') => {
        const id = ++toastCounter.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    };
    const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    /* ── fetch processes on mount ── */
    useEffect(() => {
        const fetchProcesses = async () => {
            setLoadingProcesses(true);
            try {
                const res = await axios.get('/workflows/processes');
                setProcesses(res.data || []);
            } catch (e) {
                console.error('Error fetching processes', e);
            } finally {
                setLoadingProcesses(false);
            }
        };
        fetchProcesses();
    }, []);

    /* ── fetch workflow list when process / page changes ── */
    useEffect(() => {
        if (!selectedProcess) { setWorkflows([]); return; }
        const fetchList = async () => {
            setLoadingList(true);
            try {
                const res = await axios.get('/workflows/instances', {
                    params: { processName: selectedProcess, page, size: pageSize }
                });
                const entries = res.data.entries || [];
                const parsed = entries.map(e => e.content?.properties || {});
                setWorkflows(parsed);
                const links = res.data.links || [];
                setHasNextPage(links.some(l => l.rel === 'next'));
                setHasPrevPage(page > 1);
            } catch (e) {
                console.error('Error fetching workflow list', e);
                setWorkflows([]);
            } finally {
                setLoadingList(false);
            }
        };
        fetchList();
    }, [selectedProcess, page]);

    /* ── fetch detail when a workflow is selected (or direct ID entered) ── */
    const loadDetail = async (workflowId) => {
        setLoadingDetail(true);
        setDetailData(null);
        setDetailError(null);
        setActiveTab('queue');
        try {
            const res = await axios.get(`/workflows/${workflowId}`);
            if (res.data?.error) { setDetailError(res.data.error); }
            else { setDetailData(res.data); }
        } catch (e) {
            setDetailError('Failed to load workflow details. Please verify the Workflow ID.');
        } finally {
            setLoadingDetail(false);
            detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleSelectFromList = (wf) => {
        setSelectedWorkflow(wf);
        setDirectId(wf.r_object_id);
        setDirectIdInput('');
        loadDetail(wf.r_object_id);
    };

    const handleDirectIdSubmit = (e) => {
        e.preventDefault();
        const id = directIdInput.trim();
        if (!id) return;
        setSelectedWorkflow(null);
        setCaseSearchResult(null);
        setDirectId(id);
        loadDetail(id);
    };

    /* ── clear helpers ── */
    const handleClearWorkflowId = () => {
        setDirectIdInput('');
        setDirectId('');
        setSelectedWorkflow(null);
        setDetailData(null);
        setDetailError(null);
    };

    const handleClearCaseNumber = () => {
        setCaseNumberInput('');
        setCaseSearchResult(null);
        setCaseSearchError(null);
        setDetailData(null);
        setDetailError(null);
        setSelectedWorkflow(null);
    };

    const handleCaseNumberSearch = async (e) => {
        e.preventDefault();
        const cn = caseNumberInput.trim();
        if (!cn) return;
        setCaseSearchLoading(true);
        setCaseSearchResult(null);
        setCaseSearchError(null);
        setDetailData(null);
        setDetailError(null);
        setSelectedWorkflow(null);
        try {
            const res = await axios.get('/workflows/search/by-case', { params: { caseNumber: cn } });
            if (res.data?.error) {
                showToast(res.data.error);
                setCaseSearchError(res.data.error);
            } else {
                setCaseSearchResult(res.data);
                // If only one workflow, auto-select it
                if (res.data.workflows?.length === 1) {
                    const wfId = res.data.workflows[0].r_object_id;
                    setDirectId(wfId);
                    loadDetail(wfId);
                }
            }
        } catch (err) {
            const msg = 'Case not found or error fetching workflows.';
            showToast(msg);
            setCaseSearchError(msg);
        } finally {
            setCaseSearchLoading(false);
        }
    };

    const handleSelectCaseWorkflow = (wf) => {
        setSelectedWorkflow(wf);
        setDirectId(wf.r_object_id);
        loadDetail(wf.r_object_id);
    };

    const handleRefreshDetail = () => {
        if (directId) loadDetail(directId);
    };

    const handleRestartWorkflow = async () => {
        if (!directId) return;
        if (!window.confirm('Are you sure you want to restart this workflow?')) return;
        setActionLoading('restart');
        try {
            await axios.post(`/workflows/${directId}/restart`);
            await loadDetail(directId);
            showToast('Workflow restarted successfully.', 'success');
        } catch (e) {
            showToast('Failed to restart workflow. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    /* ── UI ── */
    const rangeStart = (page - 1) * pageSize + 1;
    const rangeEnd = (page - 1) * pageSize + workflows.length;

    const workItems = detailData?.workItems || [];
    const queueItems = detailData?.queueItems || [];
    const displayVariables = (detailData?.processVariables || []).filter(
        v => !['in_fams_clmas_no', 'comments_doc_id', 'dummy_group'].includes(v.object_name)
    );

    const displayCaseNumber = detailData?.case_number || selectedWorkflow?.case_number || caseSearchResult?.caseNumber || 
        (detailData?.processVariables || []).find(v => ['case_number', 'caseno', 'in_fams_clmas_no'].includes(v.object_name?.toLowerCase()))?.string_value;

    /* Detect if any queue item is paused → show Process Error tab + enable Restart */
    const pausedItems = queueItems.filter(q => isPausedState(q.task_state));
    const hasPaused = pausedItems.length > 0;

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 relative">

            {/* ═══════════════ TOAST NOTIFICATIONS (top-right) ═══════════════ */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        style={{ animation: 'slideInRight 0.3s ease-out' }}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${toast.type === 'success'
                            ? 'bg-green-600 text-white border-green-500'
                            : 'bg-red-600 text-white border-red-500'
                            }`}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {toast.type === 'success'
                                ? <CheckCircle size={16} />
                                : <AlertCircle size={16} />}
                        </div>
                        <p className="flex-1 leading-snug text-xs">{toast.message}</p>
                        <button
                            onClick={() => dismissToast(toast.id)}
                            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100%); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>

            {/* ═══════════════ LEFT PANEL ═══════════════ */}
            <aside className="w-80 min-w-[280px] flex flex-col bg-white border-r border-slate-200 shadow-sm">

                {/* Header */}
                <div className="px-4 py-4 border-b border-slate-200 bg-gradient-to-r from-[#0A66C2]/5 to-slate-50">
                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
                        <Activity size={18} className="text-[#0A66C2]" />
                        Workflow Monitor
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Select or search a workflow</p>
                </div>

                {/* Direct Workflow ID input */}
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">By Workflow ID</p>
                    <form onSubmit={handleDirectIdSubmit} className="flex gap-1.5">
                        <div className="relative flex-1">
                            <Hash size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="workflow-id-input"
                                type="text"
                                value={directIdInput}
                                onChange={e => setDirectIdInput(e.target.value)}
                                placeholder="Workflow object ID"
                                className="w-full pl-7 pr-6 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-slate-50 transition-all"
                            />
                            {directIdInput && (
                                <button
                                    type="button"
                                    onClick={handleClearWorkflowId}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Clear"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={!directIdInput.trim()}
                            className="px-3 py-2 bg-[#0A66C2] text-white rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-[#094d92] transition-colors flex-shrink-0"
                        >
                            <Search size={13} />
                        </button>
                    </form>
                </div>

                {/* ── Case Number Search ── */}
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Briefcase size={10} /> By Case Number
                    </p>
                    <form onSubmit={handleCaseNumberSearch} className="flex gap-1.5">
                        <div className="relative flex-1">
                            <Briefcase size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="case-number-input"
                                type="text"
                                value={caseNumberInput}
                                onChange={e => setCaseNumberInput(e.target.value)}
                                placeholder="e.g. NB-DDSI-ACV-2026-27-001939"
                                className="w-full pl-7 pr-6 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-slate-50 transition-all"
                            />
                            {caseNumberInput && (
                                <button
                                    type="button"
                                    onClick={handleClearCaseNumber}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Clear"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={!caseNumberInput.trim() || caseSearchLoading}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-emerald-700 transition-colors flex-shrink-0"
                        >
                            {caseSearchLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                        </button>
                    </form>

                    {/* Case search results list */}
                    {caseSearchResult && !caseSearchError && (
                        <div className="mt-2">
                            <div className="flex items-center gap-1 mb-1.5">
                                <Briefcase size={10} className="text-emerald-600" />
                                <span className="text-[10px] font-semibold text-emerald-700 truncate">{caseSearchResult.caseNumber}</span>
                                <span className="text-[10px] text-slate-400 ml-auto">{caseSearchResult.workflows?.length ?? 0} workflow(s)</span>
                            </div>
                            {(!caseSearchResult.workflows || caseSearchResult.workflows.length === 0) ? (
                                <p className="text-[10px] text-slate-400 italic text-center py-2">No workflows found for this case.</p>
                            ) : (
                                <div className="space-y-1">
                                    {caseSearchResult.workflows.map((wf, i) => {
                                        const isActive = selectedWorkflow?.r_object_id === wf.r_object_id;
                                        const { label, color, dot } = getStatusInfo(wf.r_runtime_state);
                                        return (
                                            <button
                                                key={wf.r_object_id || i}
                                                onClick={() => handleSelectCaseWorkflow(wf)}
                                                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all text-[10px] ${isActive
                                                    ? 'bg-emerald-50 border-emerald-200'
                                                    : 'bg-white border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className={`font-semibold truncate ${isActive ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                        {wf.object_name || wf.process_name || 'Workflow'}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0 ${color}`}>
                                                        <span className={`w-1 h-1 rounded-full ${dot}`} />
                                                        {label}
                                                    </span>
                                                </div>
                                                <p className="font-mono text-slate-400 mt-0.5 truncate">{wf.r_object_id}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Process selector */}
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Browse by Process</p>
                    <div className="relative">
                        <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                            id="process-select"
                            value={selectedProcess}
                            onChange={e => { setSelectedProcess(e.target.value); setPage(1); setSelectedWorkflow(null); setDetailData(null); }}
                            disabled={loadingProcesses}
                            className="w-full pl-7 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-slate-50 appearance-none cursor-pointer transition-all"
                        >
                            <option value="">— Select Process —</option>
                            {processes.map((p, i) => (
                                <option key={i} value={p.object_name}>{p.title || p.object_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Workflow list */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {!selectedProcess ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-300 px-4 text-center">
                            <Activity size={32} className="mb-2" />
                            <p className="text-xs">Select a process above to browse workflows</p>
                        </div>
                    ) : loadingList ? (
                        <div className="flex flex-col items-center justify-center h-48">
                            <Loader2 size={24} className="animate-spin text-[#0A66C2] mb-2" />
                            <p className="text-xs text-slate-400">Loading workflows...</p>
                        </div>
                    ) : (workflows.length === 0) ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-300 px-4 text-center">
                            <List size={28} className="mb-2" />
                            <p className="text-xs">No workflows found for this process</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {workflows.map((wf, idx) => {
                                const isSelected = selectedWorkflow?.r_object_id === wf.r_object_id;
                                const { label, color, dot } = getStatusInfo(wf.r_runtime_state);
                                return (
                                    <button
                                        key={wf.r_object_id || idx}
                                        onClick={() => handleSelectFromList(wf)}
                                        className={`w-full text-left p-3 rounded-lg transition-all group border ${isSelected
                                            ? 'bg-[#0A66C2]/5 border-[#0A66C2]/30 shadow-sm'
                                            : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-semibold truncate ${isSelected ? 'text-[#0A66C2]' : 'text-slate-800 group-hover:text-[#0A66C2]'}`}>
                                                    {wf.object_name || 'Untitled'}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                                                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{wf.r_object_id}</p>
                                                    {wf.case_number && (
                                                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded truncate max-w-[120px]">
                                                            <Briefcase size={8} /> {wf.case_number}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                                {label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                                            <User size={10} />
                                            <span className="truncate">{wf.r_creator_name || '—'}</span>
                                            {wf.r_start_date && (
                                                <>
                                                    <span>·</span>
                                                    <Calendar size={10} />
                                                    <span>{new Date(wf.r_start_date).toLocaleDateString()}</span>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {workflows.length > 0 && (
                    <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                            {rangeStart}–{rangeEnd}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(1)}
                                disabled={!hasPrevPage || loadingList}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors"
                                title="First page"
                            >
                                <ChevronsLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={!hasPrevPage || loadingList}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="px-2 text-xs text-slate-600 font-medium">{page}</span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!hasNextPage || loadingList}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </aside>

            {/* ═══════════════ RIGHT DETAIL PANEL ═══════════════ */}
            <main ref={detailRef} className="flex-1 overflow-y-auto overscroll-contain">
                {/* Empty state */}
                {!directId && !loadingDetail && !detailData && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Activity size={44} className="text-slate-300" />
                        </div>
                        <p className="text-lg font-semibold text-slate-400">No Workflow Selected</p>
                        <p className="text-sm text-slate-300 mt-2">Choose from the list or enter a Workflow ID on the left</p>
                        <div className="flex items-center gap-2 mt-6 text-xs text-slate-300">
                            <ArrowRight size={14} />
                            <span>Select a process, then click a workflow row</span>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {loadingDetail && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 size={44} className="animate-spin text-[#0A66C2] mb-4" />
                        <p className="text-slate-500 font-medium">Loading workflow details...</p>
                        <p className="text-xs text-slate-400 font-mono mt-1">{directId}</p>
                    </div>
                )}

                {/* Error state */}
                {!loadingDetail && detailError && (
                    <div className="flex flex-col items-center justify-center h-full px-8">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
                            <AlertCircle size={36} className="text-red-400" />
                        </div>
                        <p className="text-xl font-bold text-slate-800">Failed to Load Workflow</p>
                        <p className="text-sm text-slate-500 mt-2 text-center max-w-md">{detailError}</p>
                        <p className="text-xs font-mono text-slate-400 mt-2 bg-slate-100 px-3 py-1 rounded">{directId}</p>
                        <button
                            onClick={handleRefreshDetail}
                            className="mt-5 flex items-center gap-2 px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-semibold hover:bg-[#094d92] transition-colors"
                        >
                            <RefreshCw size={14} /> Retry
                        </button>
                    </div>
                )}

                {/* Detail view */}
                {!loadingDetail && detailData && !detailError && (
                    <div className="max-w-5xl mx-auto p-6">

                        {/* ── Case Context Banner (shown when navigated via case number) ── */}
                        {caseSearchResult?.caseNumber && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
                                <Briefcase size={16} className="text-emerald-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-emerald-800">
                                        Found via Case: <span className="font-bold">{caseSearchResult.caseNumber}</span>
                                        {caseSearchResult.caseSubject && (
                                            <span className="font-normal text-emerald-700"> — {caseSearchResult.caseSubject}</span>
                                        )}
                                    </p>
                                    <p className="text-[10px] font-mono text-emerald-600 mt-0.5">
                                        Case ID: {caseSearchResult.caseObjectId}
                                    </p>
                                </div>
                                <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                                    {caseSearchResult.workflows?.length} workflow(s)
                                </span>
                            </div>
                        )}

                        {/* ── Header banner ── */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
                            <div className="px-5 py-4 bg-gradient-to-r from-[#0A66C2]/8 to-slate-50 border-b border-slate-200">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Activity size={18} className="text-[#0A66C2]" />
                                            <h1 className="text-lg font-bold text-slate-900 truncate max-w-lg">
                                                {detailData.object_name || detailData.process_name || 'Workflow Details'}
                                            </h1>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <p className="text-xs font-mono text-slate-400">{detailData.r_object_id}</p>
                                            {displayCaseNumber && (
                                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                    <Briefcase size={10} /> Case No: {displayCaseNumber}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <StatusBadge code={detailData.r_runtime_state} />

                                        <button
                                            onClick={handleRefreshDetail}
                                            disabled={actionLoading === 'restart'}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                                        >
                                            <RefreshCw size={13} className={loadingDetail ? 'animate-spin' : ''} /> Refresh
                                        </button>

                                        <button
                                            onClick={handleRestartWorkflow}
                                            disabled={!hasPaused || actionLoading === 'restart'}
                                            title={!hasPaused ? 'Restart is only available when a task is paused' : 'Restart this workflow'}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors shadow-sm font-semibold ${hasPaused
                                                ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 cursor-pointer'
                                                : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                                                }`}
                                        >
                                            {actionLoading === 'restart'
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <RotateCcw size={13} />}
                                            Restart
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Summary row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                                {[
                                    { label: 'Start Date', value: fmt(detailData.r_start_date) },
                                    { label: 'Creator', value: detailData.r_creator_name || '—' },
                                    { label: 'Supervisor', value: detailData.supervisor_name || '—' },
                                    { label: 'Work Items', value: workItems.length },
                                ].map(({ label, value }) => (
                                    <div key={label} className="px-5 py-3 text-center">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
                                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Tab bar ── */}
                        <div className="flex flex-wrap items-center gap-1 mb-4 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
                            {[
                                { id: 'queue', label: 'Queue Items', count: queueItems.length, icon: Inbox },
                                { id: 'variables', label: 'Variables', count: displayVariables.length, icon: Hash },
                                ...(hasPaused ? [{ id: 'process-error', label: 'Process Error', count: pausedItems.length, icon: AlertTriangle, error: true }] : []),
                            ].map(({ id, label, count, icon: Icon, error }) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id
                                        ? error ? 'bg-orange-500 text-white shadow-sm' : 'bg-blue-50 text-[#0A66C2] border border-blue-200'
                                        : error ? 'text-orange-600 hover:bg-orange-50 border border-orange-200 animate-pulse' : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <Icon size={14} />
                                    {label}
                                    {count !== null && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === id
                                            ? error ? 'bg-white/20 text-white' : 'bg-[#0A66C2]/10 text-[#0A66C2]'
                                            : error ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* ── Queue Items Tab ── */}
                        {activeTab === 'queue' && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-[#0A66C2] rounded-full" />
                                        Current Queue / Inbox Status
                                    </h3>
                                    <span className="text-xs text-slate-400">{queueItems.length} items</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Task Name</th>
                                                <th className="px-4 py-3">State</th>
                                                <th className="px-4 py-3">Sent By</th>
                                                <th className="px-4 py-3">Date Sent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {queueItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-12 text-center text-slate-400 italic text-sm">
                                                        No queue items found for this workflow.
                                                    </td>
                                                </tr>
                                            ) : queueItems.map((q, i) => (
                                                <tr key={q.r_object_id || i} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-800">{q.name || '—'}</p>
                                                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{q.item_id}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <WorkItemStatusBadge state={q.task_state} />
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600">{q.sent_by || '—'}</td>
                                                    <td className="px-4 py-3 text-xs text-slate-500">{fmt(q.date_sent)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── Process Error Tab ── */}
                        {activeTab === 'process-error' && hasPaused && (
                            <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-orange-100 flex items-center justify-between bg-orange-50">
                                    <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-orange-500 rounded-full" />
                                        <AlertTriangle size={15} className="text-orange-500" />
                                        Process Error — Paused Tasks
                                    </h3>
                                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-semibold">
                                        {pausedItems.length} paused
                                    </span>
                                </div>

                                {/* Alert banner */}
                                <div className="mx-5 mt-4 mb-2 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                                    <AlertCircle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-orange-800">Workflow is paused and requires attention</p>
                                        <p className="text-xs text-orange-600 mt-0.5">
                                            One or more tasks have been paused. The workflow cannot proceed until these are resolved.
                                            Use the <span className="font-bold">Restart</span> button above to resume the workflow.
                                        </p>
                                    </div>
                                </div>

                                <div className="px-5 pb-5 space-y-4">
                                    {pausedItems.map((q, i) => {
                                        // Find associated work item for fallback error status
                                        const associatedWorkItem = (detailData?.workItems || []).find(w => w.r_object_id === q.item_id);

                                        // Search variables for error-related content
                                        const errorVariable = displayVariables.find(v =>
                                            (v.object_name || '').toLowerCase().includes('error') ||
                                            (v.string_value || '').toLowerCase().includes('exception') ||
                                            (v.string_value || '').toLowerCase().includes('error')
                                        );

                                        // Priority: message > source > errorVariable > a_status
                                        const rawError = q.message || q.source || errorVariable?.string_value || (associatedWorkItem?.a_status) || "";
                                        const solution = getSuggestedSolution(rawError);

                                        return (
                                            <div key={q.r_object_id || q.item_id || i} className="border border-orange-100 rounded-lg overflow-hidden bg-white shadow-sm">
                                                <div className="bg-orange-50/50 px-4 py-3 border-b border-orange-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-slate-800 text-sm">{q.name || '—'}</p>
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 uppercase">
                                                            {q.task_state || 'paused'}
                                                        </span>
                                                        {errorVariable && (
                                                            <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold ml-1">
                                                                EXTERN_LOG
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        {q.item_id || q.r_object_id}
                                                    </div>
                                                </div>

                                                <div className="p-4">
                                                    <div className="flex items-center gap-6 mb-4 text-xs">
                                                        <div>
                                                            <span className="text-slate-400 font-medium mr-2">SENT BY:</span>
                                                            <span className="text-slate-700 font-semibold">{q.sent_by || '—'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 font-medium mr-2">DATE SENT:</span>
                                                            <span className="text-slate-700 font-semibold">{fmt(q.date_sent)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Suggested Resolution Section */}
                                                    {solution && rawError && (
                                                        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                                                            <div className="flex items-center gap-2 text-emerald-700 mb-2">
                                                                <CheckCircle size={14} />
                                                                <span className="text-xs font-bold uppercase tracking-wider">Suggested Resolution</span>
                                                            </div>
                                                            <p className="text-sm font-bold text-emerald-900">{solution.title}</p>
                                                            <p className="text-xs text-emerald-700 mt-1">{solution.description}</p>
                                                            <div className="mt-3 pt-3 border-t border-emerald-100">
                                                                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">What to do:</p>
                                                                <p className="text-xs text-emerald-800 font-medium italic leading-relaxed">
                                                                    "{solution.action}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="mt-3 bg-slate-900 rounded-lg p-4 border border-slate-800">
                                                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                            <AlertCircle size={10} /> Full Technical Log
                                                        </p>
                                                        <pre className="text-slate-300 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words italic">
                                                            {rawError || 'No specific error message was captured by the system for this paused state.'}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Restart action hint */}
                                <div className="mx-5 mb-5 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                                    <RotateCcw size={15} className="text-orange-500 flex-shrink-0" />
                                    <p className="text-xs text-slate-600">
                                        To resolve, click the <span className="font-semibold text-orange-700">Restart</span> button at the top of this page to retry the workflow from the paused state.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Variables Tab ── */}
                        {activeTab === 'variables' && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                                        Process String Variables
                                    </h3>
                                    <span className="text-xs text-slate-400">{displayVariables.length} variables</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {displayVariables.length === 0 ? (
                                        <div className="px-4 py-12 text-center text-slate-400 italic text-sm">
                                            No string variables found for this workflow.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 divide-y divide-slate-100">
                                            {displayVariables.map((v, i) => (
                                                <div key={i} className="flex hover:bg-slate-50/50 px-5 py-3 gap-4 items-center transition-colors">
                                                    <div className="w-1/3 min-w-[200px]">
                                                        <span className="text-xs font-semibold text-slate-600 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded">
                                                            {v.object_name}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 text-sm text-slate-800 break-words font-medium">
                                                        {v.string_value ? v.string_value : <span className="text-slate-300 italic font-normal">Empty</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Raw Info Tab ── */}
                        {activeTab === 'info' && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-100">
                                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-[#0A66C2] rounded-full" />
                                        Workflow Properties
                                    </h3>
                                </div>
                                <div className="p-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0">
                                        <DetailRow icon={Hash} label="Object ID" value={detailData.r_object_id} mono />
                                        <DetailRow icon={Activity} label="Object Name" value={detailData.object_name} />
                                        <DetailRow icon={User} label="Creator" value={detailData.r_creator_name} />
                                        <DetailRow icon={User} label="Supervisor" value={detailData.supervisor_name} />
                                        <DetailRow icon={Calendar} label="Start Date" value={fmt(detailData.r_start_date)} />
                                        <DetailRow icon={Calendar} label="Created" value={fmt(detailData.r_creation_date)} />
                                        <DetailRow icon={Hash} label="Process Name" value={detailData.process_name} mono />
                                        <DetailRow icon={Hash} label="Process ID" value={detailData.process_id} mono />
                                    </div>

                                    <div className="mt-5 border-t border-slate-100 pt-4">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Full JSON Response</p>
                                        <pre className="bg-slate-900 text-slate-300 rounded-lg p-4 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto overscroll-contain">
                                            {JSON.stringify(
                                                Object.fromEntries(
                                                    Object.entries(detailData).filter(([k]) => !['workItems', 'queueItems'].includes(k))
                                                ),
                                                null, 2
                                            )}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )
                        }
                    </div >
                )}
            </main >
        </div >
    );
};

export default WorkflowsPage;
