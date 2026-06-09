import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const NO_BACK_ROUTES = ['/', '/dashboard', '/re-dashboard'];

export default function MobileHeader({ lang }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isRtl = lang === 'ar';

  if (NO_BACK_ROUTES.includes(location.pathname)) return null;

  const isRePage = location.pathname.startsWith('/re-');
  const dashTarget = isRePage ? '/re-dashboard' : '/dashboard';
  const BackIcon = isRtl ? ChevronLeft : ChevronRight;
  const label = lang === 'ar' ? 'الرئيسية' : 'Home';

  return (
    <div className="lg:hidden flex items-center gap-1 absolute right-0 left-0 top-0 bottom-0 pointer-events-none">
      <button
        onClick={() => navigate(dashTarget)}
        className="pointer-events-auto flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors min-h-[44px]"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        <BackIcon size={18} className="flex-shrink-0" />
        <span>{label}</span>
      </button>
    </div>
  );
}