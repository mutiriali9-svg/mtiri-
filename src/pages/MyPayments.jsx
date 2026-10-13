import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { CreditCard, X, Calendar, Hash, Building2, User, Image, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import useBackClose from '@/hooks/useBackClose';

const paymentMethodLabels = {
  cash: { ar: 'نقداً', en: 'Cash' },
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
  cheque: { ar: 'شيك', en: 'Cheque' },
  other: { ar: 'أخرى', en: 'Other' },
};

const statusLabels = {
  paid: { label: { ar: 'مدفوع', en: 'Paid' }, color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
  pending: { label: { ar: 'معلّق', en: 'Pending' }, color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  late: { label: { ar: 'متأخر', en: 'Late' }, color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
};

function PaymentDetailModal({ payment, onClose }) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const locale = isAr ? 'ar-AE' : 'en-GB';
  if (!payment) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.1)' }}>
              <CreditCard size={18} style={{ color: '#2A9D8F' }} />
            </div>
            <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>{isAr ? 'تفاصيل الدفعة' : 'Payment Details'}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
          {/* Amount */}
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'rgba(42,157,143,0.08)' }}>
            <p className="text-xs text-muted-foreground mb-1">{isAr ? 'المبلغ المدفوع' : 'Amount Paid'}</p>
            <p className="text-3xl font-bold" style={{ color: '#2A9D8F' }}>
              {(payment.amount || 0).toLocaleString(locale)}
              <span className="text-lg ms-1">AED</span>
            </p>
          </div>

          {/* Details */}
          <div className="space-y-0">
            {payment.tenant_name && <Row icon={<User size={14} />} label={isAr ? 'المستأجر' : 'Tenant'} value={payment.tenant_name} />}
            {payment.unit_number && <Row icon={<Building2 size={14} />} label={isAr ? 'رقم الوحدة' : 'Unit No.'} value={payment.unit_number} />}
            {payment.payment_date && <Row icon={<Calendar size={14} />} label={isAr ? 'تاريخ الدفع' : 'Payment Date'} value={new Date(payment.payment_date).toLocaleDateString(locale)} />}
            {payment.due_date && <Row icon={<Calendar size={14} />} label={isAr ? 'تاريخ الاستحقاق' : 'Due Date'} value={new Date(payment.due_date).toLocaleDateString(locale)} />}
            {payment.due_months && <Row icon={<FileText size={14} />} label={isAr ? 'مستحق لشهر/أشهر' : 'Due Month(s)'} value={payment.due_months} />}
            {payment.payment_method && <Row icon={<CreditCard size={14} />} label={isAr ? 'طريقة الدفع' : 'Payment Method'} value={paymentMethodLabels[payment.payment_method]?.[lang] || payment.payment_method} />}
            {payment.receipt_number && <Row icon={<Hash size={14} />} label={isAr ? 'رقم الإيصال' : 'Receipt No.'} value={payment.receipt_number} />}
            {payment.status && (
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground">{isAr ? 'الحالة' : 'Status'}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: statusLabels[payment.status]?.bg, color: statusLabels[payment.status]?.color }}>
                  {statusLabels[payment.status]?.label[lang] || payment.status}
                </span>
              </div>
            )}
            {payment.notes && <Row icon={<FileText size={14} />} label={isAr ? 'ملاحظات' : 'Notes'} value={payment.notes} />}
          </div>

          {/* Receipt Image */}
          {payment.receipt_image_url ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Image size={13} /> {isAr ? 'صورة الإيصال' : 'Receipt Image'}
              </p>
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={payment.receipt_image_url} alt={isAr ? 'إيصال' : 'Receipt'} className="w-full object-contain max-h-72"
                  onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <a href={payment.receipt_image_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: 'rgba(42,157,143,0.1)', color: '#2A9D8F' }}>
                <Image size={15} /> {isAr ? 'فتح الصورة بالحجم الكامل' : 'Open Full-Size Image'}
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center gap-2 text-muted-foreground">
              <Image size={22} className="opacity-40" />
              <p className="text-xs">{isAr ? 'لا يوجد إيصال مرفق' : 'No receipt attached'}</p>
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
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const OpenIcon = isAr ? ChevronLeft : ChevronRight;
  const locale = isAr ? 'ar-AE' : 'en-GB';
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  useBackClose(!!selected, () => setSelected(null));

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const all = await base44.entities.Payment.list('-payment_date', 200);
      // Show only payments created by this user
      setPayments(all.filter(p => p.created_by === user.id));
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="space-y-5 animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.12)' }}>
          <CreditCard size={20} style={{ color: '#2A9D8F' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'دفعاتي المسجّلة' : 'My Recorded Payments'}</h1>
          <p className="text-xs text-muted-foreground">{isAr ? 'الدفعات التي قمت بإدخالها' : 'Payments you have entered'}</p>
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
          <p className="text-sm text-muted-foreground">{isAr ? 'لا توجد دفعات مسجّلة منك بعد' : 'You have not recorded any payments yet'}</p>
        </div>
      ) : (
        <div className="bg-white card-bevel rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{isAr ? 'إجمالي الدفعات' : 'Total Payments'}</span>
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
                      {p.tenant_name}{p.unit_number ? ` — ${isAr ? 'وحدة' : 'Unit'} ${p.unit_number}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString(locale) : ''}
                      {p.due_months ? ` · ${p.due_months}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#2A9D8F' }}>
                      {(p.amount || 0).toLocaleString(locale)} AED
                    </p>
                    {p.receipt_image_url && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(42,157,143,0.15)' }}>
                        <Image size={10} style={{ color: '#2A9D8F' }} />
                      </span>
                    )}
                    <OpenIcon size={14} className="text-muted-foreground" />
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