import { NavLink } from 'react-router-dom';
import { GitBranch, Users, Briefcase, Database, Network, FolderCog, Building2, FileBarChart2, UploadCloud, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { cn } from '../../utils/cn';
import nabardLogo from '../../assets/nabard-logo.svg';

const SECTIONS = ['Records', 'Configuration', 'Tools'];

const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const username = storedUser.properties?.user_name || storedUser.user_name || null;
    const isSuperAdmin = adminRole === 'Super Admin';
    const isLocalAdmin = adminRole === 'Local Admin';

    const [userOfficeType, setUserOfficeType] = useState(null);
    const [userDepartment, setUserDepartment] = useState(null);

    // Fetch office_type and department from cms_user_profile when component mounts
    useEffect(() => {
        if (isLocalAdmin && username) {
            api.get('/users/profile-context', { params: { username } })
                .then(res => {
                    if (res.data?.office_type) {
                        setUserOfficeType(res.data.office_type);
                    }
                    // Try multiple department field names
                    let dept = res.data?.department_short_code ||
                                 res.data?.department_name ||
                                 res.data?.profile_department_short_code ||
                                 res.data?.profile_department_name ||
                                 res.data?.dept;

                    // Check if department_short_code_multi exists (array format)
                    if (!dept && res.data?.department_short_code_multi && Array.isArray(res.data.department_short_code_multi)) {
                        const deptArray = res.data.department_short_code_multi;
                        if (deptArray.length > 0) {
                            dept = deptArray[0]; // Get first department
                        }
                    }

                    if (dept) {
                        setUserDepartment(String(dept).toUpperCase());
                    }
                })
                .catch(err => console.error('Failed to fetch profile context:', err));
        }
    }, [isLocalAdmin, username]);

    const allNavItems = [
        { name: 'User Management',        path: '/dashboard/users',     icon: Users,        roles: null, section: 'Records' },
        { name: 'Cases',        path: '/dashboard/cases',     icon: Briefcase,    roles: null, section: 'Records' },
        { name: 'Digidak',      path: '/dashboard/digidak',   icon: Mail,         roles: null, section: 'Records' },
        { name: 'Reports',      path: '/dashboard/reports',   icon: FileBarChart2, roles: null, section: 'Records' },
        { name: 'Workflows',    path: '/dashboard/workflows', icon: GitBranch,    roles: null, section: 'Records', hideForLocalAdmin: true },
        { name: 'NABARD Department Management',  path: '/dashboard/departments', icon: Building2,  roles: ['Super Admin'], section: 'Configuration' },
        { name: 'HO Vertical Management',    path: '/dashboard/verticals', icon: Network,      roles: ['Super Admin', 'Local Admin'], section: 'Configuration', hideForLocalAdminIf: 'ROTE' },
        { name: 'RO/TE Department Head Assignment',  path: '/dashboard/verticals2', icon: Network,     roles: ['Super Admin', 'Local Admin'], section: 'Configuration', hideForLocalAdminIf: 'HO' },
        { name: 'Metadata',     path: '/dashboard/metadata',  icon: FolderCog,    roles: null, section: 'Configuration' },
        { name: 'SFS',          path: '/dashboard/sfs',       icon: FolderCog,    roles: null, section: 'Configuration', showOnlyForHRMD: true },
        { name: 'Query',        path: '/dashboard/query',     icon: Database,     roles: null, section: 'Tools', hideForLocalAdmin: true },
        { name: 'IV Republish', path: '/dashboard/iv-republish', icon: UploadCloud, roles: null, section: 'Tools' },
    ];

    const navItems = allNavItems.filter(item => {
        // Check if item is only for HRMD department Local Admin
        if (item.showOnlyForHRMD) {
            // Super Admin can always see it
            if (isSuperAdmin) {
                return true;
            }
            // Local Admin can only see it if they're HRMD
            if (isLocalAdmin) {
                return String(userDepartment).toUpperCase() === 'HRMD';
            }
            // Regular users cannot see it
            return false;
        }

        // Hide items for Local Admin
        if (isLocalAdmin && item.hideForLocalAdmin) {
            return false;
        }
        // Check role access
        if (item.roles && !item.roles.includes(adminRole)) {
            return false;
        }
        // Check local admin office type hiding
        if (isLocalAdmin && item.hideForLocalAdminIf) {
            if (item.hideForLocalAdminIf === 'HO' && userOfficeType === 'HO') return false;
            if (item.hideForLocalAdminIf === 'ROTE' && ['RO', 'TE'].includes(userOfficeType)) return false;
        }
        return true;
    });

    return (
        <>
            {/* Mobile backdrop */}
            <div
                className={cn(
                    'fixed inset-0 z-30 bg-ink/40 transition-opacity duration-300 lg:hidden',
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                className={cn(
                    'fixed left-0 top-0 z-40 flex h-[100dvh] w-64 flex-col border-r border-line bg-surface font-sans transition-transform duration-300 ease-smooth lg:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Wordmark */}
                <div className="flex items-center gap-3 px-5 py-5">
                    <img src={nabardLogo} alt="NABARD" className="h-10 w-10 shrink-0" />
                    <div className="leading-tight">
                        <p className="font-display text-title font-semibold text-ink">NEO Admin</p>
                        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-slate-400">NABARD</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-6 scrollbar-thin">
                    {SECTIONS.map(section => {
                        const items = navItems.filter(i => i.section === section);
                        if (items.length === 0) return null;
                        return (
                            <div key={section} className="space-y-1">
                                <p className="px-3 pb-1 font-mono text-[0.65rem] uppercase tracking-widest text-slate-400">
                                    {section}
                                </p>
                                {items.map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            cn(
                                                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-body font-medium transition-colors',
                                                isActive
                                                    ? 'bg-canopy-tint text-canopy before:absolute before:-left-3 before:top-1 before:bottom-1 before:w-[3px] before:animate-spine-grow before:rounded-full before:bg-canopy'
                                                    : 'text-slate-600 hover:bg-paper hover:text-ink'
                                            )
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon size={17} className={isActive ? 'text-canopy' : 'text-slate-400'} />
                                                {item.name}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;
