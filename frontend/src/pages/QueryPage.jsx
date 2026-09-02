import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import axios from '../api/axios';
import {
    Play, ChevronLeft, ChevronRight, Database,
    ChevronsLeft, Loader2, X, AlertCircle, Filter, History, Clock, Trash2, Copy, Check
} from 'lucide-react';
import useQueryHistory from '../hooks/useQueryHistory';
import { PageHeader } from '../components/ui';

const QueryPage = () => {
    const [allRows, setAllRows] = useState([]); // Store all fetched rows
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [resultLimit, setResultLimit] = useState(10000); // DQL RETURN_TOP limit
    const [hasExecuted, setHasExecuted] = useState(false);
    const [error, setError] = useState(null);
    const [columnFilters, setColumnFilters] = useState({});

    const [query, setQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');

    // Query history
    const { history, addQuery, clearHistory } = useQueryHistory();
    const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const historyButtonRef = useRef(null);
    const historyDropdownRef = useRef(null);

    // Selective execution
    const textareaRef = useRef(null);
    const [hasSelection, setHasSelection] = useState(false);

    const executeQuery = useCallback(async (dql, limit) => {
        if (!dql || dql.trim() === '') {
            setError('Please enter a DQL query');
            return;
        }

        setLoading(true);
        setHasExecuted(true);
        setError(null);

        try {
            // Send query with RETURN_TOP limit hint
            const response = await axios.post('/query/execute', {
                dql: dql.trim(),
                limit: limit
            });

            const data = response.data;

            if (data.error) {
                setError(data.error);
                setAllRows([]);
                setColumns([]);
            } else {
                setAllRows(data.rows || []);
                setColumns(data.columns || []);
                setColumnFilters({}); // Reset filters on new query
                setCurrentPage(1); // Reset to first page

                // Add to query history after successful execution
                addQuery(dql.trim(), limit);
            }
        } catch (err) {
            console.error("Error executing query", err);
            setError(err.response?.data?.message || err.message || 'Query execution failed');
            setAllRows([]);
            setColumns([]);
        } finally {
            setLoading(false);
        }
    }, [addQuery]);

    // Close history dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showHistoryDropdown &&
                historyDropdownRef.current &&
                !historyDropdownRef.current.contains(event.target) &&
                historyButtonRef.current &&
                !historyButtonRef.current.contains(event.target)) {
                setShowHistoryDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHistoryDropdown]);

    // Track selection changes
    const handleSelectionChange = () => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            setHasSelection(start !== end);
        }
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        // Ctrl+Enter or Cmd+Enter to execute
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecuteWithSelection();
        }
    };

    // Execute selected text or full query
    const handleExecuteWithSelection = () => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;

        let queryToExecute;
        if (start !== end) {
            // Text is selected - execute only selection
            queryToExecute = query.substring(start, end).trim();
        } else {
            // No selection - execute full query
            queryToExecute = query.trim();
        }

        if (queryToExecute) {
            setActiveQuery(queryToExecute);
            executeQuery(queryToExecute, resultLimit);
        }
    };

    // Load query from history
    const loadQueryFromHistory = (historyQuery) => {
        setQuery(historyQuery);
        setShowHistoryDropdown(false);
    };

    // Copy query to clipboard
    const copyQueryToClipboard = async (queryText, itemId, e) => {
        e.stopPropagation(); // Prevent loading query when clicking copy button
        try {
            await navigator.clipboard.writeText(queryText);
            setCopiedId(itemId);
            // Reset copied state after 2 seconds
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy query:', err);
        }
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Truncate query text for display
    const truncateQuery = (text, maxLength = 60) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    // Client-side filtering
    const filteredRows = useMemo(() => {
        if (allRows.length === 0) return [];

        return allRows.filter(row => {
            return Object.entries(columnFilters).every(([column, filterValue]) => {
                if (!filterValue || filterValue.trim() === '') return true;
                const cellValue = row[column];
                if (cellValue === null || cellValue === undefined) return false;
                return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [allRows, columnFilters]);

    // Client-side pagination
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredRows.slice(startIndex, endIndex);
    }, [filteredRows, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredRows.length / pageSize);

    const handleExecute = (e) => {
        e.preventDefault();
        if (query.trim()) {
            setActiveQuery(query.trim());
            executeQuery(query.trim(), resultLimit);
        }
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handleFilterChange = (column, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [column]: value
        }));
        setCurrentPage(1); // Reset to first page when filtering
    };

    const clearAllFilters = () => {
        setColumnFilters({});
        setCurrentPage(1);
    };

    const clearQuery = () => {
        setQuery('');
        setActiveQuery('');
        setAllRows([]);
        setColumns([]);
        setHasExecuted(false);
        setError(null);
        setCurrentPage(1);
        setColumnFilters({});
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(Number(newSize));
        setCurrentPage(1); // Reset to first page when changing page size
    };

    const rangeStart = paginatedRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const rangeEnd = (currentPage - 1) * pageSize + paginatedRows.length;
    const hasActiveFilters = Object.values(columnFilters).some(v => v && v.trim() !== '');

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader title="Query" icon={Database} description="Run raw DQL against the repository." />

            {/* Query Input */}
            <form onSubmit={handleExecute} className="bg-white border border-line rounded-card shadow-card p-4 mb-4">
                <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">DQL Query</label>
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onSelect={handleSelectionChange}
                            onKeyDown={handleKeyDown}
                            placeholder="SELECT r_object_id, object_name FROM dm_document WHERE folder('/Temp')"
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy resize-y"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={clearQuery}
                                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div className="flex items-start justify-between gap-2 text-xs mt-1">
                        <p className="text-slate-400">
                            <span className="font-medium">Note:</span> r_object_id and r_object_type will be automatically included.
                            <span className="ml-1">ENABLE(RETURN_TOP n) hint is automatically added to limit database results.</span>
                        </p>
                        <p className="text-slate-500 shrink-0">
                            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">
                                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                            </kbd>
                            <span className="ml-1">to execute{hasSelection ? ' selection' : ''}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="submit"
                        disabled={!query.trim() || loading}
                        className="px-4 py-2 bg-canopy text-white rounded-lg text-sm font-medium hover:bg-canopy-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        title={`Execute query (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter)`}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Execute
                    </button>

                    {/* History Button */}
                    <div className="relative">
                        <button
                            ref={historyButtonRef}
                            type="button"
                            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
                            title="Query History"
                        >
                            <History size={14} />
                            History
                            {history.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-canopy text-white text-xs rounded-full">
                                    {history.length}
                                </span>
                            )}
                        </button>

                        {/* History Dropdown */}
                        {showHistoryDropdown && (
                            <div
                                ref={historyDropdownRef}
                                className="absolute top-full mt-2 right-0 w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col"
                            >
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                    <span className="text-sm font-semibold text-slate-700">
                                        Recent Queries ({history.length})
                                    </span>
                                    {history.length > 0 && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Clear all query history?')) {
                                                    clearHistory();
                                                }
                                            }}
                                            className="text-xs text-danger hover:text-danger flex items-center gap-1"
                                        >
                                            <Trash2 size={12} />
                                            Clear All
                                        </button>
                                    )}
                                </div>

                                {/* History List */}
                                <div className="overflow-y-auto flex-1">
                                    {history.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400">
                                            <History className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                            <p className="text-sm">No queries yet</p>
                                        </div>
                                    ) : (
                                        history.map((item) => (
                                            <div
                                                key={item.id}
                                                className="w-full px-4 py-3 hover:bg-slate-50 border-b border-slate-100 transition-colors flex items-start gap-2 group"
                                            >
                                                <Database size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                                <button
                                                    onClick={() => loadQueryFromHistory(item.query)}
                                                    className="flex-1 min-w-0 text-left"
                                                >
                                                    <p className="text-sm text-slate-700 font-mono truncate">
                                                        {truncateQuery(item.query)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                        <Clock size={10} />
                                                        <span>{formatTimestamp(item.executedAt)}</span>
                                                        {item.limit && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Limit: {item.limit.toLocaleString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={(e) => copyQueryToClipboard(item.query, item.id, e)}
                                                    className="px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                    title="Copy query"
                                                >
                                                    {copiedId === item.id ? (
                                                        <Check size={14} className="text-canopy" />
                                                    ) : (
                                                        <Copy size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600 font-medium">Max Results:</label>
                        <select
                            value={resultLimit}
                            onChange={(e) => setResultLimit(Number(e.target.value))}
                            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                            title="DQL ENABLE(RETURN_TOP n) hint"
                        >
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                            <option value={1000}>1,000</option>
                            <option value={5000}>5,000</option>
                            <option value={10000}>10,000</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600 font-medium">Rows/Page:</label>
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                        </select>
                    </div>
                </div>
            </form>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-danger-tint border border-danger/20 rounded-lg flex items-start gap-2 text-danger text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Results */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {!hasExecuted ? (
                    <div className="py-16 text-center text-slate-400">
                        <Database className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm">Enter a DQL query and click Execute</p>
                    </div>
                ) : loading ? (
                    <div className="py-16 text-center text-slate-400">
                        <Loader2 className="mx-auto h-8 w-8 text-canopy animate-spin mb-2" />
                        <p className="text-sm">Executing query...</p>
                    </div>
                ) : allRows.length === 0 && !error ? (
                    <div className="py-16 text-center text-slate-400">
                        <Database className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm">No results found</p>
                    </div>
                ) : allRows.length > 0 && (
                    <>
                        {/* Count and Filter Controls */}
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                                <span className="text-slate-600">
                                    <span className="font-semibold text-canopy">{allRows.length}</span> total rows
                                    {filteredRows.length < allRows.length && (
                                        <span className="ml-1">
                                            (<span className="font-semibold text-harvest">{filteredRows.length}</span> filtered)
                                        </span>
                                    )}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-600">
                                    Showing {rangeStart}-{rangeEnd}
                                </span>
                            </div>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex items-center gap-1"
                                >
                                    <X size={12} />
                                    Clear Filters
                                </button>
                            )}
                        </div>

                        {/* Table with fixed height */}
                        <div className="overflow-auto max-h-[calc(100vh-28rem)] min-h-[400px]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-20 w-12">#</th>
                                        {columns.map((col) => (
                                            <th key={col} className="px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                                                <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                    <span className="whitespace-nowrap">{col}</span>
                                                    <div className="relative">
                                                        <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={columnFilters[col] || ''}
                                                            onChange={(e) => handleFilterChange(col, e.target.value)}
                                                            placeholder="Filter..."
                                                            className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-canopy/30 focus:border-canopy bg-white"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {paginatedRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length + 1} className="px-3 py-12 text-center text-slate-400">
                                                <Filter className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                                <p className="text-sm">No results match the current filters</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2.5 text-slate-400 font-mono text-xs bg-slate-50/50 sticky left-0 border-r border-slate-100">
                                                    {(currentPage - 1) * pageSize + idx + 1}
                                                </td>
                                                {columns.map((col) => (
                                                    <td key={col} className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={String(row[col] ?? '')}>
                                                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-sm">
                            <span className="text-slate-500">
                                Page <span className="font-semibold text-slate-700">{currentPage}</span> of <span className="font-semibold text-slate-700">{totalPages}</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="First page"
                                >
                                    <ChevronsLeft size={14} />
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Previous page"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="px-3 text-slate-700 font-medium min-w-[3rem] text-center">{currentPage}</span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Next page"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default QueryPage;
