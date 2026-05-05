import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import useIdleTimeout from '../../hooks/useIdleTimeout';
import IdleWarningModal from '../IdleWarningModal';

const MainLayout = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const hasAccess = adminRole === 'Super Admin' || adminRole === 'Local Admin';
    const navigate = useNavigate();
    const { showWarning, remainingTime, handleContinue } = useIdleTimeout(30000, 1800000);

    if (!hasAccess) {
        return (
            <div className="bg-slate-50 min-h-screen font-sans text-slate-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md w-full text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={28} className="text-red-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-sm text-slate-600 mb-6">
                        You do not have sufficient privileges to access this. The user must have Super Admin or Local Admin rights.
                    </p>
                    <button
                        onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
                        className="px-6 py-2.5 bg-[#0A66C2] text-white text-sm font-semibold rounded-lg hover:bg-[#094d92] transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 min-h-screen font-sans text-slate-900">
            <Sidebar />
            <Topbar />
            <main className="pl-64 pt-16 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
            <IdleWarningModal isOpen={showWarning} remainingTime={remainingTime} onContinue={handleContinue} />
        </div>
    );
};

export default MainLayout;
