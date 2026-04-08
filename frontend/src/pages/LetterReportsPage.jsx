import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
    Mail, MailOpen, UserCheck, CheckCircle2, Clock, Filter, RefreshCw, Loader2,
    ChevronDown, ChevronUp, FileText, X, BarChart3
} from 'lucide-react';
import { Chart, ChartSeries, ChartSeriesItem, ChartCategoryAxis, ChartCategoryAxisItem,
    ChartLegend, ChartTooltip, ChartValueAxis, ChartValueAxisItem, ChartTitle } from '@progress/kendo-react-charts';
import 'hammerjs';

// ─── Constants ───────────────────────────────────────────────────────────────

const PALETTE = ['#0A66C2', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
    '#ec4899', '#f97316', '#6366f1', '#60a5fa', '#64748b', '#a855f7'];

const STATUS_COLORS = {
    'Unread': '#ef4444', 'Opened': '#3b82f6', 'Assigned': '#8b5cf6', 'Assigned Head': '#6366f1',
    'Closed': '#22c55e', 'Inprocess': '#f59e0b', 'Responded': '#14b8a6', 'Follow-Up': '#f97316',
    'Pushback': '#ec4899', 'Reassigned': '#a855f7', 'Reassign Head': '#64748b', 'Saved': '#94a3b8',
};

const OFFICE_TYPES = ['', 'HO', 'RO', 'TE'];
const DECISIONS = ['', 'Inward', 'Outward'];
const ENTRY_TYPES = ['', 'Internal', 'External'];
const SECRECY_LEVELS = ['', 'Regular', 'Confidential', 'Secret'];
const PRIORITIES = ['', 'Urgent', 'Normal', 'Low'];
const CATEGORIES = ['', 'Information', 'Actionable', 'FYI'];
const LANGUAGES = ['', 'English', 'Hindi', 'Regional'];
const NATURES = ['', 'Circular', 'Letter', 'Notice', 'Memo', 'DO Letter'];

// ─── KPI Card ────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, color, loading }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={20} className="text-white" />
        </div>
        <div>
            {loading ? (
                <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
                <div className="text-2xl font-bold text-slate-900">{value?.toLocaleString() ?? '—'}</div>
            )}
            <div className="text-xs font-medium text-slate-500">{label}</div>
        </div>
    </div>
);

// ─── Chart Card ──────────────────────────────────────────────────────────────

const ChartCard = ({ title, children, loading, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
        <h3 className="text-sm font-semibold text-slate-800 mb-4">{title}</h3>
        {loading ? (
            <div className="flex items-center justify-center h-56">
                <Loader2 size={28} className="animate-spin text-slate-300" />
            </div>
        ) : children}
    </div>
);

const EmptyChart = () => (
    <div className="flex items-center justify-center h-56 text-slate-400 text-sm">No data available</div>
);

// ─── Filter Select ───────────────────────────────────────────────────────────

const FilterSelect = ({ label, value, onChange, options }) => (
    <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] bg-white">
            {options.map(o => <option key={o} value={o}>{o || 'All'}</option>)}
        </select>
    </div>
);

const FilterInput = ({ label, value, onChange, type = 'text', placeholder }) => (
    <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2]" />
    </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

const LetterReportsPage = () => {
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [hasQueried, setHasQueried] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        loginOfficeType: '', decision: '', entryType: '', status: '',
        typeCategory: '', nature: '', secrecy: '', priority: '',
        languages: '', vertical: '', fileNumber: '', region: '',
        financialYear: '', fromDate: '', toDate: '',
    });

    // Data
    const [summary, setSummary] = useState(null);
    const [byStatus, setByStatus] = useState([]);
    const [byCategory, setByCategory] = useState([]);
    const [byNature, setByNature] = useState([]);
    const [bySecrecy, setBySecrecy] = useState([]);
    const [byPriority, setByPriority] = useState([]);
    const [byVertical, setByVertical] = useState([]);
    const [trend, setTrend] = useState([]);
    const [byDecision, setByDecision] = useState([]);
    const [byLanguage, setByLanguage] = useState([]);

    const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

    const cleanFilters = () => {
        const params = {};
        Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
        return params;
    };

    const fetchReport = useCallback(() => {
        setLoading(true);
        setHasQueried(true);
        const params = cleanFilters();

        Promise.all([
            api.get('/reports/digidak/summary', { params }).catch(() => ({ data: {} })),
            api.get('/reports/digidak/by-status', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-type-category', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-nature', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-secrecy', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-priority', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-vertical', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/trend', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-decision', { params }).catch(() => ({ data: [] })),
            api.get('/reports/digidak/by-language', { params }).catch(() => ({ data: [] })),
        ]).then(([sumR, stR, catR, natR, secR, priR, verR, trnR, decR, lngR]) => {
            setSummary(sumR.data);
            setByStatus(arr(stR.data));
            setByCategory(arr(catR.data));
            setByNature(arr(natR.data));
            setBySecrecy(arr(secR.data));
            setByPriority(arr(priR.data));
            setByVertical(arr(verR.data));
            setTrend(arr(trnR.data));
            setByDecision(arr(decR.data));
            setByLanguage(arr(lngR.data));
        }).finally(() => setLoading(false));
    }, [filters]);

    const resetFilters = () => {
        setFilters({
            loginOfficeType: '', decision: '', entryType: '', status: '',
            typeCategory: '', nature: '', secrecy: '', priority: '',
            languages: '', vertical: '', fileNumber: '', region: '',
            financialYear: '', fromDate: '', toDate: '',
        });
    };

    const activeFilterCount = Object.values(filters).filter(v => v).length;

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 size={22} className="text-[#0A66C2]" /> Letter Reports
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Digidak correspondence analytics — sent, received, unread, assigned</p>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <button onClick={() => setFiltersOpen(!filtersOpen)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-500" />
                        <span className="text-sm font-semibold text-slate-800">Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{activeFilterCount}</span>
                        )}
                    </div>
                    {filtersOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {filtersOpen && (
                    <div className="px-6 pb-5 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                            <FilterSelect label="Office Type" value={filters.loginOfficeType} onChange={v => setFilter('loginOfficeType', v)} options={OFFICE_TYPES} />
                            <FilterSelect label="Direction" value={filters.decision} onChange={v => setFilter('decision', v)} options={DECISIONS} />
                            <FilterSelect label="Entry Type" value={filters.entryType} onChange={v => setFilter('entryType', v)} options={ENTRY_TYPES} />
                            <FilterSelect label="Task Category" value={filters.typeCategory} onChange={v => setFilter('typeCategory', v)} options={CATEGORIES} />
                            <FilterSelect label="Nature" value={filters.nature} onChange={v => setFilter('nature', v)} options={NATURES} />
                            <FilterSelect label="Secrecy" value={filters.secrecy} onChange={v => setFilter('secrecy', v)} options={SECRECY_LEVELS} />
                            <FilterSelect label="Priority" value={filters.priority} onChange={v => setFilter('priority', v)} options={PRIORITIES} />
                            <FilterSelect label="Language" value={filters.languages} onChange={v => setFilter('languages', v)} options={LANGUAGES} />
                            <FilterInput label="Vertical / Dept" value={filters.vertical} onChange={v => setFilter('vertical', v)} placeholder="e.g. FSDD" />
                            <FilterInput label="File Number" value={filters.fileNumber} onChange={v => setFilter('fileNumber', v)} placeholder="e.g. SMF-10" />
                            <FilterInput label="Region" value={filters.region} onChange={v => setFilter('region', v)} placeholder="e.g. Maharashtra" />
                            <FilterInput label="Financial Year" value={filters.financialYear} onChange={v => setFilter('financialYear', v)} placeholder="e.g. 2025-2026" />
                            <FilterInput label="From Date" value={filters.fromDate} onChange={v => setFilter('fromDate', v)} type="date" />
                            <FilterInput label="To Date" value={filters.toDate} onChange={v => setFilter('toDate', v)} type="date" />
                        </div>
                        <div className="flex items-center gap-3 mt-5">
                            <button onClick={fetchReport} disabled={loading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] text-white rounded-xl text-sm font-semibold hover:bg-[#094d92] transition-colors disabled:opacity-50">
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                Generate Report
                            </button>
                            <button onClick={resetFilters}
                                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                <X size={14} /> Clear Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {!hasQueried ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <FileText size={48} strokeWidth={1} />
                    <p className="mt-3 text-sm">Apply filters and click <strong>Generate Report</strong> to view analytics</p>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                        <KpiCard icon={Mail} label="Total Letters" value={summary?.total} color="bg-[#0A66C2]" loading={loading} />
                        <KpiCard icon={Mail} label="Unread" value={summary?.unread} color="bg-red-500" loading={loading} />
                        <KpiCard icon={MailOpen} label="Opened" value={summary?.opened} color="bg-blue-500" loading={loading} />
                        <KpiCard icon={UserCheck} label="Assigned" value={summary?.assigned} color="bg-purple-500" loading={loading} />
                        <KpiCard icon={Clock} label="In Process" value={summary?.inprocess} color="bg-amber-500" loading={loading} />
                        <KpiCard icon={CheckCircle2} label="Closed" value={summary?.closed} color="bg-emerald-500" loading={loading} />
                    </div>

                    {/* Row 1: Status + Decision */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <ChartCard title="Letters by Status" loading={loading}>
                            {byStatus.length > 0 ? (
                                <Chart style={{ height: 320 }}>
                                    <ChartTooltip />
                                    <ChartLegend position="bottom" labels={{ font: '11px Inter' }} />
                                    <ChartSeries>
                                        <ChartSeriesItem type="donut" data={byStatus.map(d => ({
                                            category: d.category || 'Unknown', value: d.value,
                                            color: STATUS_COLORS[d.category] || '#64748b'
                                        }))} field="value" categoryField="category" colorField="color" holeSize={60} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>

                        <ChartCard title="Inward vs Outward" loading={loading}>
                            {byDecision.length > 0 ? (
                                <Chart style={{ height: 320 }}>
                                    <ChartTooltip />
                                    <ChartLegend position="bottom" labels={{ font: '12px Inter' }} />
                                    <ChartSeries>
                                        <ChartSeriesItem type="donut" data={byDecision.map((d, i) => ({
                                            category: d.category || 'Unknown', value: d.value,
                                            color: i === 0 ? '#0A66C2' : '#22c55e'
                                        }))} field="value" categoryField="category" colorField="color" holeSize={70} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>
                    </div>

                    {/* Row 2: Trend + Vertical */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <ChartCard title="Letter Volume Trend (Monthly)" loading={loading}>
                            {trend.length > 0 ? (
                                <Chart style={{ height: 280 }}>
                                    <ChartTooltip />
                                    <ChartCategoryAxis>
                                        <ChartCategoryAxisItem categories={trend.map(d => d.category)} labels={{ rotation: -45, font: '11px Inter' }} />
                                    </ChartCategoryAxis>
                                    <ChartValueAxis><ChartValueAxisItem labels={{ font: '11px Inter' }} /></ChartValueAxis>
                                    <ChartSeries>
                                        <ChartSeriesItem type="area" data={trend.map(d => d.value)} color="#0A66C2" line={{ style: 'smooth' }} opacity={0.3} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>

                        <ChartCard title="Letters by Vertical / Department (Top 20)" loading={loading}>
                            {byVertical.length > 0 ? (
                                <Chart style={{ height: 280 }}>
                                    <ChartTooltip />
                                    <ChartCategoryAxis>
                                        <ChartCategoryAxisItem categories={byVertical.map(d => d.category || 'Unknown')} labels={{ font: '10px Inter' }} />
                                    </ChartCategoryAxis>
                                    <ChartValueAxis><ChartValueAxisItem labels={{ font: '11px Inter' }} /></ChartValueAxis>
                                    <ChartSeries>
                                        <ChartSeriesItem type="bar" data={byVertical.map(d => d.value)} color="#0A66C2" gap={0.4} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>
                    </div>

                    {/* Row 3: Nature + Category + Priority */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <ChartCard title="By Nature of Correspondence" loading={loading}>
                            {byNature.length > 0 ? (
                                <Chart style={{ height: 260 }}>
                                    <ChartTooltip />
                                    <ChartLegend position="bottom" labels={{ font: '11px Inter' }} />
                                    <ChartSeries>
                                        <ChartSeriesItem type="donut" data={byNature.map((d, i) => ({
                                            category: d.category || 'Unknown', value: d.value,
                                            color: PALETTE[i % PALETTE.length]
                                        }))} field="value" categoryField="category" colorField="color" holeSize={50} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>

                        <ChartCard title="By Task Category" loading={loading}>
                            {byCategory.length > 0 ? (
                                <Chart style={{ height: 260 }}>
                                    <ChartTooltip />
                                    <ChartCategoryAxis>
                                        <ChartCategoryAxisItem categories={byCategory.map(d => d.category || 'Unknown')} labels={{ font: '11px Inter' }} />
                                    </ChartCategoryAxis>
                                    <ChartValueAxis><ChartValueAxisItem labels={{ font: '11px Inter' }} /></ChartValueAxis>
                                    <ChartSeries>
                                        <ChartSeriesItem type="column" data={byCategory.map((d, i) => ({
                                            value: d.value, color: PALETTE[i % PALETTE.length]
                                        }))} field="value" colorField="color" gap={0.8} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>

                        <ChartCard title="By Priority" loading={loading}>
                            {byPriority.length > 0 ? (
                                <Chart style={{ height: 260 }}>
                                    <ChartTooltip />
                                    <ChartCategoryAxis>
                                        <ChartCategoryAxisItem categories={byPriority.map(d => d.category || 'Unknown')} labels={{ font: '11px Inter' }} />
                                    </ChartCategoryAxis>
                                    <ChartValueAxis><ChartValueAxisItem labels={{ font: '11px Inter' }} /></ChartValueAxis>
                                    <ChartSeries>
                                        <ChartSeriesItem type="column" data={byPriority.map((d, i) => ({
                                            value: d.value, color: PALETTE[i % PALETTE.length]
                                        }))} field="value" colorField="color" gap={0.8} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>
                    </div>

                    {/* Row 4: Secrecy + Language */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <ChartCard title="By Secrecy Classification" loading={loading}>
                            {bySecrecy.length > 0 ? (
                                <Chart style={{ height: 260 }}>
                                    <ChartTooltip />
                                    <ChartLegend position="bottom" labels={{ font: '11px Inter' }} />
                                    <ChartSeries>
                                        <ChartSeriesItem type="donut" data={bySecrecy.map((d, i) => ({
                                            category: d.category || 'Unknown', value: d.value,
                                            color: PALETTE[i % PALETTE.length]
                                        }))} field="value" categoryField="category" colorField="color" holeSize={60} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>

                        <ChartCard title="By Language" loading={loading}>
                            {byLanguage.length > 0 ? (
                                <Chart style={{ height: 260 }}>
                                    <ChartTooltip />
                                    <ChartCategoryAxis>
                                        <ChartCategoryAxisItem categories={byLanguage.map(d => d.category || 'Unknown')} labels={{ font: '12px Inter' }} />
                                    </ChartCategoryAxis>
                                    <ChartValueAxis><ChartValueAxisItem labels={{ font: '11px Inter' }} /></ChartValueAxis>
                                    <ChartSeries>
                                        <ChartSeriesItem type="column" data={byLanguage.map((d, i) => ({
                                            value: d.value, color: PALETTE[i % PALETTE.length]
                                        }))} field="value" colorField="color" gap={0.8} />
                                    </ChartSeries>
                                </Chart>
                            ) : <EmptyChart />}
                        </ChartCard>
                    </div>
                </>
            )}
        </div>
    );
};

const arr = d => Array.isArray(d) ? d : [];

export default LetterReportsPage;
