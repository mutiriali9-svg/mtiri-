import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, X, BellDot, FileWarning } from 'lucide-react';

export default function NotificationDropdown({ lang, newPaymentsCount, urgentAlertsCount, expiredContractsCount, userRole }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isRtl = lang === 'ar';

  const totalCount = (newPaymentsCount || 0) + (urgentAlertsCount || 0) + (expiredContractsCount || 0);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  const showSmartAlerts = userRole === 'admin' || userRole === 'data_entry' || userRole === 'investor';
  const showNotifications = userRole === 'admin' || userRole === 'investor';

  const items = [];
  if (showSmartAlerts) {
    items.push({
      icon: BellRing,
      label: isRtl ? 'المتأخرات - التنبيهات الذكية' : 'Overdue - Smart Alerts',
      count: urgentAlertsCount || 0,
      color: urgentAlertsCount > 0 ? '#E63946' : '#6B7280',
      to: '/smart-alerts',
    });
  }
  if (showNotifications) {
    items.push({
      icon: Bell,
      label: isRtl ? 'آخر الدفعات والمصروفات' : 'Recent Payments & Expenses',
      count: newPaymentsCount || 0,
      color: newPaymentsCount > 0 ? '#E63946' : '#6B7280',
      to: '/notifications',
    });
  }

  const showExpiredContracts = userRole === 'admin' || userRole === 'investor';
  if (showExpiredContracts) {
    items.push({
      icon: FileWarning,
      label: isRtl ? 'العقود المنتهية' : 'Expired Contracts',
      count: expiredContractsCount || 0,
      color: expiredContractsCount > 0 ? '#E63946' : '#6B7280',
      to: '/contracts',
    });
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-secondary transition-colors"
      >
        {totalCount > 0 ? (
          <BellDot size={20} style={{ color: '#E63946' }} />
        ) : (
          <Bell size={20} className="text-muted-foreground" />
        )}
        {totalCount > 0 && (
          <span
            className="absolute -top-0.5 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: '#E63946', right: '-2px' }}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-12 z-50 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in-up"
          style={{
            minWidth: '260px',
            right: isRtl ? '0' : '0',
            left: 'auto',
            direction: isRtl ? 'rtl' : 'ltr',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
              {isRtl ? 'الإشعارات' : 'Notifications'}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Items */}
          <div className="py-2">
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={idx}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors"
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: item.count > 0 ? 'rgba(230,57,70,0.1)' : '#F3F4F6',
                    }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.count > 0
                        ? (isRtl ? `${item.count} إشعار` : `${item.count} notification${item.count > 1 ? 's' : ''}`)
                        : (isRtl ? 'لا توجد إشعارات' : 'No notifications')}
                    </p>
                  </div>
                  {item.count > 0 && (
                    <span
                      className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: '#E63946' }}
                    >
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}