import { NavLink } from 'react-router-dom';
import { GitBranch, Users, Compass, Briefcase, UsersRound, Database, Network, FolderCog, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const Sidebar = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const username = storedUser.properties?.user_name || storedUser.user_name || null;
    const isLocalAdmin = adminRole === 'Local Admin';

    const [userOfficeType, setUserOfficeType] = useState(null);

    useEffect(() => {
        if (isLocalAdmin && username) {
            api.get('/users/profile-context', { params: { username } })
                .then(res => { if (res.data?.office_type) setUserOfficeType(res.data.office_type); })
                .catch(() => {});
        }
    }, [isLocalAdmin, username]);

    const allNavItems = [
        { name: 'User Management',             path: '/dashboard/users',       icon: Users,     roles: null },
        { name: 'NABARD Departments',          path: '/dashboard/departments', icon: Building2, roles: ['Super Admin'] },
        { name: 'HO Vertical Management',      path: '/dashboard/verticals',   icon: Network,   roles: ['Super Admin', 'Local Admin'], hideForLocalAdminIf: 'ROTE' },
        { name: 'RO/TE Dept Assignment',       path: '/dashboard/verticals2',  icon: Network,   roles: ['Super Admin', 'Local Admin'], hideForLocalAdminIf: 'HO' },
        { name: 'Metadata',                    path: '/dashboard/metadata',    icon: FolderCog, roles: null },
        { name: 'Cases',                       path: '/dashboard/cases',       icon: Briefcase, roles: null },
        { name: 'Workflows',                   path: '/dashboard/workflows',   icon: GitBranch, roles: null },
        { name: 'Query',                       path: '/dashboard/query',       icon: Database,  roles: null },
        { name: 'Groups',                      path: '/dashboard/groups',      icon: UsersRound,roles: null },
    ];

    const navItems = allNavItems.filter(item => {
        if (item.roles && !item.roles.includes(adminRole)) return false;
        if (isLocalAdmin && item.hideForLocalAdminIf) {
            if (item.hideForLocalAdminIf === 'HO' && userOfficeType === 'HO') return false;
            if (item.hideForLocalAdminIf === 'ROTE' && ['RO', 'TE'].includes(userOfficeType)) return false;
        }
        return true;
    });

    return (
        <aside className="w-64 bg-[#1a3566] flex flex-col h-screen fixed left-0 top-0 z-20 font-sans">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-[#152d57]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <Compass className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white leading-tight tracking-wide">NEO Admin</h1>
                        <p className="text-xs text-blue-300/60">NEO Admin Portal</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
                <p className="text-xs font-semibold text-[#6b93c9] uppercase tracking-widest px-3 mb-2">Menu</p>
                <div className="space-y-0.5">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                                    isActive
                                        ? 'bg-white/15 text-white shadow-sm'
                                        : 'text-blue-200 hover:bg-white/10 hover:text-white'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={17} className={isActive ? 'text-white' : 'text-blue-300'} />
                                    <span className="truncate">{item.name}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>

        </aside>
    );
};

export default Sidebar;
