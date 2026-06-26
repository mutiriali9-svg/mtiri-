import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Bell, CreditCard, Receipt, ArrowRight, X, Image, FileText, Calendar, Hash, Building2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const categoryLabels = {
  ar: { maintenance: 'صيانة', salary: 'رواتب', utilities: 'مرافق', equipment: 'معدات', cleaning: 'نظافة', admin: 'إدارة', marketing: 'تسويق', insurance: 'تأمين', savings: 'ادخار', other: 'أخرى' },
  en: { maintenance: 'Maintenance', salary: 'Salary', utilities: 'Utilities', equipment: 'Equipment', cleaning: 'Cleaning', admin: 'Admin', marketing: 'Marketing', insurance: 'Insurance', savings: 'Savings', other: 'Other' },
};
const paymentMethodLabels = {
  ar: { cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى' },
  en: { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', other: 'Other' },
};

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="text-muted-foreground/60">{icon}</span>{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function DetailModal({ notif, onClose, lang }) {
  if (!notif) return null;
  const item = notif.reference_data || {};
  const isPayment = notif.type === 'payment' || notif.type === 're_payment';
  const isAr = lang === 'ar';
  const payLabels = paymentMethodLabels[lang] || paymentMethodLabels.ar;
  const color = isPayment ? '#2A9D8F' : '#E63946';
  const bgTint = isPayment ? 'rgba(42,157,143,0.08)' : 'rgba(230,57,70,0.08)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgTint }}>
              {isPayment ? <CreditCard size={16} style={{ color }} /> : <Receipt size={16} style={{ color }} />}
            </div>
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
              {isPayment ? (isAr ? 'تفاصيل الدفعة' : 'Payment Details') : (isAr ? 'تفاصيل المصروف' : 'Expense Details')}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
          {/* Amount */}
          <div className="rounded-xl p-3 text-center mb-3" style={{ backgroundColor: bgTint }}>
            <p className="text-[11px] text-muted-foreground mb-0.5">{isPayment ? (isAr ? 'المبلغ المدفوع' : 'Amount Paid') : (isAr ? 'المبلغ' : 'Amount')}</p>
            <p className="text-2xl font-bold" style={{ color }}>
              {(notif.amount || 0).toLocaleString()} <span className="text-sm">AED</span>
            </p>
          </div>

          {/* Details */}
          <div className="space-y-1">
            {isPayment ? (
              <>
                {item.tenant_name && <Row icon={<User size={13}/>} label={isAr ? 'المستأجر' : 'Tenant'} value={item.tenant_name} />}
                {item.unit_number && <Row icon={<Building2 size={13}/>} label={isAr ? 'رقم الوحدة' : 'Unit'} value={item.unit_number} />}
                {item.payment_date && <Row icon={<Calendar size={13}/>} label={isAr ? 'تاريخ الدفع' : 'Payment Date'} value={new Date(item.payment_date).toLocaleDateString()} />}
                {item.due_months && <Row icon={<FileText size={13}/>} label={isAr ? 'مستحق لشهر' : 'Due Months'} value={item.due_months} />}
                {item.payment_method && <Row icon={<CreditCard size={13}/>} label={isAr ? 'طريقة الدفع' : 'Method'} value={payLabels[item.payment_method] || item.payment_method} />}
                {item.receipt_number && <Row icon={<Hash size={13}/>} label={isAr ? 'رقم الإيصال' : 'Receipt No.'} value={item.receipt_number} />}
                {item.notes && <Row icon={<FileText size={13}/>} label={isAr ? 'ملاحظات' : 'Notes'} value={item.notes} />}
              </>
            ) : (
              <>
                {item.description && <Row icon={<FileText size={13}/>} label={isAr ? 'الوصف' : 'Description'} value={item.description} />}
                {item.expense_date && <Row icon={<Calendar size={13}/>} label={isAr ? 'التاريخ' : 'Date'} value={new Date(item.expense_date).toLocaleDateString()} />}
                {item.category && <Row icon={<FileText size={13}/>} label={isAr ? 'التصنيف' : 'Category'} value={(categoryLabels[lang]||categoryLabels.ar)[item.category] || item.category} />}
                {item.unit_number && <Row icon={<Building2 size={13}/>} label={isAr ? 'رقم الوحدة' : 'Unit'} value={item.unit_number} />}
                {item.vendor && <Row icon={<User size={13}/>} label={isAr ? 'المورد' : 'Vendor'} value={item.vendor} />}
                {item.invoice_number && <Row icon={<Hash size={13}/>} label={isAr ? 'رقم الفاتورة' : 'Invoice No.'} value={item.invoice_number} />}
                {item.notes && <Row icon={<FileText size={13}/>} label={isAr ? 'ملاحظات' : 'Notes'} value={item.notes} />}
              </>
            )}
          </div>

          {/* Receipt/Invoice image */}
          {(isPayment ? item.receipt_image_url : item.invoice_image_url) && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Image size={12} />{isPayment ? (isAr ? 'صورة الإيصال' : 'Receipt') : (isAr ? 'صورة الفاتورة' : 'Invoice')}
              </p>
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={isPayment ? item.receipt_image_url : item.invoice_image_url} alt="receipt" className="w-full object-contain max-h-48" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <a href={isPayment ? item.receipt_image_url : item.invoice_image_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: bgTint, color }}>
                <Image size={13} />{isAr ? 'فتح بالحجم الكامل' : 'Open Full Size'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'investor' && user.role !== 'tester') { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const data = await base44.entities.Notification.list('-created_at', 200);
      const recent = data.filter(n => n.created_at && new Date(n.created_at) >= cutoff);
      setNotifs(recent);
      setLoading(false);

      try {
        const myReads = await base44.entities.NotificationRead.filter({ user_id: user.id });
        const readIds = new Set(myReads.map(r => r.notification_id));
        const toMark = recent.filter(n => !readIds.has(n.id));
        for (const n of toMark) {
          base44.entities.NotificationRead.create({
            user_id: user.id,
            notification_id: n.id,
          }).catch(() => {});
        }
      } catch (e) {
        console.log('reads error:', e);
      }
      window.dispatchEvent(new Event('notifications-updated'));
    };
    fetchData();
  }, [user]);

  const openNotif = (notif) => {
    setSelected(notif);
  };

  if (user?.role !== 'admin' && user?.role !== 'investor' && user?.role !== 'tester') {
    return <div className="text-center py-20 text-muted-foreground">{isAr ? 'غير مصرح' : 'Unauthorized'}</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in-up overflow-x-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowRight size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(201,168,76,0.15)' }}>
          <Bell size={20} style={{ color: '#C9A84C' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الإشعارات' : 'Notifications'}</h1>
          <p className="text-xs text-muted-foreground">{notifs.length > 0 ? `${notifs.length} ${isAr ? 'إشعار جديد' : 'new'}` : (isAr ? 'لا توجد إشعارات جديدة' : 'No new notifications')}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="bg-white card-bevel rounded-2xl p-5">
              <div className="h-4 bg-muted rounded animate-pulse mb-2 w-1/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <div className="bg-white card-bevel rounded-2xl p-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Bell size={40} className="opacity-20" />
          <p className="text-sm">{isAr ? 'لا توجد إشعارات جديدة' : 'No new notifications'}</p>
        </div>
      ) : (
        <div className="bg-white card-bevel rounded-2xl overflow-hidden" style={{ maxWidth: '100%' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
              {isAr ? 'الدفعات والمصروفات الجديدة' : 'New Payments & Expenses'}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{notifs.length}</span>
          </div>
          <div className="divide-y divide-border">
            {notifs.map(n => {
              const isPayment = n.type === 'payment' || n.type === 're_payment';
              const isRe = n.type === 're_payment' || n.type === 're_expense';
              const color = isPayment ? '#2A9D8F' : '#E63946';
              const bgColor = isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)';
              const Icon = isPayment ? CreditCard : Receipt;
              const item = n.reference_data || {};
              const date = isPayment ? item.payment_date : item.expense_date;
              const label = isPayment ? (item.tenant_name || n.title) : (item.description || n.title);
              const tag = isRe ? (isAr ? 'عقارات' : 'RE') : (isAr ? 'القرية' : 'Qarya');

              return (
                <div
                  key={n.id}
                  onClick={() => openNotif(n)}
                  className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
                  style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.04)' : 'rgba(230,57,70,0.04)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-xs truncate" style={{ color: '#1B2B4B' }}>{label}</p>
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded-full shrink-0" style={{ backgroundColor: isRe ? 'rgba(201,168,76,0.15)' : 'rgba(168,178,192,0.15)', color: isRe ? '#C9A84C' : '#6B7280' }}>{tag}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{date ? new Date(date).toLocaleDateString() : ''}</p>
                  </div>
                  <p className="font-bold text-xs shrink-0 whitespace-nowrap" style={{ color }}>{(n.amount || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">AED</span></p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && <DetailModal notif={selected} onClose={() => setSelected(null)} lang={lang} />}
    </div>
  );
}