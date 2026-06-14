import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Bell, CreditCard, Receipt, ArrowRight, ChevronDown, ChevronLeft, X, Image, FileText, Calendar, Hash, Building2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const categoryLabels = {
  ar: { maintenance: 'صيانة', salary: 'رواتب', utilities: 'مرافق', equipment: 'معدات', cleaning: 'نظافة', admin: 'إدارة', marketing: 'تسويق', insurance: 'تأمين', savings: 'ادخار', other: 'أخرى' },
  en: { maintenance: 'Maintenance', salary: 'Salary', utilities: 'Utilities', equipment: 'Equipment', cleaning: 'Cleaning', admin: 'Admin', marketing: 'Marketing', insurance: 'Insurance', savings: 'Savings', other: 'Other' },
};

const paymentMethodLabels = {
  ar: { cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى' },
  en: { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', other: 'Other' },
};

const PREVIEW_COUNT = 5;

function DetailModal({ item, type, onClose, lang }) {
  if (!item) return null;
  const isPayment = type === 'payment';
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
                {item.tenant_name && <Row icon={<User size={15} />} label={isAr ? 'المستأجر' : 'Tenant'} value={item.tenant_name} />}
                {item.unit_number && <Row icon={<Building2 size={15} />} label={isAr ? 'رقم الوحدة' : 'Unit'} value={item.unit_number} />}
                {item.payment_date && <Row icon={<Calendar size={15} />} label={isAr ? 'تاريخ الدفع' : 'Payment Date'} value={new Date(item.payment_date).toLocaleDateString()} />}
                {item.due_months && <Row icon={<FileText size={15} />} label={isAr ? 'مستحق لشهر/أشهر' : 'Due Months'} value={item.due_months} />}
                {item.payment_method && <Row icon={<CreditCard size={15} />} label={isAr ? 'طريقة الدفع' : 'Method'} value={payLabels[item.payment_method] || item.payment_method} />}
                {item.receipt_number && <Row icon={<Hash size={15} />} label={isAr ? 'رقم الإيصال' : 'Receipt No.'} value={item.receipt_number} />}
                {item.notes && <Row icon={<FileText size={15} />} label={isAr ? 'ملاحظات' : 'Notes'} value={item.notes} />}
              </>
            ) : (
              <>
                {item.description && <Row icon={<FileText size={15} />} label={isAr ? 'الوصف' : 'Description'} value={item.description} />}
                {item.expense_date && <Row icon={<Calendar size={15} />} label={isAr ? 'التاريخ' : 'Date'} value={new Date(item.expense_date).toLocaleDateString()} />}
                {item.category && <Row icon={<FileText size={15} />} label={isAr ? 'التصنيف' : 'Category'} value={catLabels[item.category] || item.category} />}
                {item.unit_number && <Row icon={<Building2 size={15} />} label={isAr ? 'رقم الوحدة' : 'Unit'} value={item.unit_number} />}
                {item.vendor && <Row icon={<User size={15} />} label={isAr ? 'المورد' : 'Vendor'} value={item.vendor} />}
                {item.invoice_number && <Row icon={<Hash size={15} />} label={isAr ? 'رقم الفاتورة' : 'Invoice No.'} value={item.invoice_number} />}
                {item.notes && <Row icon={<FileText size={15} />} label={isAr ? 'ملاحظات' : 'Notes'} value={item.notes} />}
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
              <a href={isPayment ? item.receipt_image_url : item.invoice_image_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)', color: isPayment ? '#2A9D8F' : '#E63946' }}>
                <Image size={15} />{isAr ? 'فتح الصورة بالحجم الكامل' : 'Open Full Size'}
              </a>
            </div>
          )}
          {!(isPayment ? item.receipt_image_url : item.invoice_image_url) && (
            <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-2 text-muted-foreground">
              <Image size={24} className="opacity-40" />
              <p className="text-xs">{isPayment ? (isAr ? 'لا يوجد إيصال مرفق' : 'No receipt attached') : (isAr ? 'لا توجد فاتورة مرفقة' : 'No invoice attached')}</p>
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

function SectionCard({ title, icon, color, bgColor, count, children, showAll, onToggleShowAll, onHeaderClick, showMoreLabel, showLessLabel }) {
  return (
    <div className="bg-white card-bevel rounded-2xl overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-border ${onHeaderClick ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`} onClick={onHeaderClick}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgColor }}>{icon}</div>
          <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: bgColor, color }}>{count}</span>
          {onHeaderClick && <ChevronLeft size={16} className="text-muted-foreground" />}
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
      {count > PREVIEW_COUNT && (
        <button onClick={onToggleShowAll} className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold hover:bg-muted/50" style={{ color }}>
          {showAll ? showLessLabel : `${showMoreLabel} (${count - PREVIEW_COUNT})`}
          <ChevronDown size={15} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
export default function Notifications() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [seenAt, setSeenAt] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'investor') { setLoading(false); return; }
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
      setPayments(pays.filter(p => p.payment_date && p.payment_date >= cutoffStr));
      setExpenses(exps.filter(e => e.expense_date && e.expense_date >= cutoffStr));
      setLoading(false);
      setTimeout(() => { localStorage.setItem('notifications_seen_at', new Date().toISOString()); }, 1000);
    };
    fetchData();
  }, [user]);

  if (user?.role !== 'admin' && user?.role !== 'investor') {
    return <div className="text-center py-20 text-muted-foreground">{isAr ? 'غير مصرح' : 'Unauthorized'}</div>;
  }

  const visiblePayments = showAllPayments ? payments : payments.slice(0, PREVIEW_COUNT);
  const visibleExpenses = showAllExpenses ? expenses : expenses.slice(0, PREVIEW_COUNT);

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
          <p className="text-xs text-muted-foreground">{isAr ? 'آخر 30 يوم' : 'Last 30 days'}</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (<div key={i} className="bg-white card-bevel rounded-2xl p-5"><div className="h-4 bg-muted rounded animate-pulse mb-2 w-1/3" /><div className="h-3 bg-muted rounded animate-pulse w-1/2" /></div>))}
        </div>
      ) : (
        <div className="space-y-5">
          <SectionCard
            title={isAr ? 'الدفعات الحديثة' : 'Recent Payments'}
            icon={<CreditCard size={16} style={{ color: '#2A9D8F' }} />}
            color="#2A9D8F" bgColor="rgba(42,157,143,0.1)"
            count={payments.length} showAll={showAllPayments}
            onToggleShowAll={() => setShowAllPayments(p => !p)}
            onHeaderClick={() => navigate('/payments')}
            showMoreLabel={isAr ? 'عرض المزيد' : 'Show more'}
            showLessLabel={isAr ? 'عرض أقل' : 'Show less'}
          >
            {payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{isAr ? 'لا توجد دفعات خلال آخر 30 يوم' : 'No payments in the last 30 days'}</div>
            ) : visiblePayments.map(p => {
              const isNew = seenAt && p.created_at && new Date(p.created_at) > seenAt;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${isNew ? 'bg-red-50/40' : ''}`} onClick={() => { setSelectedItem(p); setSelectedType('payment'); }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>{p.tenant_name}{p.unit_number ? ` — ${isAr ? 'وحدة' : 'Unit'} ${p.unit_number}` : ''}</p>
                      {isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : ''}{p.due_months ? ` · ${p.due_months}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#2A9D8F' }}>{(p.amount || 0).toLocaleString()} AED</p>
                    {p.receipt_image_url && (<span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.15)' }}><Image size={11} style={{ color: '#2A9D8F' }} /></span>)}
                  </div>
                </div>
              );
            })}
          </SectionCard>
          <SectionCard
            title={isAr ? 'المصروفات الحديثة' : 'Recent Expenses'}
            icon={<Receipt size={16} style={{ color: '#E63946' }} />}
            color="#E63946" bgColor="rgba(230,57,70,0.1)"
            count={expenses.length} showAll={showAllExpenses}
            onToggleShowAll={() => setShowAllExpenses(p => !p)}
            onHeaderClick={() => navigate('/expenses')}
            showMoreLabel={isAr ? 'عرض المزيد' : 'Show more'}
            showLessLabel={isAr ? 'عرض أقل' : 'Show less'}
          >
            {expenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{isAr ? 'لا توجد مصروفات خلال آخر 30 يوم' : 'No expenses in the last 30 days'}</div>
            ) : visibleExpenses.map(e => {
              const isNew = seenAt && e.created_at && new Date(e.created_at) > seenAt;
              const catLabels = categoryLabels[lang] || categoryLabels.ar;
              return (
                <div key={e.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${isNew ? 'bg-red-50/40' : ''}`} onClick={() => { setSelectedItem(e); setSelectedType('expense'); }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>{e.description}</p>
                      {isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : ''}{e.category ? ` · ${catLabels[e.category] || e.category}` : ''}{e.unit_number ? ` · ${isAr ? 'وحدة' : 'Unit'} ${e.unit_number}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#E63946' }}>{(e.amount || 0).toLocaleString()} AED</p>
                    {e.invoice_image_url && (<span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.15)' }}><Image size={11} style={{ color: '#E63946' }} /></span>)}
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </div>
      )}
      {selectedItem && <DetailModal item={selectedItem} type={selectedType} onClose={() => { setSelectedItem(null); setSelectedType(null); }} lang={lang} />}
    </div>
  );
}