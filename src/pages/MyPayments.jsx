import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { CreditCard, X, Calendar, Hash, Building2, User, Image, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const paymentMethodLabels = {
  cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى',
};

const statusLabels = {
  paid: { label: 'مدفوع', color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
  pending: { label: 'معلّق', color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  late: { label: 'متأخر', color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
};

function PaymentDetailModal({ payment, onClose }) {
  if (!payment) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.1)' }}>
              <CreditCard size={18} style={{ color: '#2A9D8F' }} />
            </div>
            <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>تفاصيل الدفعة</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" dir="rtl">
          {/* Amount */}
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'rgba(42,157,143,0.08)' }}>
            <p className="text-xs text-muted-foreground mb-1">المبلغ المدفوع</p>
            <p className="text-3xl font-bold" style={{ color: '#2A9D8F' }}>
              {(payment.amount || 0).toLocaleString('ar-AE')}
              <span className="text-lg mr-1">AED</span>
            </p>
          </div>

          {/* Details */}
          <div className="space-y-0">
            {payment.tenant_name && <Row icon={<User size={14} />} label="المستأجر" value={payment.tenant_name} />}
            {payment.unit_number && <Row icon={<Building2 size={14} />} label="رقم الوحدة" value={payment.unit_number} />}
            {payment.payment_date && <Row icon={<Calendar size={14} />} label="تاريخ الدفع" value={new Date(payment.payment_date).toLocaleDateString('ar-AE')} />}
            {payment.due_date && <Row icon={<Calendar size={14} />} label="تاريخ الاستحقاق" value={new Date(payment.due_date).toLocaleDateString('ar-AE')} />}
            {payment.due_months && <Row icon={<FileText size={14} />} label="مستحق لشهر/أشهر" value={payment.due_months} />}
            {payment.payment_method && <Row icon={<CreditCard size={14} />} label="طريقة الدفع" value={paymentMethodLabels[payment.payment_method] || payment.payment_method} />}
            {payment.receipt_number && <Row icon={<Hash size={14} />} label="رقم الإيصال" value={payment.receipt_number} />}
            {payment.status && (
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground">الحالة</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: statusLabels[payment.status]?.bg, color: statusLabels[payment.status]?.color }}>
                  {statusLabels[payment.status]?.label || payment.status}
                </span>
              </div>
            )}
            {payment.notes && <Row icon={<FileText size={14} />} label="ملاحظات" value={payment.notes} />}
          </div>

          {/* Receipt Image */}
          {payment.receipt_image_url ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Image size={13} /> صورة الإيصال
              </p>
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={payment.receipt_image_url} alt="إيصال" className="w-full object-contain max-h-72"
                  onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <a href={payment.receipt_image_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: 'rgba(42,157,143,0.1)', color: '#2A9D8F' }}>
                <Image size={15} /> فتح الصورة بالحجم الكامل
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center gap-2 text-muted-foreground">
              <Image size={22} className="opacity-40" />
              <p className="text-xs">لا يوجد إيصال مرفق</p>
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
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span className="opacity-60">{icon}</span>{label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function MyPayments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const all = await base44.entities.Payment.list('-payment_date', 200);
      // Show only payments created by this user
      setPayments(all.filter(p => p.created_by_id === user.id));
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="space-y-5 animate-fade-in-up" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/data-entry')}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
        >
          <ChevronRight size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.12)' }}>
          <CreditCard size={20} style={{ color: '#2A9D8F' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>دفعاتي المسجّلة</h1>
          <p className="text-xs text-muted-foreground">الدفعات التي قمت بإدخالها</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white card-bevel rounded-2xl p-4">
              <div className="h-4 bg-muted rounded animate-pulse mb-2 w-2/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white card-bevel rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
          <CreditCard size={32} className="opacity-30" />
          <p className="text-sm text-muted-foreground">لا توجد دفعات مسجّلة منك بعد</p>
        </div>
      ) : (
        <div className="bg-white card-bevel rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>إجمالي الدفعات</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(42,157,143,0.1)', color: '#2A9D8F' }}>
              {payments.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {payments.map(p => {
              const st = statusLabels[p.status] || statusLabels.paid;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
                  onClick={() => setSelected(p)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1B2B4B' }}>
                      {p.tenant_name}{p.unit_number ? ` — وحدة ${p.unit_number}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString('ar-AE') : ''}
                      {p.due_months ? ` · ${p.due_months}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#2A9D8F' }}>
                      {(p.amount || 0).toLocaleString('ar-AE')} AED
                    </p>
                    {p.receipt_image_url && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.15)' }}>
                        <Image size={10} style={{ color: '#2A9D8F' }} />
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && <PaymentDetailModal payment={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}