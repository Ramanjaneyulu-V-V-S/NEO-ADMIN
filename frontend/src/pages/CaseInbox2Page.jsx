import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import {
    Inbox, Loader2, X, User, Building2, MapPin, FolderOpen,
    FileText, ClipboardList, UploadCloud, ChevronLeft, ChevronRight, ChevronsLeft
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import { DataTable, Modal, Button, useToast } from '../components/ui';
import { CaseDetailsModal, MovementRegisterModal } from '../components/CaseModals';
import { caseStatusPillCls } from '../utils/statusTone';

const PAGE_SIZE = 20;

const disabledSelectCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-8';

const FieldLabel = ({ icon: Icon, label }) => (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
        <Icon size={13} className="text-slate-400" />
        {label}
    </label>
);

// ─── CaseInbox2Page ────────────────────────────────────────────────────────────
const CaseInbox2Page = () => {
    // Local Admin role & profile context
    const storedUser    = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole     = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin  = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null);
    const [localAdminOfficeType, setLocalAdminOfficeType] = useState('');
    const [localAdminLocation, setLocalAdminLocation] = useState('');
    const [localAdminDepartments, setLocalAdminDepartments] = useState([]);

    // Fetch Local Admin profile context on mount
    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                setLocalAdminOfficeType(ctx.office_type || '');
                setLocalAdminLocation(ctx.location || '');
                const deptMulti = ctx.department_short_code_multi || [];
                setLocalAdminDepartments(Array.isArray(deptMulti) ? deptMulti : []);
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    // Filter state
    const [officeType,  setOfficeType]  = useState(() => isLocalAdmin ? '' : '');
    const [location,    setLocation]    = useState(() => isLocalAdmin ? '' : '');
    const [department,  setDepartment]  = useState(null);
    const [allDepartments, setAllDepartments] = useState([]);

    // Initialize filters for Local Admin when profile context loads
    useEffect(() => {
        if (isLocalAdmin && profileCtx && localAdminOfficeType) {
            setOfficeType(localAdminOfficeType);
            if (localAdminLocation) setLocation(localAdminLocation);
        }
    }, [isLocalAdmin, profileCtx, localAdminOfficeType, localAdminLocation]);

    // Users state
    const [users,        setUsers]        = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Cases state
    const [cases,        setCases]        = useState([]);
    const [total,        setTotal]        = useState(0);
    const [loadingCases, setLoadingCases] = useState(false);
    const [page,         setPage]         = useState(1);
    const [error,        setError]        = useState(null);

    const [detailCase,   setDetailCase]   = useState(null);
    const [movementCase, setMovementCase] = useState(null);

    const [actionLoading, setActionLoading] = useState(null); // 'iv-<objectId>'
    const [ivConfirmCase, setIvConfirmCase] = useState(null); // case pending Republish-to-IV confirmation
    const toast = useToast();

    const locations = getLocations(officeType);
    const isRoTe    = officeType === 'RO' || officeType === 'TE';

    // For Local Admin: filter departments to only those in their profile
    const departments = isLocalAdmin && profileCtx
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            return allDepartments.filter(d => allowed.includes(d.shortCode.toLowerCase()));
          })()
        : allDepartments;

    // Fetch departments when office type / location changes
    useEffect(() => {
        if (!officeType || (isRoTe && !location)) { setAllDepartments([]); return; }
        fetchDepartments(officeType, location).then(setAllDepartments);
    }, [officeType, location]);

    // For Local Admin: auto-fetch users when profile context loads with location/office type
    useEffect(() => {
        if (!isLocalAdmin) return;
        if (!profileCtx || !officeType || (isRoTe && !location)) return;
        if (isRoTe && location) {
            fetchUsersByLocation(location);
        }
    }, [isLocalAdmin, profileCtx, officeType, location]);

    // Fetch users by location
    const fetchUsersByLocation = async (loc) => {
        setLoadingUsers(true); setUsers([]);
        try {
            const res = await api.get('/users/by-location', { params: { location: loc } });
            setUsers(res.data?.users || res.data || []);
        } catch { setUsers([]); }
        finally { setLoadingUsers(false); }
    };

    // Fetch users by department
    const fetchUsersByDept = async (shortCode, officeTypeFilter) => {
        setLoadingUsers(true); setUsers([]);
        try {
            const params = { shortCode };
            if (officeTypeFilter) params.officeType = officeTypeFilter;
            const res = await api.get('/users/by-dept', { params });
            setUsers(res.data?.users || res.data || []);
        } catch { setUsers([]); }
        finally { setLoadingUsers(false); }
    };

    // Office type change handler
    const handleOfficeTypeChange = (val) => {
        setOfficeType(val); setLocation(''); setDepartment(null);
        setUsers([]); setFilteredUsers([]); setSelectedUser(null); setCases([]); setTotal(0); setPage(1);
    };

    // Location change handler
    const handleLocationChange = (val) => {
        setLocation(val); setDepartment(null); setSelectedUser(null); setFilteredUsers([]);
        setCases([]); setTotal(0); setPage(1);
        if (val) fetchUsersByLocation(val);
        else setUsers([]);
    };

    // Department change handler
    const handleDepartmentChange = (shortCode) => {
        setSelectedUser(null); setCases([]); setTotal(0); setPage(1);
        if (!shortCode) {
            setDepartment(null); setFilteredUsers([]);
            if (isRoTe && location) fetchUsersByLocation(location);
            else setUsers([]);
            return;
        }
        const dept = departments.find(d => d.shortCode === shortCode) || null;
        setDepartment(dept);

        if (dept) {
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

    // Fetch cases for selected user
    const fetchCases = useCallback(async (userName, pg) => {
        if (!userName) { setCases([]); setTotal(0); return; }
        setLoadingCases(true);
        setError(null);
        try {
            const start = (pg - 1) * PAGE_SIZE;
            const res = await api.get('/inbox/tasklist', {
                params: { username: userName, page: pg, start }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(entry => {
                    const props = entry?.content?.properties || entry?.properties || entry;
                    return { ...props, _raw: entry };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }
            setCases(items);
            setTotal(data.total || data.count || items.length);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load inbox');
            setCases([]);
            setTotal(0);
        } finally {
            setLoadingCases(false);
        }
    }, []);

    const handleSelectUser = (userName) => {
        setSelectedUser(userName);
        setPage(1);
        fetchCases(userName, 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(selectedUser, newPage);
    };

    const rangeStart = cases.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const rangeEnd   = (page - 1) * PAGE_SIZE + cases.length;
    const hasNext    = rangeEnd < total;
    const hasPrev    = page > 1;

    const p               = (c, f) => c[`packagescase_folder${f}`] || c[f];
    const getCaseName     = (c) => p(c, 'object_name') || '—';
    const getCaseDesc     = (c) => p(c, 'description') || c.packagesworkflow_paramtask_name || '—';
    const getCaseStatus   = (c) => p(c, 'status') || '—';
    const getCasePriority = (c) => p(c, 'task_priority') || '—';
    const getCaseDept     = (c) => p(c, 'department_name') || '—';
    const getCaseHoRo     = (c) => p(c, 'ho_ro') || '—';
    const getCaseId       = (c) => p(c, 'id') || c.id || '';
    const getCaseObjectId = (c) => c.packagescase_folderid || c.r_object_id || c.objectId || c.id || '';

    const handleRepublishToIv = async (c) => {
        const objectId = getCaseObjectId(c);
        if (!objectId) return;
        setActionLoading(`iv-${objectId}`);
        try {
            const { data: noteDoc } = await api.get(`/iv/note-document/${objectId}`);
            if (!noteDoc.success) {
                toast.error(noteDoc.error || 'No note document found for this case.');
                return;
            }
            const { data: publishResult } = await api.post('/iv/publish', { docId: noteDoc.noteDocumentId });
            if (publishResult.success) {
                toast.success(
                    publishResult.publicationId
                        ? `Republish triggered — publication ID ${publishResult.publicationId}`
                        : 'Republish triggered successfully.'
                );
            } else {
                toast.error(publishResult.error || 'Failed to republish document.');
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to republish document.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmRepublish = () => {
        const c = ivConfirmCase;
        setIvConfirmCase(null);
        if (c) handleRepublishToIv(c);
    };

    const iconBtnCls = 'p-1.5 rounded-lg text-slate-400 hover:text-canopy hover:bg-canopy-tint transition-colors';
    const inboxColumns = [
        { key: 'idx', header: '#', width: 'w-12', card: 'hide',
          render: (_c, idx) => <span className="text-slate-400 font-mono text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</span> },
        { key: 'name', header: 'Case Number', primary: true,
          render: (c) => <span className="font-medium text-slate-800">{getCaseName(c)}</span> },
        { key: 'desc', header: 'Subject',
          render: (c) => <span className="block max-w-xs truncate text-slate-600" title={getCaseDesc(c)}>{getCaseDesc(c)}</span> },
        { key: 'dept', header: 'Department', render: (c) => <span className="text-xs text-slate-600">{getCaseDept(c)}</span> },
        { key: 'office', header: 'Office', render: (c) => <span className="text-xs text-slate-600">{getCaseHoRo(c)}</span> },
        { key: 'status', header: 'Status',
          render: (c) => <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${caseStatusPillCls(getCaseStatus(c))}`}>{getCaseStatus(c)}</span> },
        { key: 'priority', header: 'Priority',
          render: (c) => getCasePriority(c) !== '—' ? (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  getCasePriority(c) === 'High'   ? 'bg-danger-tint text-danger' :
                  getCasePriority(c) === 'Medium' ? 'bg-harvest/15 text-harvest' :
                  'bg-slate-100 text-slate-600'
              }`}>{getCasePriority(c)}</span>
          ) : '—' },
        { key: 'actions', header: 'Actions', align: 'center', width: 'w-24', card: 'footer',
          render: (c) => (
              <div className="flex items-center justify-center gap-1">
                  <button onClick={() => setDetailCase(c)} title="Case Details" className={iconBtnCls}><FileText size={15} /></button>
                  <button onClick={() => setMovementCase(c)} title="Movement Register" className={iconBtnCls}><ClipboardList size={15} /></button>
                  <button
                      onClick={() => setIvConfirmCase(c)}
                      title="Republish to IV"
                      disabled={actionLoading === `iv-${getCaseObjectId(c)}`}
                      className={`${iconBtnCls} disabled:opacity-40 disabled:pointer-events-none`}
                  >
                      {actionLoading === `iv-${getCaseObjectId(c)}`
                          ? <Loader2 size={15} className="animate-spin" />
                          : <UploadCloud size={15} />}
                  </button>
              </div>
          ) },
    ];

    return (
        <div className="flex h-full flex-col">
            {detailCase   && <CaseDetailsModal     caseItem={detailCase}   onClose={() => setDetailCase(null)} />}
            {movementCase && <MovementRegisterModal caseItem={movementCase} onClose={() => setMovementCase(null)} />}

            {/* Republish to IV — confirmation */}
            {ivConfirmCase && (
                <Modal
                    isOpen
                    onClose={() => setIvConfirmCase(null)}
                    size="sm"
                    title={
                        <span className="flex items-center gap-2">
                            <UploadCloud size={18} className="text-slate-500" />
                            Republish to IV
                        </span>
                    }
                    footer={
                        <>
                            <Button variant="secondary" size="sm" onClick={() => setIvConfirmCase(null)}>Cancel</Button>
                            <Button variant="primary" size="sm" onClick={handleConfirmRepublish}>Republish</Button>
                        </>
                    }
                >
                    <p className="text-sm text-slate-600">
                        Republish notesheet of case <span className="font-medium text-slate-900">{getCaseName(ivConfirmCase)}</span> to the IV viewer?
                    </p>
                </Modal>
            )}

            {/* Filter Panel */}
            <div className="bg-surface border border-slate-200 rounded-xl p-5 shadow-sm mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" />
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
                            <input readOnly value="Mumbai (Head Office)" className={disabledSelectCls} />
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
                            placeholder={!officeType ? '— Select office first —' : (isRoTe && !location) ? '— Select location first —' : '— All departments —'}
                            options={departments.map(d => ({ value: d.shortCode, label: d.name }))}
                        />
                    </div>
                    <div>
                        <FieldLabel icon={User} label="User Name" />
                        {/* Show filtered users if department selected, otherwise show all users */}
                        {(() => {
                            const displayUsers = (department && isRoTe ? filteredUsers : users).filter(u => u.object_name?.trim());
                            const isEmpty = displayUsers.length === 0;
                            return (
                                <CustomSelect
                                    value={selectedUser || ''}
                                    onChange={handleSelectUser}
                                    disabled={loadingUsers || isEmpty}
                                    placeholder={loadingUsers ? 'Loading users…' : isEmpty ? '— No matching users —' : '— Select user —'}
                                    options={displayUsers.map(u => ({ value: u.object_name, label: u.object_name }))}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Tasks panel */}
            <div className="flex-1 bg-surface border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

                {/* Panel header */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <ClipboardList size={15} className="text-canopy" />
                    <span className="text-sm font-semibold text-slate-700">
                        {selectedUser ? `Inbox — ${selectedUser}` : 'Inbox Tasks'}
                    </span>
                    {selectedUser && !loadingCases && total > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                            {total} case{total !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Table area */}
                <div className="flex-1 overflow-auto">
                    {!selectedUser && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <Inbox size={36} strokeWidth={1.5} />
                            <p className="text-sm">Select a user to view their inbox cases</p>
                        </div>
                    )}

                    {selectedUser && loadingCases && (
                        <div className="flex items-center justify-center h-full py-16">
                            <Loader2 size={24} className="animate-spin text-canopy" />
                        </div>
                    )}

                    {selectedUser && !loadingCases && error && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-danger py-16">
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {selectedUser && !loadingCases && !error && cases.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <Inbox size={36} strokeWidth={1.5} />
                            <p className="text-sm">No pending cases found for this user</p>
                        </div>
                    )}

                    {selectedUser && !loadingCases && !error && cases.length > 0 && (
                        <DataTable
                            columns={inboxColumns}
                            rows={cases}
                            rowKey={(c, idx) => getCaseId(c) || idx}
                            stickyHeader
                            maxHeight="70vh"
                            className="p-3 md:p-0"
                        />
                    )}
                </div>

                {/* Pagination footer */}
                {selectedUser && !loadingCases && cases.length > 0 && (hasPrev || hasNext) && (
                    <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-surface">
                        <span className="text-xs text-slate-500">
                            {rangeStart > 0 ? `Showing ${rangeStart}–${rangeEnd}${total > rangeEnd ? ` of ${total}` : ''}` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={!hasPrev}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={!hasPrev}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 py-1 text-xs font-medium text-slate-700">Page {page}</span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={!hasNext}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="w-16" />
                    </div>
                )}
            </div>
        </div>
    );
};

export { CaseInbox2Page as CaseInboxContent };
export default CaseInbox2Page;
