import { useState, useEffect } from 'react';
import { ClipboardList, FileText } from 'lucide-react';
import api from '../api/axios';
import { Modal, DataTable, Badge } from './ui';
import { formatDateTime } from '../utils/datetime';

// Case rows reach these modals in two shapes: flat (`object_name`, from
// /delegate and /reports) and task-prefixed (`packagescase_folderobject_name`,
// from the inbox listing). `f` reads whichever is present.
const f = (c, field) => c?.[`packagescase_folder${field}`] || c?.[field] || '';
const caseIdOf = (c) => c?.packagescase_folderid || c?.r_object_id || c?.objectId || c?.id || '';

// Truncating cell with the full value on hover; cards get their own truncation.
const Cell = ({ value }) => {
    const v = value ?? '';
    return (
        <span className="block max-w-xs truncate" title={String(v)}>
            {v === '' ? '—' : v}
        </span>
    );
};

const DetailRow = ({ label, value }) => (
    <div className="flex min-w-0 gap-2">
        <dt className="w-32 shrink-0 text-caption font-medium text-slate-500">{label}</dt>
        <dd className="min-w-0 break-words text-caption text-ink">{value || '—'}</dd>
    </div>
);

// ─── Case Details Modal ───────────────────────────────────────────────────────
export const CaseDetailsModal = ({ caseItem, onClose }) => {
    if (!caseItem) return null;
    const rows = [
        ['Case Number',    f(caseItem, 'object_name')],
        ['Subject',        f(caseItem, 'description')],
        ['Department',     f(caseItem, 'department_name')],
        ['Vertical',       f(caseItem, 'functions')],
        ['Office Type',    f(caseItem, 'ho_ro')],
        ['Case Priority',  f(caseItem, 'task_priority')],
        ['Case Status',    f(caseItem, 'status')],
        ['Nature of Case', f(caseItem, 'case_nature')],
        ['Disposal Level', f(caseItem, 'disposal_level')],
        ['File No',        f(caseItem, 'file_number')],
        ['Case Type',      f(caseItem, 'types')],
        ['Created By',     f(caseItem, 'r_creator_name')],
        ['Created Date',   formatDateTime(f(caseItem, 'r_creation_date'))],
        ['Language',       f(caseItem, 'language_type')],
        ['Task',           caseItem.packagesworkflow_paramtask_name],
        ['Performer',      caseItem.task_performer_name],
        ['Object ID',      caseItem.r_object_id || caseIdOf(caseItem)],
    ].filter(([label, v]) => v || !['Task', 'Performer'].includes(label));

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="2xl"
            title={
                <span className="flex items-center gap-2">
                    <FileText size={16} className="text-canopy" />
                    Case Details
                </span>
            }
        >
            <p className="mb-3 font-mono text-caption text-slate-500">{f(caseItem, 'object_name')}</p>
            <dl className="grid grid-cols-1 gap-3 rounded-card border border-line bg-paper/60 p-4 sm:grid-cols-2">
                {rows.map(([label, v]) => <DetailRow key={label} label={label} value={v} />)}
            </dl>
        </Modal>
    );
};

// ─── Movement Register Modal ──────────────────────────────────────────────────
const dateCol = (key, header) => ({
    key, header, mono: true, render: (r) => formatDateTime(r[key]),
});
const textCol = (key, header, extra = {}) => ({
    key, header, render: (r) => <Cell value={r[key]} />, ...extra,
});

const MOVEMENT_COLUMNS = [
    { key: 'idx', header: '#', mono: true, width: 'w-12', card: 'hide', render: (_r, i) => i + 1 },
    textCol('object_name',   'Object Name', { primary: true }),
    textCol('performer',     'Performer'),
    textCol('decision',      'Decision'),
    textCol('assigned_user', 'Assigned User'),
    dateCol('completion_date', 'Completed'),
    dateCol('r_creation_date', 'Created'),
    dateCol('r_modify_date',   'Modified'),
    textCol('acl_domain',    'Acl Domain'),
    textCol('acl_name',      'Acl Name'),
    textCol('owner_name',    'Owner Name'),
];

export const MovementRegisterModal = ({ caseItem, onClose }) => {
    const [movement, setMovement] = useState([]);
    const [loading, setLoading]   = useState(true);
    const caseId = caseIdOf(caseItem);

    useEffect(() => {
        if (!caseId) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        api.get(`/delegate/cases/${caseId}/movement`, { params: { isValidEntry: true } })
            .then(res => { if (!cancelled) setMovement(Array.isArray(res.data) ? res.data : []); })
            .catch(() => { if (!cancelled) setMovement([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (!caseItem) return null;

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="3xl"
            title={
                <span className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-canopy" />
                    Movement Register
                </span>
            }
        >
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-caption text-slate-500">{f(caseItem, 'object_name')}</span>
                {!loading && <Badge tone="canopy">{movement.length}</Badge>}
            </div>
            <DataTable
                columns={MOVEMENT_COLUMNS}
                rows={movement}
                rowKey={(r, i) => r.r_object_id || i}
                loading={loading}
                skeletonRows={4}
                stickyHeader
                maxHeight="55vh"
                empty={{
                    icon: ClipboardList,
                    title: 'No movement records',
                    description: 'No movement register entries were found for this case.',
                }}
                className="md:rounded-card md:border md:border-line"
            />
        </Modal>
    );
};
