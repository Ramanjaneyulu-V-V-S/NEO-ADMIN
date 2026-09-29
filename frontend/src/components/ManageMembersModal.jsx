import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from '../api/axios';
import {
    Users, UserPlus, Search, Trash2, Loader2, UsersRound, User
} from 'lucide-react';
import { Modal, Button, useToast } from './ui';

const ManageMembersModal = ({ isOpen, onClose, groupName, onUpdate }) => {
    const [members, setMembers] = useState({ users: [], groups: [] });
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('user');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const toast = useToast();

    const showNotification = (type, message) =>
        type === 'success' ? toast.success(message) : toast.error(message);

    useEffect(() => {
        if (isOpen && groupName) {
            fetchMembers();
        }
    }, [isOpen, groupName]);

    const fetchMembers = async () => {
        setLoadingMembers(true);
        try {
            const response = await axios.get(`/groups/${groupName}/members`);
            setMembers(response.data);
        } catch (error) {
            console.error('Error fetching members:', error);
            showNotification('error', 'Failed to load members');
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const response = await axios.get('/groups/search-members', {
                params: { query: searchQuery, type: searchType }
            });
            setSearchResults(response.data.results || []);
        } catch (error) {
            console.error('Error searching:', error);
            showNotification('error', 'Search failed');
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery) handleSearch();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, searchType]);

    const handleAddMember = async (memberName, memberType, memberSrc) => {
        setProcessing(true);
        try {
            const response = await axios.post(`/groups/${groupName}/members`, {
                memberName,
                memberType,
                memberSrc
            });

            if (response.data.success) {
                toast.success(response.data.message);
                fetchMembers();
                setSearchQuery('');
                setSearchResults([]);
                if (onUpdate) onUpdate();
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            console.error('Error adding member:', error);
            const errorMsg = error.response?.data?.message || error.response?.data || 'Failed to add member';
            toast.error(`Failed to add member: ${errorMsg}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleRemoveMember = async (memberName, memberType) => {
        setProcessing(true);
        try {
            const response = await axios.delete(
                `/groups/${groupName}/members/${memberName}`,
                { params: { memberType } }
            );

            if (response.data.success) {
                toast.success(response.data.message);
                fetchMembers();
                setConfirmRemove(null);
                if (onUpdate) onUpdate();
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            console.error('Error removing member:', error);
            toast.error('Failed to remove member');
        } finally {
            setProcessing(false);
        }
    };

    const isAlreadyMember = (name) => {
        return members.users.some(u => u.name === name) ||
               members.groups.some(g => g.name === name);
    };

    const RemoveControl = ({ name, type }) =>
        confirmRemove?.name === name && confirmRemove?.type === type ? (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleRemoveMember(name, type)}
                    disabled={processing}
                    className="rounded bg-danger px-3 py-1 text-xs font-medium text-white hover:bg-danger/90 disabled:opacity-50"
                >
                    Confirm
                </button>
                <button
                    onClick={() => setConfirmRemove(null)}
                    className="rounded bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                    Cancel
                </button>
            </div>
        ) : (
            <button
                onClick={() => setConfirmRemove({ name, type })}
                disabled={processing}
                className="rounded p-1.5 text-danger transition-colors hover:bg-danger-tint disabled:opacity-50"
                title={`Remove ${type}`}
            >
                <Trash2 size={14} />
            </button>
        );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="3xl"
            title="Manage Members"
            footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
        >
            <p className="mb-4 text-caption text-slate-500">
                Group: <span className="font-mono text-ink">{groupName}</span>
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
                {/* ── Current Members ── */}
                <div className="md:pr-6">
                    <h3 className="mb-4 flex items-center gap-2 text-title font-semibold text-ink">
                        <Users size={18} className="text-canopy" />
                        Current Members
                    </h3>

                    {loadingMembers ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-slate-400" size={32} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Users */}
                            <div>
                                <h4 className="mb-2 flex items-center gap-2 text-caption font-semibold text-slate-700">
                                    <User size={14} />
                                    Users ({members.users.length})
                                </h4>
                                <div className="space-y-1">
                                    {members.users.length === 0 ? (
                                        <p className="text-caption italic text-slate-400">No users</p>
                                    ) : (
                                        members.users.map((user, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between rounded-lg bg-paper p-3 transition-colors hover:bg-slate-100"
                                            >
                                                <span className="text-body font-medium text-ink">{user.name}</span>
                                                <RemoveControl name={user.name} type="user" />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Groups */}
                            <div>
                                <h4 className="mb-2 flex items-center gap-2 text-caption font-semibold text-slate-700">
                                    <UsersRound size={14} />
                                    Nested Groups ({members.groups.length})
                                </h4>
                                <div className="space-y-1">
                                    {members.groups.length === 0 ? (
                                        <p className="text-caption italic text-slate-400">No nested groups</p>
                                    ) : (
                                        members.groups.map((group, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between rounded-lg bg-canopy-tint p-3 transition-colors hover:bg-canopy-tint/70"
                                            >
                                                <span className="text-body font-medium text-ink">{group.name}</span>
                                                <RemoveControl name={group.name} type="group" />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Add Members ── */}
                <div className="md:pl-6">
                    <h3 className="mb-4 flex items-center gap-2 text-title font-semibold text-ink">
                        <UserPlus size={18} className="text-canopy" />
                        Add Members
                    </h3>

                    {/* Search Type Toggle */}
                    <div className="mb-4 flex gap-2">
                        {[
                            { id: 'user', label: 'Users', Icon: User },
                            { id: 'group', label: 'Groups', Icon: UsersRound },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => { setSearchType(t.id); setSearchResults([]); }}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-body font-medium transition-colors ${
                                    searchType === t.id
                                        ? 'bg-canopy text-white'
                                        : 'bg-surface text-slate-700 ring-1 ring-line hover:bg-slate-50'
                                }`}
                            >
                                <t.Icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative mb-4">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search for ${searchType}s...`}
                            className="w-full rounded-lg border border-line bg-surface py-2.5 pl-10 pr-4 text-body focus:border-canopy focus:outline-none focus:ring-2 focus:ring-canopy/20"
                        />
                        {searching && (
                            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                    </div>

                    {/* Search Results */}
                    <div className="min-h-[200px] space-y-1">
                        {searchResults.length === 0 && searchQuery ? (
                            <p className="py-8 text-center text-body italic text-slate-400">
                                No {searchType}s found
                            </p>
                        ) : searchResults.length === 0 ? (
                            <p className="py-8 text-center text-body italic text-slate-400">
                                Start typing to search for {searchType}s
                            </p>
                        ) : (
                            searchResults.map((result, idx) => {
                                const alreadyMember = isAlreadyMember(result.name);
                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between rounded-lg p-3 transition-colors ${
                                            alreadyMember
                                                ? 'bg-slate-100 opacity-60'
                                                : 'bg-surface ring-1 ring-line hover:bg-slate-50'
                                        }`}
                                    >
                                        <div>
                                            <span className="text-body font-medium text-ink">{result.name}</span>
                                            {result.fullName && (
                                                <span className="ml-2 text-caption text-slate-500">({result.fullName})</span>
                                            )}
                                        </div>
                                        {alreadyMember ? (
                                            <span className="text-caption font-medium text-slate-500">Already member</span>
                                        ) : (
                                            <button
                                                onClick={() => handleAddMember(result.name, result.type, result.src)}
                                                disabled={processing}
                                                className="rounded-lg bg-canopy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-canopy-dark disabled:opacity-50"
                                            >
                                                Add
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ManageMembersModal;
