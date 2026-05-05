import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
    FolderOpen, FileText, Layers, Building2, MapPin, Tag, MessageSquareText,
    CheckCircle2, AlertCircle, X, Loader2, Plus, Hash, RefreshCw, Trash2, Pencil
} from 'lucide-react';
import { getLocations, fetchDepartments } from '../data/nabardMetadata.js';

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
        <div className={`fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3 border rounded-xl shadow-lg max-w-sm ${styles[toast.type]}`}>
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button onClick={onDismiss}><X size={16} /></button>
        </div>
    );
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const inputCls = (err) =>
    `w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] ${
        err ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

const selectCls = (err, disabled) => disabled
    ? 'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-10'
    : `w-full px-4 py-2.5 border rounded-xl text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] transition-all cursor-pointer ${
        err ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

const ChevronDown = ({ disabled }) => (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg className={`w-4 h-4 ${disabled ? 'text-slate-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);

const FieldLabel = ({ icon: Icon, label, required }) => (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <span className="flex items-center gap-1.5">
            <Icon size={14} className="text-slate-400" />
            {label}
            {required && <span className="text-red-400">*</span>}
            {!required && <span className="text-xs font-normal text-slate-400">(optional)</span>}
        </span>
    </label>
);

const FieldError = ({ msg }) => msg
    ? <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{msg}</p>
    : null;

// ─── Existing File Numbers List ───────────────────────────────────────────────
const FileNumberList = ({ hoRo, deptShortCode, roShortCode, refreshKey, onToast }) => {
    const [items, setItems]         = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);
    // confirmId = r_object_id of the row awaiting delete confirmation; null otherwise
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting]   = useState(null); // r_object_id being deleted
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ object_name: '', description: '' });
    const [saving, setSaving]       = useState(false);

    const canFetch = hoRo && deptShortCode && (hoRo === 'HO' || roShortCode);

    const loadList = useCallback(async () => {
        if (!canFetch) return;
        setLoading(true);
        setError(null);
        try {
            const params = { hoRo, deptShortCode };
            if (roShortCode) params.roShortCode = roShortCode;
            const res = await api.get('/metadata/file-numbers', { params });
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [hoRo, deptShortCode, roShortCode, canFetch]);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const startEdit = (item) => {
        setEditingId(item.r_object_id);
        setEditValues({ object_name: item.object_name || '', description: item.description || '' });
        setConfirmId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({ object_name: '', description: '' });
    };

    const handleSave = async (item) => {
        setSaving(true);
        try {
            await api.put(`/metadata/file-numbers/${item.r_object_id}`, {
                object_name: editValues.object_name.trim(),
                description: editValues.description.trim(),
            });
            onToast({ type: 'success', message: `File number '${item.object_name}' updated.` });
            setItems(prev => prev.map(i => i.r_object_id === item.r_object_id
                ? { ...i, object_name: editValues.object_name.trim(), description: editValues.description.trim() }
                : i));
            cancelEdit();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Update failed';
            onToast({ type: 'error', message: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/metadata/file-numbers/${item.r_object_id}`);
            onToast({ type: 'success', message: `File number '${item.object_name}' deleted.` });
            setItems(prev => prev.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Delete failed';
            onToast({ type: 'error', message: msg });
        } finally {
            setDeleting(null);
        }
    };

    if (!canFetch) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Existing File Numbers</span>
                    {!loading && (
                        <span className="px-2 py-0.5 bg-blue-100 text-[#0A66C2] text-xs font-semibold rounded-full">
                            {items.length}
                        </span>
                    )}
                </div>
                <button onClick={loadList} disabled={loading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-40">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin text-[#0A66C2]" />
                    <span className="text-sm">Loading…</span>
                </div>
            ) : error ? (
                <div className="px-5 py-4 text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            ) : items.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                    No file numbers found for this selection
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">File Number</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Description</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Dept Code</th>
                                {hoRo !== 'HO' && (
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Location Code</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const isConfirming = confirmId === item.r_object_id;
                                const isDeleting   = deleting  === item.r_object_id;
                                const isEditing    = editingId === item.r_object_id;
                                const rowBg = isEditing ? 'bg-blue-50' : isConfirming ? 'bg-red-50' : 'hover:bg-blue-50/30';
                                return (
                                    <tr key={item.r_object_id || idx}
                                        className={`transition-colors ${rowBg}`}>
                                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                                            {isEditing ? (
                                                <input
                                                    value={editValues.object_name}
                                                    onChange={e => setEditValues(v => ({ ...v, object_name: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                                />
                                            ) : (item.object_name || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 text-xs max-w-xs">
                                            {isEditing ? (
                                                <input
                                                    value={editValues.description}
                                                    onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                                />
                                            ) : (
                                                <span className="truncate block">{item.description || '—'}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                                                {item.dept_short_code || '—'}
                                            </span>
                                        </td>
                                        {hoRo !== 'HO' && (
                                            <td className="px-4 py-2.5">
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                                                    {item.ro_short_code || '—'}
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── File Number Tab ──────────────────────────────────────────────────────────
const EMPTY_FN = { officeType: '', location: '', department: '', shortCode: '', locationShortCode: '', fileNumber: '', description: '' };

const FileNumberTab = ({ onToast }) => {
    const [form, setForm]         = useState(EMPTY_FN);
    const [errors, setErrors]     = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Role & profile context for Local Admin
    const storedUser  = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole   = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';

    const [profileCtx, setProfileCtx] = useState(null); // { office_type, location, department_short_code_multi }

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;
        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                const officeType = ctx.office_type || '';
                const location   = ctx.location   || '';
                if (officeType) {
                    // Pre-compute locationShortCode from the metadata list
                    const locs = getLocations(officeType);
                    const locObj = locs.find(l => l.location === location);
                    setForm({ ...EMPTY_FN, officeType, location, locationShortCode: locObj?.shortCode || '' });
                }
            })
            .catch(() => setProfileCtx({}));
    }, [isLocalAdmin, loginUsername]);

    const isHO            = form.officeType === 'HO';
    const locationOptions = getLocations(form.officeType);

    // Dynamic department fetching
    const [allDeptOptions, setAllDeptOptions] = useState([]);
    useEffect(() => {
        if (!form.officeType || (!isHO && !form.location)) { setAllDeptOptions([]); return; }
        fetchDepartments(form.officeType, form.location).then(setAllDeptOptions);
    }, [form.officeType, form.location]);

    // For Local Admin: filter departments to only those in their profile
    const deptOptions     = isLocalAdmin && profileCtx
        ? (() => {
            const raw = profileCtx.department_short_code_multi;
            const allowed = (Array.isArray(raw) ? raw : (raw ? [raw] : []))
                .map(s => s.toLowerCase());
            return allDeptOptions.filter(d => allowed.includes(d.shortCode.toLowerCase()));
          })()
        : allDeptOptions;

    const handleOfficeType = (val) => {
        setForm({ ...EMPTY_FN, officeType: val });
        setErrors({});
    };

    const handleLocation = (val) => {
        const locObj = locationOptions.find(l => l.location === val);
        setForm(f => ({ ...f, location: val, locationShortCode: locObj?.shortCode || '', department: '', shortCode: '' }));
        if (errors.location) setErrors(e => ({ ...e, location: undefined }));
    };

    const handleDept = (val) => {
        const deptObj = deptOptions.find(d => d.name === val);
        setForm(f => ({ ...f, department: val, shortCode: deptObj?.shortCode || '' }));
        if (errors.department) setErrors(e => ({ ...e, department: undefined }));
    };

    const set = (field, val) => {
        setForm(f => ({ ...f, [field]: val }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.officeType)        e.officeType  = 'Office type is required';
        if (!isHO && !form.location) e.location    = 'Location is required';
        if (!form.department)        e.department  = 'Department is required';
        if (!form.fileNumber.trim()) e.fileNumber  = 'File number is required';
        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/metadata/file-numbers', {
                object_name:     form.fileNumber.trim(),
                ho_ro:           form.officeType,
                dept_short_code: form.shortCode,
                ro_short_code:   isHO ? '' : form.locationShortCode,
                description:     form.description.trim(),
            });
            onToast({ type: 'success', message: res.data?.message || 'File number created successfully' });
            setForm(f => ({ ...f, fileNumber: '', description: '' }));
            setErrors({});
            setRefreshKey(k => k + 1);   // refresh list
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to create file number';
            onToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    // List is shown when department is selected (all required context is available)
    const listReady = form.officeType && form.shortCode && (isHO || form.locationShortCode);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* ── Left: creation form ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm shrink-0">
                        <FileText size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create File Number</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_file_number</code> under /ECM CONFIG/File Number
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Office Type */}
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" required />
                        <div className="relative">
                            <select value={form.officeType} onChange={e => handleOfficeType(e.target.value)}
                                disabled={isLocalAdmin}
                                className={selectCls(errors.officeType, isLocalAdmin)}>
                                <option value="">— Select office type —</option>
                                <option value="HO">HO — Head Office</option>
                                <option value="RO">RO — Regional Office</option>
                                <option value="TE">TE — Training Establishment</option>
                            </select>
                            <ChevronDown />
                        </div>
                        <FieldError msg={errors.officeType} />
                    </div>

                    {/* Location */}
                    <div>
                        <FieldLabel icon={MapPin} label="Location" required={!isHO} />
                        <div className="relative">
                            {isHO ? (
                                <>
                                    <select disabled className={selectCls(null, true)}>
                                        <option>— Not applicable for HO —</option>
                                    </select>
                                    <ChevronDown disabled />
                                </>
                            ) : (
                                <>
                                    <select value={form.location}
                                        onChange={e => handleLocation(e.target.value)}
                                        disabled={!form.officeType || isLocalAdmin}
                                        className={selectCls(errors.location, !form.officeType || isLocalAdmin)}>
                                        <option value="">— Select location —</option>
                                        {locationOptions.map(l => (
                                            <option key={l.location} value={l.location}>{l.location}</option>
                                        ))}
                                    </select>
                                    <ChevronDown disabled={!form.officeType} />
                                </>
                            )}
                        </div>
                        <FieldError msg={errors.location} />
                    </div>

                    {/* Department */}
                    <div>
                        <FieldLabel icon={Layers} label="Department" required />
                        {(() => {
                            const disabled = !form.officeType || (!isHO && !form.location);
                            return (
                                <>
                                    <div className="relative">
                                        <select value={form.department}
                                            onChange={e => handleDept(e.target.value)}
                                            disabled={disabled}
                                            className={selectCls(errors.department, disabled)}>
                                            <option value="">— Select department —</option>
                                            {deptOptions.map(d => (
                                                <option key={d.shortCode} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown disabled={disabled} />
                                    </div>
                                    {form.shortCode && (
                                        <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                                            <Tag size={11} />Short code: <span className="font-mono text-slate-600">{form.shortCode}</span>
                                        </p>
                                    )}
                                </>
                            );
                        })()}
                        <FieldError msg={errors.department} />
                    </div>

                    {/* File Number */}
                    <div>
                        <FieldLabel icon={FileText} label="File Number" required />
                        <input type="text" value={form.fileNumber}
                            onChange={e => set('fileNumber', e.target.value)}
                            placeholder="e.g. SMF-10"
                            className={`${inputCls(errors.fileNumber)} font-mono`} />
                        <FieldError msg={errors.fileNumber} />
                    </div>

                    {/* Description */}
                    <div>
                        <FieldLabel icon={FolderOpen} label="Description" required={false} />
                        <textarea value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="e.g. Jammu & Kashmir - State Master File (SMF)"
                            rows={3}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] hover:border-slate-300 bg-white resize-none transition-all" />
                    </div>

                    {/* DQL preview */}
                    {form.officeType && form.department && form.fileNumber && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 space-y-0.5">
                            <p className="font-sans text-slate-400 font-semibold mb-1">DQL Preview</p>
                            <p>create cms_file_number objects</p>
                            <p>&nbsp;&nbsp;set object_name='{form.fileNumber.trim()}'</p>
                            <p>&nbsp;&nbsp;set ho_ro='{form.officeType}'</p>
                            <p>&nbsp;&nbsp;set dept_short_code='{form.shortCode}'</p>
                            {!isHO && form.location && (
                                <p>&nbsp;&nbsp;set ro_short_code='{form.locationShortCode}'</p>
                            )}
                            {form.description && <p>&nbsp;&nbsp;set description='{form.description.trim()}'</p>}
                            <p>&nbsp;&nbsp;link '/ECM CONFIG/File Number';</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button type="button"
                            onClick={() => { setForm(EMPTY_FN); setErrors({}); }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-all">
                            Reset
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Creating…' : 'Create File Number'}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Right: existing file numbers list ── */}
            {listReady ? (
                <FileNumberList
                    hoRo={form.officeType}
                    deptShortCode={form.shortCode}
                    roShortCode={isHO ? '' : form.locationShortCode}
                    refreshKey={refreshKey}
                    onToast={onToast}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Hash size={36} className="mb-3" />
                    <p className="text-sm text-slate-400">Select office type and department</p>
                    <p className="text-xs text-slate-300 mt-1">Existing file numbers will appear here</p>
                </div>
            )}
        </div>
    );
};

// ─── Case Type Tab ───────────────────────────────────────────────────────────
const CaseTypeTab = ({ onToast }) => {
    const [caseType, setCaseType]       = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [items, setItems]             = useState([]);
    const [loading, setLoading]         = useState(false);
    const [refreshKey, setRefreshKey]   = useState(0);

    // Fetch existing case types
    useEffect(() => {
        setLoading(true);
        api.get('/metadata/case-types')
            .then(res => setItems(Array.isArray(res.data) ? res.data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [refreshKey]);

    const handleCreate = async () => {
        if (!caseType.trim()) return;
        setSubmitting(true);
        try {
            const res = await api.post('/metadata/case-types', { object_name: caseType.trim() });
            if (res.data?.success) {
                onToast({ type: 'success', message: res.data.message });
                setCaseType('');
                setRefreshKey(k => k + 1);
            } else {
                onToast({ type: 'error', message: res.data?.message || 'Creation failed' });
            }
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <FolderOpen size={20} className="text-[#0A66C2]" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create Case Type</p>
                        <p className="text-xs text-slate-400">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">dm_folder</code> under /ECM CONFIG/Case Type
                        </p>
                    </div>
                </div>

                <div>
                    <FieldLabel icon={Tag} label="Case Type" required />
                    <input
                        type="text"
                        value={caseType}
                        onChange={e => setCaseType(e.target.value)}
                        placeholder="e.g. test"
                        className={inputCls(false)}
                    />
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!caseType.trim() || submitting}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        caseType.trim() && !submitting
                            ? 'bg-[#0A66C2] text-white hover:bg-[#094d92] shadow-md shadow-blue-600/20'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {submitting ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><Plus size={15} /> Create Case Type</>}
                </button>
            </div>

            {/* Existing list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">Existing Case Types</span>
                    <button onClick={() => setRefreshKey(k => k + 1)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                </div>
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">No case types found</div>
                ) : (
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto overscroll-contain">
                        {items.map((item, idx) => (
                            <div key={item.r_object_id || idx}
                                className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
                                <FolderOpen size={14} className="text-[#0A66C2] shrink-0" />
                                <span className="text-sm text-slate-800 font-medium">{item.object_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Hindi Comments Tab ─────────────────────────────────────────────────────
const HindiCommentsTab = ({ onToast }) => {
    const [comment, setComment]         = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [items, setItems]             = useState([]);
    const [loading, setLoading]         = useState(false);
    const [refreshKey, setRefreshKey]   = useState(0);

    useEffect(() => {
        setLoading(true);
        api.get('/metadata/hindi-comments')
            .then(res => setItems(Array.isArray(res.data) ? res.data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [refreshKey]);

    const handleCreate = async () => {
        if (!comment.trim()) return;
        setSubmitting(true);
        try {
            const res = await api.post('/metadata/hindi-comments', { object_name: comment.trim() });
            if (res.data?.success) {
                onToast({ type: 'success', message: res.data.message });
                setComment('');
                setRefreshKey(k => k + 1);
            } else {
                onToast({ type: 'error', message: res.data?.message || 'Creation failed' });
            }
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <MessageSquareText size={20} className="text-[#0A66C2]" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Add Hindi Comment</p>
                        <p className="text-xs text-slate-400">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">dm_folder</code> under /ECM CONFIG/Hindi Comments
                        </p>
                    </div>
                </div>

                <div>
                    <FieldLabel icon={Tag} label="Comment Text" required />
                    <input
                        type="text"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="e.g. कृपया अपना उत्तर हिंदी में दें"
                        className={inputCls(false)}
                    />
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!comment.trim() || submitting}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        comment.trim() && !submitting
                            ? 'bg-[#0A66C2] text-white hover:bg-[#094d92] shadow-md shadow-blue-600/20'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {submitting ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><Plus size={15} /> Add Comment</>}
                </button>
            </div>

            {/* Existing list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">Existing Hindi Comments</span>
                        {items.length > 0 && (
                            <span className="text-xs bg-blue-50 text-[#0A66C2] font-semibold px-2 py-0.5 rounded-full">{items.length}</span>
                        )}
                    </div>
                    <button onClick={() => setRefreshKey(k => k + 1)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                </div>
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">No hindi comments found</div>
                ) : (
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto overscroll-contain">
                        {items.map((item, idx) => (
                            <div key={item.r_object_id || idx}
                                className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
                                <MessageSquareText size={14} className="text-[#0A66C2] shrink-0" />
                                <span className="text-sm text-slate-800 font-medium">{item.object_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Case section — inner tabs ────────────────────────────────────────────────
const CASE_TABS = [
    { id: 'filenumber',     label: 'File Number',     icon: FileText },
    { id: 'casetype',       label: 'Case Type',       icon: FolderOpen },
    { id: 'hindicomments',  label: 'Hindi Comments',  icon: MessageSquareText },
];

const CaseSection = ({ onToast, isLocalAdmin }) => {
    const [activeTab, setActiveTab] = useState('filenumber');
    // Filter tabs for Local Admin - hide case type and hindi comments
    const visibleTabs = isLocalAdmin
        ? CASE_TABS.filter(t => t.id === 'filenumber')
        : CASE_TABS;
    return (
        <div className="space-y-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {visibleTabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === t.id
                                ? 'bg-white text-[#0A66C2] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        <t.icon size={15} />
                        {t.label}
                    </button>
                ))}
            </div>
            {activeTab === 'filenumber'    && <FileNumberTab onToast={onToast} />}
            {activeTab === 'casetype'      && <CaseTypeTab onToast={onToast} />}
            {activeTab === 'hindicomments' && <HindiCommentsTab onToast={onToast} />}
        </div>
    );
};

// ─── Nature of Correspondence — reusable tab ─────────────────────────────────
// inputValue   : 'nature_of_correspondence_internal' | 'nature_of_correspondence_external'
// folderPath   : '/Digidak Config/Nature of correspondence Internal' | ...External
// listLabel    : heading shown in the list panel
// allowAdd: whether to allow adding new items (default: true)
// allowEditDelete: whether to allow edit/delete operations (default: true)
const NatureOfCorrespondenceTab = ({ inputValue, folderPath, listLabel, formTitle, fieldLabel, onToast, allowAdd = true, allowEditDelete = true }) => {
    const [value, setValue]           = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [items, setItems]           = useState([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // edit / delete state
    const [confirmId, setConfirmId]   = useState(null);
    const [deleting, setDeleting]     = useState(null);
    const [editingId, setEditingId]   = useState(null);
    const [editValue, setEditValue]   = useState('');
    const [saving, setSaving]         = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/metadata/digidak/metadata', { params: { input: inputValue } });
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [inputValue]);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setSubmitting(true);
        try {
            const res = await api.post('/metadata/digidak/metadata', {
                input: inputValue, results: value.trim(), folder_path: folderPath,
            });
            onToast({ type: 'success', message: res.data?.message || 'Added successfully' });
            setValue('');
            setRefreshKey(k => k + 1);
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to add' });
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.r_object_id);
        setEditValue(item.results || '');
        setConfirmId(null);
    };

    const cancelEdit = () => { setEditingId(null); setEditValue(''); };

    const handleSave = async (item) => {
        setSaving(true);
        try {
            await api.put(`/metadata/digidak/metadata/${item.r_object_id}`, { results: editValue.trim() });
            onToast({ type: 'success', message: `'${item.results}' updated.` });
            setItems(prev => prev.map(i => i.r_object_id === item.r_object_id
                ? { ...i, results: editValue.trim() } : i));
            cancelEdit();
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message || 'Update failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/metadata/digidak/metadata/${item.r_object_id}`);
            onToast({ type: 'success', message: `'${item.results}' deleted.` });
            setItems(prev => prev.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message || 'Delete failed' });
        } finally {
            setDeleting(null);
        }
    };

    const resolvedFormTitle = formTitle ?? (inputValue.includes('internal') ? 'Add Nature of Correspondence (Internal)' : 'Add Nature of Correspondence (External)');
    const resolvedFieldLabel = fieldLabel ?? 'Nature of Correspondence';

    return (
        <div className={`grid ${allowAdd ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'} gap-6 items-start`}>
            {/* Left: form (only shown if add allowed) */}
            {allowAdd && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm shrink-0">
                        <Tag size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">{resolvedFormTitle}</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_digidak_metadata</code> under {folderPath}
                        </p>
                    </div>
                </div>
                <form onSubmit={handleAdd} className="p-6 space-y-4">
                    <div>
                        <FieldLabel icon={Tag} label={resolvedFieldLabel} required />
                        <input type="text" value={value} onChange={e => setValue(e.target.value)}
                            placeholder="e.g. Circular"
                            className={inputCls(false)} />
                    </div>
                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                        <button type="submit" disabled={submitting || !value.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Adding…' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
            )}

            {/* Right: list with edit + delete */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Hash size={14} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700">{listLabel}</span>
                        {!loading && (
                            <span className="px-2 py-0.5 bg-blue-100 text-[#0A66C2] text-xs font-semibold rounded-full">
                                {items.length}
                            </span>
                        )}
                    </div>
                    <button onClick={loadList} disabled={loading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-40">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                        <Loader2 size={18} className="animate-spin text-[#0A66C2]" />
                        <span className="text-sm">Loading…</span>
                    </div>
                ) : error ? (
                    <div className="px-5 py-4 text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle size={15} /> {error}
                    </div>
                ) : items.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">No values found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Nature of Correspondence</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 w-32">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => {
                                    const isEditing    = editingId  === item.r_object_id;
                                    const isConfirming = confirmId  === item.r_object_id;
                                    const isDeleting   = deleting   === item.r_object_id;
                                    const rowBg = isEditing ? 'bg-blue-50' : isConfirming ? 'bg-red-50' : 'hover:bg-blue-50/30';
                                    return (
                                        <tr key={item.r_object_id || idx} className={`transition-colors ${rowBg}`}>
                                            <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                            <td className="px-4 py-2.5 text-slate-800 text-sm">
                                                {isEditing ? (
                                                    <input value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                                                ) : (item.results || '—')}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => handleSave(item)} disabled={saving}
                                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1">
                                                            {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                                                            Save
                                                        </button>
                                                        <button onClick={cancelEdit} disabled={saving}
                                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-all disabled:opacity-50">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : isDeleting ? (
                                                    <Loader2 size={15} className="animate-spin text-red-400 mx-auto" />
                                                ) : allowEditDelete && isConfirming ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => handleDelete(item)}
                                                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all">
                                                            Delete
                                                        </button>
                                                        <button onClick={() => setConfirmId(null)}
                                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-all">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : allowEditDelete ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => startEdit(item)}
                                                            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                                                            title="Edit">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button onClick={() => { setConfirmId(item.r_object_id); setEditingId(null); }}
                                                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                            title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Digidak section ──────────────────────────────────────────────────────────
const NATURE_TABS = [
    { id: 'internal', label: 'Nature of correspondence Internal' },
    { id: 'external', label: 'Nature of correspondence External' },
];

const NatureOfCorrespondenceSection = ({ onToast }) => {
    const [activeTab, setActiveTab] = useState('internal');
    return (
        <div className="space-y-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {NATURE_TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === t.id
                                ? 'bg-white text-[#0A66C2] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>
            {activeTab === 'internal' && (
                <NatureOfCorrespondenceTab
                    inputValue="nature_of_correspondence_internal"
                    folderPath="/Digidak Config/Nature of correspondence Internal"
                    listLabel="Internal Values"
                    formTitle="Add Nature of correspondence Internal"
                    fieldLabel="Nature of correspondence Internal"
                    onToast={onToast}
                    allowAdd={true}
                    allowEditDelete={false}
                />
            )}
            {activeTab === 'external' && (
                <NatureOfCorrespondenceTab
                    inputValue="nature_of_correspondence_external"
                    folderPath="/Digidak Config/Nature of correspondence External"
                    listLabel="External Values"
                    formTitle="Add Nature of correspondence External"
                    fieldLabel="Nature of correspondence External"
                    onToast={onToast}
                    allowAdd={true}
                    allowEditDelete={false}
                />
            )}
        </div>
    );
};

const DIGIDAK_TABS = [
    { id: 'nature_of_correspondence', label: 'Nature of correspondence' },
    { id: 'mode_of_dispatch',         label: 'Mode of Dispatch' },
    { id: 'category_external',        label: 'Category External' },
];

const DigidakSection = ({ onToast }) => {
    const [activeTab, setActiveTab] = useState('nature_of_correspondence');
    return (
        <div className="space-y-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {DIGIDAK_TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === t.id
                                ? 'bg-white text-[#0A66C2] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>
            {activeTab === 'nature_of_correspondence' && <NatureOfCorrespondenceSection onToast={onToast} />}
            {activeTab === 'mode_of_dispatch' && (
                <NatureOfCorrespondenceTab
                    inputValue="mode_of_receipt"
                    folderPath="/Digidak Config/Mode of Dispatch"
                    listLabel="Mode of Dispatch Values"
                    formTitle="Add Mode of Dispatch"
                    fieldLabel="Mode of Dispatch"
                    onToast={onToast}
                    allowAdd={true}
                    allowEditDelete={false}
                />
            )}
            {activeTab === 'category_external' && (
                <NatureOfCorrespondenceTab
                    inputValue="received_from"
                    folderPath="/Digidak Config/Category External"
                    listLabel="Category External Values"
                    formTitle="Add Category External"
                    fieldLabel="Category External"
                    onToast={onToast}
                    allowAdd={true}
                    allowEditDelete={false}
                />
            )}
        </div>
    );
};

// ─── Top-level tabs ───────────────────────────────────────────────────────────
const TOP_TABS = [
    { id: 'case',    label: 'Case',    icon: FolderOpen },
    { id: 'digidak', label: 'Digidak', icon: Layers },
];

// ─── MetadataPage ─────────────────────────────────────────────────────────────
const MetadataPage = () => {
    const [activeTab, setActiveTab] = useState('case');
    const [toast, setToast]         = useState(null);

    // Get user info to check if Local Admin
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    const adminRole = user?.properties?.admin_role || user?.admin_role || null;
    const isLocalAdmin = adminRole === 'Local Admin';

    // Filter tabs for Local Admin - hide Digidak tab
    const visibleTopTabs = isLocalAdmin
        ? TOP_TABS.filter(t => t.id === 'case')
        : TOP_TABS;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            {/* Page header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <h1 className="text-lg font-bold text-slate-900">Metadata</h1>
                <p className="text-xs text-slate-500 mt-0.5">Manage ECM configuration metadata objects</p>
            </div>

            {/* Top tab bar */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-0">
                    {visibleTopTabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all ${
                                activeTab === t.id
                                    ? 'border-[#0A66C2] text-[#0A66C2]'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}>
                            <t.icon size={15} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-6">
                {activeTab === 'case'    && <CaseSection onToast={setToast} isLocalAdmin={isLocalAdmin} />}
                {activeTab === 'digidak' && <DigidakSection onToast={setToast} />}
            </div>
        </div>
    );
};

export default MetadataPage;
