import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Briefcase, TrendingUp, Activity, Users, Loader2, RefreshCw } from 'lucide-react';
import { Chart, ChartSeries, ChartSeriesItem, ChartCategoryAxis, ChartCategoryAxisItem, ChartLegend, ChartTooltip, ChartValueAxis, ChartValueAxisItem } from '@progress/kendo-react-charts';
import 'hammerjs';

// ─── Color palette ───────────────────────────────────────────────────────────
const COLORS = {
    blue: '#0A66C2', lightBlue: '#3b82f6', skyBlue: '#60a5fa',
    green: '#22c55e', yellow: '#f59e0b', red: '#ef4444',
    slate: '#64748b', purple: '#8b5cf6', indigo: '#6366f1',
    teal: '#14b8a6', pink: '#ec4899', orange: '#f97316',
};

const CHART_PALETTE = [COLORS.blue, COLORS.green, COLORS.yellow, COLORS.red, COLORS.purple, COLORS.teal, COLORS.pink, COLORS.orange, COLORS.indigo, COLORS.skyBlue, COLORS.slate, COLORS.lightBlue];

const WORKFLOW_COLORS = {
    'Dormant': COLORS.slate, 'Running': COLORS.blue, 'Finished': COLORS.green,
    'Halted': COLORS.yellow, 'Terminated': COLORS.red, 'Failed': COLORS.red,
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, color, loading }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={22} className="text-white" />
        </div>
        <div>
            {loading ? (
                <div className="h-8 w-20 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
                <div className="text-2xl font-bold text-slate-900">{value?.toLocaleString() ?? '—'}</div>
            )}
            <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
        </div>
    </div>
);

// ─── Chart Card wrapper ──────────────────────────────────────────────────────
const ChartCard = ({ title, children, loading }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">{title}</h3>
        {loading ? (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={28} className="animate-spin text-slate-300" />
            </div>
        ) : children}
    </div>
);

// ─── Dashboard Page ──────────────────────────────────────────────────────────
const DashboardPage = () => {
    const [summary, setSummary] = useState(null);
    const [casesByDept, setCasesByDept] = useState([]);
    const [casesByStatus, setCasesByStatus] = useState([]);
    const [casesByOffice, setCasesByOffice] = useState([]);
    const [casesTrend, setCasesTrend] = useState([]);
    const [workflowStatus, setWorkflowStatus] = useState([]);
    const [usersByOffice, setUsersByOffice] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            api.get('/dashboard/summary').catch(() => ({ data: {} })),
            api.get('/dashboard/cases-by-dept').catch(() => ({ data: [] })),
            api.get('/dashboard/cases-by-status').catch(() => ({ data: [] })),
            api.get('/dashboard/cases-by-office').catch(() => ({ data: [] })),
            api.get('/dashboard/cases-trend').catch(() => ({ data: [] })),
            api.get('/dashboard/workflow-status').catch(() => ({ data: [] })),
            api.get('/dashboard/users-by-office').catch(() => ({ data: [] })),
        ]).then(([sumRes, deptRes, statusRes, officeRes, trendRes, wfRes, usersRes]) => {
            setSummary(sumRes.data);
            setCasesByDept(Array.isArray(deptRes.data) ? deptRes.data : []);
            setCasesByStatus(Array.isArray(statusRes.data) ? statusRes.data : []);
            setCasesByOffice(Array.isArray(officeRes.data) ? officeRes.data : []);
            setCasesTrend(Array.isArray(trendRes.data) ? trendRes.data : []);
            setWorkflowStatus(Array.isArray(wfRes.data) ? wfRes.data : []);
            setUsersByOffice(Array.isArray(usersRes.data) ? usersRes.data : []);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-xs text-slate-500 mt-0.5">Case management analytics and insights</p>
                </div>
                <button onClick={fetchData} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard icon={Briefcase} label="Total Cases" value={summary?.totalCases} color="bg-[#0A66C2]" loading={loading} />
                <KpiCard icon={TrendingUp} label="Cases This Month" value={summary?.casesThisMonth} color="bg-emerald-500" loading={loading} />
                <KpiCard icon={Activity} label="Active Workflows" value={summary?.activeWorkflows} color="bg-amber-500" loading={loading} />
                <KpiCard icon={Users} label="Active Users" value={summary?.activeUsers} color="bg-purple-500" loading={loading} />
            </div>

            {/* Row 1: Cases by Department + Cases by Status */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Cases by Department (Top 15)" loading={loading}>
                    {casesByDept.length > 0 ? (
                        <Chart style={{ height: 350 }}>
                            <ChartTooltip />
                            <ChartCategoryAxis>
                                <ChartCategoryAxisItem categories={casesByDept.map(d => d.category || 'Unknown')}
                                    labels={{ rotation: 0, font: '11px Inter' }} />
                            </ChartCategoryAxis>
                            <ChartValueAxis>
                                <ChartValueAxisItem labels={{ font: '11px Inter' }} />
                            </ChartValueAxis>
                            <ChartSeries>
                                <ChartSeriesItem type="bar" data={casesByDept.map(d => d.value)}
                                    color={COLORS.blue} gap={0.5} />
                            </ChartSeries>
                        </Chart>
                    ) : <EmptyState />}
                </ChartCard>

                <ChartCard title="Cases by Status" loading={loading}>
                    {casesByStatus.length > 0 ? (
                        <Chart style={{ height: 350 }}>
                            <ChartTooltip />
                            <ChartLegend position="bottom" labels={{ font: '12px Inter' }} />
                            <ChartSeries>
                                <ChartSeriesItem type="donut" data={casesByStatus.map((d, i) => ({
                                    category: d.category || 'Unknown', value: d.value,
                                    color: CHART_PALETTE[i % CHART_PALETTE.length]
                                }))} field="value" categoryField="category" colorField="color"
                                    holeSize={60} />
                            </ChartSeries>
                        </Chart>
                    ) : <EmptyState />}
                </ChartCard>
            </div>

            {/* Row 2: Case Trend + Cases by Office */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Case Creation Trend (Last 12 Months)" loading={loading}>
                    {casesTrend.length > 0 ? (
                        <Chart style={{ height: 300 }}>
                            <ChartTooltip />
                            <ChartCategoryAxis>
                                <ChartCategoryAxisItem categories={casesTrend.map(d => d.category)}
                                    labels={{ rotation: -45, font: '11px Inter' }} />
                            </ChartCategoryAxis>
                            <ChartValueAxis>
                                <ChartValueAxisItem labels={{ font: '11px Inter' }} />
                            </ChartValueAxis>
                            <ChartSeries>
                                <ChartSeriesItem type="area" data={casesTrend.map(d => d.value)}
                                    color={COLORS.blue} line={{ style: 'smooth' }} opacity={0.3} />
                            </ChartSeries>
                        </Chart>
                    ) : <EmptyState />}
                </ChartCard>

                <ChartCard title="Cases by Office Type" loading={loading}>
                    {casesByOffice.length > 0 ? (
                        <Chart style={{ height: 300 }}>
                            <ChartTooltip />
                            <ChartLegend position="bottom" labels={{ font: '12px Inter' }} />
                            <ChartSeries>
                                <ChartSeriesItem type="donut" data={casesByOffice.map((d, i) => ({
                                    category: d.category || 'Unknown', value: d.value,
                                    color: i === 0 ? COLORS.blue : COLORS.green
                                }))} field="value" categoryField="category" colorField="color"
                                    holeSize={70} />
                            </ChartSeries>
                        </Chart>
                    ) : <EmptyState />}
                </ChartCard>
            </div>

            {/* Row 3: Workflow Health + Users by Office */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Workflow Health" loading={loading}>
                    {workflowStatus.length > 0 ? (
                        <Chart style={{ height: 300 }}>
                            <ChartTooltip />
                            <ChartLegend position="bottom" labels={{ font: '12px Inter' }} />
                            <ChartSeries>
                                <ChartSeriesItem type="donut" data={workflowStatus.map(d => ({
                                    category: d.category, value: d.value,
                                    color: WORKFLOW_COLORS[d.category] || COLORS.slate
                                }))} field="value" categoryField="category" colorField="color"
                                    holeSize={60} />
                            </ChartSeries>
                        </Chart>
                    ) : <EmptyState />}
                </ChartCard>

                <ChartCard title="Users by Office Type" loading={loading}>
                    {usersByOffice.length > 0 ? (
                        <Chart style={{ height: 300 }}>
                            <ChartTooltip />
                            <ChartCategoryAxis>
                                <ChartCategoryAxisItem categories={usersByOffice.map(d => d.category || 'Unknown')}
                                    labels={{ font: '12px Inter' }} />
                            </ChartCategoryAxis>
                            <ChartValueAxis>
                                <ChartValueAxisItem labels={{ font: '11px Inter' }} />
                            </ChartValueAxis>
                            <ChartSeries>
                                <ChartSeriesItem type="column" data={usersByOffice.map((d, i) => ({
                                    value: d.value, color: CHART_PALETTE[i % CHART_PALETTE.length]
                                }))} field="value" colorField="color" gap={1} />
                            </ChartSeries>
                        </Chart>
                    ) : <EmptyState />}
                </ChartCard>
            </div>
        </div>
    );
};

const EmptyState = () => (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No data available
    </div>
);

export default DashboardPage;
