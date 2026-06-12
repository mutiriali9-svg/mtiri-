import AuthCallback from '@/pages/callback/index';
import CompleteProfile from '@/pages/CompleteProfile';
import PendingApproval from '@/pages/PendingApproval';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import ContractAlerts from '@/pages/ContractAlerts';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/lib/LanguageContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DeletedAccountScreen from '@/components/DeletedAccountScreen';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Units from '@/pages/Units';
import Payments from '@/pages/Payments';
import Expenses from '@/pages/Expenses';
import Reports from '@/pages/Reports';
import Savings from '@/pages/Savings';
import UnitDetails from '@/pages/UnitDetails';
import DataEntry from '@/pages/DataEntry.jsx';
import Investors from '@/pages/Investors';
import RegistrationRequests from '@/pages/RegistrationRequests';
import PendingApprovals from '@/pages/PendingApprovals';
import RequestAccess from '@/pages/RequestAccess';
import ReDashboard from '@/pages/re/ReDashboard';
import ReUnits from '@/pages/re/ReUnits';
import RePayments from '@/pages/re/RePayments';
import ReExpenses from '@/pages/re/ReExpenses';
import ReReports from '@/pages/re/ReReports';
import ReInvestors from '@/pages/re/ReInvestors';
import ReSavings from '@/pages/re/ReSavings';
import Notifications from '@/pages/Notifications';
import SmartAlerts from '@/pages/SmartAlerts';
import ActivityLogPage from '@/pages/ActivityLog';
import MyPayments from '@/pages/MyPayments';
import Profile from '@/pages/Profile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthenticated, authChecked } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#0E1A30' }}>
        <div className="flex flex-col items-center gap-4">
          <span className="text-4xl font-bold" style={{ color: '#C9A84C', fontFamily: 'Cairo' }}>المطيري</span>
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated && authChecked) {
    return <Navigate to="/login" replace />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered' || authError.type === 'not_a_member' || authError.type === 'workspace_member_required') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    } else if (authError.type && authError.type !== 'unknown') {
      return <UserNotRegisteredError />;
    }
  }

  if (!user && !isLoadingAuth) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!user?.role) {
  return <Navigate to="/complete-profile" replace />;
}

  if (user?.role === 'delete_request') {
    return <DeletedAccountScreen />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
      <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/contracts" element={<ContractAlerts />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/units" element={<Units />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/units/:unitNumber" element={<UnitDetails />} />
        <Route path="/data-entry" element={<DataEntry />} />
        <Route path="/investors" element={<Investors />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="/registration-requests" element={<RegistrationRequests />} />
        <Route path="/pending-approvals" element={<PendingApprovals />} />
        <Route path="/re-dashboard" element={<ReDashboard />} />
        <Route path="/re-units" element={<ReUnits />} />
        <Route path="/re-payments" element={<RePayments />} />
        <Route path="/re-expenses" element={<ReExpenses />} />
        <Route path="/re-reports" element={<ReReports />} />
        <Route path="/re-investors" element={<ReInvestors />} />
        <Route path="/re-savings" element={<ReSavings />} />
        <Route path="/smart-alerts" element={<SmartAlerts />} />
        <Route path="/activity-log" element={<ActivityLogPage />} />
        <Route path="/my-payments" element={<MyPayments />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/request-access" element={<RequestAccess />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App