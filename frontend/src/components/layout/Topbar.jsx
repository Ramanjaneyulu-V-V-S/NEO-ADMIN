import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, Menu } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';

const CRUMBS = {
    users: 'User Management',
    cases: 'Cases',
    reports: 'Reports',
    workflows: 'Workflows',
    groups: 'Groups',
    inbox: 'Inbox',
    departments: 'NABARD Departments',
    verticals: 'HO Verticals',
    verticals2: 'RO / TE Dept Heads',
    metadata: 'Metadata',
    sfs: 'SFS',
    query: 'Query',
};

const Topbar = ({ onMenuClick = () => {} }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [user] = useState(() => {
        try {
            const storedUser = localStorage.getItem('user');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (!user) return null;

    const adminRole = user.properties?.admin_role || user.admin_role || null;
    const userName = user.user_name || user.properties?.user_name || user.object_name || 'User';
    const userEmail = user.user_address || user.properties?.user_address || 'No email';
    const initials = userName ? userName.charAt(0).toUpperCase() : 'U';
    const crumb = CRUMBS[location.pathname.split('/').filter(Boolean).pop()] || '';

    return (
        <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 shadow-card backdrop-blur sm:px-6 lg:left-64">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="-ml-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-paper hover:text-ink lg:hidden"
                    aria-label="Open navigation menu"
                >
                    <Menu size={20} />
                </button>
                {crumb && (
                    <span className="truncate font-mono text-caption uppercase tracking-widest text-slate-400">
                        {crumb}
                    </span>
                )}
            </div>

            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsProfileOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-1.5 transition-colors hover:border-line hover:bg-paper"
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canopy-tint font-semibold text-caption text-canopy">
                        {initials}
                    </span>
                    <ChevronDown
                        size={15}
                        className={cn('text-slate-400 transition-transform', isProfileOpen && 'rotate-180')}
                    />
                </button>

                {isProfileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-card border border-line bg-white text-body shadow-pop animate-fade-rise">
                        <div className="border-b border-line bg-paper/60 p-4">
                            <p className="font-medium text-ink">{userName}</p>
                            <p className="mt-0.5 break-all text-caption text-slate-500">{userEmail}</p>
                        </div>
                        {(adminRole === 'Super Admin' || adminRole === 'Local Admin') && (
                            <div className="p-4">
                                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-slate-400">
                                    Privileges
                                </p>
                                <div className="mt-1.5 flex items-center gap-2 text-ink">
                                    <span className="h-1.5 w-1.5 rounded-full bg-canopy" />
                                    <span>{adminRole}</span>
                                </div>
                            </div>
                        )}
                        <div className="border-t border-line p-2">
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center justify-center gap-2 rounded-lg p-2 font-medium text-danger transition-colors hover:bg-danger-tint"
                            >
                                <LogOut size={15} />
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Topbar;
