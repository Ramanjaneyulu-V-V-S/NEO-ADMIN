import { useState } from 'react';
import api from '../api/axios';
import { UploadCloud, Info, CheckCircle2, AlertCircle, X, FileText, CalendarRange } from 'lucide-react';
import { PageHeader, Card, Field, Input, Button, Modal, Tabs, useToast } from '../components/ui';
import IvBulkRepublish from '../components/IvBulkRepublish';

export default function IvRepublishPage() {
    const [activeTab, setActiveTab] = useState('single');
    const [docId, setDocId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [result, setResult] = useState(null);
    const toast = useToast();

    const isFormValid = docId.trim().length > 0;

    const handleSubmit = async () => {
        if (!isFormValid || submitting) return;
        setConfirmOpen(false);
        setSubmitting(true);
        setResult(null);
        try {
            const { data } = await api.post('/iv/publish', { docId: docId.trim() });
            setResult({ ...data, docId: docId.trim() });
            if (data.success) {
                toast.success(
                    data.publicationId
                        ? `Republish triggered — publication ID ${data.publicationId}`
                        : 'Republish triggered successfully.'
                );
                setDocId('');
            } else {
                toast.error(data.error || 'Failed to republish document.');
            }
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to republish document.';
            setResult({ success: false, error: message, docId: docId.trim() });
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader
                title="IV Republish"
                icon={UploadCloud}
                description="Manually republish a document's content to the IV viewer pipeline."
            />

            <Tabs
                value={activeTab}
                onChange={setActiveTab}
                tabs={[
                    { id: 'single', label: 'Single document', icon: FileText },
                    { id: 'bulk', label: 'Bulk by date', icon: CalendarRange },
                ]}
            />

            {activeTab === 'bulk' && <IvBulkRepublish />}

            {activeTab === 'single' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="space-y-5 lg:col-span-2">
                    <Field label="Document ID" help="The r_object_id of the document to republish">
                        <Input
                            type="text"
                            value={docId}
                            onChange={(e) => setDocId(e.target.value)}
                            placeholder="e.g. 0902cba081081c70"
                            onKeyDown={(e) => e.key === 'Enter' && isFormValid && setConfirmOpen(true)}
                        />
                    </Field>

                    <Button
                        onClick={() => setConfirmOpen(true)}
                        disabled={!isFormValid}
                        loading={submitting}
                        className="w-full justify-center"
                    >
                        {submitting ? 'Republishing…' : 'Republish to IV'}
                    </Button>

                    {result && (
                        <div className={`rounded-card border p-4 ${result.success ? 'border-canopy/20 bg-canopy-tint' : 'border-danger/20 bg-danger-tint'}`}>
                            <div className="flex items-start gap-2">
                                {result.success
                                    ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-canopy" />
                                    : <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />}
                                <div className="min-w-0 flex-1">
                                    <p className={`text-body font-semibold ${result.success ? 'text-canopy-dark' : 'text-danger'}`}>
                                        {result.success ? 'Republish Triggered' : 'Republish Failed'}
                                    </p>
                                    <p className="mt-0.5 break-all font-mono text-caption text-slate-500">{result.docId}</p>
                                    {result.success ? (
                                        result.publicationId && (
                                            <p className="mt-1 text-caption text-canopy">Publication ID: {result.publicationId}</p>
                                        )
                                    ) : (
                                        <p className="mt-1 text-caption text-danger">{result.error}</p>
                                    )}
                                </div>
                                <button onClick={() => setResult(null)} className="ml-auto shrink-0 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-700">
                        <Info size={16} className="text-canopy" />
                        <h3 className="text-body font-semibold">About this tool</h3>
                    </div>
                    <p className="text-caption text-slate-500">
                        Pushes a document's current content to the IV viewer pipeline, so the preview shown to end
                        users reflects its latest version.
                    </p>
                    <ol className="space-y-2 text-caption text-slate-500">
                        <li className="flex gap-2">
                            <span className="font-mono text-slate-400">1.</span>
                            Paste the document&apos;s <code className="rounded bg-paper px-1 py-0.5 font-mono text-slate-600">r_object_id</code>.
                        </li>
                        <li className="flex gap-2">
                            <span className="font-mono text-slate-400">2.</span>
                            Confirm — this calls the IV publish service directly.
                        </li>
                        <li className="flex gap-2">
                            <span className="font-mono text-slate-400">3.</span>
                            A publication ID confirms the request was accepted.
                        </li>
                    </ol>
                    <p className="border-t border-line pt-3 text-caption text-slate-400">
                        Republishing a case&apos;s notesheet? Use the republish icon on the Cases page instead — it
                        resolves the document ID for you automatically.
                    </p>
                </Card>
            </div>
            )}

            {confirmOpen && (
                <Modal
                    isOpen
                    onClose={() => setConfirmOpen(false)}
                    size="sm"
                    title={
                        <span className="flex items-center gap-2">
                            <UploadCloud size={18} className="text-slate-500" />
                            Republish to IV
                        </span>
                    }
                    footer={
                        <>
                            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                            <Button variant="primary" size="sm" onClick={handleSubmit}>Republish</Button>
                        </>
                    }
                >
                    <p className="text-sm text-slate-600">
                        Republish document <span className="font-mono font-medium text-slate-900">{docId.trim()}</span> to the IV viewer pipeline?
                    </p>
                </Modal>
            )}
        </div>
    );
}
