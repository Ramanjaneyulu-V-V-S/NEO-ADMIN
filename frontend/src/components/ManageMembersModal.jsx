import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from '../api/axios';
import {
    X, Users, UserPlus, Search, Trash2, Loader2, CheckCircle,
    AlertCircle, UsersRound, User
} from 'lucide-react';

const ManageMembersModal = ({ isOpen, onClose, groupName, onUpdate }) => {
    const [members, setMembers] = useState({ users: [], groups: [] });
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('user');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(null);

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

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const isAlreadyMember = (name) => {
        return members.users.some(u => u.name === name) ||
               members.groups.some(g => g.name === name);
    };

    return (
        <AnimatePresence>
        {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[70vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Users className="text-[#0A66C2]" size={24} />
                            Manage Members
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Group: {groupName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

{/* Content */}
                <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-slate-200 min-h-0">
                    {/* Left Panel - Current Members */}
                    <div className="p-6 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Current Members</h3>

                        {loadingMembers ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-slate-400" size={32} />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Users */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <User size={14} />
                                        Users ({members.users.length})
                                    </h4>
                                    <div className="space-y-1">
                                        {members.users.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">No users</p>
                                        ) : (
                                            members.users.map((user, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                                >
                                                    <span className="text-sm font-medium text-slate-900">{user.name}</span>
                                                    {confirmRemove?.name === user.name && confirmRemove?.type === 'user' ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleRemoveMember(user.name, 'user')}
                                                                disabled={processing}
                                                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmRemove(null)}
                                                                className="px-3 py-1 bg-slate-300 text-slate-700 text-xs rounded hover:bg-slate-400"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmRemove({ name: user.name, type: 'user' })}
                                                            disabled={processing}
                                                            className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors disabled:opacity-50"
                                                            title="Remove user"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Groups */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <UsersRound size={14} />
                                        Nested Groups ({members.groups.length})
                                    </h4>
                                    <div className="space-y-1">
                                        {members.groups.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">No nested groups</p>
                                        ) : (
                                            members.groups.map((group, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    <span className="text-sm font-medium text-slate-900">{group.name}</span>
                                                    {confirmRemove?.name === group.name && confirmRemove?.type === 'group' ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleRemoveMember(group.name, 'group')}
                                                                disabled={processing}
                                                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmRemove(null)}
                                                                className="px-3 py-1 bg-slate-300 text-slate-700 text-xs rounded hover:bg-slate-400"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmRemove({ name: group.name, type: 'group' })}
                                                            disabled={processing}
                                                            className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors disabled:opacity-50"
                                                            title="Remove group"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Add Members */}
                    <div className="p-6 overflow-y-auto overscroll-contain bg-slate-50 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <UserPlus size={20} />
                            Add Members
                        </h3>

                        {/* Search Type Toggle */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => { setSearchType('user'); setSearchResults([]); }}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                    searchType === 'user'
                                        ? 'bg-[#0A66C2] text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <User size={14} className="inline mr-1" />
                                Users
                            </button>
                            <button
                                onClick={() => { setSearchType('group'); setSearchResults([]); }}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                    searchType === 'group'
                                        ? 'bg-[#0A66C2] text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <UsersRound size={14} className="inline mr-1" />
                                Groups
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-4">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Search for ${searchType}s...`}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] bg-white"
                            />
                            {searching && (
                                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                            )}
                        </div>

                        {/* Search Results */}
                        <div className="space-y-1 min-h-[200px]">
                            {searchResults.length === 0 && searchQuery ? (
                                <p className="text-sm text-slate-400 text-center py-8 italic">
                                    No {searchType}s found
                                </p>
                            ) : searchResults.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8 italic">
                                    Start typing to search for {searchType}s
                                </p>
                            ) : (
                                searchResults.map((result, idx) => {
                                    const alreadyMember = isAlreadyMember(result.name);
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                                alreadyMember
                                                    ? 'bg-slate-200 opacity-60'
                                                    : 'bg-white hover:bg-slate-100'
                                            }`}
                                        >
                                            <div>
                                                <span className="text-sm font-medium text-slate-900">{result.name}</span>
                                                {result.fullName && (
                                                    <span className="text-xs text-slate-500 ml-2">({result.fullName})</span>
                                                )}
                                            </div>
                                            {alreadyMember ? (
                                                <span className="text-xs text-slate-500 font-medium">Already member</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleAddMember(result.name, result.type, result.src)}
                                                    disabled={processing}
                                                    className="px-3 py-1.5 bg-[#0A66C2] text-white text-xs rounded-lg hover:bg-[#094d92] disabled:opacity-50 transition-colors font-medium"
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

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 shadow-md hover:shadow-lg transition-all font-medium"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
        )}
        </AnimatePresence>
    );
};

export default ManageMembersModal;
