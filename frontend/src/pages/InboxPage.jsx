import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import {
    ClipboardList, Loader2, User, ChevronLeft, ChevronRight
} from 'lucide-react';
import { PageHeader, useToast } from '../components/ui';

const USERS_PAGE_SIZE = 2000;
const TASKS_PAGE_SIZE = 50;

async function fetchAllUsers() {
    let page = 1;
    let all = [];
    while (true) {
        const res = await api.get('/users/profiles', { params: { page, size: USERS_PAGE_SIZE } });
        const users = res.data.users || [];
        all = all.concat(users);
        if (!res.data.hasNext) break;
        page++;
    }
    return all;
}

// ─── InboxPage ────────────────────────────────────────────────────────────────
const InboxPage = () => {
    const toast                           = useToast();
    const [allUsers, setAllUsers]         = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery]   = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [tasks, setTasks]               = useState([]);
    const [total, setTotal]               = useState(0);
    const [page, setPage]                 = useState(1);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const dropdownRef                     = useRef(null);

    const totalPages = Math.max(1, Math.ceil(total / TASKS_PAGE_SIZE));

    // Load all users on mount
    useEffect(() => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then(setAllUsers)
            .catch(() => toast.error('Failed to load users.'))
            .finally(() => setLoadingUsers(false));
    }, [toast]);

    // Reset to page 1 when user changes
    useEffect(() => {
        setPage(1);
    }, [selectedUser]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch tasks when user or page changes
    useEffect(() => {
        if (!selectedUser) { setTasks([]); setTotal(0); return; }
        setLoadingTasks(true);
        api.get('/inbox', { params: { username: selectedUser.object_name, page, size: TASKS_PAGE_SIZE } })
            .then(res => {
                setTasks(res.data.tasks || []);
                setTotal(res.data.total || 0);
            })
            .catch(err => {
                toast.error(err.response?.data?.message || 'Failed to fetch inbox tasks.');
                setTasks([]);
            })
            .finally(() => setLoadingTasks(false));
    }, [selectedUser, page, toast]);

    const filteredUsers = useMemo(() =>
        allUsers.filter(u => {
            const q = searchQuery.toLowerCase();
            return (u.object_name || '').toLowerCase().includes(q)
                || (u.user_login_name || '').toLowerCase().includes(q);
        }),
        [allUsers, searchQuery]
    );

    const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy bg-white';

    const start = total === 0 ? 0 : (page - 1) * TASKS_PAGE_SIZE + 1;
    const end   = Math.min(page * TASKS_PAGE_SIZE, total);

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader title="Case Inbox" icon={ClipboardList} description="View the workflow inbox for any user." />

            {/* User selector */}
            <div className="bg-white border border-line rounded-card p-5 shadow-card mb-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <User size={15} className="text-canopy" />
                    Select User
                </h2>
                <div className="relative max-w-md" ref={dropdownRef}>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder={loadingUsers ? 'Loading users…' : 'Search by name or login…'}
                        value={selectedUser ? selectedUser.object_name : searchQuery}
                        disabled={loadingUsers}
                        onFocus={() => { if (selectedUser) setSelectedUser(null); setShowDropdown(true); }}
                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); setSelectedUser(null); }}
                    />
                    {loadingUsers && (
                        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                    )}
                    {showDropdown && filteredUsers.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                            {filteredUsers.slice(0, 100).map(u => (
                                <button
                                    key={u.r_object_id || u.user_login_name}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-canopy/5 flex items-center justify-between"
                                    onClick={() => { setSelectedUser(u); setSearchQuery(''); setShowDropdown(false); }}
                                >
                                    <span className="font-medium text-slate-800">{u.object_name}</span>
                                    <span className="text-xs text-slate-400 font-mono">{u.user_login_name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tasks panel */}
            <div className="bg-white border border-line rounded-card shadow-card flex flex-col overflow-hidden min-h-[420px]">

                {/* Panel header */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <ClipboardList size={15} className="text-canopy" />
                    <span className="text-sm font-semibold text-slate-700">
                        {selectedUser ? `Inbox — ${selectedUser.object_name}` : 'Inbox Tasks'}
                    </span>
                    {selectedUser && !loadingTasks && total > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                            {total} task{total !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Table area */}
                <div className="flex-1 overflow-auto max-h-[62vh]">
                    {!selectedUser && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <ClipboardList size={36} strokeWidth={1.5} />
                            <p className="text-sm">Select a user to view their inbox tasks</p>
                        </div>
                    )}

                    {selectedUser && loadingTasks && (
                        <div className="flex items-center justify-center h-full py-16">
                            <Loader2 size={24} className="animate-spin text-canopy" />
                        </div>
                    )}

                    {selectedUser && !loadingTasks && tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <ClipboardList size={36} strokeWidth={1.5} />
                            <p className="text-sm">No inbox tasks found for this user</p>
                        </div>
                    )}

                    {selectedUser && !loadingTasks && tasks.length > 0 && (
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    {['Case Name', 'Description', 'Status', 'Initiator', 'Priority'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tasks.map((task, idx) => (
                                    <tr key={task.objectId || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-800">{task.caseName || '—'}</td>
                                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{task.description || '—'}</td>
                                        <td className="px-4 py-3">
                                            {task.status
                                                ? <span className="px-2 py-0.5 text-xs rounded-full bg-canopy-tint text-canopy font-medium">{task.status}</span>
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{task.initiator || '—'}</td>
                                        <td className="px-4 py-3">
                                            {task.priority
                                                ? <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                    task.priority === 'High'   ? 'bg-danger-tint text-danger' :
                                                    task.priority === 'Medium' ? 'bg-harvest/15 text-harvest' :
                                                    'bg-slate-100 text-slate-600'
                                                  }`}>{task.priority}</span>
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination footer */}
                {selectedUser && !loadingTasks && total > TASKS_PAGE_SIZE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-slate-500">
                            Showing {start}–{end} of {total}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => p - 1)}
                                disabled={page === 1}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                                .reduce((acc, p, i, arr) => {
                                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((item, i) =>
                                    item === '...'
                                        ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
                                        : <button
                                            key={item}
                                            onClick={() => setPage(item)}
                                            className={`min-w-[28px] h-7 rounded-lg text-xs font-medium ${
                                                item === page
                                                    ? 'bg-canopy text-white'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                          >{item}</button>
                                )
                            }
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page === totalPages}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <span className="text-xs text-slate-500">
                            Page {page} of {totalPages}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InboxPage;
