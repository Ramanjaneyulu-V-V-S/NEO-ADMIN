import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import useIdleTimeout from '../../hooks/useIdleTimeout';
import IdleWarningModal from '../IdleWarningModal';
import { ToastProvider } from '../ui/ToastProvider';
import { Button } from '../ui/Button';

const MainLayout = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const hasAccess = adminRole === 'Super Admin' || adminRole === 'Local Admin';
    const navigate = useNavigate();
    const { showWarning, remainingTime, handleContinue } = useIdleTimeout(30000, 1800000);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (!hasAccess) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4 font-sans text-ink">
                <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-tint">
                        <ShieldAlert size={28} className="text-danger" />
                    </div>
                    <h2 className="mb-2 font-display text-title font-medium text-ink">Access denied</h2>
                    <p className="mb-6 text-body text-slate-500">
                        This area needs Super Admin or Local Admin rights. Sign in with an account that has them.
                    </p>
                    <Button
                        onClick={() => {
                            localStorage.removeItem('user');
                            navigate('/login');
                        }}
                    >
                        Back to sign in
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="min-h-[100dvh] bg-paper font-sans text-ink">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
                {/* `overflow-x-clip`, not `-hidden`. `hidden` makes this a scroll
                    container: it can be scrolled programmatically — by focus, by
                    `scrollIntoView`, by a wheel chained out of a floating panel —
                    with no scrollbar to show it and no way for the user to scroll
                    back, so the whole column silently slides under the fixed
                    sidebar. `hidden` also forces the unset axis to `auto`, making
                    this a second vertical scroller competing with the document.
                    `clip` clips at exactly the same edge and is not a scrollport. */}
                <main className="min-h-[100dvh] overflow-x-clip pt-14 lg:pl-64">
                    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col p-4">
                        <Outlet />
                    </div>
                </main>
                <IdleWarningModal isOpen={showWarning} remainingTime={remainingTime} onContinue={handleContinue} />
            </div>
        </ToastProvider>
    );
};

export default MainLayout;
