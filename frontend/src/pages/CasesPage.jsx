import React, { useState, useCallback, useEffect } from 'react';
import axios from '../api/axios';
import {
    Search, Briefcase,
    Loader2, X, Eye, RefreshCw,
    FileText, CheckCircle, AlertCircle, PlayCircle, Clock,
    AlertTriangle, Inbox, ArrowRightLeft, ClipboardList, Download, UploadCloud
} from 'lucide-react';
import { CaseInboxContent } from './CaseInbox2Page';
import { DelegateContent } from './DelegatePage';
import { CaseDetailsModal, MovementRegisterModal } from '../components/CaseModals';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import {
    PageHeader, Tabs, useToast, Button, Input, DateInput,
    Card, DataTable, Pagination, EmptyState, Modal,
} from '../components/ui';
import { formatDateTime } from '../utils/datetime';
import { downloadXlsx, downloadRosterXlsx, mapWithConcurrency } from '../utils/userExport';
import { recordExport } from '../utils/audit';
import CustomSelect from '../components/ui/CustomSelect.jsx';

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
    const [ivCase, setIvCase] = useState(null); // case whose documents are open in the Republish-to-IV picker
    const [ivDocs, setIvDocs] = useState([]);
    const [ivDocsLoading, setIvDocsLoading] = useState(false);
    const [ivDocsError, setIvDocsError] = useState(null);
    const [ivSelected, setIvSelected] = useState(() => new Set());
    const [ivStatus, setIvStatus] = useState({}); // docId -> { state: 'publishing'|'done'|'error', publicationId?, error? }

    // Log Modal State
    const [logModalOpen, setLogModalOpen] = useState(false);
    const [selectedLogItem, setSelectedLogItem] = useState(null);

    // Case Details & Movement Register modals
    const [detailCase, setDetailCase] = useState(null);
    const [movementCase, setMovementCase] = useState(null);

    // Cases export — null when idle, 'plain' | 'movement' while running
    const [exporting, setExporting] = useState(null);
    const toast = useToast();

    // ─── Local Admin role & profile context ──────────────────────────────────────
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);
    const [officeType, setOfficeType] = useState('');
    const [location, setLocation]     = useState('');
    const [allDepartments, setAllDepartments] = useState([]);

    // ─── Case Filters ──────────────────────────────────────────────────────────
    const [filterOfficeType,   setFilterOfficeType]   = useState('');
    const [filterLocation,     setFilterLocation]     = useState('');
    const [filterDeptName,     setFilterDeptName]     = useState('');
    const [filterDeptShortCode, setFilterDeptShortCode] = useState('');
    const [filterVertical,     setFilterVertical]     = useState('');
    const [filterFromDate,     setFilterFromDate]     = useState('');
    const [filterToDate,       setFilterToDate]       = useState('');
    const [filterDeptOptions,  setFilterDeptOptions]  = useState([]);
    const [filterVerticals,    setFilterVerticals]    = useState([]);
    const [loadingFilterVerts, setLoadingFilterVerts] = useState(false);

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

    // ─── Filter Derived State ──────────────────────────────────────────────────────
    const filterLocs = getLocations(filterOfficeType);
    const filterLocationShortCode = filterLocation
        ? (filterLocs.find(l => l.location === filterLocation)?.shortCode || '')
        : '';

    // ─── Filter Handlers ───────────────────────────────────────────────────────────
    const handleFilterOfficeTypeChange = useCallback((v) => {
        setFilterOfficeType(v);
        setFilterLocation('');
        setFilterDeptName('');
        setFilterDeptShortCode('');
        setFilterVertical('');
        setFilterVerticals([]);
        if (v === 'HO') {
            fetchDepartments('HO').then(setFilterDeptOptions);
        } else {
            setFilterDeptOptions([]);
        }
    }, []);

    const handleFilterLocationChange = useCallback((v) => {
        setFilterLocation(v);
        setFilterDeptName('');
        setFilterDeptShortCode('');
        setFilterVertical('');
        setFilterVerticals([]);
        if (v && filterOfficeType) {
            fetchDepartments(filterOfficeType, v).then(setFilterDeptOptions);
        }
    }, [filterOfficeType]);

    const handleFilterDeptChange = useCallback((v) => {
        const deptObj = filterDeptOptions.find(d => d.name === v);
        setFilterDeptName(v);
        setFilterDeptShortCode(deptObj?.shortCode || '');
        setFilterVertical('');
        setFilterVerticals([]);
        if (filterOfficeType === 'HO' && deptObj) {
            setLoadingFilterVerts(true);
            axios.get('/groups/verticals', { params: { officeType: 'HO', deptName: deptObj.name } })
                .then(res => {
                    const verts = res.data || [];
                    setFilterVerticals(verts);
                })
                .catch(() => setFilterVerticals([]))
                .finally(() => setLoadingFilterVerts(false));
        }
    }, [filterOfficeType, filterDeptOptions]);

    const handleFilterVerticalChange = useCallback((v) => {
        setFilterVertical(v);
    }, []);

    const handleClearFilters = useCallback(() => {
        setFilterOfficeType('');
        setFilterLocation('');
        setFilterDeptName('');
        setFilterDeptShortCode('');
        setFilterVertical('');
        setFilterFromDate('');
        setFilterToDate('');
        setFilterVerticals([]);
        setFilterDeptOptions([]);
    }, []);

    // Shared /cases/search query params — used by the list fetch and the exports.
    const buildCaseSearchParams = useCallback((searchTerm, pageNum, size) => {
        const params = { page: pageNum, size };
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

        // Case filters
        if (filterOfficeType) params.hoRo = filterOfficeType;
        if (filterDeptShortCode) params.departmentShortCode = filterDeptShortCode.toLowerCase();
        if (filterLocationShortCode) params.roShortCode = filterLocationShortCode;
        if (filterVertical) params.functions = filterVertical;
        if (filterFromDate) params.fromDate = filterFromDate;
        if (filterToDate) params.toDate = filterToDate;

        return params;
    }, [isLocalAdmin, officeType, locationShortCode, localAdminDeptNames, filterOfficeType, filterDeptShortCode, filterLocationShortCode, filterVertical, filterFromDate, filterToDate]);

    // withCount=false on plain page navigation — the filter set (and therefore the
    // total) hasn't changed, so we skip the extra COUNT(*) and keep the shown count.
    const fetchCases = useCallback(async (searchTerm, pageNum, size = pageSize, withCount = true) => {
        setLoading(true);
        setHasSearched(true);

        try {
            const params = buildCaseSearchParams(searchTerm, pageNum, size);
            if (!withCount) params.withCount = false;

            const response = await axios.get('/cases/search', { params });

            const data = response.data;
            setCases(data.cases || []);
            setHasNextPage(data.hasNext || false);
            if (typeof data.total === 'number') {
                // Exact count for the current filter set (from the backend COUNT(*)).
                setTotalEstimate(String(data.total));
            } else if (withCount) {
                // Fallback: running "N+" estimate when the exact count isn't available.
                const currentCount = (data.cases || []).length;
                const minTotal = (pageNum - 1) * pageSize + currentCount;
                setTotalEstimate(data.hasNext ? `${minTotal}+` : minTotal.toString());
            }
            // withCount === false → keep the exact count already on screen
        } catch (error) {
            console.error("Error fetching cases", error);
            setCases([]);
            setHasNextPage(false);
            setTotalEstimate('0');
        } finally {
            setLoading(false);
        }
    }, [pageSize, buildCaseSearchParams]);

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

    // Trigger fetch when case filters change
    useEffect(() => {
        if (filterOfficeType || filterLocation || filterDeptShortCode || filterVertical || filterFromDate || filterToDate) {
            fetchCases(activeSearch, 1);
        }
    }, [filterOfficeType, filterLocation, filterDeptShortCode, filterVertical, filterFromDate, filterToDate, fetchCases, activeSearch]);

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
        fetchCases(activeSearch, newPage, pageSize, false);
    };

    const clearSearch = () => {
        setCaseNumber('');
        setActiveSearch('');
        setIsDefaultLoad(true);
        setPage(1);
        fetchCases('', 1);
    };

    // ─── Cases export (xlsx) ─────────────────────────────────────────────────────
    const EXPORT_PAGE_SIZE = 200;
    const EXPORT_MAX_PAGES = 500; // runaway guard only → up to 100k cases

    // Pages through every case matching the current filters (not just the visible page).
    const fetchAllCasesForExport = async () => {
        const all = [];
        for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
            const params = buildCaseSearchParams(activeSearch, p, EXPORT_PAGE_SIZE);
            const { data } = await axios.get('/cases/search', { params });
            const batch = data.cases || [];
            all.push(...batch);
            if (!data.hasNext || batch.length === 0) break;
        }
        return all;
    };

    const CASE_COLS = [
        { header: '#', key: 'idx', width: 6 },
        { header: 'Case Number', key: 'caseNumber', width: 34 },
        { header: 'Subject', key: 'subject', width: 50 },
        { header: 'Department', key: 'department', width: 22 },
        { header: 'Created Date', key: 'createdDate', width: 22 },
        { header: 'Created By', key: 'createdBy', width: 22 },
        { header: 'Case Status', key: 'caseStatus', width: 18 },
    ];

    const caseBaseRow = (c, i) => ({
        idx: i + 1,
        caseNumber: c.object_name ?? '',
        subject: c.description ?? '',
        department: c.department_name ?? '',
        createdDate: formatDateTime(c.r_creation_date, ''),
        createdBy: c.r_creator_name ?? '',
        caseStatus: c.status ?? '',
    });

    // With an HO office-type filter active, split the workbook into one sheet per
    // department instead of a single combined sheet.
    const isHOExport = () => officeType === 'HO' || filterOfficeType === 'HO';

    // Case position lists keyed by department, preserving fetch order.
    const groupCaseIndexesByDept = (list) => {
        const map = new Map();
        list.forEach((c, i) => {
            const key = c.department_name || 'Unknown';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(i);
        });
        return map;
    };

    // Excel tab names: <= 31 chars, none of  : \ / ? * [ ] , and unique per workbook.
    const toSheetName = (name, used) => {
        const base = (name || 'Unknown').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Unknown';
        let candidate = base;
        let k = 2;
        while (used.has(candidate.toLowerCase())) {
            const suffix = ` (${k++})`;
            candidate = base.slice(0, 31 - suffix.length) + suffix;
        }
        used.add(candidate.toLowerCase());
        return candidate;
    };

    const exportCases = async () => {
        setExporting('plain');
        try {
            const rows = await fetchAllCasesForExport();
            if (!rows.length) { toast.error('No cases to export.'); return; }

            const splitByDept = isHOExport();
            let sheets;
            if (splitByDept) {
                const used = new Set();
                sheets = [...groupCaseIndexesByDept(rows).entries()].map(([dept, idxs]) => ({
                    name: toSheetName(dept, used),
                    columns: CASE_COLS,
                    rows: idxs.map((gi, i) => caseBaseRow(rows[gi], i)),
                }));
            } else {
                sheets = [{ name: 'Cases', columns: CASE_COLS, rows: rows.map(caseBaseRow) }];
            }

            await downloadXlsx(sheets, `cases_${new Date().toISOString().slice(0, 10)}.xlsx`);
            recordExport({
                action: 'Export Cases', targetType: 'report', count: rows.length,
                detail: splitByDept ? `XLSX · ${sheets.length} department sheets` : 'XLSX',
            });
            toast.success(`Exported ${rows.length} case${rows.length === 1 ? '' : 's'}.`);
        } catch (err) {
            console.error('Cases export failed', err);
            toast.error('Export failed. Please try again.');
        } finally {
            setExporting(null);
        }
    };

    const MOVEMENT_COLS = [
        { header: 'Entry Object Name', key: 'm_object_name', width: 20 },
        { header: 'Performer', key: 'm_performer', width: 22 },
        { header: 'Decision', key: 'm_decision', width: 16 },
        { header: 'Assigned User', key: 'm_assigned_user', width: 22 },
        { header: 'Completion Date', key: 'm_completion_date', width: 22 },
    ];

    // Movement Register entries come back newest-first; walk them in the order
    // they actually happened so each case starts with its "Initiated" entry.
    const sortMovementChronological = (entries) =>
        [...entries].sort((a, b) => {
            const ta = new Date(a.r_creation_date || a.received_date || a.completion_date || 0).getTime();
            const tb = new Date(b.r_creation_date || b.received_date || b.completion_date || 0).getTime();
            return ta - tb;
        });

    const exportCasesWithMovement = async () => {
        setExporting('movement');
        try {
            const cases = await fetchAllCasesForExport();
            if (!cases.length) { toast.error('No cases to export.'); return; }

            const movements = await mapWithConcurrency(cases, 5, async (c) => {
                if (!c.r_object_id) return [];
                const { data } = await axios.get(`/delegate/cases/${c.r_object_id}/movement`, {
                    params: { isValidEntry: true },
                });
                return Array.isArray(data) ? data : [];
            });

            const EMPTY_KEY = CASE_COLS.map(() => '');
            const EMPTY_TRAIL = MOVEMENT_COLS.map(() => '');
            let n = 0;

            // Build the flat, merge-ready row list for one department's (or all) cases.
            const buildRosterRows = (idxs) => {
                const rows = [];
                idxs.forEach((gi, localIdx) => {
                    const b = caseBaseRow(cases[gi], localIdx);
                    // Identical across every movement row of a case → the export helper
                    // merges these leading cells into one block per case.
                    const keyVals = [
                        String(b.idx), b.caseNumber, b.subject, b.department,
                        b.createdDate, b.createdBy, b.caseStatus,
                    ];
                    const entries = sortMovementChronological(movements[gi] || []);
                    if (entries.length === 0) {
                        rows.push({ keyVals, trailing: EMPTY_TRAIL });
                    } else {
                        entries.forEach((m) => {
                            n++;
                            rows.push({
                                keyVals,
                                trailing: [
                                    m.object_name ?? '',
                                    m.performer ?? '',
                                    m.decision ?? '',
                                    m.assigned_user ?? '',
                                    formatDateTime(m.completion_date, ''),
                                ],
                            });
                        });
                    }
                    // Blank spacer row between cases so the merged blocks read as separate.
                    if (localIdx < idxs.length - 1) rows.push({ keyVals: EMPTY_KEY, trailing: EMPTY_TRAIL });
                });
                return rows;
            };

            const groupColumns = CASE_COLS.map(({ header, width }) => ({ header, width }));
            const trailingColumns = MOVEMENT_COLS.map(({ header, width }) => ({ header, width }));

            const splitByDept = isHOExport();
            let sheets;
            if (splitByDept) {
                const used = new Set();
                sheets = [...groupCaseIndexesByDept(cases).entries()].map(([dept, idxs]) => ({
                    name: toSheetName(dept, used), groupColumns, trailingColumns,
                    rows: buildRosterRows(idxs),
                }));
            } else {
                sheets = [{
                    name: 'Cases + Movement', groupColumns, trailingColumns,
                    rows: buildRosterRows(cases.map((_, i) => i)),
                }];
            }

            await downloadRosterXlsx(sheets, `cases_movement_${new Date().toISOString().slice(0, 10)}.xlsx`);
            recordExport({
                action: 'Export Cases + Movement Register', targetType: 'report',
                count: cases.length,
                detail: splitByDept
                    ? `XLSX · ${sheets.length} department sheets · ${n} movement entries`
                    : `XLSX · ${n} movement entries`,
            });
            toast.success(`Exported ${cases.length} case${cases.length === 1 ? '' : 's'} with movement register.`);
        } catch (err) {
            console.error('Cases + movement export failed', err);
            toast.error('Export failed. Please try again.');
        } finally {
            setExporting(null);
        }
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

    const openIvDocuments = async (c) => {
        if (!c.r_object_id) return;
        setIvCase(c);
        setIvDocs([]);
        setIvSelected(new Set());
        setIvStatus({});
        setIvDocsError(null);
        setIvDocsLoading(true);
        try {
            const { data } = await axios.get(`/iv/case-documents/${c.r_object_id}`);
            if (data.success) {
                setIvDocs(data.documents || []);
            } else {
                setIvDocsError(data.error || 'Failed to load case documents.');
            }
        } catch (error) {
            console.error('Error loading case documents', error);
            setIvDocsError(error.response?.data?.error || 'Failed to load case documents.');
        } finally {
            setIvDocsLoading(false);
        }
    };

    const closeIvDocuments = () => {
        setIvCase(null);
        setIvDocs([]);
    };

    const republishDocs = async (docs) => {
        const ids = docs.map((d) => d.id);
        setIvStatus((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, { state: 'publishing' }])) }));
        let ok = 0;
        for (const doc of docs) {
            let status;
            try {
                const { data } = await axios.post('/iv/publish', { docId: doc.id });
                status = data.success
                    ? { state: 'done', publicationId: data.publicationId }
                    : { state: 'error', error: data.error || 'Failed to republish.' };
            } catch (error) {
                console.error('Error republishing to IV', error);
                status = { state: 'error', error: error.response?.data?.error || 'Failed to republish.' };
            }
            if (status.state === 'done') ok += 1;
            setIvStatus((s) => ({ ...s, [doc.id]: status }));
        }
        if (ok === docs.length) {
            toast.success(docs.length === 1 ? `Republished ${docs[0].name}.` : `Republished ${ok} documents.`);
        } else {
            toast.error(`Republished ${ok} of ${docs.length} documents — see the list for failures.`);
        }
    };

    const toggleIvSelected = (id) => {
        setIvSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const ivBusy = Object.values(ivStatus).some((s) => s.state === 'publishing');
    const allIvSelected = ivDocs.length > 0 && ivSelected.size === ivDocs.length;

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

        if (s === 'running' || s === 'active') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-canopy-tint text-canopy-dark"><PlayCircle size={12} /> Running</span>;
        if (s === 'halted' || s === 'paused') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-harvest/15 text-harvest"><AlertTriangle size={12} /> Halted</span>;
        if (s === 'failed') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-tint text-danger"><AlertCircle size={12} /> Failed</span>;
        if (s === 'finished' || s === 'completed') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-tide/10 text-tide"><CheckCircle size={12} /> Finished</span>;
        if (s === 'terminated') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-clay/10 text-clay"><XCircle size={12} /> Terminated</span>;
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status || 'Unknown'}</span>;
    };

    const rangeStart = cases.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd = (page - 1) * pageSize + cases.length;

    const isSingle = totalEstimate === '1';
    const resultLabel = isDefaultLoad
        ? `recent case${isSingle ? '' : 's'}`
        : `result${isSingle ? '' : 's'} found`;

    const activeWorkflow = workflowData?.workflows && workflowData.workflows.length > 0
        ? workflowData.workflows[activeWorkflowIndex]
        : null;

    const workItemColumns = [
        { key: 'seq', header: 'Seq', width: 'w-16', align: 'center', mono: true, card: 'hide',
          render: (item) => <span className="text-xs text-slate-500">{item.r_act_seqno}</span> },
        { key: 'name', header: 'Activity Name', primary: true,
          render: (item) => <span className="font-medium text-slate-900">{item.r_act_name}</span> },
        { key: 'performer', header: 'Performer', render: (item) => <span className="text-slate-600">{item.r_performer_name || '-'}</span> },
        { key: 'status', header: 'Status', render: (item) => getStatusBadge(item.r_runtime_state || item.a_wi_status) },
        { key: 'date', header: 'Date', mono: true,
          render: (item) => <span className="text-xs text-slate-600">{formatDateTime(item.r_creation_date, '-')}</span> },
        { key: 'actions', header: 'Actions', width: 'w-32', align: 'right', card: 'footer',
          render: (item) => (
              <div className="flex items-center gap-2 md:justify-end">
                  <button
                      onClick={() => handleViewLogs(item)}
                      className="p-1.5 text-slate-400 hover:text-canopy hover:bg-canopy-tint rounded transition-colors"
                      title="View Logs"
                  >
                      <FileText size={16} />
                  </button>
                  {(item.r_runtime_state === 'failed' || item.r_runtime_state === 'halted') && (
                      <button
                          onClick={() => handleRetryActivity(activeWorkflow.r_object_id, item.r_object_id)}
                          disabled={actionLoading === `retry-${item.r_object_id}`}
                          className="p-1.5 text-slate-400 hover:text-canopy hover:bg-canopy-tint rounded transition-colors"
                          title="Retry Activity"
                      >
                          {actionLoading === `retry-${item.r_object_id}`
                              ? <Loader2 size={16} className="animate-spin" />
                              : <RefreshCw size={16} />}
                      </button>
                  )}
              </div>
          ) },
    ];

    const caseColumns = [
        {
            key: 'object_name',
            header: 'Case Number',
            primary: true,
            mono: true,
            // one line in the table; free to break inside the phone folio card
            render: (c) => <span className="break-all md:whitespace-nowrap">{c.object_name || '-'}</span>,
        },
        {
            key: 'description',
            header: 'Description',
            card: 'body',
            render: (c) => (
                <span className="block max-w-xs truncate md:max-w-sm" title={c.description}>
                    {c.description || '-'}
                </span>
            ),
        },
        {
            key: 'office',
            header: 'Office / Dept',
            card: 'body',
            render: (c) => (
                <div className="flex flex-col">
                    <span>{c.ho_ro}</span>
                    <span className="text-caption text-slate-400">{c.department_name}</span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'center',
            card: 'footer',
            width: 'w-28',
            render: (c) => (
                <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" title="Case Details" onClick={() => setDetailCase(c)}>
                        <FileText size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Movement Register" onClick={() => setMovementCase(c)}>
                        <ClipboardList size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Republish documents to IV" onClick={() => openIvDocuments(c)}>
                        <UploadCloud size={15} />
                    </Button>
                </div>
            ),
        },
    ];

    const showExports = activeTab === 'cases' && hasSearched && cases.length > 0;

    return (
        <div className="flex flex-col">
            <PageHeader
                title="Case Management"
                icon={Briefcase}
                description="Browse cases, inspect inbox tasks, and delegate work."
                actions={showExports && (
                    <>
                        <Button variant="secondary" size="sm" onClick={exportCases} loading={exporting === 'plain'} disabled={!!exporting}>
                            {exporting !== 'plain' && <Download size={14} />}
                            Export Cases
                        </Button>
                        <Button variant="secondary" size="sm" onClick={exportCasesWithMovement} loading={exporting === 'movement'} disabled={!!exporting}>
                            {exporting !== 'movement' && <Download size={14} />}
                            Export with Movement Register
                        </Button>
                    </>
                )}
            />

            {/* Tabs */}
            <Tabs
                className="mb-6"
                value={activeTab}
                onChange={setActiveTab}
                tabs={[
                    { id: 'cases', label: 'Cases', icon: Briefcase },
                    { id: 'inbox', label: 'Case Inbox', icon: Inbox },
                    { id: 'delegate', label: 'Delegate Case', icon: ArrowRightLeft },
                ]}
            />

            {/* Case Inbox Tab */}
            {activeTab === 'inbox' && <CaseInboxContent />}

            {/* Delegate Case Tab */}
            {activeTab === 'delegate' && <DelegateContent />}

            {/* Cases Tab */}
            {activeTab === 'cases' && (
            <>
            {/* Search + filters */}
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <form onSubmit={handleSearch} className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1 sm:max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={caseNumber}
                            onChange={(e) => setCaseNumber(e.target.value)}
                            placeholder="Search case number..."
                            className="pl-9 pr-8"
                        />
                        {caseNumber && (
                            <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <Button type="submit" disabled={!caseNumber.trim() || loading} loading={loading}>
                        {!loading && <Search size={16} />}
                        Search
                    </Button>
                </form>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                    {/* Office Type Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Office Type</label>
                        <CustomSelect
                            value={filterOfficeType}
                            onChange={handleFilterOfficeTypeChange}
                            placeholder="All"
                            options={[
                                { value: 'HO', label: 'HO' },
                                { value: 'RO', label: 'RO' },
                                { value: 'TE', label: 'TE' },
                            ]}
                        />
                    </div>

                    {/* Location Filter (RO/TE only) */}
                    {(filterOfficeType === 'RO' || filterOfficeType === 'TE') && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Location</label>
                            <CustomSelect
                                value={filterLocation}
                                onChange={handleFilterLocationChange}
                                disabled={!filterOfficeType}
                                placeholder="Select location"
                                options={filterLocs.map(l => ({ value: l.location, label: l.location }))}
                            />
                        </div>
                    )}

                    {/* Department Filter */}
                    {filterOfficeType && (filterOfficeType === 'HO' || filterLocation) && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Department</label>
                            <CustomSelect
                                value={filterDeptName}
                                onChange={handleFilterDeptChange}
                                disabled={!filterDeptOptions.length}
                                placeholder="Select dept"
                                options={filterDeptOptions.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))}
                            />
                        </div>
                    )}

                    {/* Vertical Filter (HO + Dept only) */}
                    {filterOfficeType === 'HO' && filterDeptName && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vertical</label>
                            <CustomSelect
                                value={filterVertical}
                                onChange={handleFilterVerticalChange}
                                disabled={loadingFilterVerts || !filterVerticals.length}
                                placeholder={loadingFilterVerts ? 'Loading...' : 'Select vertical'}
                                options={filterVerticals.map(v => ({ value: v.object_name, label: v.object_name }))}
                            />
                        </div>
                    )}

                    {/* From Date Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From Date</label>
                        <DateInput value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                    </div>

                    {/* To Date Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To Date</label>
                        <DateInput value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                    </div>

                    {/* Clear Filters Button */}
                    {(filterOfficeType || filterLocation || filterDeptName || filterVertical || filterFromDate || filterToDate) && (
                        <div className="flex items-end">
                            <button
                                onClick={handleClearFilters}
                                className="w-full px-3 py-2 bg-surface border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors"
                            >
                                <X size={14} />
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Results */}
            <Card pad={false} className="overflow-hidden">
                {!hasSearched ? (
                    <EmptyState
                        icon={Search}
                        title="Search for cases"
                        description="Enter a case number above, or apply filters and search."
                    />
                ) : (
                    <>
                        {/* Results Meta */}
                        {totalEstimate && !loading && (
                            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-sm backdrop-blur-sm">
                                <span className="text-slate-600">
                                    <span className="font-semibold text-canopy">{totalEstimate}</span> {resultLabel}
                                </span>
                                {cases.length > 0 && <span className="text-slate-400 text-xs">Showing {rangeStart}-{rangeEnd}</span>}
                            </div>
                        )}

                        <DataTable
                            columns={caseColumns}
                            rows={cases}
                            rowKey={(c, i) => c.r_object_id || i}
                            loading={loading}
                            skeletonRows={3}
                            stickyHeader
                            empty={{
                                icon: Search,
                                title: 'No cases found',
                                description: 'Try a different search term or widen the filters.',
                            }}
                        />

                        {cases.length > 0 && (
                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                hasNext={hasNextPage}
                                rangeStart={rangeStart}
                                rangeEnd={rangeEnd}
                                loading={loading}
                                onPageChange={handlePageChange}
                                onPageSizeChange={(n) => {
                                    setPageSize(n);
                                    setPage(1);
                                    if (activeSearch) fetchCases(activeSearch, 1, n);
                                }}
                            />
                        )}
                    </>
                )}
            </Card>

            {/* Workflow Master Modal */}
            {isWorkflowModalOpen && (
                <Modal
                    isOpen
                    onClose={() => setIsWorkflowModalOpen(false)}
                    size="4xl"
                    title={
                        <span className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                                <Briefcase className="text-canopy" size={20} />
                                Workflow Details
                            </span>
                            {selectedCase && (
                                <span className="font-sans text-sm font-normal text-slate-500">
                                    Case: <span className="font-medium text-slate-900">{selectedCase.object_name}</span>
                                </span>
                            )}
                        </span>
                    }
                >
                        {/* Modal Content — bleed to the panel edges so the workflow sidebar sits flush */}
                        <div className="-m-5 flex min-h-[50vh] flex-col md:flex-row">
                            {loadingWorkflow ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-16">
                                    <Loader2 size={48} className="animate-spin text-canopy mb-4" />
                                    <p className="text-slate-600 font-medium">Loading workflow topology...</p>
                                </div>
                            ) : workflowData?.error ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-20 h-20 bg-danger-tint rounded-full flex items-center justify-center mb-6">
                                        <AlertTriangle size={40} className="text-danger" />
                                    </div>
                                    <p className="text-xl font-bold text-slate-900 mb-2">Failed to Load Workflows</p>
                                    <p className="text-slate-600">{workflowData.error}</p>
                                </div>
                            ) : !workflowData?.workflows || workflowData.workflows.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
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
                                        <div className="w-full shrink-0 border-b border-slate-200 bg-slate-50 md:w-64 md:border-b-0 md:border-r">
                                            <div className="p-4 border-b border-slate-200">
                                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Workflows ({workflowData.workflows.length})</h3>
                                            </div>
                                            <div className="p-2 space-y-1">
                                                {workflowData.workflows.map((wf, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setActiveWorkflowIndex(idx)}
                                                        className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                                                            activeWorkflowIndex === idx 
                                                            ? 'bg-surface shadow-sm ring-1 ring-slate-200 text-canopy font-medium' 
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
                                    <div className="min-w-0 flex-1 bg-surface p-5 md:p-8">
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
                                                        Started: <span>{formatDateTime(activeWorkflow.r_start_date, 'N/A')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Eye size={16} className="text-slate-400" />
                                                        Supervisor: <span>{activeWorkflow.supervisor_name || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex flex-col items-start md:items-end md:mr-4">
                                                    <span className="text-xs font-semibold text-slate-500 uppercase mb-1">Current State</span>
                                                    {getStatusBadge(activeWorkflow.r_runtime_state)}
                                                </div>
                                                
                                                <button
                                                    onClick={() => handleRestartWorkflow(activeWorkflow.r_object_id)}
                                                    disabled={actionLoading === `restart-${activeWorkflow.r_object_id}`}
                                                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-colors"
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
                                                <div className="w-1 h-6 bg-canopy rounded-full"></div>
                                                Activity History & Queue Items
                                            </h4>
                                            
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                <DataTable
                                                    columns={workItemColumns}
                                                    rows={activeWorkflow.workItems || []}
                                                    rowKey={(item, i) => item.r_object_id || i}
                                                    empty={{ icon: Inbox, title: 'No activities found for this workflow.' }}
                                                    stickyHeader
                                                    maxHeight="60vh"
                                                    className="p-3 md:p-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                </Modal>
            )}

            {/* Log Details Modal */}
            {logModalOpen && selectedLogItem && (
                <Modal
                    isOpen
                    onClose={() => setLogModalOpen(false)}
                    size="xl"
                    title={
                        <span className="flex items-center gap-2">
                            <FileText size={18} className="text-slate-500" />
                            Activity Log
                        </span>
                    }
                    footer={
                        <button onClick={() => setLogModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">Close</button>
                    }
                >
                        <div className="bg-canopy-tint rounded-lg p-4 font-mono text-xs text-ink overflow-x-auto">
                            <p className="mb-2 text-slate-500"># System Log for WorkItem: {selectedLogItem.r_object_id}</p>
                            <p className="mb-2 text-slate-500"># Activity: {selectedLogItem.r_act_name}</p>
                            <div className="space-y-1">
                                <span className="text-canopy/70">[INFO]</span> Activity started at {formatDateTime(selectedLogItem.r_creation_date)}<br/>
                                <span className="text-canopy/70">[DEBUG]</span> Performer assigned: {selectedLogItem.r_performer_name}<br/>
                                <span className="text-canopy/70">[INFO]</span> Status changed to: {selectedLogItem.r_runtime_state}<br/>
                                {selectedLogItem.r_runtime_state === 'failed' && (
                                    <>
                                        <span className="text-danger/70">[ERROR]</span> Activity execution failed.<br/>
                                        <span className="text-danger/70">[ERROR]</span> Exception details not available in mock.<br/>
                                    </>
                                )}
                                <span className="text-slate-500">... End of log</span>
                            </div>
                        </div>
                </Modal>
            )}
            </>
            )}

            {/* Case Details Modal */}
            {detailCase && <CaseDetailsModal caseItem={detailCase} onClose={() => setDetailCase(null)} />}

            {/* Movement Register Modal */}
            {movementCase && <MovementRegisterModal caseItem={movementCase} onClose={() => setMovementCase(null)} />}

            {/* Republish to IV — pick documents */}
            {ivCase && (
                <Modal
                    isOpen
                    onClose={closeIvDocuments}
                    size="lg"
                    title={
                        <span className="flex items-center gap-2">
                            <UploadCloud size={18} className="text-slate-500" />
                            Republish to IV
                        </span>
                    }
                    footer={
                        <>
                            <Button variant="secondary" size="sm" onClick={closeIvDocuments}>Close</Button>
                            <Button
                                variant="primary"
                                size="sm"
                                disabled={ivSelected.size === 0 || ivBusy}
                                onClick={() => republishDocs(ivDocs.filter((d) => ivSelected.has(d.id)))}
                            >
                                Republish selected{ivSelected.size > 0 ? ` (${ivSelected.size})` : ''}
                            </Button>
                        </>
                    }
                >
                    <p className="mb-3 text-sm text-slate-600">
                        Documents of case <span className="font-medium text-slate-900">{ivCase.object_name}</span>. Choose which ones to republish to the IV viewer.
                    </p>
                    {ivDocsLoading && (
                        <div className="flex items-center gap-2 py-8 justify-center text-sm text-slate-500">
                            <Loader2 size={16} className="animate-spin" /> Loading documents…
                        </div>
                    )}
                    {!ivDocsLoading && ivDocsError && (
                        <p className="py-6 text-center text-sm text-danger">{ivDocsError}</p>
                    )}
                    {!ivDocsLoading && !ivDocsError && ivDocs.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">No documents found for this case.</p>
                    )}
                    {!ivDocsLoading && ivDocs.length > 0 && (
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                            <label className="flex items-center gap-3 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={allIvSelected}
                                    disabled={ivBusy}
                                    onChange={() => setIvSelected(allIvSelected ? new Set() : new Set(ivDocs.map((d) => d.id)))}
                                />
                                Select all ({ivDocs.length})
                            </label>
                            {ivDocs.map((d) => {
                                const st = ivStatus[d.id];
                                return (
                                    <div key={d.id} className="flex items-center gap-3 px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={ivSelected.has(d.id)}
                                            disabled={ivBusy}
                                            onChange={() => toggleIvSelected(d.id)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm text-slate-900" title={d.name}>{d.name}</div>
                                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                                                <span>{d.category || 'Document'}</span>
                                                <span className="font-mono">{d.id}</span>
                                                {d.modified && <span>{formatDateTime(d.modified, '')}</span>}
                                            </div>
                                            {st?.state === 'done' && (
                                                <div className="text-xs text-canopy-dark">
                                                    Republished{st.publicationId ? ` — publication ID ${st.publicationId}` : ''}
                                                </div>
                                            )}
                                            {st?.state === 'error' && <div className="text-xs text-danger">{st.error}</div>}
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            disabled={ivBusy}
                                            onClick={() => republishDocs([d])}
                                        >
                                            {st?.state === 'publishing'
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : st?.state === 'error' ? 'Retry' : 'Republish'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default CasesPage;