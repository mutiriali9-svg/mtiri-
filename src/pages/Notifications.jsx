import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Bell, CreditCard, Receipt, ArrowRight, ChevronDown, X, Image, FileText, Calendar, Hash, Building2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const categoryLabels = {
  ar: { maintenance: 'صيانة', salary: 'رواتب', utilities: 'مرافق', equipment: 'معدات', cleaning: 'نظافة', admin: 'إدارة', marketing: 'تسويق', insurance: 'تأمين', savings: 'ادخار', other: 'أخرى' },
  en: { maintenance: 'Maintenance', salary: 'Salary', utilities: 'Utilities', equipment: 'Equipment', cleaning: 'Cleaning', admin: 'Admin', marketing: 'Marketing', insurance: 'Insurance', savings: 'Savings', other: 'Other' },
};

const paymentMethodLabels = {
  ar: { cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى' },
  en: { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', other: 'Other' },
};

const PREVIEW_COUNT = 8;

function DetailModal({ item, onClose, lang }) {
  if (!item) return null;
  const isPayment = item._type === 'payment';
  const isAr = lang === 'ar';
  const catLabels = categoryLabels[lang] || categoryLabels.ar;
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
              {(item.amount || 0).toLocaleString()}<span className="text-lg mr-1">AED</span>
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

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="text-muted-foreground/60">{icon}</span>{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [seenAt, setSeenAt] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'investor' && user.role !== 'tester') { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      const RESET_DATE = '2026-06-01T00:00:00.000Z';
      const savedSeenAt = localStorage.getItem('notifications_seen_at');
      setSeenAt(new Date(savedSeenAt || RESET_DATE));

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const [pays, exps] = await Promise.all([
        base44.entities.Payment.list('-payment_date', 200),
        base44.entities.Expense.list('-expense_date', 200),
      ]);

      const payments = pays
        .filter(p => p.payment_date && p.payment_date >= cutoffStr)
        .map(p => ({ ...p, _type: 'payment', _sortDate: p.payment_date }));

      const expenses = exps
        .filter(e => e.expense_date && e.expense_date >= cutoffStr)
        .map(e => ({ ...e, _type: 'expense', _sortDate: e.expense_date }));

      const combined = [...payments, ...expenses].sort((a, b) =>
        b._sortDate.localeCompare(a._sortDate)
      );

      setFeed(combined);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Mark as seen on visit
  
  if (user?.role !== 'admin' && user?.role !== 'investor' && user?.role !== 'tester') {
    return <div className="text-center py-20 text-muted-foreground">{isAr ? 'غير مصرح' : 'Unauthorized'}</div>;
  }

  const visibleFeed = showAll ? feed : feed.slice(0, PREVIEW_COUNT);
  const paymentsCount = feed.filter(i => i._type === 'payment').length;
  const expensesCount = feed.filter(i => i._type === 'expense').length;

  return (
    <div className="space-y-5 animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowRight size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(201,168,76,0.15)' }}>
          <Bell size={20} style={{ color: '#C9A84C' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الإشعارات' : 'Notifications'}</h1>
          <p className="text-xs text-muted-foreground">{isAr ? 'آخر 30 يوم' : 'Last 30 days'}</p>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white card-bevel rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.1)' }}>
              <CreditCard size={18} style={{ color: '#2A9D8F' }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'الدفعات' : 'Payments'}</p>
              <p className="text-xl font-bold" style={{ color: '#2A9D8F' }}>{paymentsCount}</p>
            </div>
          </div>
          <div className="bg-white card-bevel rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.1)' }}>
              <Receipt size={18} style={{ color: '#E63946' }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'المصروفات' : 'Expenses'}</p>
              <p className="text-xl font-bold" style={{ color: '#E63946' }}>{expensesCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Combined Feed */}
      <div className="bg-white card-bevel rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
            {isAr ? 'الدفعات والمصروفات الحديثة' : 'Recent Payments & Expenses'}
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{feed.length}</span>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded animate-pulse w-1/3" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))
          ) : feed.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {isAr ? 'لا توجد بيانات خلال آخر 30 يوم' : 'No data in the last 30 days'}
            </div>
          ) : (
            visibleFeed.map(item => {
              const isPayment = item._type === 'payment';
              const color = isPayment ? '#2A9D8F' : '#E63946';
              const bgColor = isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)';
              const Icon = isPayment ? CreditCard : Receipt;
              const isNew = seenAt && item.created_at && new Date(item.created_at) > seenAt;
              const date = isPayment ? item.payment_date : item.expense_date;
              const label = isPayment ? item.tenant_name : item.description;
              const sub = isPayment
                ? (item.unit_number ? `${isAr ? 'وحدة' : 'Unit'} ${item.unit_number}` : '')
                : ((categoryLabels[lang]||categoryLabels.ar)[item.category] || item.category || '');

              return (
                <div
                  key={`${item._type}-${item.id}`}
                  onClick={() => setSelectedItem(item)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${isNew ? 'bg-amber-50/30' : ''}`}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>{label}</p>
                      {isNew && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {date ? new Date(date).toLocaleDateString() : ''}
                      {sub ? ` · ${sub}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color }}>{(item.amount || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AED</span></p>
                    {(isPayment ? item.receipt_image_url : item.invoice_image_url) && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                        <Image size={11} style={{ color }} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {feed.length > PREVIEW_COUNT && (
          <button
            onClick={() => setShowAll(p => !p)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
            style={{ color: '#1B2B4B' }}
          >
            {showAll ? (isAr ? 'عرض أقل' : 'Show less') : `${isAr ? 'عرض المزيد' : 'Show more'} (${feed.length - PREVIEW_COUNT})`}
            <ChevronDown size={15} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} lang={lang} />}
    </div>
  );
}