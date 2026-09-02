import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import CasesPage from './pages/CasesPage';
import WorkflowsPage from './pages/WorkflowsPage';
import GroupsPage from './pages/GroupsPage';
import UsersPage from './pages/UsersPage';
import QueryPage from './pages/QueryPage';
import VerticalsPage from './pages/VerticalsPage';
import Verticals2Page from './pages/Verticals2Page';
import DepartmentPage from './pages/DepartmentPage';
import InboxPage from './pages/InboxPage';
import MetadataPage from './pages/MetadataPage';
import SfsPage from './pages/SfsPage';
import DelegatePage from './pages/DelegatePage';
import CaseInbox2Page from './pages/CaseInbox2Page';
import ReportsPage from './pages/ReportsPage';

function App() {
  return (
    <Router basename="/neoadmin/">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard/users" replace />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="verticals" element={<VerticalsPage />} />
            <Route path="verticals2" element={<Verticals2Page />} />
            <Route path="departments" element={<DepartmentPage />} />
            <Route path="metadata" element={<MetadataPage />} />
            <Route path="sfs" element={<SfsPage />} />
            <Route path="user-export" element={<Navigate to="/dashboard/users" replace />} />
            <Route path="query" element={<QueryPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="delegate" element={<Navigate to="/dashboard/cases" replace />} />
            <Route path="inbox2" element={<Navigate to="/dashboard/cases" replace />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard/users" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
