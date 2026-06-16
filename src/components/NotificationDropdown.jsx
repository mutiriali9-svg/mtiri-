import { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, X, BellDot, FileWarning, ClipboardList, CreditCard, Receipt, StickyNote } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotificationDropdown({
  lang, newPaymentsCount, newExpensesCount, urgentAlertsCount,
  expiredContractsCount, registrationRequestsCount, notesCount, userRole, onBellClick
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isRtl = lang === 'ar';

  const combinedFinanceCount = (newPaymentsCount || 0) + (newExpensesCount || 0);

  const totalCount =
    combinedFinanceCount +
    (urgentAlertsCount || 0) +
    ((userRole === 'admin' || userRole === 'investor' || userRole === 'data_entry' || userRole === 'tester') ? (expiredContractsCount || 0) : 0) +
    (userRole === 'admin' ? (registrationRequestsCount || 0) : 0) +
    (notesCount || 0);

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

  const showSmartAlerts = userRole === 'admin' || userRole === 'data_entry' || userRole === 'investor' || userRole === 'tester';
  const showFinance = userRole === 'admin' || userRole === 'investor' || userRole === 'tester';
  const showExpiredContracts = userRole === 'admin' || userRole === 'investor' || userRole === 'data_entry' || userRole === 'tester';

  const items = [];

  if (showSmartAlerts) {
    items.push({
      icon: BellRing,
      label: isRtl ? 'المتأخرات - التنبيهات الذكية' : 'Overdue - Smart Alerts',
      count: urgentAlertsCount || 0,
      color: (urgentAlertsCount || 0) > 0 ? '#E63946' : '#6B7280',
      to: '/smart-alerts',
    });
  }

  if (showFinance) {
    items.push({
      icon: CreditCard,
      label: isRtl ? 'آخر الدفعات والمصروفات' : 'Recent Payments & Expenses',
      count: combinedFinanceCount,
      color: combinedFinanceCount > 0 ? '#2A9D8F' : '#6B7280',
      subLabel: combinedFinanceCount > 0
        ? (isRtl
          ? `${newPaymentsCount || 0} دفعة · ${newExpensesCount || 0} مصروف`
          : `${newPaymentsCount || 0} payment · ${newExpensesCount || 0} expense`)
        : null,
      to: '/notifications',
    });
  }

  if (showExpiredContracts) {
    items.push({
      icon: FileWarning,
      label: isRtl ? 'العقود المنتهية' : 'Expired Contracts',
      count: expiredContractsCount || 0,
      color: (expiredContractsCount || 0) > 0 ? '#E63946' : '#6B7280',
      to: '/units',
    });
  }

  if (userRole === 'admin' && (registrationRequestsCount || 0) > 0) {
    items.push({
      icon: ClipboardList,
      label: isRtl ? 'طلبات التسجيل' : 'Registration Requests',
      count: registrationRequestsCount || 0,
      color: '#E63946',
      to: '/registration-requests',
    });
  }

  items.push({
    icon: StickyNote,
    label: isRtl ? 'الملاحظات' : 'Notes',
    count: notesCount || 0,
    color: (notesCount || 0) > 0 ? '#A8B2C0' : '#6B7280',
    to: '/notes',
    silver: true,
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(prev => !prev);
          if (onBellClick) onBellClick();
        }}
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

      {open && (
        <div
          className="absolute top-12 z-50 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in-up"
          style={{ minWidth: '270px', right: '0', left: 'auto', direction: isRtl ? 'rtl' : 'ltr' }}
        >
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

          <div className="py-2">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const isNotes = item.silver;
              const bgColor = item.count > 0
                ? (isNotes ? 'rgba(168,178,192,0.15)' : 'rgba(230,57,70,0.1)')
                : '#F3F4F6';

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
                    style={{ backgroundColor: bgColor }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.subLabel
                        ? item.subLabel
                        : item.count > 0
                          ? (isRtl ? `${item.count} إشعار` : `${item.count} notification${item.count > 1 ? 's' : ''}`)
                          : (isRtl ? 'لا توجد إشعارات' : 'No notifications')}
                    </p>
                  </div>
                  {item.count > 0 && (
                    <span
                      className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: isNotes ? '#A8B2C0' : '#E63946' }}
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