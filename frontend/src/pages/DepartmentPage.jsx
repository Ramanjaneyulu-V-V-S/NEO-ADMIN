import { useState } from 'react';
import api from '../api/axios';
import { Building2, CheckCircle2, AlertCircle, X, MapPin } from 'lucide-react';
import { RO_LOCATIONS, TE_LOCATIONS, invalidateDeptCache } from '../data/nabardMetadata.js';
import { PageHeader, Card, Field, Input, Button } from '../components/ui';
import CustomSelect from '../components/ui/CustomSelect.jsx';

const OFFICE_TYPES = [
    { value: 'HO', label: 'HO - Head Office' },
    { value: 'RO', label: 'RO - Regional Office' },
    { value: 'TE', label: 'TE - Training Establishment' },
];

export default function DepartmentPage() {
    const [officeType, setOfficeType] = useState('');
    const [departmentName, setDepartmentName] = useState('');
    const [dmdSelection, setDmdSelection] = useState('');
    const [location, setLocation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const shortCode = departmentName.toLowerCase();

    const locationOptions = officeType === 'RO'
        ? RO_LOCATIONS.map(l => ({ value: l.location, label: `${l.location} (${l.shortCode})` }))
        : officeType === 'TE'
            ? TE_LOCATIONS.map(l => ({ value: l.location, label: `${l.location} (${l.shortCode})` }))
            : [];

    const selectedLocationObj = officeType === 'RO'
        ? RO_LOCATIONS.find(l => l.location === location)
        : officeType === 'TE'
            ? TE_LOCATIONS.find(l => l.location === location)
            : null;

    const isFormValid = officeType
        && departmentName.length > 0
        && (officeType === 'HO' ? dmdSelection !== '' : location !== '');

    const handleDeptNameChange = (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        if (val.length <= 8) setDepartmentName(val);
    };

    const handleOfficeTypeChange = (val) => {
        setOfficeType(val);
        setDmdSelection('');
        setLocation('');
        setResult(null);
    };

    const handleSubmit = async () => {
        if (!isFormValid || submitting) return;
        setSubmitting(true);
        setResult(null);

        const payload = {
            officeType,
            departmentName,
            departmentShortCode: shortCode,
            dmdSelection: officeType === 'HO' ? dmdSelection : null,
            locationShortCode: selectedLocationObj?.shortCode || null,
            locationName: location || null,
        };

        try {
            const { data } = await api.post('/departments', payload);
            setResult(data);
            if (data.success) {
                invalidateDeptCache(officeType, location || undefined);
                setDepartmentName('');
                setDmdSelection('');
                setLocation('');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setResult({ success: false, message: msg, steps: [] });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader
                title="Department Creation"
                icon={Building2}
                description="Create a new department with associated groups and metadata in Documentum."
            />

            <Card className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Office Type">
                    <CustomSelect
                        value={officeType}
                        onChange={handleOfficeTypeChange}
                        placeholder="Select office type"
                        options={OFFICE_TYPES}
                    />
                </Field>

                {(officeType === 'RO' || officeType === 'TE') && (
                    <Field
                        label={
                            <span className="inline-flex items-center gap-1.5">
                                <MapPin size={11} />
                                {officeType === 'RO' ? 'Regional Office Location' : 'Training Establishment Location'}
                            </span>
                        }
                    >
                        <CustomSelect
                            value={location}
                            onChange={setLocation}
                            placeholder="Select location"
                            options={locationOptions}
                        />
                    </Field>
                )}

                <Field label="Department Name" help={`${departmentName.length}/8 characters`}>
                    <Input
                        type="text"
                        value={departmentName}
                        onChange={handleDeptNameChange}
                        maxLength={8}
                        placeholder="e.g. FSPD (max 8 characters, uppercase only)"
                    />
                </Field>

                {departmentName && (
                    <Field label="Department Short Code" help="Auto-generated from department name">
                        <Input type="text" value={shortCode} readOnly className="bg-paper text-slate-600" />
                    </Field>
                )}

                {officeType === 'HO' && departmentName && (
                    <Field label={`${departmentName} belongs to DMD S1 or DMD S2?`} className="md:col-span-2 lg:col-span-3">
                        <div className="flex flex-wrap gap-3">
                            {['DMDS1', 'DMDS2'].map(opt => (
                                <label
                                    key={opt}
                                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-5 py-3 text-body font-medium transition-colors
                                        ${dmdSelection === opt
                                            ? 'border-canopy bg-canopy-tint text-canopy'
                                            : 'border-line bg-surface text-slate-600 hover:border-slate-300'}`}
                                >
                                    <input
                                        type="radio"
                                        name="dmdSelection"
                                        value={opt}
                                        checked={dmdSelection === opt}
                                        onChange={() => setDmdSelection(opt)}
                                        className="accent-canopy"
                                    />
                                    {opt === 'DMDS1' ? 'DMD S1' : 'DMD S2'}
                                </label>
                            ))}
                        </div>
                    </Field>
                )}
                </div>

                <Button
                    onClick={handleSubmit}
                    disabled={!isFormValid}
                    loading={submitting}
                    className="w-full justify-center"
                >
                    {submitting ? 'Creating Department…' : 'Create Department'}
                </Button>

                {result && (
                    <div className={`rounded-card border p-4 ${result.success ? 'border-canopy/20 bg-canopy-tint' : 'border-danger/20 bg-danger-tint'}`}>
                        <div className="mb-3 flex items-start gap-2">
                            {result.success
                                ? <CheckCircle2 size={18} className="mt-0.5 text-canopy" />
                                : <AlertCircle size={18} className="mt-0.5 text-danger" />}
                            <div>
                                <p className={`text-body font-semibold ${result.success ? 'text-canopy-dark' : 'text-danger'}`}>
                                    {result.success ? 'Department Created Successfully' : 'Department Creation Failed'}
                                </p>
                                <p className={`mt-0.5 text-caption ${result.success ? 'text-canopy' : 'text-danger'}`}>
                                    {result.message}
                                </p>
                            </div>
                            <button onClick={() => setResult(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        </div>

                        {result.steps && result.steps.length > 0 && (
                            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                                <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-slate-500">Steps</p>
                                {result.steps.map((step, i) => (
                                    <div key={i} className="flex items-start gap-2 text-caption">
                                        {step.success
                                            ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-canopy" />
                                            : <AlertCircle size={13} className="mt-0.5 shrink-0 text-danger" />}
                                        <div>
                                            <span className={step.success ? 'text-slate-700' : 'text-danger'}>
                                                {step.step}
                                            </span>
                                            {step.message && <span className="ml-1 text-slate-400">— {step.message}</span>}
                                            {step.error && <p className="mt-0.5 break-all text-danger">{step.error}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
