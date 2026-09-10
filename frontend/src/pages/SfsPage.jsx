import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getLocations } from '../data/nabardMetadata.js';
import {
    CheckCircle2, AlertCircle, X, Loader2, Plus, Hash, RefreshCw, Trash2, FileText
} from 'lucide-react';
import { PageHeader, Tabs, useToast } from '../components/ui';
import CustomSelect from '../components/ui/CustomSelect.jsx';

// ─── Shared helpers ───────────────────────────────────────────────────────────
const inputCls = (err) =>
    `w-full px-4 py-2.5 border rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy ${
        err ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

const selectCls = (err, disabled) => disabled
    ? 'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-10'
    : `w-full px-4 py-2.5 border rounded-xl text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy transition-colors cursor-pointer ${
        err ? 'border-danger/40 bg-danger-tint' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

const ChevronDown = ({ disabled }) => (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg className={`w-4 h-4 ${disabled ? 'text-slate-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);

const FieldLabel = ({ label, required }) => (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <span className="flex items-center gap-1.5">
            {label}
            {required && <span className="text-danger/70">*</span>}
        </span>
    </label>
);

const FieldError = ({ msg }) => msg
    ? <p className="mt-1 text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{msg}</p>
    : null;

// ─── Existing Document Types List ────────────────────────────────────────────
const DocumentTypeList = ({ refreshKey, onToast }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ document_type: '', document_category: '', serial_number: '' });
    const [saving, setSaving] = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/sfs/document-types');
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const startEdit = (item) => {
        setEditingId(item.r_object_id);
        setEditValues({
            document_type: item.document_type || '',
            document_category: item.document_category || '',
            serial_number: item.serial_number || ''
        });
        setConfirmId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({ document_type: '', document_category: '', serial_number: '' });
    };

    const handleSave = async (item) => {
        setSaving(true);
        try {
            await api.put(`/sfs/document-types/${item.r_object_id}`, {
                document_type: editValues.document_type.trim(),
                document_category: editValues.document_category.trim(),
                serial_number: editValues.serial_number.trim(),
            });
            onToast({ type: 'success', message: 'Document type updated.' });
            setItems(prev => prev.map(i => i.r_object_id === item.r_object_id
                ? { ...i, ...editValues }
                : i));
            cancelEdit();
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/sfs/document-types/${item.r_object_id}`);
            onToast({ type: 'success', message: 'Document type deleted.' });
            setItems(items.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Existing Document Types</span>
                    {!loading && (
                        <span className="px-2 py-0.5 bg-canopy-tint text-canopy text-xs font-semibold rounded-full">
                            {items.length}
                        </span>
                    )}
                </div>
                <button onClick={loadList} disabled={loading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin text-canopy" />
                    <span className="text-sm">Loading…</span>
                </div>
            ) : error ? (
                <div className="px-5 py-4 text-sm text-danger flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            ) : items.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                    No document types found
                </div>
            ) : (
                <div className="overflow-auto scrollbar-thin max-h-[70vh]">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Type</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Category</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Serial Number</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const isConfirming = confirmId === item.r_object_id;
                                const isDeleting = deleting === item.r_object_id;
                                const isEditing = editingId === item.r_object_id;
                                const rowBg = isEditing ? 'bg-canopy-tint' : isConfirming ? 'bg-canopy-tint' : 'hover:bg-canopy-tint/30';
                                return (
                                    <tr key={item.r_object_id || idx} className={`transition-colors ${rowBg}`}>
                                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.document_type}
                                                    onChange={e => setEditValues(v => ({ ...v, document_type: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-canopy/40 rounded text-sm focus:outline-none focus:ring-1 focus:ring-canopy/70 bg-white" />
                                            ) : (item.document_type || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.document_category}
                                                    onChange={e => setEditValues(v => ({ ...v, document_category: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-canopy/40 rounded text-sm focus:outline-none focus:ring-1 focus:ring-canopy/70 bg-white" />
                                            ) : (item.document_category || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.serial_number}
                                                    onChange={e => setEditValues(v => ({ ...v, serial_number: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-canopy/40 rounded text-sm focus:outline-none focus:ring-1 focus:ring-canopy/70 bg-white" />
                                            ) : (item.serial_number || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSave(item)} disabled={saving}
                                                            className="p-1 rounded text-canopy hover:bg-canopy-tint disabled:opacity-40 transition-colors"
                                                            title="Save">
                                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                        </button>
                                                        <button onClick={cancelEdit} disabled={saving}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : isConfirming ? (
                                                    <>
                                                        <button onClick={() => handleDelete(item)} disabled={isDeleting}
                                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-danger bg-danger-tint border border-danger/20 rounded hover:bg-danger-tint disabled:opacity-40 transition-colors"
                                                            title="Confirm delete">
                                                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                            Delete
                                                        </button>
                                                        <button onClick={() => setConfirmId(null)} disabled={isDeleting}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setConfirmId(item.r_object_id)}
                                                            className="p-1 rounded text-danger hover:bg-danger-tint transition-colors"
                                                            title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
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

// ─── Document Type Tab ────────────────────────────────────────────────────────
const DocumentTypeTab = ({ onToast }) => {
    const EMPTY_FORM = { document_type: '', document_category: '', serial_number: '' };
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [existingTypes, setExistingTypes] = useState([]);

    // Load existing document types for duplicate checking
    useEffect(() => {
        const fetchExisting = async () => {
            try {
                const res = await api.get('/sfs/document-types');
                setExistingTypes(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Failed to load existing types:', err);
            }
        };
        fetchExisting();
    }, [refreshKey]);

    const set = (field, val) => {
        setForm(f => ({ ...f, [field]: val }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.document_type.trim()) e.document_type = 'Document Type is required';
        if (!form.document_category.trim()) e.document_category = 'Document Category is required';
        if (!form.serial_number.trim()) e.serial_number = 'Serial Number is required';

        // Check for duplicate document type (case-insensitive)
        if (form.document_type.trim()) {
            const isDuplicate = existingTypes.some(item =>
                item.document_type &&
                item.document_type.toLowerCase() === form.document_type.trim().toLowerCase()
            );
            if (isDuplicate) {
                e.document_type = `Document Type "${form.document_type.trim()}" already exists`;
            }
        }

        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/sfs/document-types', {
                document_type: form.document_type.trim(),
                document_category: form.document_category.trim(),
                serial_number: form.serial_number.trim(),
            });
            onToast({ type: 'success', message: res.data?.message || 'Document type created successfully' });
            setForm(EMPTY_FORM);
            setErrors({});
            setRefreshKey(k => k + 1);
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* Left: creation form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm shrink-0">
                        <FileText size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create Document Type</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_sfs_metadata</code> under /SFS Config/Document Type
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Document Type */}
                    <div>
                        <FieldLabel label="Document Type" required />
                        <input type="text" value={form.document_type}
                            onChange={e => set('document_type', e.target.value)}
                            placeholder="e.g. DocType1"
                            className={inputCls(errors.document_type)} />
                        <FieldError msg={errors.document_type} />
                    </div>

                    {/* Document Category */}
                    <div>
                        <FieldLabel label="Document Category" required />
                        <input type="text" value={form.document_category}
                            onChange={e => set('document_category', e.target.value)}
                            placeholder="e.g. DocCatg1"
                            className={inputCls(errors.document_category)} />
                        <FieldError msg={errors.document_category} />
                    </div>

                    {/* Serial Number */}
                    <div>
                        <FieldLabel label="Serial Number" required />
                        <input type="text" value={form.serial_number}
                            onChange={e => set('serial_number', e.target.value)}
                            placeholder="e.g. 001A"
                            className={inputCls(errors.serial_number)} />
                        <FieldError msg={errors.serial_number} />
                    </div>

                    {/* DQL preview */}
                    {form.document_type && form.document_category && form.serial_number && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 space-y-0.5">
                            <p className="font-sans text-slate-400 font-semibold mb-1">DQL Preview</p>
                            <p>create cms_sfs_metadata object</p>
                            <p>&nbsp;&nbsp;set document_type='{form.document_type.trim()}'</p>
                            <p>&nbsp;&nbsp;set document_category='{form.document_category.trim()}'</p>
                            <p>&nbsp;&nbsp;set serial_number='{form.serial_number.trim()}'</p>
                            <p>&nbsp;&nbsp;link '/SFS Config/Document Type';</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button type="button"
                            onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-colors disabled:opacity-40">
                            Reset
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-canopy hover:bg-canopy-dark disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Right: existing list */}
            <DocumentTypeList refreshKey={refreshKey} onToast={onToast} />
        </div>
    );
};

// ─── Existing Document Categories List ────────────────────────────────────────
const DocumentCategoryList = ({ refreshKey, onToast }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ document_type: '', document_category: '', serial_number: '' });
    const [saving, setSaving] = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/sfs/document-categories');
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const startEdit = (item) => {
        setEditingId(item.r_object_id);
        setEditValues({
            document_type: item.document_type || '',
            document_category: item.document_category || '',
            serial_number: item.serial_number || ''
        });
        setConfirmId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({ document_type: '', document_category: '', serial_number: '' });
    };

    const handleSave = async (item) => {
        setSaving(true);
        try {
            await api.put(`/sfs/document-categories/${item.r_object_id}`, {
                document_type: editValues.document_type.trim(),
                document_category: editValues.document_category.trim(),
                serial_number: editValues.serial_number.trim(),
            });
            onToast({ type: 'success', message: 'Document category updated.' });
            setItems(prev => prev.map(i => i.r_object_id === item.r_object_id
                ? { ...i, ...editValues }
                : i));
            cancelEdit();
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/sfs/document-categories/${item.r_object_id}`);
            onToast({ type: 'success', message: 'Document category deleted.' });
            setItems(items.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Existing Document Categories</span>
                    {!loading && (
                        <span className="px-2 py-0.5 bg-canopy-tint text-canopy text-xs font-semibold rounded-full">
                            {items.length}
                        </span>
                    )}
                </div>
                <button onClick={loadList} disabled={loading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin text-canopy" />
                    <span className="text-sm">Loading…</span>
                </div>
            ) : error ? (
                <div className="px-5 py-4 text-sm text-danger flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            ) : items.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                    No document categories found
                </div>
            ) : (
                <div className="overflow-auto scrollbar-thin max-h-[70vh]">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Type</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Category</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Serial Number</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const isConfirming = confirmId === item.r_object_id;
                                const isDeleting = deleting === item.r_object_id;
                                const isEditing = editingId === item.r_object_id;
                                const rowBg = isEditing ? 'bg-canopy-tint' : isConfirming ? 'bg-canopy-tint' : 'hover:bg-canopy-tint/30';
                                return (
                                    <tr key={item.r_object_id || idx} className={`transition-colors ${rowBg}`}>
                                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <CustomSelect
                                                    value={editValues.document_type}
                                                    onChange={val => setEditValues(v => ({ ...v, document_type: val }))}
                                                    placeholder="— Select —"
                                                    options={[]}
                                                />
                                            ) : (item.document_type || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.document_category}
                                                    onChange={e => setEditValues(v => ({ ...v, document_category: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-canopy/40 rounded text-sm focus:outline-none focus:ring-1 focus:ring-canopy/70 bg-white" />
                                            ) : (item.document_category || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.serial_number}
                                                    onChange={e => setEditValues(v => ({ ...v, serial_number: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-canopy/40 rounded text-sm focus:outline-none focus:ring-1 focus:ring-canopy/70 bg-white" />
                                            ) : (item.serial_number || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSave(item)} disabled={saving}
                                                            className="p-1 rounded text-canopy hover:bg-canopy-tint disabled:opacity-40 transition-colors"
                                                            title="Save">
                                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                        </button>
                                                        <button onClick={cancelEdit} disabled={saving}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : isConfirming ? (
                                                    <>
                                                        <button onClick={() => handleDelete(item)} disabled={isDeleting}
                                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-danger bg-danger-tint border border-danger/20 rounded hover:bg-danger-tint disabled:opacity-40 transition-colors"
                                                            title="Confirm delete">
                                                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                            Delete
                                                        </button>
                                                        <button onClick={() => setConfirmId(null)} disabled={isDeleting}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setConfirmId(item.r_object_id)}
                                                            className="p-1 rounded text-danger hover:bg-danger-tint transition-colors"
                                                            title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
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

// ─── Document Category Tab ────────────────────────────────────────────────────
const DocumentCategoryTab = ({ onToast }) => {
    const EMPTY_FORM = { document_type: '', document_category: '', serial_number: '' };
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [documentTypes, setDocumentTypes] = useState([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [existingCategories, setExistingCategories] = useState([]);

    // Fetch document types for dropdown and existing categories for duplicate checking
    useEffect(() => {
        setLoadingTypes(true);
        Promise.all([
            api.get('/sfs/document-types'),
            api.get('/sfs/document-categories')
        ])
            .then(([typesRes, catRes]) => {
                setDocumentTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
                setExistingCategories(Array.isArray(catRes.data) ? catRes.data : []);
            })
            .catch(() => {
                setDocumentTypes([]);
                setExistingCategories([]);
            })
            .finally(() => setLoadingTypes(false));
    }, [refreshKey]);

    const set = (field, val) => {
        setForm(f => ({ ...f, [field]: val }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.document_type.trim()) e.document_type = 'Document Type is required';
        if (!form.document_category.trim()) e.document_category = 'Document Category is required';
        if (!form.serial_number.trim()) e.serial_number = 'Serial Number is required';

        // Check for duplicate document category under the same document type
        if (form.document_type.trim() && form.document_category.trim()) {
            const isDuplicate = existingCategories.some(item =>
                item.document_type &&
                item.document_category &&
                item.document_type.toLowerCase() === form.document_type.trim().toLowerCase() &&
                item.document_category.toLowerCase() === form.document_category.trim().toLowerCase()
            );
            if (isDuplicate) {
                e.document_category = `Category "${form.document_category.trim()}" already exists for this Document Type`;
            }
        }

        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/sfs/document-categories', {
                document_type: form.document_type.trim(),
                document_category: form.document_category.trim(),
                serial_number: form.serial_number.trim(),
            });
            onToast({ type: 'success', message: res.data?.message || 'Document category created successfully' });
            setForm(EMPTY_FORM);
            setErrors({});
            setRefreshKey(k => k + 1);
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* Left: creation form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-canopy-tint to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-canopy flex items-center justify-center shadow-sm shrink-0">
                        <FileText size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create Document Category</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_sfs_metadata</code> under /SFS Config/Document Type
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Document Type Dropdown */}
                    <div>
                        <FieldLabel label="Document Type" required />
                        <CustomSelect
                            value={form.document_type}
                            onChange={val => set('document_type', val)}
                            disabled={loadingTypes}
                            invalid={!!errors.document_type}
                            placeholder="— Select document type —"
                            options={documentTypes.map(dt => ({ value: dt.document_type, label: dt.document_type }))}
                        />
                        <FieldError msg={errors.document_type} />
                    </div>

                    {/* Document Category */}
                    <div>
                        <FieldLabel label="Document Category" required />
                        <input type="text" value={form.document_category}
                            onChange={e => set('document_category', e.target.value)}
                            placeholder="e.g. DocCatg1"
                            className={inputCls(errors.document_category)} />
                        <FieldError msg={errors.document_category} />
                    </div>

                    {/* Serial Number */}
                    <div>
                        <FieldLabel label="Serial Number" required />
                        <input type="text" value={form.serial_number}
                            onChange={e => set('serial_number', e.target.value)}
                            placeholder="e.g. 002A"
                            className={inputCls(errors.serial_number)} />
                        <FieldError msg={errors.serial_number} />
                    </div>

                    {/* DQL preview */}
                    {form.document_type && form.document_category && form.serial_number && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 space-y-0.5">
                            <p className="font-sans text-slate-400 font-semibold mb-1">DQL Preview</p>
                            <p>create cms_sfs_metadata object</p>
                            <p>&nbsp;&nbsp;set document_type='{form.document_type.trim()}'</p>
                            <p>&nbsp;&nbsp;set document_category='{form.document_category.trim()}'</p>
                            <p>&nbsp;&nbsp;set serial_number='{form.serial_number.trim()}'</p>
                            <p>&nbsp;&nbsp;link '/SFS Config/Document Type';</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button type="button"
                            onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-colors disabled:opacity-40">
                            Reset
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-canopy hover:bg-canopy-dark disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Right: existing list */}
            <DocumentCategoryList refreshKey={refreshKey} onToast={onToast} />
        </div>
    );
};

// ─── SFS User Access Tab ──────────────────────────────────────────────────────
const SFS_USER_ROLES = ['Digitization', 'Request Document', 'View SFS Document', 'View Download', 'Maker', 'Checker'];

const SfsUserAccessTab = ({ onToast }) => {
    const [officeType, setOfficeType] = useState('');
    const [location, setLocation] = useState('');
    const [role, setRole] = useState('');
    const [locations, setLocations] = useState([]);
    const [users, setUsers] = useState([]);
    const [displayedUsers, setDisplayedUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [addingUser, setAddingUser] = useState(null);
    const [userMembership, setUserMembership] = useState({});

    // Helper function to get shortCode from location
    const getLocationShortCode = (loc) => {
        if (!loc) return undefined;
        const locObj = locations.find(l => (typeof l === 'string' ? l : l.location) === loc);
        if (locObj && typeof locObj === 'object') {
            return locObj.shortCode;
        }
        return undefined;
    };

    // Get user profile for access control
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';
    const isSuperAdmin = adminRole === 'Super Admin';
    const isLocalAdmin = adminRole === 'Local Admin';

    // Access control: only Super Admin and Local Admin can access
    const hasAccess = isSuperAdmin || isLocalAdmin;

    // Fetch profile context for Local Admin
    const [profileCtx, setProfileCtx] = useState(null);

    useEffect(() => {
        if (!isLocalAdmin || !loginUsername) return;

        api.get('/users/profile-context', { params: { username: loginUsername } })
            .then(res => {
                const ctx = res.data || {};
                setProfileCtx(ctx);
                // Auto-select office type and location
                if (ctx.office_type && !officeType) {
                    setOfficeType(ctx.office_type);
                }
                if (ctx.location && !location) {
                    setLocation(ctx.location);
                }
            })
            .catch(err => console.error('[SFS] Failed to fetch profile context:', err));
    }, [isLocalAdmin, loginUsername, officeType, location]);

    // Update locations when office type changes
    useEffect(() => {
        const locs = getLocations(officeType);
        setLocations(locs || []);
    }, [officeType]);

    // Auto-fetch users for Local Admin when office type and location are populated
    useEffect(() => {
        if (isLocalAdmin && officeType && location && !users.length) {
            fetchUsersByOffice(officeType, location, role);
        }
    }, [isLocalAdmin, officeType, location]);

    // Check membership for a user in a specific role
    const checkUserMembership = async (userName, role, office, loc) => {
        try {
            const params = {
                userName,
                role,
                officeType: office,
                department: 'HRMD'
            };
            if (loc) {
                params.location = loc;
                // Pass locationShortCode for Maker/Checker roles
                const shortCode = getLocationShortCode(loc);
                if (shortCode) {
                    params.locationShortCode = shortCode;
                }
            }
            const res = await api.get('/sfs/user-access/check-membership', { params });
            return res.data?.isMember || false;
        } catch (err) {
            console.error('[SFS] Error checking membership:', err);
            return false;
        }
    };

    // Check membership for a single user in all roles (lazy loading)
    const checkUserAllRoles = async (userName, office, loc) => {
        const membership = {};
        for (const role of SFS_USER_ROLES) {
            membership[role] = await checkUserMembership(userName, role, office, loc);
        }
        setUserMembership(prev => ({
            ...prev,
            [userName]: membership
        }));
        return membership;
    };

    // Fetch users when office type or location changes
    const fetchUsersByOffice = async (office, loc = '', selectedRole = '') => {
        setUsers([]);
        setDisplayedUsers([]);
        setSearchQuery('');
        setUserMembership({});

        if (!office) return;

        setLoading(true);
        try {
            const params = {
                officeType: office,
                department: 'HRMD',
                location: loc || undefined,
                role: selectedRole || undefined
            };

            // Add locationShortCode for Maker/Checker roles
            if (loc && (selectedRole === 'Maker' || selectedRole === 'Checker')) {
                const shortCode = getLocationShortCode(loc);
                if (shortCode) {
                    params.locationShortCode = shortCode;
                }
            }

            const res = await api.get('/sfs/user-access/users', {
                params
            });
            const fetchedUsers = Array.isArray(res.data) ? res.data : [];
            setUsers(fetchedUsers);
            setDisplayedUsers(fetchedUsers);

            // Pre-load membership for first 10 users
            setTimeout(() => {
                for (let i = 0; i < Math.min(10, fetchedUsers.length); i++) {
                    checkUserAllRoles(fetchedUsers[i].user_name, office, loc);
                }
            }, 100);
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to fetch users';
            console.error('[SFS] Error fetching users:', errMsg);
            onToast({ type: 'error', message: errMsg });
            setUsers([]);
            setDisplayedUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Handle office type change
    const handleOfficeTypeChange = (value) => {
        setOfficeType(value);
        setLocation('');
        setRole('');
        setUsers([]);
        setDisplayedUsers([]);
        setUserMembership({});

        if (value === 'HO') {
            fetchUsersByOffice(value, '', '');
        } else if (value === 'RO' || value === 'TE') {
            // For RO/TE, wait for location selection
            // Grid will show "Select location" message
        }
    };

    // Handle location change
    const handleLocationChange = (value) => {
        setLocation(value);
        if (officeType && value) {
            fetchUsersByOffice(officeType, value, role);
        }
    };

    // Handle role change
    const handleRoleChange = (value) => {
        setRole(value);
        if (officeType) {
            fetchUsersByOffice(officeType, location, value);
        }
    };

    // Handle search
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setDisplayedUsers(users);
        } else {
            const filtered = users.filter(user =>
                (user.user_name || '').toLowerCase().includes(query.toLowerCase()) ||
                (user.user_login_name || '').toLowerCase().includes(query.toLowerCase())
            );
            setDisplayedUsers(filtered);
        }
    };

    const handleAddUserToGroup = async (userName, selectedRole) => {
        const key = `${userName}-${selectedRole}`;
        setAddingUser(key);
        try {
            // Find the location object to get shortCode
            let locationShortCode = undefined;
            if (location) {
                const locObj = locations.find(l => (typeof l === 'string' ? l : l.location) === location);
                if (locObj && typeof locObj === 'object') {
                    locationShortCode = locObj.shortCode;
                }
            }

            const payload = {
                userName,
                role: selectedRole,
                officeType,
                department: 'HRMD',
                location: location || undefined,
                locationShortCode: locationShortCode
            };
            const res = await api.post('/sfs/user-access/add-to-group', payload);
            onToast({ type: 'success', message: res.data?.message || 'User added successfully' });

            // Update membership state to reflect the change immediately
            setUserMembership(prev => ({
                ...prev,
                [userName]: {
                    ...prev[userName],
                    [selectedRole]: !prev[userName]?.[selectedRole]
                }
            }));
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || 'Failed to add user' });
        } finally {
            setAddingUser(null);
        }
    };

    // Access denied check
    if (!hasAccess) {
        return (
            <div className="bg-danger-tint border border-danger/20 rounded-2xl p-8 text-center">
                <AlertCircle size={32} className="text-danger mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-danger mb-2">Access Denied</h3>
                <p className="text-danger">You don't have permission to access SFS User Access. Only Super Admin and Local Admin users can access this feature.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Office Type */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Office Type {isLocalAdmin && '(Locked)'}</label>
                            <CustomSelect
                                value={officeType}
                                onChange={handleOfficeTypeChange}
                                disabled={isLocalAdmin}
                                placeholder="— Select —"
                                options={[
                                    { value: 'HO', label: 'HO — Head Office' },
                                    { value: 'RO', label: 'RO — Regional Office' },
                                    { value: 'TE', label: 'TE — Training Establishment' },
                                ]}
                            />
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Location {isLocalAdmin && '(Locked)'}</label>
                            <CustomSelect
                                value={location}
                                onChange={handleLocationChange}
                                disabled={officeType === 'HO' || !officeType || isLocalAdmin}
                                placeholder="— Select —"
                                options={locations.map(loc => {
                                    const locStr = typeof loc === 'string' ? loc : loc.location;
                                    return { value: locStr, label: locStr };
                                })}
                            />
                        </div>

                        {/* Department */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Department</label>
                            <div className="relative">
                                <select disabled className={selectCls(false, true)}>
                                    <option>HRMD</option>
                                </select>
                                <ChevronDown disabled />
                            </div>
                        </div>

                        {/* Role */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Role</label>
                            <CustomSelect
                                value={role}
                                onChange={handleRoleChange}
                                disabled={!officeType}
                                placeholder="— All Roles —"
                                options={SFS_USER_ROLES.map(r => ({ value: r, label: r }))}
                            />
                        </div>
                    </div>

                    {/* Search Box */}
                    {officeType && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Search</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by name, login, designation..."
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy"
                                />
                            </div>
                            {displayedUsers.length > 0 && (
                                <div className="text-xs text-slate-500 mt-2">{displayedUsers.length} users</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {!officeType ? (
                    <div className="px-6 py-8 text-center text-sm text-slate-400">
                        Select office type to view users
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                        <Loader2 size={18} className="animate-spin text-canopy" />
                        <span className="text-sm">Loading…</span>
                    </div>
                ) : displayedUsers.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-slate-400">
                        {searchQuery ? 'No users match your search' : 'No users found'}
                    </div>
                ) : (
                    <div className="overflow-auto scrollbar-thin max-h-[70vh]">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">#</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Login</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">UIN</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">SFS Roles</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayedUsers.map((user, idx) => {
                                    const userMem = userMembership[user.user_name];
                                    const assignedRoles = userMem ? SFS_USER_ROLES.filter(r => userMem[r]) : [];

                                    return (
                                        <tr key={user.r_object_id || idx} className="hover:bg-canopy-tint/30">
                                            <td className="px-6 py-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                            <td className="px-6 py-3 text-slate-900 font-medium">{user.user_name || '—'}</td>
                                            <td className="px-6 py-3 text-slate-600 text-sm">{user.user_login_name || '—'}</td>
                                            <td className="px-6 py-3 text-slate-600 font-mono text-xs">{user.uin || '—'}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {userMem ? (
                                                        assignedRoles.length > 0 ? (
                                                            assignedRoles.map(r => (
                                                                <span key={r} className="px-2 py-1 bg-canopy-tint text-canopy text-xs font-medium rounded">
                                                                    {r.substring(0, 15)}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">—</span>
                                                        )
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">…</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <>
                                                    {!userMem ? (
                                                        <span className="text-slate-300 text-xs">Loading…</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2 justify-center">
                                                        {SFS_USER_ROLES.map(r => {
                                                            const isMember = userMem[r];
                                                            return (
                                                                <button key={r} onClick={() => handleAddUserToGroup(user.user_name, r)}
                                                                    disabled={addingUser === `${user.user_name}-${r}`}
                                                                    className={`px-3 py-1.5 text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1 ${
                                                                        isMember
                                                                            ? 'bg-danger hover:bg-danger'
                                                                            : 'bg-canopy hover:bg-canopy-dark'
                                                                    } disabled:opacity-60`}>
                                                                    {addingUser === `${user.user_name}-${r}` ? (
                                                                        <Loader2 size={11} className="animate-spin" />
                                                                    ) : (
                                                                        isMember ? `Remove ${r.substring(0, 12)}` : `Mark to ${r.substring(0, 12)}`
                                                                    )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                    )}
                                                </>
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

// ─── Top-level SFS page ───────────────────────────────────────────────────────
const SFS_TABS = [
    { id: 'document_type', label: 'Document Type' },
    { id: 'document_category', label: 'Document Category' },
    { id: 'user_access', label: 'User Access' },
];

const SfsPage = () => {
    const [activeTab, setActiveTab] = useState('document_type');
    const toast = useToast();

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader
                title="SFS Configuration"
                icon={FileText}
                description="Manage SFS metadata objects."
            />
            <Tabs tabs={SFS_TABS} value={activeTab} onChange={setActiveTab} className="mb-5" />

            <div className="flex-1">
                {activeTab === 'document_type' && <DocumentTypeTab onToast={toast.show} />}
                {activeTab === 'document_category' && <DocumentCategoryTab onToast={toast.show} />}
                {activeTab === 'user_access' && <SfsUserAccessTab onToast={toast.show} />}
            </div>
        </div>
    );
};

export default SfsPage;
