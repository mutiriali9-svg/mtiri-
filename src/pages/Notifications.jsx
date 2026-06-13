import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Bell, CreditCard, Receipt, ArrowRight, ChevronDown, ChevronLeft, X, Image, FileText, Calendar, Hash, Building2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const categoryLabels = {
  maintenance: 'صيانة', salary: 'رواتب', utilities: 'مرافق',
  equipment: 'معدات', cleaning: 'نظافة', admin: 'إدارة',
  marketing: 'تسويق', insurance: 'تأمين', savings: 'ادخار', other: 'أخرى',
};

const paymentMethodLabels = {
  cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى',
};

const PREVIEW_COUNT = 5;

function DetailModal({ item, type, onClose }) {
  if (!item) return null;
  const isPayment = type === 'payment';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)' }}>
              {isPayment ? <CreditCard size={18} style={{ color: '#2A9D8F' }} /> : <Receipt size={18} style={{ color: '#E63946' }} />}
            </div>
            <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>{isPayment ? 'تفاصيل الدفعة' : 'تفاصيل المصروف'}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" dir="rtl">
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.08)' : 'rgba(230,57,70,0.08)' }}>
            <p className="text-xs text-muted-foreground mb-1">{isPayment ? 'المبلغ المدفوع' : 'المبلغ'}</p>
            <p className="text-3xl font-bold" style={{ color: isPayment ? '#2A9D8F' : '#E63946' }}>
              {(item.amount || 0).toLocaleString('ar-AE')}<span className="text-lg mr-1">AED</span>
            </p>
          </div>
          <div className="space-y-3">
            {isPayment ? (
              <>
                {item.tenant_name && <Row icon={<User size={15} />} label="المستأجر" value={item.tenant_name} />}
                {item.unit_number && <Row icon={<Building2 size={15} />} label="رقم الوحدة" value={item.unit_number} />}
                {item.payment_date && <Row icon={<Calendar size={15} />} label="تاريخ الدفع" value={new Date(item.payment_date).toLocaleDateString('ar-AE')} />}
                {item.due_date && <Row icon={<Calendar size={15} />} label="تاريخ الاستحقاق" value={new Date(item.due_date).toLocaleDateString('ar-AE')} />}
                {item.due_months && <Row icon={<FileText size={15} />} label="مستحق لشهر/أشهر" value={item.due_months} />}
                {item.payment_method && <Row icon={<CreditCard size={15} />} label="طريقة الدفع" value={paymentMethodLabels[item.payment_method] || item.payment_method} />}
                {item.receipt_number && <Row icon={<Hash size={15} />} label="رقم الإيصال" value={item.receipt_number} />}
                {item.notes && <Row icon={<FileText size={15} />} label="ملاحظات" value={item.notes} />}
              </>
            ) : (
              <>
                {item.description && <Row icon={<FileText size={15} />} label="الوصف" value={item.description} />}
                {item.expense_date && <Row icon={<Calendar size={15} />} label="التاريخ" value={new Date(item.expense_date).toLocaleDateString('ar-AE')} />}
                {item.category && <Row icon={<FileText size={15} />} label="التصنيف" value={categoryLabels[item.category] || item.category} />}
                {item.unit_number && <Row icon={<Building2 size={15} />} label="رقم الوحدة" value={item.unit_number} />}
                {item.vendor && <Row icon={<User size={15} />} label="المورد / الجهة" value={item.vendor} />}
                {item.invoice_number && <Row icon={<Hash size={15} />} label="رقم الفاتورة" value={item.invoice_number} />}
                {item.notes && <Row icon={<FileText size={15} />} label="ملاحظات" value={item.notes} />}
              </>
            )}
          </div>
          {(isPayment ? item.receipt_image_url : item.invoice_image_url) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Image size={13} />{isPayment ? 'صورة الإيصال' : 'صورة الفاتورة'}</p>
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={isPayment ? item.receipt_image_url : item.invoice_image_url} alt={isPayment ? 'إيصال' : 'فاتورة'} className="w-full object-contain max-h-72" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <a href={isPayment ? item.receipt_image_url : item.invoice_image_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80" style={{ backgroundColor: isPayment ? 'rgba(42,157,143,0.1)' : 'rgba(230,57,70,0.1)', color: isPayment ? '#2A9D8F' : '#E63946' }}>
                <Image size={15} />فتح الصورة بالحجم الكامل
              </a>
            </div>
          )}
          {!(isPayment ? item.receipt_image_url : item.invoice_image_url) && (
            <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-2 text-muted-foreground">
              <Image size={24} className="opacity-40" />
              <p className="text-xs">{isPayment ? 'لا يوجد إيصال مرفق' : 'لا توجد فاتورة مرفقة'}</p>
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
      <span className="text-sm font-medium text-foreground text-left">{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, color, bgColor, count, children, showAll, onToggleShowAll, onHeaderClick }) {
  return (
    <div className="bg-white card-bevel rounded-2xl overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-border ${onHeaderClick ? 'cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50' : ''}`} onClick={onHeaderClick}>
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
        <button onClick={onToggleShowAll} className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors hover:bg-muted/50" style={{ color }}>
          {showAll ? 'عرض أقل' : `عرض المزيد (${count - PREVIEW_COUNT})`}
          <ChevronDown size={15} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
export default function Notifications() {
  const { user } = useAuth();
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
    return <div className="text-center py-20 text-muted-foreground">غير مصرح</div>;
  }

  const visiblePayments = showAllPayments ? payments : payments.slice(0, PREVIEW_COUNT);
  const visibleExpenses = showAllExpenses ? expenses : expenses.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-5 animate-fade-in-up" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowRight size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(201,168,76,0.15)' }}>
          <Bell size={20} style={{ color: '#C9A84C' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>الإشعارات</h1>
          <p className="text-xs text-muted-foreground">آخر 30 يوم</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (<div key={i} className="bg-white card-bevel rounded-2xl p-5"><div className="h-4 bg-muted rounded animate-pulse mb-2 w-1/3" /><div className="h-3 bg-muted rounded animate-pulse w-1/2" /></div>))}
        </div>
      ) : (
        <div className="space-y-5">
          <SectionCard title="الدفعات الحديثة" icon={<CreditCard size={16} style={{ color: '#2A9D8F' }} />} color="#2A9D8F" bgColor="rgba(42,157,143,0.1)" count={payments.length} showAll={showAllPayments} onToggleShowAll={() => setShowAllPayments(p => !p)} onHeaderClick={() => navigate('/payments')}>
            {payments.length === 0 ? (<div className="p-8 text-center text-sm text-muted-foreground">لا توجد دفعات خلال آخر 30 يوم</div>
            ) : visiblePayments.map(p => {
              const isNew = seenAt && p.created_at && new Date(p.created_at) > seenAt;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${isNew ? 'bg-red-50/40' : ''}`} onClick={() => { setSelectedItem(p); setSelectedType('payment'); }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>{p.tenant_name}{p.unit_number ? ` — وحدة ${p.unit_number}` : ''}</p>
                      {isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('ar-AE') : ''}{p.due_months ? ` · ${p.due_months}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#2A9D8F' }}>{(p.amount || 0).toLocaleString('ar-AE')} AED</p>
                    {p.receipt_image_url && (<span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.15)' }}><Image size={11} style={{ color: '#2A9D8F' }} /></span>)}
                  </div>
                </div>
              );
            })}
          </SectionCard>
          <SectionCard title="المصروفات الحديثة" icon={<Receipt size={16} style={{ color: '#E63946' }} />} color="#E63946" bgColor="rgba(230,57,70,0.1)" count={expenses.length} showAll={showAllExpenses} onToggleShowAll={() => setShowAllExpenses(p => !p)} onHeaderClick={() => navigate('/expenses')}>
            {expenses.length === 0 ? (<div className="p-8 text-center text-sm text-muted-foreground">لا توجد مصروفات خلال آخر 30 يوم</div>
            ) : visibleExpenses.map(e => {
              const isNew = seenAt && e.created_at && new Date(e.created_at) > seenAt;
              return (
                <div key={e.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${isNew ? 'bg-red-50/40' : ''}`} onClick={() => { setSelectedItem(e); setSelectedType('expense'); }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>{e.description}</p>
                      {isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{e.expense_date ? new Date(e.expense_date).toLocaleDateString('ar-AE') : ''}{e.category ? ` · ${categoryLabels[e.category] || e.category}` : ''}{e.unit_number ? ` · وحدة ${e.unit_number}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#E63946' }}>{(e.amount || 0).toLocaleString('ar-AE')} AED</p>
                    {e.invoice_image_url && (<span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.15)' }}><Image size={11} style={{ color: '#E63946' }} /></span>)}
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </div>
      )}
      {selectedItem && <DetailModal item={selectedItem} type={selectedType} onClose={() => { setSelectedItem(null); setSelectedType(null); }} />}
    </div>
  );
}