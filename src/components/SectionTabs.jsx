import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Home } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';

export const SECTION_PAIRS = [
  ['/dashboard', '/re-dashboard'],
  ['/reports', '/re-reports'],
  ['/investors', '/re-investors'],
  ['/units', '/re-units'],
  ['/payments', '/re-payments'],
  ['/expenses', '/re-expenses'],
  ['/savings', '/re-savings'],
];

export function normalizePath(pathname) {
  return pathname === '/' ? '/dashboard' : pathname;
}

export function pairOf(pathname) {
  const current = normalizePath(pathname);
  return SECTION_PAIRS.find(([q, r]) => q === current || r === current) || null;
}

export function twinOf(path) {
  const pair = pairOf(path);
  if (!pair) return null;
  return pair[0] === normalizePath(path) ? pair[1] : pair[0];
}

export function sectionActive(navPath, pathname) {
  const current = normalizePath(pathname);
  return current === navPath || current === twinOf(navPath);
}

export default function SectionTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();

  if (user?.role === 'data_entry') return null;

  const pair = pairOf(location.pathname);
  if (!pair) return null;

  const [qaryaPath, rePath] = pair;
  const isRe = normalizePath(location.pathname).startsWith('/re-');
  const isAr = lang === 'ar';

  const tabs = [
    { path: qaryaPath, icon: Building2, label: isAr ? 'القرية' : 'Qarya', active: !isRe },
    { path: rePath, icon: Home, label: isAr ? 'العقار' : 'Real Estate', active: isRe },
  ];

  return (
    <div
      className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-white border border-border shadow-sm w-full max-w-xs"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {tabs.map(({ path, icon: Icon, label, active }) => (
        <button
          key={path}
          onClick={() => { if (!active) navigate(path); }}
          className="flex-1 flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-lg text-sm font-bold transition-all duration-200"
          style={active
            ? { backgroundColor: '#1B2B4B', color: '#C9A84C' }
            : { backgroundColor: 'transparent', color: '#64748B' }}
        >
          <Icon size={16} style={{ flexShrink: 0 }} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
