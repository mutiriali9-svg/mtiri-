import { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, X, BellDot, FileWarning, ClipboardList, CreditCard, Receipt, StickyNote, ChevronLeft, Home, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotificationDropdown({
  lang, userId, newPaymentsCount, newExpensesCount, urgentAlertsCount,
  expiredContractsCount, expiredQaryaCount, expiredReCount,
  registrationRequestsCount, notesCount, userRole, onBellClick
}) {

  const [open, setOpen] = useState(false);
  const [expiredOpen, setExpiredOpen] = useState(false);
  const ref = useRef(null);
  const isRtl = lang === 'ar';
  const [seenCount, setSeenCount] = useState(() => Number(localStorage.getItem(`bell_seen_count_${userId}`) || 0));

  const combinedFinanceCount = (newPaymentsCount || 0) + (newExpensesCount || 0);

  // إذا ما توصل أرقام مقسّمة، نستخدم الرقم القديم كله على القرية (توافق عكسي)
  const qaryaExpired = expiredQaryaCount ?? expiredContractsCount ?? 0;
  const reExpired = expiredReCount ?? 0;
  const totalExpired = qaryaExpired + reExpired;

  const totalCount =
    combinedFinanceCount +
    (urgentAlertsCount || 0) +
    ((userRole === 'admin' || userRole === 'investor' || userRole === 'data_entry' || userRole === 'tester') ? totalExpired : 0) +
    (userRole === 'admin' ? (registrationRequestsCount || 0) : 0) +
    (notesCount || 0);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setExpiredOpen(false);
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
      key: 'smart',
      icon: BellRing,
      label: isRtl ? 'المتأخرات - التنبيهات الذكية' : 'Overdue - Smart Alerts',
      count: urgentAlertsCount || 0,
      color: (urgentAlertsCount || 0) > 0 ? '#E63946' : '#6B7280',
      to: '/smart-alerts',
    });
  }

  if (showFinance) {
    items.push({
      key: 'finance',
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

  // العقود المنتهية أصبح عنصر "قابل للفتح" مش رابط مباشر
  if (showExpiredContracts) {
    items.push({
      key: 'expired',
      icon: FileWarning,
      label: isRtl ? 'العقود المنتهية' : 'Expired Contracts',
      count: totalExpired,
      color: totalExpired > 0 ? '#E63946' : '#6B7280',
      expandable: true,
    });
  }

  if (userRole === 'admin' && (registrationRequestsCount || 0) > 0) {
    items.push({
      key: 'reg',
      icon: ClipboardList,
      label: isRtl ? 'طلبات التسجيل' : 'Registration Requests',
      count: registrationRequestsCount || 0,
      color: '#E63946',
      to: '/registration-requests',
    });
  }

  items.push({
    key: 'notes',
    icon: StickyNote,
    label: isRtl ? 'الملاحظات' : 'Notes',
    count: notesCount || 0,
    color: (notesCount || 0) > 0 ? '#E63946' : '#6B7280',
    to: '/notes',
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);
          if (!willOpen) setExpiredOpen(false);
          if (willOpen) {
            setSeenCount(totalCount);
            localStorage.setItem(`bell_seen_count_${userId}`, String(totalCount));
            if (onBellClick) onBellClick();
          }
        }}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-secondary transition-colors"
      >
        {(totalCount - seenCount) > 0 ? (
          <BellDot size={20} style={{ color: '#E63946' }} />
        ) : (
          <Bell size={20} className="text-muted-foreground" />
        )}
        {(totalCount - seenCount) > 0 && (
          <span
            className="absolute -top-0.5 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: '#E63946', right: '-2px' }}
          >
            {(totalCount - seenCount) > 99 ? '99+' : (totalCount - seenCount)}
          </span>
        )}
      </button>

      {open && (
  <div
    className="absolute top-12 z-50"
    style={{ right: '0' }}
  >
    <div className="flex items-start" style={{ flexDirection: 'row' }}>

      {/* الخانة الفرعية - دائمًا فيزيائيًا على يسار القائمة الرئيسية */}
      {expiredOpen && (
        <div
          className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in-up"
          style={{ minWidth: '190px', marginRight: '8px', order: 1 }}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div className="px-4 py-3 border-b border-border">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
              {isRtl ? 'العقود المنتهية' : 'Expired Contracts'}
            </span>
          </div>
          <Link
            to="/units"
            onClick={() => { setOpen(false); setExpiredOpen(false); }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(230,57,70,0.1)' }}>
              <Home size={15} style={{ color: '#E63946' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{isRtl ? 'القرية' : 'Qarya'}</p>
            </div>
            <span className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#E63946' }}>
              {qaryaExpired > 99 ? '99+' : qaryaExpired}
            </span>
          </Link>
          <Link
            to="/re-units"
            onClick={() => { setOpen(false); setExpiredOpen(false); }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(230,57,70,0.1)' }}>
              <Building2 size={15} style={{ color: '#E63946' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{isRtl ? 'العقارات' : 'Real Estate'}</p>
            </div>
            <span className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#E63946' }}>
              {reExpired > 99 ? '99+' : reExpired}
            </span>
          </Link>
        </div>
      )}

      {/* القائمة الرئيسية - تبقى ثابتة بمكانها دائمًا */}
      <div
        className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in-up"
        style={{ minWidth: '270px', order: 2 }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
            {isRtl ? 'الإشعارات' : 'Notifications'}
          </span>
          <button
            onClick={() => { setOpen(false); setExpiredOpen(false); }}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const bgColor = item.count > 0 ? 'rgba(230,57,70,0.1)' : '#F3F4F6';

            const rowContent = (
              <>
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
                    style={{ backgroundColor: '#E63946' }}
                  >
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                )}
                {item.expandable && (
  <ChevronLeft size={14} className="text-muted-foreground flex-shrink-0" style={{ transform: expiredOpen ? 'rotate(180deg)' : 'none' }} />
)}
              </>
            );

            if (item.expandable) {
              return (
                <button
                  key={item.key}
                  onClick={() => setExpiredOpen(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors"
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  {rowContent}
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => { setOpen(false); setExpiredOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors"
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                {rowContent}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  </div>
)}