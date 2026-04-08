import { NavLink } from 'react-router-dom';
<<<<<<< HEAD
import { GitBranch, Users, Compass, Briefcase, UsersRound, Database, Network, ClipboardList, FolderCog, Building2 } from 'lucide-react';

const Sidebar = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;

    const allNavItems = [
        { name: 'Users',        path: '/dashboard/users',     icon: Users,        roles: null },
        { name: 'Verticals',    path: '/dashboard/verticals', icon: Network,      roles: ['Super Admin', 'Local Admin'] },
        { name: 'Departments',  path: '/dashboard/departments', icon: Building2,  roles: ['Super Admin'] },
        { name: 'Metadata',     path: '/dashboard/metadata',  icon: FolderCog,    roles: null },
        { name: 'Cases',        path: '/dashboard/cases',     icon: Briefcase,    roles: null },
        { name: 'Workflows',    path: '/dashboard/workflows', icon: GitBranch,    roles: null },
        { name: 'Groups',       path: '/dashboard/groups',    icon: UsersRound,   roles: null },
        { name: 'Query',        path: '/dashboard/query',     icon: Database,     roles: null },
=======
import { GitBranch, Users, Compass, Settings, Briefcase, UsersRound, Database, LayoutDashboard } from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { name: 'Overview', path: '/dashboard/overview', icon: LayoutDashboard },
        { name: 'Cases', path: '/dashboard/cases', icon: Briefcase },
        { name: 'Workflows', path: '/dashboard/workflows', icon: GitBranch },
        { name: 'Groups', path: '/dashboard/groups', icon: UsersRound },
        { name: 'Users', path: '/dashboard/users', icon: Users },
        { name: 'Query', path: '/dashboard/query', icon: Database },
>>>>>>> 1f00b260edcf3382c454a00028d329c01692b990
    ];

    const navItems = allNavItems.filter(item => !item.roles || item.roles.includes(adminRole));

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-20 font-sans">
            {/* Logo Section */}
            <div className="p-6 mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0A66C2] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Compass className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">NB Admin</h1>
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <div className="flex-1 px-4 overflow-y-auto">
                <div className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-blue-50 text-[#0A66C2]'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={18} className={isActive ? 'text-[#0A66C2]' : 'text-slate-500'} />
                                    {item.name}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </div>
            
        </aside>
    );
};

export default Sidebar;
