import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, Users, BarChart2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const tabs = [
  { path: '/dashboard', icon: LayoutDashboard, labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/units', icon: Building2, labelAr: 'الوحدات', labelEn: 'Units' },
  { path: '/payments', icon: CreditCard, labelAr: 'الدفعات', labelEn: 'Payments' },
  { path: '/investors', icon: Users, labelAr: 'المستثمرين', labelEn: 'Investors' },
  { path: '/reports', icon: BarChart2, labelAr: 'التقارير', labelEn: 'Reports' },
];

const reTabs = [
  { path: '/re-dashboard', icon: LayoutDashboard, labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/re-units', icon: Building2, labelAr: 'الوحدات', labelEn: 'Units' },
  { path: '/re-payments', icon: CreditCard, labelAr: 'الدفعات', labelEn: 'Payments' },
  { path: '/re-investors', icon: Users, labelAr: 'المستثمرين', labelEn: 'Investors' },
  { path: '/re-reports', icon: BarChart2, labelAr: 'التقارير', labelEn: 'Reports' },
];

export default function MobileBottomNav({ lang }) {
  const location = useLocation();
  const { user } = useAuth();

  // Don't show for data_entry or on non-main pages
  if (user?.role === 'data_entry') return null;

  // Detect if on real-estate section
  const isRe = location.pathname.startsWith('/re-');
  const navTabs = isRe ? reTabs : tabs;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        backgroundColor: '#0E1A30',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navTabs.map(({ path, icon: Icon, labelAr, labelEn }) => {
        const isActive = location.pathname === path || location.pathname === '/' && path === '/dashboard';
        return (
          <Link
            key={path}
            to={path}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 select-none"
            style={{ color: isActive ? '#C9A84C' : 'rgba(255,255,255,0.45)' }}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">
              {lang === 'ar' ? labelAr : labelEn}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}