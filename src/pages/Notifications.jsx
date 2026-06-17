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
  const isPayment = notif.type === 'payment';
  const isAr = lang === 'ar';
  const payLabels = paymentMethodLabels[lang] || paymentMethodLabels.ar;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)' }}>
              {isPayment ? <CreditCard size={18} style={{ color: '#2A9D8F' }} /> : <Receipt size={18} style={{ color: '#E63946' }} />}
            </div>
            <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>
              {isPayment ? (isAr ? 'تفاصيل الدفعة' : 'Payment Details') : (isAr ? 'تفاصيل المصروف' : 'Expense Details')}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.08)' : 'rgba(230,57,70,0.08)' }}>
            <p className="text-xs text-muted-foreground mb-1">{isPayment ? (isAr ? 'المبلغ المدفوع' : 'Amount Paid') : (isAr ? 'المبلغ' : 'Amount')}</p>
            <p className="text-3xl font-bold" style={{ color: isPayment ? '#2A9D8F' : '#E63946' }}>
              {(notif.amount || 0).toLocaleString()}<span className="text-lg mr-1">AED</span>
            </p>
          </div>
          <div className="space-y-3">
            {isPayment ? (
              <>
                {item.tenant_name && <Row icon={<User size={15}/>} label={isAr ? 'المستأجر' : 'Tenant'} value={item.tenant_name} />}
                {item.unit_number && <Row icon={<Building2 size={15}/>} label={isAr ? 'رقم الوحدة' : 'Unit'} value={item.unit_number} />}
                {item.payment_date && <Row icon={<Calendar size={15}/>} label={isAr ? 'تاريخ الدفع' : 'Payment Date'} value={new Date(item.payment_date).toLocaleDateString()} />}
                {item.due_months && <Row icon={<FileText size={15}/>} label={isAr ? 'مستحق لشهر' : 'Due Months'} value={item.due_months} />}
                {item.payment_method && <Row icon={<CreditCard size={15}/>} label={isAr ? 'طريقة الدفع' : 'Method'} value={payLabels[item.payment_method] || item.payment_method} />}
                {item.receipt_number && <Row icon={<Hash size={15}/>} label={isAr ? 'رقم الإيصال' : 'Receipt No.'} value={item.receipt_number} />}
                {item.notes && <Row icon={<FileText size={15}/>} label={isAr ? 'ملاحظات' : 'Notes'} value={item.notes} />}
              </>
            ) : (
              <>
                {item.description && <Row icon={<FileText size={15}/>} label={isAr ? 'الوصف' : 'Description'} value={item.description} />}
                {item.expense_date && <Row icon={<Calendar size={15}/>} label={isAr ? 'التاريخ' : 'Date'} value={new Date(item.expense_date).toLocaleDateString()} />}
                {item.category && <Row icon={<FileText size={15}/>} label={isAr ? 'التصنيف' : 'Category'} value={(categoryLabels[lang]||categoryLabels.ar)[item.category] || item.category} />}
                {item.unit_number && <Row icon={<Building2 size={15}/>} label={isAr ? 'رقم الوحدة' : 'Unit'} value={item.unit_number} />}
                {item.vendor && <Row icon={<User size={15}/>} label={isAr ? 'المورد' : 'Vendor'} value={item.vendor} />}
                {item.invoice_number && <Row icon={<Hash size={15}/>} label={isAr ? 'رقم الفاتورة' : 'Invoice No.'} value={item.invoice_number} />}
                {item.notes && <Row icon={<FileText size={15}/>} label={isAr ? 'ملاحظات' : 'Notes'} value={item.notes} />}
              </>
            )}
          </div>
          {(isPayment ? item.receipt_image_url : item.invoice_image_url) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Image size={13} />{isPayment ? (isAr ? 'صورة الإيصال' : 'Receipt') : (isAr ? 'صورة الفاتورة' : 'Invoice')}
              </p>
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={isPayment ? item.receipt_image_url : item.invoice_image_url} alt="receipt" className="w-full object-contain max-h-72" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <a href={isPayment ? item.receipt_image_url : item.invoice_image_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)', color: isPayment ? '#2A9D8F' : '#E63946' }}>
                <Image size={15} />{isAr ? 'فتح الصورة بالحجم الكامل' : 'Open Full Size'}
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
      const data = await base44.entities.Notification.list('-created_at', 200);
      setNotifs(data.filter(n => n.is_read === false));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const openNotif = async (notif) => {
  console.log('CLICKED notif.id:', notif.id, typeof notif.id);
  console.log('BEFORE filter, count:', notifs.length);
  setSelected(notif);
  setNotifs(prev => {
    const after = prev.filter(n => n.id !== notif.id);
    console.log('AFTER filter, count:', after.length);
    return after;
  });
  try {
    const r = await base44.entities.Notification.update(notif.id, { is_read: true });
    console.log('UPDATE SUCCESS:', r);
  } catch (e) {
    console.log('UPDATE FAILED:', e);
  }
  window.dispatchEvent(new Event('notifications-updated'));
};

  if (user?.role !== 'admin' && user?.role !== 'investor' && user?.role !== 'tester') {
    return <div className="text-center py-20 text-muted-foreground">{isAr ? 'غير مصرح' : 'Unauthorized'}</div>;
  }

  const payments = notifs.filter(n => n.type === 'payment');
  const expenses = notifs.filter(n => n.type === 'expense');

  return (
    <div className="space-y-5 animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>
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
        <div className="bg-white card-bevel rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
              {isAr ? 'الدفعات والمصروفات الجديدة' : 'New Payments & Expenses'}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{notifs.length}</span>
          </div>
          <div className="divide-y divide-border">
            {notifs.map(n => {
              const isPayment = n.type === 'payment';
              const color = isPayment ? '#2A9D8F' : '#E63946';
              const bgColor = isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)';
              const Icon = isPayment ? CreditCard : Receipt;
              const item = n.reference_data || {};
              const date = isPayment ? item.payment_date : item.expense_date;
              const label = isPayment ? (item.tenant_name || n.title) : (item.description || n.title);

              return (
                <div
                  key={n.id}
                  onClick={() => openNotif(n)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
                  style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.04)' : 'rgba(230,57,70,0.04)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>{label}</p>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{date ? new Date(date).toLocaleDateString() : ''}</p>
                  </div>
                  <p className="font-bold text-sm shrink-0" style={{ color }}>{(n.amount || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AED</span></p>
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