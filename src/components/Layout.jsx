import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useRef } from 'react';
import {
  LayoutDashboard, Building2, CreditCard, Receipt,
  BarChart3, LogOut, Menu, X, PlusCircle, Users, Wallet, Globe, ClipboardList, ChevronUp, ChevronDown, Home, Bell, BellRing, History, ChevronRight, ChevronLeft, StickyNote
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import MobileBottomNav from '@/components/MobileBottomNav';
import RouteTransition from '@/components/RouteTransition';
import MobileHeader from '@/components/MobileHeader';
import NotificationDropdown from '@/components/NotificationDropdown';

const adminNavKeys = [
  { path: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { path: '/reports', key: 'reports', icon: BarChart3 },
  { path: '/investors', key: 'investors', icon: Users },
  { path: '/units', key: 'units', icon: Building2 },
  { path: '/payments', key: 'payments', icon: CreditCard },
  { path: '/expenses', key: 'expenses', icon: Receipt },
  { path: '/savings', key: 'savings', icon: Wallet },
];

const dataEntryNavKeys = [
  { path: '/data-entry', key: 'dataEntry', icon: PlusCircle },
  { path: '/my-payments', key: 'myPayments', icon: CreditCard },
  { path: '/units', key: 'units', icon: Building2 },
  { path: '/smart-alerts', key: 'smartAlerts', icon: BellRing },
];

const investorQaryaNavKeys = [
  { path: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { path: '/reports', key: 'reports', icon: BarChart3 },
  { path: '/investors', key: 'investors', icon: Users },
  { path: '/units', key: 'units', icon: Building2 },
  { path: '/payments', key: 'payments', icon: CreditCard },
  { path: '/expenses', key: 'expenses', icon: Receipt },
  { path: '/savings', key: 'savings', icon: Wallet },
];

const investorReNavKeys = [
  { path: '/re-dashboard', key: 'reDashboard', icon: LayoutDashboard },
  { path: '/re-reports', key: 'reReports', icon: BarChart3 },
  { path: '/re-investors', key: 'reInvestors', icon: Users },
  { path: '/re-units', key: 'reUnits', icon: Building2 },
  { path: '/re-payments', key: 'rePayments', icon: CreditCard },
  { path: '/re-expenses', key: 'reExpenses', icon: Receipt },
  { path: '/re-savings', key: 'reSavings', icon: Wallet },
];

const investorNavKeys = [...investorQaryaNavKeys, ...investorReNavKeys];

const realEstateNavKeys = [
  { path: '/re-dashboard', key: 'reDashboard', icon: LayoutDashboard },
  { path: '/re-reports', key: 'reReports', icon: BarChart3 },
  { path: '/re-investors', key: 'reInvestors', icon: Users },
  { path: '/re-units', key: 'reUnits', icon: Building2 },
  { path: '/re-payments', key: 'rePayments', icon: CreditCard },
  { path: '/re-expenses', key: 'reExpenses', icon: Receipt },
  { path: '/re-savings', key: 'reSavings', icon: Wallet },
];

const navLabels = {
  ar: {
    dashboard: 'لوحة التحكم',
    units: 'الوحدات السكنية',
    payments: 'الدفعات',
    expenses: 'المصاريف',
    reports: 'التقارير',
    investors: 'المستثمرون',
    savings: 'الادخار',
    dataEntry: 'إدخال البيانات',
    myPayments: 'دفعاتي',
    smartAlerts: 'التنبيهات الذكية',
    registrationRequests: 'طلبات التسجيل',
    activityLog: 'سجل العمليات',
    qaryaVilla: 'بناية القرية',
    realEstate: 'العقارات',
    reDashboard: 'لوحة التحكم',
    reUnits: 'الوحدات السكنية',
    rePayments: 'الدفعات',
    reExpenses: 'المصاريف',
    reReports: 'التقارير',
    reInvestors: 'المستثمرون',
    reSavings: 'الادخار',
    alerts: 'الإشعارات',
    userManagement: 'إدارة الحسابات',
    notes: 'الملاحظات',
  },
  en: {
    dashboard: 'Dashboard',
    units: 'Units',
    payments: 'Payments',
    expenses: 'Expenses',
    reports: 'Reports',
    investors: 'Investors',
    savings: 'Savings',
    dataEntry: 'Data Entry',
    myPayments: 'My Payments',
    smartAlerts: 'Smart Alerts',
    registrationRequests: 'Registration Requests',
    activityLog: 'Activity Log',
    qaryaVilla: 'Qarya Villa',
    realEstate: 'Real Estate',
    reDashboard: 'Dashboard',
    reUnits: 'Units',
    rePayments: 'Payments',
    reExpenses: 'Expenses',
    reReports: 'Reports',
    reInvestors: 'Investors',
    reSavings: 'Savings',
    alerts: 'Notifications',
    userManagement: 'User Management',
    notes: 'Notes',
  },
};

const BACK_BUTTON_ROUTES = [
  '/dashboard', '/units', '/payments', '/expenses', '/reports', '/investors', '/savings',
  '/re-dashboard', '/re-units', '/re-payments', '/re-expenses', '/re-reports', '/re-investors', '/re-savings',
  '/smart-alerts', '/notifications', '/activity-log', '/data-entry', '/my-payments',
  '/registration-requests', '/pending-approvals', '/notes',
];


export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { lang, setLang } = useLang();

  // ── Notification counts ──────────────────────────────────────────────────
  const [newPaymentsCount, setNewPaymentsCount] = useState(0);
  const [newExpensesCount, setNewExpensesCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const seenAtRef = useRef(
  new Date(localStorage.getItem('notifications_seen_at') || '2024-01-01T00:00:00.000Z')
);
  // ────────────────────────────────────────────────────────────────────────

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const isDataEntry = user?.role === 'data_entry';
  const isInvestor = user?.role === 'investor';

  const PRESERVED_ROUTES = ['/dashboard', '/', '/units', '/payments'];
  const mainRef = useRef(null);
  const scrollCache = useRef({});

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const saved = scrollCache.current[location.pathname];
    if (saved !== undefined) {
      el.scrollTop = saved;
    } else {
      el.scrollTop = 0;
    }
    const onScroll = () => {
      if (PRESERVED_ROUTES.includes(location.pathname)) {
        scrollCache.current[location.pathname] = el.scrollTop;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  const [qaryaOpen, setQaryaOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_qarya_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [reOpen, setReOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_re_open');
    return saved !== null ? saved === 'true' : false;
  });
  const [alertsOpen, setAlertsOpen] = useState(false);

  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    localStorage.setItem('sidebar_qarya_open', String(qaryaOpen));
  }, [qaryaOpen]);

  const isMountedRe = useRef(false);
  useEffect(() => {
    if (!isMountedRe.current) { isMountedRe.current = true; return; }
    localStorage.setItem('sidebar_re_open', String(reOpen));
  }, [reOpen]);

  const [urgentAlertsCount, setUrgentAlertsCount] = useState(0);
  const [expiredContractsCount, setExpiredContractsCount] = useState(0);
  const [registrationRequestsCount, setRegistrationRequestsCount] = useState(0);

  useEffect(() => {
    if (!user?.role) return;
    const loadAlerts = async () => {
      const today = new Date().toISOString().split('T')[0];
      const alerts = await base44.entities.PaymentAlert.list('-alert_date', 200);
      const urgent = alerts.filter(a =>
        a.status !== 'paid' &&
        a.alert_date && a.alert_date <= today
      );
      setUrgentAlertsCount(urgent.length);

      const [units, reUnits] = await Promise.all([
        base44.entities.Unit.list(),
        base44.entities.ReUnit.list(),
      ]);
      const allUnits = [...units, ...reUnits];
      const todayStr = new Date().toISOString().split('T')[0];
      const expired = allUnits.filter(u => u.contract_end && u.contract_end < todayStr);
      setExpiredContractsCount(expired.length);
    };
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user?.role) return;
    const loadRequests = async () => {
      const requests = await base44.entities.RegistrationRequest.list();
      const pendingRequests = requests.filter(r => r.status === 'pending');
      setRegistrationRequestsCount(pendingRequests.length);
    };
    loadRequests();
    const interval = setInterval(loadRequests, 60000);
    return () => clearInterval(interval);
  }, [user]);


  
 // ── Load notification counts (payments + expenses + notes) ───────────────
useEffect(() => {
  if (!user?.role) return;
  if (user.role !== 'admin' && user.role !== 'investor') return;
  const loadCounts = async () => {
    console.log('ENTITIES:', Object.keys(base44.entities));
  };
  loadCounts();
  const interval = setInterval(loadCounts, 30000);
  return () => clearInterval(interval);
}, [user]);
  // ────────────────────────────────────────────────────────────────────────

  const isAdmin = user?.role === 'admin';

  // ── Bell click: persist seenAt ────────────────────────────────────────────
  const handleBellClick = () => {
    const now = new Date();
    localStorage.setItem('notifications_seen_at', now.toISOString());
    seenAtRef.current = now;
  };
  // ────────────────────────────────────────────────────────────────────────

  const isTester = user?.role === 'tester';
  const navKeys = isDataEntry ? dataEntryNavKeys : isInvestor ? investorNavKeys : adminNavKeys;
  const isRtl = lang === 'ar';
  const navLabel = (key) => navLabels[lang]?.[key] || key;

  useEffect(() => {
  if (location.pathname === '/notifications') {
    const now = new Date();
    localStorage.setItem('notifications_seen_at', now.toISOString());
    seenAtRef.current = now; // ← الإصلاح الحاسم: sync الـ ref مع localStorage
    
    
  }
  if (location.pathname === '/notes') {
    setNotesCount(0);
  }
}, [location.pathname]);
  const isAllowedDataEntry =
  location.pathname === '/data-entry' ||
  location.pathname.startsWith('/units') ||
  location.pathname === '/pending-approvals' ||
  location.pathname.startsWith('/smart-alerts') ||
  location.pathname === '/my-payments' ||
  location.pathname === '/profile' ||
  location.pathname === '/notes';

  if (user && isDataEntry && !isAllowedDataEntry) {
    return <Navigate to="/data-entry" replace />;
  }

  const isAllowedInvestor = [
    '/', '/dashboard', '/units', '/payments', '/expenses', '/reports', '/investors', '/savings',
    '/re-dashboard', '/re-units', '/re-payments', '/re-expenses', '/re-reports', '/re-investors', '/re-savings',
    '/smart-alerts', '/notifications', '/profile', '/notes',
  ].some(p => location.pathname === p || location.pathname.startsWith(p + '/'));

  if (user && isInvestor && !isAllowedInvestor) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await base44.functions.invoke('requestAccountDeletion', {});
    } catch (e) {
      // ignore
    }
    base44.auth.logout();
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  const roleLabel = user?.role === 'admin'
    ? (lang === 'ar' ? 'مالك' : 'Owner')
    : user?.role === 'data_entry'
    ? (lang === 'ar' ? 'إدخال بيانات' : 'Data Entry')
    : user?.role === 'investor'
    ? (lang === 'ar' ? 'مستثمر' : 'Investor')
    : user?.role;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] font-cairo" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 h-full z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          w-56 sm:w-64
          ${isRtl ? 'right-0' : 'left-0'}
          ${mobileOpen
            ? 'translate-x-0'
            : isRtl
              ? 'translate-x-full lg:translate-x-0'
              : '-translate-x-full lg:translate-x-0'
          }
        `}
        style={{ backgroundColor: '#0E1A30' }}
      >
        {/* Logo + Close */}
        <div className="flex items-center justify-between h-14 border-b border-white/10 px-3 flex-shrink-0 gap-2">
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm sm:text-base leading-tight tracking-wide truncate" style={{ color: '#C9A84C', letterSpacing: '0.03em' }}>{lang === 'ar' ? 'المطيري' : 'Al-Mutairi'}</span>
            <span className="text-white/60 text-[9px] sm:text-[10px] font-light leading-tight" style={{ color: 'rgba(201,168,76,0.7)' }}>{lang === 'ar' ? 'لإدارة العقار والأعمال' : 'Real Estate Management'}</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">

          {/* ── Admin / Tester: Qarya Villa ── */}
          {(isAdmin || isTester) && (
            <div>
              <button
                onClick={() => setQaryaOpen(prev => !prev)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  <Building2 size={16} style={{ color: '#C9A84C' }} />
                </div>
                <span className="flex-1 text-right font-bold text-base" style={{ color: '#C9A84C' }}>
                  {navLabel('qaryaVilla')}
                </span>
                {qaryaOpen
                  ? <ChevronUp size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                  : <ChevronDown size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                }
              </button>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: qaryaOpen ? '600px' : '0px', opacity: qaryaOpen ? 1 : 0 }}
              >
                <div className="space-y-1 mt-1">
                  {adminNavKeys.filter(item => item.key !== 'registrationRequests').map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5 active:bg-white/10'}`}
                        style={{
                          borderRight: isRtl && isActive ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none',
                          borderLeft: !isRtl && isActive ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none',
                        }}
                      >
                        <Icon size={18} style={{ color: isActive ? '#C9A84C' : '', flexShrink: 0 }} />
                        <span className="text-sm font-medium">{navLabel(item.key)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Admin / Tester: Real Estate ── */}
          {(isAdmin || isTester) && (
            <div className="mt-2">
              <div className="border-b border-white/10 mb-2" />
              <button
                onClick={() => setReOpen(prev => !prev)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  <Home size={16} style={{ color: '#C9A84C' }} />
                </div>
                <span className="flex-1 text-right font-bold text-base" style={{ color: '#C9A84C' }}>
                  {navLabel('realEstate')}
                </span>
                {reOpen
                  ? <ChevronUp size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                  : <ChevronDown size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                }
              </button>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: reOpen ? '600px' : '0px', opacity: reOpen ? 1 : 0 }}
              >
                <div className="space-y-1 mt-1">
                  {realEstateNavKeys.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5 active:bg-white/10'}`}
                        style={{
                          borderRight: isRtl && isActive ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none',
                          borderLeft: !isRtl && isActive ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none',
                        }}
                      >
                        <Icon size={18} style={{ color: isActive ? '#C9A84C' : '', flexShrink: 0 }} />
                        <span className="text-sm font-medium">{navLabel(item.key)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Admin / Tester: Alerts Section ── */}
          {(isAdmin || isTester) && (
            <div className="mt-2">
              <div className="border-b border-white/10 mb-2" />
              <button
                onClick={() => setAlertsOpen(prev => !prev)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  <Bell size={16} style={{ color: '#C9A84C' }} />
                </div>
                <span className="flex-1 text-right font-bold text-base" style={{ color: '#C9A84C' }}>{navLabel('alerts')}</span>
                {alertsOpen
                  ? <ChevronUp size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                  : <ChevronDown size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                }
              </button>
              <div className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: alertsOpen ? '600px' : '0px', opacity: alertsOpen ? 1 : 0 }}>
                <div className="space-y-1 mt-1">
                  <Link to="/activity-log"
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/activity-log' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                    style={{ borderRight: isRtl && location.pathname === '/activity-log' ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/activity-log' ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none' }}>
                    <History size={18} style={{ color: location.pathname === '/activity-log' ? '#C9A84C' : '', flexShrink: 0 }} />
                    <span className="text-sm font-medium">{navLabel('activityLog')}</span>
                  </Link>
                  <Link to="/smart-alerts"
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/smart-alerts' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                    style={{ borderRight: isRtl && location.pathname === '/smart-alerts' ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/smart-alerts' ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none' }}>
                    <BellRing size={18} style={{ color: location.pathname === '/smart-alerts' ? '#C9A84C' : '', flexShrink: 0 }} />
                    <span className="text-sm font-medium">{navLabel('smartAlerts')}</span>
                  </Link>
                  <Link to="/registration-requests"
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/registration-requests' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                    style={{ borderRight: isRtl && location.pathname === '/registration-requests' ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/registration-requests' ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none' }}>
                    <ClipboardList size={18} style={{ color: location.pathname === '/registration-requests' ? '#C9A84C' : '', flexShrink: 0 }} />
                    <span className="text-sm font-medium">{navLabel('registrationRequests')}</span>
                  </Link>
                  {/* Notes link */}
                  <Link to="/notes"
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/notes' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                    style={{ borderRight: isRtl && location.pathname === '/notes' ? '3px solid #A8B2C0' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/notes' ? '3px solid #A8B2C0' : !isRtl ? '3px solid transparent' : 'none' }}>
                    <StickyNote size={18} style={{ color: location.pathname === '/notes' ? '#A8B2C0' : '', flexShrink: 0 }} />
                    <span className="text-sm font-medium">{navLabel('notes')}</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Admin: User Management ── */}
          {user?.role === 'admin' && (
            <div className="mt-2">
              <div className="border-b border-white/10 mb-2" />
              <Link
                to="/users"
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/users' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                style={{
                  borderRight: isRtl && location.pathname === '/users' ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none',
                  borderLeft: !isRtl && location.pathname === '/users' ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none',
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  <Users size={16} style={{ color: '#C9A84C' }} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm" style={{ color: '#A8B2C0' }}>
                    {navLabel('userManagement')}
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* ── Investor ── */}
          {isInvestor && (
            <>
              <div>
                <button onClick={() => setQaryaOpen(prev => !prev)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                    <Building2 size={16} style={{ color: '#C9A84C' }} />
                  </div>
                  <span className="flex-1 text-right font-bold text-base" style={{ color: '#C9A84C' }}>{navLabel('qaryaVilla')}</span>
                  {qaryaOpen ? <ChevronUp size={15} className="text-white/40" /> : <ChevronDown size={15} className="text-white/40" />}
                </button>
                <div className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: qaryaOpen ? '600px' : '0px', opacity: qaryaOpen ? 1 : 0 }}>
                  <div className="space-y-1 mt-1">
                    {investorQaryaNavKeys.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      return (
                        <Link key={item.path} to={item.path}
                          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                          style={{ borderRight: isRtl && isActive ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && isActive ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none' }}>
                          <Icon size={18} style={{ color: isActive ? '#C9A84C' : '', flexShrink: 0 }} />
                          <span className="text-sm font-medium">{navLabel(item.key)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <div className="border-b border-white/10 mb-2" />
                <button onClick={() => setReOpen(prev => !prev)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                    <Home size={16} style={{ color: '#C9A84C' }} />
                  </div>
                  <span className="flex-1 text-right font-bold text-base" style={{ color: '#C9A84C' }}>{navLabel('realEstate')}</span>
                  {reOpen ? <ChevronUp size={15} className="text-white/40" /> : <ChevronDown size={15} className="text-white/40" />}
                </button>
                <div className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: reOpen ? '600px' : '0px', opacity: reOpen ? 1 : 0 }}>
                  <div className="space-y-1 mt-1">
                    {investorReNavKeys.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      return (
                        <Link key={item.path} to={item.path}
                          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                          style={{ borderRight: isRtl && isActive ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && isActive ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none' }}>
                          <Icon size={18} style={{ color: isActive ? '#C9A84C' : '', flexShrink: 0 }} />
                          <span className="text-sm font-medium">{navLabel(item.key)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Smart Alerts - Investor */}
              <div className="mt-2">
                <div className="border-b border-white/10 mb-2" />
                <Link
                  to="/smart-alerts"
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/smart-alerts' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  style={{ borderRight: isRtl && location.pathname === '/smart-alerts' ? '3px solid #A8B2C0' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/smart-alerts' ? '3px solid #A8B2C0' : !isRtl ? '3px solid transparent' : 'none' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(168,178,192,0.15)', border: '1px solid rgba(168,178,192,0.3)' }}>
                    <BellRing size={16} style={{ color: '#A8B2C0' }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm" style={{ color: '#A8B2C0' }}>{navLabel('smartAlerts')}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(168,178,192,0.6)' }}>{lang === 'ar' ? 'لتتبع الدفعات' : 'Track Payments'}</span>
                  </div>
                </Link>
                {/* Notes - Investor */}
                <Link
                  to="/notes"
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/notes' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  style={{ borderRight: isRtl && location.pathname === '/notes' ? '3px solid #A8B2C0' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/notes' ? '3px solid #A8B2C0' : !isRtl ? '3px solid transparent' : 'none' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(168,178,192,0.15)', border: '1px solid rgba(168,178,192,0.3)' }}>
                    <StickyNote size={16} style={{ color: '#A8B2C0' }} />
                  </div>
                  <span className="font-bold text-sm" style={{ color: '#A8B2C0' }}>{navLabel('notes')}</span>
                </Link>
              </div>
            </>
          )}

          {/* ── Data Entry ── */}
          {isDataEntry && (
            <div className="space-y-1">
              {dataEntryNavKeys.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link key={item.path} to={item.path}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                    style={{ borderRight: isRtl && isActive ? '3px solid #C9A84C' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && isActive ? '3px solid #C9A84C' : !isRtl ? '3px solid transparent' : 'none' }}>
                    <Icon size={18} style={{ color: isActive ? '#C9A84C' : '', flexShrink: 0 }} />
                    <span className="text-sm font-medium">{navLabel(item.key)}</span>
                  </Link>
                );
              })}
              {/* Notes - Data Entry */}
              <div className="mt-2">
                <div className="border-b border-white/10 mb-2" />
                <Link
                  to="/notes"
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${location.pathname === '/notes' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  style={{ borderRight: isRtl && location.pathname === '/notes' ? '3px solid #A8B2C0' : isRtl ? '3px solid transparent' : 'none', borderLeft: !isRtl && location.pathname === '/notes' ? '3px solid #A8B2C0' : !isRtl ? '3px solid transparent' : 'none' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(168,178,192,0.15)', border: '1px solid rgba(168,178,192,0.3)' }}>
                    <StickyNote size={16} style={{ color: '#A8B2C0' }} />
                  </div>
                  <span className="font-bold text-sm" style={{ color: '#A8B2C0' }}>{navLabel('notes')}</span>
                </Link>
              </div>
            </div>
          )}

        </nav>

        {/* Language + User */}
        <div className="border-t border-white/10 p-3 space-y-2 flex-shrink-0">
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 active:bg-white/10 transition-all text-sm min-h-[44px]"
          >
            <Globe size={16} style={{ flexShrink: 0 }} />
            <span>{lang === 'ar' ? 'English' : 'عربي'}</span>
          </button>

          <div className="flex items-center gap-3 px-3 py-2">
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}
              className="flex items-center gap-3 flex-1 min-w-0 hover:bg-white/5 p-1 rounded-xl transition-all text-right"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: '#C9A84C', color: '#0E1A30' }}>
                {user?.full_name?.[0] || 'م'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{user?.full_name || 'المدير'}</p>
                <p className="text-white/40 text-xs truncate">{roleLabel}</p>
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleLogout(e); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-all flex-shrink-0"
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut size={16} />
            </button>
          </div>

          {user?.role !== 'admin' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm min-h-[44px]"
            >
              <X size={15} style={{ flexShrink: 0 }} />
              <span>{lang === 'ar' ? 'حذف الحساب' : 'Delete Account'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isRtl ? 'lg:mr-64' : 'lg:ml-64'}`}>

        {/* Top Bar */}
        <header
          className="bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30"
          dir="ltr"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            minHeight: 'calc(56px + env(safe-area-inset-top))',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-12 h-12 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors -ml-2 relative z-10"
            style={{ color: '#111827' }}
          >
            <Menu size={22} color="#111827" />
          </button>

          <div className="lg:hidden relative flex-1 flex items-center justify-center">
            <span className="font-bold text-lg" style={{ color: '#C9A84C' }}>{lang === 'ar' ? 'المطيري' : 'Al-Mutairi'}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <NotificationDropdown
              lang={lang}
              newPaymentsCount={newPaymentsCount}
              newExpensesCount={newExpensesCount}
              urgentAlertsCount={urgentAlertsCount}
              expiredContractsCount={expiredContractsCount}
              registrationRequestsCount={registrationRequestsCount}
              notesCount={notesCount}
              userRole={user?.role}
              onBellClick={handleBellClick}
            />
            <button
              onClick={toggleLang}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
            >
              <Globe size={15} />
              <span>{lang === 'ar' ? 'English' : 'عربي'}</span>
            </button>
            <div className="h-6 w-px bg-border hidden lg:block" />
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 rounded-xl hover:bg-secondary transition-colors px-2 py-2 -mr-2 lg:px-2 lg:py-1.5 min-h-[44px] lg:min-h-0"
            >
              <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: '#1B2B4B', color: '#C9A84C' }}>
                {user?.full_name?.[0] || 'م'}
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">{user?.username || user?.full_name || (lang === 'ar' ? 'المدير' : 'Owner')}</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main
          ref={mainRef}
          className="flex-1 p-4 lg:p-6 overflow-auto lg:pb-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
        >
          {(() => {
            const noDashboardRoutes = ['/', '/dashboard', '/re-dashboard'];
            if (noDashboardRoutes.includes(location.pathname)) return null;
            const isRePage = location.pathname.startsWith('/re-');
            const dashTarget = isRePage ? '/re-dashboard' : '/dashboard';
            const BackIcon = isRtl ? ChevronLeft : ChevronRight;
            return (
              <button
                onClick={() => navigate(dashTarget)}
                className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white border border-border bg-white/80 shadow-sm"
                style={{ color: '#1B2B4B' }}
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                <BackIcon size={16} />
                <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
              </button>
            );
          })()}
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav lang={lang} />

      {/* Delete Account Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-5 animate-fade-in-up"
            dir="rtl"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
              <X size={28} style={{ color: '#E63946' }} />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>
                {lang === 'ar' ? 'حذف الحساب' : 'Delete Account'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === 'ar' ? 'هل أنت متأكد من حذف حسابك؟' : 'Are you sure you want to delete your account?'}
              </p>
            </div>
            <div className="w-full rounded-xl px-4 py-3 text-center" style={{ backgroundColor: '#F8F9FA', border: '1px solid #E2E8F0' }}>
              <p className="text-xs text-muted-foreground mb-0.5">{lang === 'ar' ? 'الحساب المسجل' : 'Registered Account'}</p>
              <p className="font-bold text-base" style={{ color: '#1B2B4B' }}>{user?.full_name || user?.email || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ direction: 'ltr' }}>{user?.email}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
                className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-colors hover:bg-secondary"
                style={{ borderColor: '#E2E8F0', color: '#1B2B4B' }}
              >
                {lang === 'ar' ? 'لا، تراجع' : 'No, Cancel'}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors"
                style={{ backgroundColor: deletingAccount ? '#F87171' : '#E63946' }}
              >
                {deletingAccount
                  ? (lang === 'ar' ? 'جاري...' : 'Processing...')
                  : (lang === 'ar' ? 'نعم، احذف' : 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}