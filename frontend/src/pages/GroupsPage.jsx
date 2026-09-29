import React, { useState, useCallback } from 'react';
import axios from '../api/axios';
import { Search, X, Users, UsersRound, Settings } from 'lucide-react';
import ManageMembersModal from '../components/ManageMembersModal';
import { PageHeader, DataTable, Pagination, Button, Input, Card } from '../components/ui';
import { formatDate } from '../utils/datetime';

const GroupsPage = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalEstimate, setTotalEstimate] = useState(null);

    const [groupName, setGroupName] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchGroups = useCallback(async (searchTerm, pageNum) => {
        setLoading(true);
        try {
            const response = await axios.get('/groups/search', {
                params: {
                    groupName: searchTerm && searchTerm.trim() !== '' ? searchTerm.trim() : undefined,
                    page: pageNum,
                    size: pageSize
                }
            });

            const data = response.data;
            setGroups(data.groups || []);
            setHasNextPage(data.hasNext || false);
            const currentCount = (data.groups || []).length;
            const minTotal = (pageNum - 1) * pageSize + currentCount;
            setTotalEstimate(data.hasNext ? `${minTotal}+` : minTotal.toString());
        } catch (error) {
            console.error("Error fetching groups", error);
            setGroups([]);
            setHasNextPage(false);
            setTotalEstimate('0');
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    // Load all groups on component mount
    React.useEffect(() => {
        fetchGroups('', 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(groupName.trim());
        setPage(1);
        fetchGroups(groupName.trim(), 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchGroups(activeSearch, newPage);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setPage(1);
        fetchGroups(activeSearch, 1);
    };

    const clearSearch = () => {
        setGroupName('');
        setActiveSearch('');
        setPage(1);
        fetchGroups('', 1);
    };

    const rangeStart = groups.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd = (page - 1) * pageSize + groups.length;

    const handleManageMembers = (group) => {
        setSelectedGroup(group);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedGroup(null);
    };

    const handleMembersUpdated = () => {
        fetchGroups(activeSearch, page);
    };

    const memberCounts = (g) => {
        const users = Array.isArray(g.users_names)
            ? g.users_names.filter((n) => n && n.trim() !== '')
            : (g.users_names ? [g.users_names] : []);
        const grps = Array.isArray(g.groups_names)
            ? g.groups_names.filter((n) => n && n.trim() !== '')
            : (g.groups_names ? [g.groups_names] : []);
        const tooltip = [
            users.length > 0 ? `Users: ${users.join(', ')}` : '',
            grps.length > 0 ? `Groups: ${grps.join(', ')}` : '',
        ].filter(Boolean).join('\n') || 'No members';
        return { users: users.length, groups: grps.length, tooltip };
    };

    const columns = [
        {
            key: 'idx',
            header: '#',
            mono: true,
            width: 'w-12',
            card: 'hide',
            render: (_g, i) => (page - 1) * pageSize + i + 1,
        },
        {
            key: 'group_name',
            header: 'Group name',
            primary: true,
            render: (g) => <span className="font-medium text-ink">{g.group_name || '—'}</span>,
        },
        {
            key: 'description',
            header: 'Description',
            render: (g) => (
                <span className="block max-w-xs truncate text-slate-600" title={g.description}>
                    {g.description || '—'}
                </span>
            ),
        },
        { key: 'owner_name', header: 'Owner', render: (g) => g.owner_name || '—' },
        {
            key: 'members',
            header: 'Members',
            render: (g) => {
                const c = memberCounts(g);
                return (
                    <div className="flex flex-col gap-0.5" title={c.tooltip}>
                        <span className="inline-flex items-center gap-1 text-caption text-slate-600">
                            <Users size={11} className="text-slate-400" />
                            <span className="font-mono">{c.users}</span> {c.users === 1 ? 'user' : 'users'}
                        </span>
                        {c.groups > 0 && (
                            <span className="inline-flex items-center gap-1 text-caption text-slate-500">
                                <UsersRound size={11} className="text-slate-400" />
                                <span className="font-mono">{c.groups}</span> {c.groups === 1 ? 'group' : 'groups'}
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'r_creation_date',
            header: 'Created',
            mono: true,
            render: (g) => formatDate(g.r_creation_date),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            card: 'footer',
            render: (g) => (
                <Button size="sm" variant="secondary" onClick={() => handleManageMembers(g)}>
                    <Settings size={13} />
                    Manage
                </Button>
            ),
        },
    ];

    return (
        <div className="flex flex-1 flex-col">
            <PageHeader
                title="Groups"
                icon={Users}
                description="Documentum groups and their members."
                actions={
                    <form onSubmit={handleSearch} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <div className="relative min-w-0 flex-1 sm:flex-none">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="Filter by group name…"
                                className="w-full pl-9 pr-8 sm:w-56"
                            />
                            {groupName && (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink"
                                    aria-label="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <Button type="submit" loading={loading}>
                            <Search size={14} />
                            Search
                        </Button>
                    </form>
                }
            />

            <Card pad={false} className="overflow-hidden">
                {totalEstimate && !loading && (
                    <div className="flex items-center justify-between border-b border-line bg-paper/60 px-4 py-2 text-caption text-slate-600">
                        <span>
                            <span className="font-mono text-canopy">{totalEstimate}</span> group
                            {totalEstimate !== '1' ? 's' : ''}
                            {activeSearch && ` matching "${activeSearch}"`}
                        </span>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    rows={groups}
                    rowKey={(g, i) => g.r_object_id || i}
                    loading={loading}
                    empty={{
                        icon: Users,
                        title: 'No groups found',
                        description: activeSearch
                            ? `Nothing matches "${activeSearch}". Try a different term.`
                            : 'There are no groups to show.',
                    }}
                    className="px-1"
                    stickyHeader
                />

                {groups.length > 0 && (
                    <Pagination
                        page={page}
                        pageSize={pageSize}
                        hasNext={hasNextPage}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        loading={loading}
                    />
                )}
            </Card>

            <ManageMembersModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                groupName={selectedGroup?.group_name}
                onUpdate={handleMembersUpdated}
            />
        </div>
    );
};

export default GroupsPage;
