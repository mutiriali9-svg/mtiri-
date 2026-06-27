import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import {
  Bell, Plus, Trash2, CheckCircle2, AlertTriangle,
  Building2, Home, Search, X, Edit2, Calendar, RefreshCw, Upload, MessageCircle, FileImage
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MobileDrawerSelect from '@/components/MobileDrawerSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { differenceInDays, parseISO, isValid, addMonths, format } from 'date-fns';
import ConfirmDialog from '@/components/ConfirmDialog';

const PAYMENT_PLANS = [
  { value: 'monthly', label: { ar: 'شهري', en: 'Monthly' }, months: 1 },
  { value: 'quarterly', label: { ar: 'كل 3 أشهر', en: 'Quarterly' }, months: 3 },
  { value: 'five_annual', label: { ar: '5 دفعات سنوياً', en: '5x Annually' }, days: 73 },
  { value: 'biannual', label: { ar: 'كل 6 أشهر', en: 'Biannual' }, months: 6 },
  { value: 'annual', label: { ar: 'سنوي', en: 'Annual' }, months: 12 },
];

const statusConfig = {
  active: { label: { ar: 'نشط', en: 'Active' }, color: '#1B2B4B', bg: 'rgba(27,43,75,0.08)' },
  paid: { label: { ar: 'مدفوع', en: 'Paid' }, color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
  overdue: { label: { ar: 'متأخر', en: 'Overdue' }, color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
};

const emptyForm = {
  unit_number: '', tenant_name: '', property_type: 'qarya',
  alert_date: '', alert_time: '', original_amount: '', accumulated_amount: '', remaining_balance: '', description: '',
  payment_plan: 'monthly', status: 'active',
};

function getNextDateFromPlan(startDate, plan) {
  const planObj = PAYMENT_PLANS.find(p => p.value === plan) || PAYMENT_PLANS[0];
  const base = parseISO(startDate);
  if (planObj.days) {
    const next = new Date(base);
    next.setDate(next.getDate() + planObj.days);
    return format(next, 'yyyy-MM-dd');
  }
  return format(addMonths(base, planObj.months), 'yyyy-MM-dd');
}

function getDaysLabel(dateStr, lang) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(d, today);
  if (lang === 'en') {
    if (diff === 0) return { text: 'Today', color: '#E63946' };
    if (diff < 0) return { text: `${Math.abs(diff)} days late`, color: '#E63946' };
    if (diff <= 3) return { text: `In ${diff} days`, color: '#F97316' };
    if (diff <= 7) return { text: `In ${diff} days`, color: '#C9A84C' };
    return { text: `${diff} days left`, color: '#64748B' };
  }
  if (diff === 0) return { text: 'اليوم', color: '#E63946' };
  if (diff < 0) return { text: `متأخر ${Math.abs(diff)} يوم`, color: '#E63946' };
  if (diff <= 3) return { text: `خلال ${diff} أيام`, color: '#F97316' };
  if (diff <= 7) return { text: `خلال ${diff} أيام`, color: '#C9A84C' };
  return { text: `متبقي ${diff} يوم`, color: '#64748B' };
}

export default function SmartAlerts() {
  const { user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isDataEntry = user?.role === 'data_entry';
  const isInvestor = user?.role === 'investor';

  const t = (ar, en) => lang === 'en' ? en : ar;

  const [alerts, setAlerts] = useState([]);
  const [units, setUnits] = useState([]);
  const [reUnits, setReUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [justPaid, setJustPaid] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', notes: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTenant, setSearchTenant] = useState(searchParams.get('search') || '');
  const [filterProperty, setFilterProperty] = useState(searchParams.get('property') || 'all');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');
  const [filterUnit, setFilterUnit] = useState(searchParams.get('unit') || 'all');
  const [whatsappLoading, setWhatsappLoading] = useState(null);
  const [unitDetailModal, setUnitDetailModal] = useState(null);
  const [viewAlert, setViewAlert] = useState(null);

  useEffect(() => {
    const p = {};
    if (searchTenant) p.search = searchTenant;
    if (filterProperty !== 'all') p.property = filterProperty;
    if (filterStatus !== 'all') p.status = filterStatus;
    if (filterUnit !== 'all') p.unit = filterUnit;
    setSearchParams(p, { replace: true });
  }, [searchTenant, filterProperty, filterStatus, filterUnit, setSearchParams]);

  const today = new Date().toISOString().split('T')[0];

  const load = async () => {
    setLoading(true);
    const [alertsData, unitsData, reUnitsData] = await Promise.all([
      base44.entities.PaymentAlert.list('-alert_date', 200),
      base44.entities.Unit.list(),
      base44.entities.ReUnit.list(),
    ]);
    const updated = alertsData.map(a => {
      if (a.status !== 'paid' && a.alert_date && a.alert_date <= today) {
        return { ...a, status: 'overdue' };
      }
      return a;
    });
    setAlerts(updated);
    setUnits(unitsData);
    setReUnits(reUnitsData);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const allUnits = [
    ...units.map(u => ({ ...u, _type: 'qarya' })),
    ...reUnits.map(u => ({ ...u, _type: 'real_estate' })),
  ];

  const urgentAlerts = alerts.filter(a =>
    a.status !== 'paid' && a.alert_date && a.alert_date <= today
  );

  const filteredAlerts = alerts.filter(a => {
    if (filterProperty !== 'all' && a.property_type !== filterProperty) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterUnit !== 'all' && a.unit_number !== filterUnit) return false;
    if (searchTenant && !a.tenant_name?.toLowerCase().includes(searchTenant.toLowerCase()) &&
        !a.unit_number?.toLowerCase().includes(searchTenant.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const statusOrder = { overdue: 0, active: 1, paid: 2 };
    const sA = statusOrder[a.status] ?? 1;
    const sB = statusOrder[b.status] ?? 1;
    if (sA !== sB) return sA - sB;
    const nA = parseInt(a.unit_number) || 9999;
    const nB = parseInt(b.unit_number) || 9999;
    if (nA !== nB) return nA - nB;
    return (a.unit_number || '').localeCompare(b.unit_number || '');
  });

  const handleUnitSelect = (unitNum) => {
    const found = allUnits.find(u => u.unit_number === unitNum);
    setForm(f => ({
      ...f,
      unit_number: unitNum,
      tenant_name: found?.tenant_name || f.tenant_name,
      property_type: found?._type || f.property_type,
    }));
  };

  const openForm = (alert = null) => {
    if (alert) {
      setEditing(alert);
      setForm({
        unit_number: alert.unit_number || '',
        tenant_name: alert.tenant_name || '',
        property_type: alert.property_type || 'qarya',
        alert_date: alert.alert_date || '',
        alert_time: alert.alert_time || '',
        original_amount: alert.original_amount || '',
        accumulated_amount: '',
        remaining_balance: alert.remaining_balance || alert.original_amount || '',
        description: alert.description || '',
        payment_plan: alert.payment_plan || 'monthly',
        status: alert.status || 'active',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.unit_number || !form.alert_date || !form.tenant_name) return;
    setSaving(true);
    try {
      const monthly = Number(form.original_amount) || 0;
      const overdue = Number(form.accumulated_amount) || 0;
      const total = monthly + overdue;
      const payload = {
        unit_number: form.unit_number,
        tenant_name: form.tenant_name,
        property_type: form.property_type || 'qarya',
        alert_date: form.alert_date,
        alert_time: form.alert_time || '',
        original_amount: monthly,
        remaining_balance: total || monthly,
        payment_plan: form.payment_plan || 'monthly',
        description: form.description || '',
        status: overdue > 0 ? 'overdue' : (form.alert_date <= today ? 'overdue' : 'active'),
      };
      if (editing) {
        await base44.entities.PaymentAlert.update(editing.id, payload);
        await logActivity('PaymentAlert', 'update', `تنبيه - ${form.unit_number} - ${form.tenant_name}`, editing, payload, null, user);
      } else {
        await base44.entities.PaymentAlert.create(payload);
        await logActivity('PaymentAlert', 'create', `تنبيه - ${form.unit_number} - ${form.tenant_name}`, null, payload, null, user);
      }
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (alert) => {
    setPaymentModal(alert);
    setPaymentInput({ amount: '', notes: '', receipt_url: '' });
    setReceiptUploaded(false);
    setJustPaid(null);
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReceiptUploading(true);
    const { file_url } = await uploadFile(file);
    setPaymentInput(p => ({ ...p, receipt_url: file_url }));
    setReceiptUploading(false);
    setReceiptUploaded(true);
    setTimeout(() => setReceiptUploaded(false), 3000);
  };

  const handleDataEntryPaid = async () => {
    const alert = paymentModal;
    if (!alert || !paymentInput.amount) return;
    if (!paymentInput.due_months?.trim()) {
      setPaymentError(t('يرجى تحديد الشهر المستحق *', 'Please enter the due month *'));
      return;
    }
    if (!paymentInput.receipt_url) {
      setPaymentError(t('يرجى رفع صورة الإيصال *', 'Please upload a receipt image *'));
      return;
    }
    setPaymentError('');
    setPaymentSaving(true);

    const paidAmount   = Number(paymentInput.amount);
    const monthly      = Number(alert.original_amount || 0);
    const currentBalance = Number(alert.remaining_balance || monthly);
    const alertDate    = alert.alert_date || today;
    const plan         = alert.payment_plan || 'monthly';
    const planObj      = PAYMENT_PLANS.find(p => p.value === plan);
    const planLabel    = planObj?.label[lang] || planObj?.label.ar || 'شهري';

    // Save payment record
    const paymentRecord = {
      tenant_name:       alert.tenant_name,
      unit_number:       alert.unit_number,
      amount:            paidAmount,
      payment_date:      today,
      due_months:        paymentInput.due_months || '',
      status:            'paid',
      notes:             paymentInput.notes || '',
      receipt_image_url: paymentInput.receipt_url || '',
      created_by:        user?.id || '',
    };

    await base44.entities.Payment.create(paymentRecord);
    await logActivity('Payment', 'create', `دفعة - ${alert.unit_number} - ${alert.tenant_name}`, null, paymentRecord, `دفعة جديدة: ${paidAmount} د.إ`, user);

    base44.entities.Notification.create({
      type: 'payment',
      title: `دفعة جديدة — ${alert.tenant_name}`,
      amount: paidAmount,
      reference_id: '',
      reference_data: paymentRecord,
    }).catch(() => {});

    let newDate, newBalance, nextStatus, periodsAdvanced;

    if (paidAmount >= currentBalance) {
      // ─── تسويه كاملة + احتساب ما زاد ───────────────────────────
      const creditAfterCurrent   = paidAmount - currentBalance;
      const additionalPeriods    = monthly > 0 ? Math.floor(creditAfterCurrent / monthly) : 0;
      const partialCredit        = monthly > 0 ? creditAfterCurrent % monthly : 0;
      periodsAdvanced            = 1 + additionalPeriods;

      newDate = alertDate;
      for (let i = 0; i < periodsAdvanced; i++) {
        newDate = getNextDateFromPlan(newDate, plan);
      }

      newBalance  = partialCredit > 0 ? monthly - partialCredit : monthly;
      nextStatus  = newDate > today ? 'active' : 'overdue';

      const alertUpdatePayload = {
        remaining_balance: newBalance,
        last_paid_date:    today,
        last_paid_amount:  paidAmount,
        alert_date:        newDate,
        next_alert_date:   newDate,
        status:            nextStatus,
      };

      await base44.entities.PaymentAlert.update(alert.id, alertUpdatePayload);
      await logActivity('PaymentAlert', 'update', `تحديث بعد دفع - ${alert.unit_number} - ${alert.tenant_name}`, alert, alertUpdatePayload, `دفعة كاملة + ${periodsAdvanced} دورات`, user);

      setJustPaid({
        unit_number:  alert.unit_number,
        tenant_name:  alert.tenant_name,
        next_date:    newDate,
        plan:         planLabel,
        paid:         paidAmount,
        remaining:    partialCredit > 0 ? newBalance : 0,
        periods:      periodsAdvanced,
      });

    } else {
      // ─── دفع جزئي على الرصيد الحالي ─────────────────────────────
      newBalance     = currentBalance - paidAmount;
      newDate        = alertDate;
      periodsAdvanced = 0;
      nextStatus     = today < alertDate ? 'active' : 'overdue';

      const alertUpdatePayload = {
        remaining_balance: newBalance,
        last_paid_date:    today,
        last_paid_amount:  paidAmount,
        status:            nextStatus,
      };

      await base44.entities.PaymentAlert.update(alert.id, alertUpdatePayload);
      await logActivity('PaymentAlert', 'update', `تحديث بعد دفع جزئي - ${alert.unit_number} - ${alert.tenant_name}`, alert, alertUpdatePayload, `دفعة جزئية: ${paidAmount} د.إ`, user);

      setJustPaid({
        unit_number: alert.unit_number,
        tenant_name: alert.tenant_name,
        next_date:   newDate,
        plan:        planLabel,
        paid:        paidAmount,
        remaining:   newBalance,
        periods:     0,
      });
    }

    setTimeout(() => setJustPaid(null), 5000);
    setPaymentSaving(false);
    setReceiptUploaded(false);
    setPaymentModal(null);
    load();
  };

  const handleSendWhatsapp = async (alert) => {
    setWhatsappLoading(alert.id);
    try {
      const res = await base44.functions.invoke('sendWhatsappReminder', { alert_id: alert.id });
      const data = res.data;
      if (data?.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank');
      }
    } catch (e) {
      // fallback: open generic WhatsApp link with manual message
    } finally {
      setWhatsappLoading(null);
    }
  };

  const handleDelete = (alert) => {
    setConfirmDelete({
      message: t(`هل تريد حذف تنبيه وحدة ${alert.unit_number} — ${alert.tenant_name}؟`, `Delete alert for unit ${alert.unit_number} — ${alert.tenant_name}?`),
      onConfirm: async () => {
        await base44.entities.PaymentAlert.delete(alert.id);
        await logActivity('PaymentAlert', 'delete', `تنبيه - ${alert.unit_number} - ${alert.tenant_name}`, alert, null, null, user);
        setConfirmDelete(null);
        load();
      },
    });
  };

  const uniqueUnits = [...new Set(alerts.map(a => a.unit_number).filter(Boolean))];
  const totalActive = alerts.filter(a => a.status === 'active').length;
  const totalOverdue = alerts.filter(a => a.status === 'overdue').length;
  const totalToday = alerts.filter(a => a.alert_date === today && a.status !== 'paid').length;

  const previewNextDate = form.alert_date && form.payment_plan
    ? getNextDateFromPlan(form.alert_date, form.payment_plan)
    : null;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Bell size={22} style={{ color: '#C9A84C' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('نظام التنبيه الذكي', 'Smart Alerts')}</h1>
            <p className="text-xs mt-0.5 text-muted-foreground">{t('لتتبع الدفعات', 'Track Payments')}</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => openForm()} style={{ backgroundColor: '#1B2B4B' }} className="gap-2">
            <Plus size={16} /> {t('إضافة تنبيه', 'Add Alert')}
          </Button>
        )}
      </div>

      {/* Just Paid Success Banner */}
      {justPaid && (
        <div className="rounded-xl p-4 flex items-start gap-3 border-2" style={{ backgroundColor: 'rgba(42,157,143,0.07)', borderColor: '#2A9D8F' }}>
          <CheckCircle2 size={22} style={{ color: '#2A9D8F', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#2A9D8F' }}>
              ✅ {t(`تم تسجيل الدفعة لوحدة ${justPaid.unit_number} — ${justPaid.tenant_name}`, `Payment recorded for unit ${justPaid.unit_number} — ${justPaid.tenant_name}`)}
            </p>
            <p className="text-xs mt-1" style={{ color: '#1B2B4B' }}>
              {t('المبلغ المدفوع', 'Paid')}: <span className="font-bold">{justPaid.paid?.toLocaleString() || '0'}</span> {t('د.إ', 'AED')} · 
              {t('المتبقي', 'Remaining')}: <span className="font-bold">{justPaid.remaining?.toLocaleString() || '0'}</span> {t('د.إ', 'AED')} ·
              {t(`الدفعة القادمة (${justPaid.plan})`, `Next (${justPaid.plan})`)}: <span className="font-bold">{justPaid.next_date}</span>
            </p>
          </div>
          <button onClick={() => setJustPaid(null)} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Data Entry / Investor / Admin Alert Banner */}
      {(isDataEntry || isInvestor || isAdmin) && urgentAlerts.length > 0 && (
        <div className="rounded-xl p-4 border-2" style={{ backgroundColor: 'rgba(230,57,70,0.06)', borderColor: '#E63946' }}>
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle size={22} style={{ color: '#E63946' }} />
            <p className="font-bold text-sm" style={{ color: '#E63946' }}>
              {t('الوحدات المتأخرة', 'Overdue Units')}
            </p>
          </div>
          <div className="space-y-2">
            {urgentAlerts.map(a => {
              const daysInfo = getDaysLabel(a.alert_date, lang);
              const planObj = PAYMENT_PLANS.find(p => p.value === (a.payment_plan || 'monthly'));
              const planLabel = planObj?.label[lang] || planObj?.label.ar;
              const monthly = Number(a.original_amount || 0);
              const total = Number(a.remaining_balance || monthly);
              const overdueAmt = total > monthly ? total - monthly : 0;
              // دفع جزئي: المتبقي أقل من الشهري وفيه last_paid_amount
              const isPartial = a.last_paid_amount > 0 && total < monthly && total > 0;
              return (
                <div key={a.id} className="rounded-xl px-3 py-2.5 bg-white border" style={{ borderColor: '#FECACA' }}>
                  {/* السطر الأول: الوحدة والمستأجر والوقت */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#E63946' }} />
                    <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{t('وحدة', 'Unit')} {a.unit_number}</span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-sm">{a.tenant_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{planLabel}</span>
                    {daysInfo && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full mr-auto"
                        style={{ backgroundColor: `${daysInfo.color}18`, color: daysInfo.color }}>
                        {daysInfo.text}
                      </span>
                    )}
                  </div>

                  {/* السطر الثاني: تفاصيل المبالغ الذكية */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* الدفعة القادمة دائمًا */}
                    {monthly > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
                        style={{ backgroundColor: 'rgba(42,157,143,0.1)', color: '#2A9D8F' }}>
                        {t('الدفعة', 'Amount')}: {monthly.toLocaleString()} {t('د.إ', 'AED')}
                      </span>
                    )}

                    {/* حالة المتأخر: remaining > monthly */}
                    {overdueAmt > 0 && (
                      <>
                        <span className="text-muted-foreground">+</span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
                          style={{ backgroundColor: 'rgba(230,57,70,0.1)', color: '#E63946' }}>
                          {t('متأخر', 'Overdue')}: {overdueAmt.toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                        <span className="text-muted-foreground">=</span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold"
                          style={{ backgroundColor: 'rgba(27,43,75,0.08)', color: '#1B2B4B' }}>
                          {t('الإجمالي', 'Total')}: {total.toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                      </>
                    )}

                    {/* حالة الدفع الجزئي: remaining < monthly */}
                    {isPartial && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
                          style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#B8860B' }}>
                          {t('دفع جزئي', 'Partial')}: {Number(a.last_paid_amount).toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold"
                          style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946' }}>
                          {t('المتبقي', 'Remaining')}: {total.toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                      </>
                    )}

                    {/* أزرار العمل */}
                    {isDataEntry && (
                      <div className="flex items-center gap-2 mr-auto">
                        <Button size="sm" onClick={() => openPaymentModal(a)}
                          className="text-xs h-7 gap-1"
                          style={{ backgroundColor: '#2A9D8F' }}>
                          <Upload size={13} /> {t('رفع دفعة', 'Submit Payment')}
                        </Button>
                        <button
                          onClick={() => handleSendWhatsapp(a)}
                          disabled={whatsappLoading === a.id}
                          className="h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors"
                          style={{ backgroundColor: '#25D366', color: '#fff' }}
                        >
                          {whatsappLoading === a.id
                            ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                            : <MessageCircle size={13} />
                          }
                          {t('واتساب', 'WhatsApp')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No urgent alerts */}
      {(isDataEntry || isInvestor || isAdmin) && urgentAlerts.length === 0 && (
        <div className="rounded-xl p-4 border flex items-center gap-3" style={{ backgroundColor: 'rgba(42,157,143,0.06)', borderColor: '#2A9D8F' }}>
          <CheckCircle2 size={20} style={{ color: '#2A9D8F' }} />
          <p className="text-sm font-medium" style={{ color: '#2A9D8F' }}>{t('لا توجد دفعات مستحقة حالياً', 'No payments due at this time')}</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: t('تنبيهات نشطة', 'Active Alerts'), value: totalActive, color: '#1B2B4B' },
          { label: t('مستحقة اليوم', 'Due Today'), value: totalToday, color: '#E63946' },
          { label: t('متأخرة', 'Overdue'), value: totalOverdue, color: '#E63946' },
        ].map(s => (
          <div key={s.label} className="bg-white card-bevel rounded-xl p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white card-bevel rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">{t('بحث بالمستأجر / الوحدة', 'Search tenant / unit')}</Label>
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchTenant} onChange={e => setSearchTenant(e.target.value)}
              placeholder={t('اسم المستأجر أو رقم الوحدة...', 'Tenant name or unit number...')} className="pr-9 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{t('العقار', 'Property')}</Label>
          <MobileDrawerSelect
            value={filterProperty}
            onValueChange={setFilterProperty}
            triggerClassName="w-40 text-sm"
            dir="rtl"
            options={[
              { value: 'all', label: t('الكل', 'All') },
              { value: 'qarya', label: t('بناية القرية', 'Qarya Villa') },
              { value: 'real_estate', label: t('العقارات', 'Real Estate') },
            ]}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{t('الوحدة', 'Unit')}</Label>
          <MobileDrawerSelect
            value={filterUnit}
            onValueChange={setFilterUnit}
            triggerClassName="w-36 text-sm"
            dir="rtl"
            options={[
              { value: 'all', label: t('الكل', 'All') },
              ...uniqueUnits.map(u => ({ value: u, label: `${t('وحدة', 'Unit')} ${u}` })),
            ]}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{t('الحالة', 'Status')}</Label>
          <MobileDrawerSelect
            value={filterStatus}
            onValueChange={setFilterStatus}
            triggerClassName="w-32 text-sm"
            dir="rtl"
            options={[
              { value: 'all', label: t('الكل', 'All') },
              { value: 'active', label: t('نشط', 'Active') },
              { value: 'overdue', label: t('متأخر', 'Overdue') },
            ]}
          />
        </div>
        {(searchTenant || filterProperty !== 'all' || filterStatus !== 'all' || filterUnit !== 'all') && (
          <Button variant="outline" size="sm" onClick={() => {
            setSearchTenant(''); setFilterProperty('all'); setFilterStatus('all'); setFilterUnit('all');
          }} className="gap-1.5 text-xs">
            <X size={13} /> {t('إلغاء الفلتر', 'Clear Filter')}
          </Button>
        )}
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t('جاري التحميل...', 'Loading...')}</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white card-bevel rounded-xl py-16 text-center text-muted-foreground">
          <Bell size={40} className="mx-auto mb-3 opacity-20" />
          <p>{t('لا توجد تنبيهات', 'No alerts found')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => {
            const daysInfo = getDaysLabel(alert.alert_date, lang);
            const st = statusConfig[alert.status] || statusConfig.active;
            const isOverdue = alert.status === 'overdue';
            const planObj = PAYMENT_PLANS.find(p => p.value === (alert.payment_plan || 'monthly'));
            const planLabel = planObj?.label[lang] || planObj?.label.ar;

            return (
              <div key={alert.id} onClick={() => setViewAlert(alert)} className="bg-white card-bevel rounded-xl overflow-hidden transition-all cursor-pointer hover:shadow-md"
                style={{
                  borderRight: isOverdue ? '4px solid #E63946' : '4px solid transparent',
                  backgroundColor: isOverdue ? 'rgba(230,57,70,0.02)' : undefined,
                }}>
                <div className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: st.bg }}>
                    {alert.property_type === 'real_estate'
                      ? <Home size={18} style={{ color: st.color }} />
                      : <Building2 size={18} style={{ color: st.color }} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
                        {t('وحدة', 'Unit')} {alert.unit_number}
                      </span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-sm text-muted-foreground">{alert.tenant_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
                        {planLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar size={11} /> {alert.alert_date}
                      </span>
                      {alert.original_amount > 0 && (
                        <span className="text-xs font-semibold" style={{ color: '#2A9D8F' }}>
                          {t('الدفعة القادمة', 'Next Payment')}: {Number(alert.original_amount).toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                      )}
                      {alert.remaining_balance > alert.original_amount && (
                        <span className="text-xs font-bold" style={{ color: '#E63946' }}>
                          {t('المتأخر', 'Overdue')}: {(Number(alert.remaining_balance) - Number(alert.original_amount)).toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                      )}
                      {alert.remaining_balance > alert.original_amount && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(27,43,75,0.08)', color: '#1B2B4B' }}>
                          {t('الإجمالي', 'Total')}: {Number(alert.remaining_balance).toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                      )}
                      {/* دفع جزئي: المتبقي أقل من الشهري */}
                      {alert.last_paid_amount > 0 && alert.remaining_balance < alert.original_amount && alert.remaining_balance > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#B8860B' }}>
                          {t('دفع', 'Paid')} {Number(alert.last_paid_amount).toLocaleString()} {t('جزئي · متبقي', 'partial · remaining')} {Number(alert.remaining_balance).toLocaleString()} {t('د.إ', 'AED')}
                        </span>
                      )}
                      {alert.description && <span className="text-xs text-muted-foreground">{alert.description}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap" onClick={ev => ev.stopPropagation()}>
                    {daysInfo && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: `${daysInfo.color}18`, color: daysInfo.color }}>
                        {daysInfo.text}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: st.bg, color: st.color }}>
                      {st.label[lang]}
                    </span>

                    {/* إضافة دفعة — زر احترافي موحّد يفتح نافذة الدفع */}
                    {(isAdmin || isDataEntry) && alert.status !== 'paid' && (
                      <Button
                        size="sm"
                        onClick={() => openPaymentModal(alert)}
                        className="h-7 px-2.5 gap-1 text-xs font-semibold rounded-lg shadow-none"
                        style={{ backgroundColor: '#2A9D8F' }}
                      >
                        <Plus size={13} /> {t('إضافة دفعة', 'Add Payment')}
                      </Button>
                    )}

                    {/* WhatsApp button — visible to admin and data_entry */}
                    {(isAdmin || isDataEntry) && alert.status !== 'paid' && (
                      <button
                        onClick={() => handleSendWhatsapp(alert)}
                        disabled={whatsappLoading === alert.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors"
                        style={{ color: '#25D366' }}
                        title={t('إرسال تذكير واتساب', 'Send WhatsApp reminder')}
                      >
                        {whatsappLoading === alert.id
                          ? <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: '#25D366', borderTopColor: 'transparent' }} />
                          : <MessageCircle size={16} />
                        }
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button onClick={() => openForm(alert)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDelete(alert)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Alert Detail Dialog */}
      <Dialog open={!!viewAlert} onOpenChange={(v) => { if (!v) setViewAlert(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('تفاصيل التنبيه', 'Alert Details')} — {t('وحدة', 'Unit')} {viewAlert?.unit_number}</DialogTitle>
          </DialogHeader>
          {viewAlert && (() => {
            const st = statusConfig[viewAlert.status] || statusConfig.active;
            const daysInfo = getDaysLabel(viewAlert.alert_date, lang);
            const planObj = PAYMENT_PLANS.find(p => p.value === (viewAlert.payment_plan || 'monthly'));
            const planLabel = planObj?.label[lang] || planObj?.label.ar;
            const monthly = Number(viewAlert.original_amount || 0);
            const total = Number(viewAlert.remaining_balance || monthly);
            const overdueAmt = Math.max(0, total - monthly);
            return (
              <div className="space-y-3 pt-1">
                <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                  {[
                    { label: t('المستأجر', 'Tenant'), value: viewAlert.tenant_name },
                    { label: t('نوع العقار', 'Property'), value: viewAlert.property_type === 'real_estate' ? t('العقارات', 'Real Estate') : t('بناية القرية', 'Qarya') },
                    { label: t('خطة الدفع', 'Payment Plan'), value: planLabel },
                    { label: t('تاريخ الاستحقاق', 'Due Date'), value: viewAlert.alert_date },
                    { label: t('آخر دفع', 'Last Paid'), value: viewAlert.last_paid_date },
                    { label: t('ملاحظات', 'Notes'), value: viewAlert.description },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      <span className="font-medium text-xs" style={{ color: '#1B2B4B' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: 'rgba(42,157,143,0.08)' }}>
                    <p className="text-muted-foreground">{planLabel || t('الدفعة', 'Amount')}</p>
                    <p className="font-bold mt-0.5" style={{ color: '#2A9D8F' }}>{monthly.toLocaleString()}</p>
                  </div>
                  {overdueAmt > 0 && (
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: 'rgba(230,57,70,0.08)' }}>
                      <p className="text-muted-foreground">{t('المتأخر', 'Overdue')}</p>
                      <p className="font-bold mt-0.5" style={{ color: '#E63946' }}>{overdueAmt.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: 'rgba(27,43,75,0.06)' }}>
                    <p className="text-muted-foreground">{t('الإجمالي', 'Total')}</p>
                    <p className="font-bold mt-0.5" style={{ color: '#1B2B4B' }}>{total.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label[lang]}</span>
                  {daysInfo && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${daysInfo.color}18`, color: daysInfo.color }}>{daysInfo.text}</span>}
                </div>
                <div className="flex gap-2 pt-1 flex-wrap">
                  {(isAdmin || isDataEntry) && viewAlert.status !== 'paid' && (
                    <Button className="flex-1 gap-1" style={{ backgroundColor: '#2A9D8F' }} onClick={() => { setViewAlert(null); openPaymentModal(viewAlert); }}>
                      <Upload size={14} /> {t('رفع دفعة', 'Submit Payment')}
                    </Button>
                  )}
                  {isAdmin && (
                    <Button className="flex-1 gap-1" variant="outline" onClick={() => { setViewAlert(null); openForm(viewAlert); }}>
                      <Edit2 size={14} /> {t('تعديل', 'Edit')}
                    </Button>
                  )}
                  <Button className="w-full gap-1" variant="outline" onClick={() => { setViewAlert(null); navigate(`/units/${viewAlert.unit_number}`); }}>
                    🏠 {t('صفحة الوحدة', 'Unit Page')}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Unit Detail Modal */}
      <Dialog open={!!unitDetailModal} onOpenChange={(v) => { if (!v) setUnitDetailModal(null); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('بيانات الوحدة', 'Unit Details')} — {unitDetailModal?.unit_number}</DialogTitle>
          </DialogHeader>
          {unitDetailModal && (
            <div className="space-y-3 pt-1 text-sm">
              <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                {[
                  { label: t('اسم المستأجر', 'Tenant'), value: unitDetailModal.tenant_name },
                  { label: t('الجنسية', 'Nationality'), value: unitDetailModal.nationality },
                  { label: t('الإيجار السنوي', 'Annual Rent'), value: unitDetailModal.annual_rent ? `${Number(unitDetailModal.annual_rent).toLocaleString()} ${t('د.إ', 'AED')}` : null },
                  { label: t('خطة الدفع', 'Payment Plan'), value: unitDetailModal.payment_plan },
                  { label: t('بداية العقد', 'Contract Start'), value: unitDetailModal.contract_start },
                  { label: t('نهاية العقد', 'Contract End'), value: unitDetailModal.contract_end },
                  { label: t('رقم المالك', 'Owner Phone'), value: unitDetailModal.owner_phone },
                  { label: t('الطابق', 'Floor'), value: unitDetailModal.floor },
                  { label: t('ملاحظات', 'Notes'), value: unitDetailModal.notes },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground text-xs">{row.label}</span>
                    <span className="font-medium text-xs text-right" style={{ color: '#1B2B4B' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {unitDetailModal.contract_image_url && (
                <a href={unitDetailModal.contract_image_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
                  style={{ color: '#1B2B4B' }}>
                  📄 {t('عرض صورة العقد', 'View Contract')}
                </a>
              )}
              <Button
                onClick={() => { setUnitDetailModal(null); navigate(`/units/${unitDetailModal.unit_number}`); }}
                className="w-full gap-2"
                style={{ backgroundColor: '#1B2B4B' }}>
                {t('صفحة الوحدة', 'Unit Page')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        message={confirmDelete?.message}
        onConfirm={confirmDelete?.onConfirm}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Data Entry Payment Modal */}
      <Dialog open={!!paymentModal} onOpenChange={(v) => { if (!v) setPaymentModal(null); }}>
        <DialogContent className="max-w-sm" dir="rtl" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DialogHeader className="flex-shrink-0 pb-2 border-b">
            <DialogTitle>{t('رفع دفعة جديدة', 'Submit Payment')}</DialogTitle>
          </DialogHeader>
          {paymentModal && (() => {
            const monthly = Number(paymentModal.original_amount || 0);
            const currentTotal = Number(paymentModal.remaining_balance || monthly);
            const overdueAmt = Math.max(0, currentTotal - monthly);
            const paidNow = Number(paymentInput.amount) || 0;
            const afterPay = Math.max(0, currentTotal - paidNow);
            const isFullyPaid = paidNow >= currentTotal && paidNow > 0;
            const alertDate = paymentModal.alert_date || today;
            const isPaidEarly = today < alertDate;
            return (
              <div className="overflow-y-auto flex-1 py-2 space-y-3 px-1">
                {/* ملخص الوحدة */}
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'rgba(27,43,75,0.05)', border: '1px solid rgba(27,43,75,0.1)' }}>
                  <p className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{t('وحدة', 'Unit')} {paymentModal.unit_number} — {paymentModal.tenant_name}</p>
                  <p className="text-xs text-muted-foreground">{t('تاريخ الاستحقاق', 'Due date')}: {paymentModal.alert_date}</p>
                  <div className="space-y-1 pt-1 border-t">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{PAYMENT_PLANS.find(p => p.value === (paymentModal.payment_plan || 'monthly'))?.label[lang] || t('الدفعة', 'Amount')}</span>
                      <span className="font-semibold" style={{ color: '#2A9D8F' }}>{monthly.toLocaleString()} {t('د.إ', 'AED')}</span>
                    </div>
                    {overdueAmt > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t('متأخر', 'Overdue')}</span>
                        <span className="font-bold" style={{ color: '#E63946' }}>{overdueAmt.toLocaleString()} {t('د.إ', 'AED')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t pt-1">
                      <span className="font-bold" style={{ color: '#1B2B4B' }}>{t('الإجمالي المستحق', 'Total Due')}</span>
                      <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>{currentTotal.toLocaleString()} {t('د.إ', 'AED')}</span>
                    </div>
                  </div>
                </div>

                {/* المبلغ المدفوع - يدوي */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('المبلغ المدفوع *', 'Amount Paid *')}</Label>
                  <Input
                    type="number"
                    value={paymentInput.amount}
                    onChange={e => setPaymentInput(p => ({ ...p, amount: e.target.value }))}
                    placeholder={t('أدخل المبلغ يدوياً...', 'Enter amount manually...')}
                    className="text-sm"
                    autoFocus
                  />
                </div>

                {/* مستحق لشهر - إجباري */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('مستحق لشهر *', 'Due Month *')}</Label>
                  <Input
                    value={paymentInput.due_months || ''}
                    onChange={e => setPaymentInput(p => ({ ...p, due_months: e.target.value }))}
                    placeholder={t('مثال: يوليو 2026', 'e.g. July 2026')}
                    className="text-sm"
                  />
                </div>

                {/* معاينة ذكية بعد الدفع */}
{paidNow > 0 && (() => {
  const creditAfterCurrent = paidNow >= currentTotal
    ? paidNow - currentTotal : 0;
  const additionalPeriods  = monthly > 0 && creditAfterCurrent > 0
    ? Math.floor(creditAfterCurrent / monthly) : 0;
  const partialCredit      = monthly > 0 && creditAfterCurrent > 0
    ? creditAfterCurrent % monthly : 0;
  const periodsToAdvance   = paidNow >= currentTotal ? 1 + additionalPeriods : 0;

  let previewNextDate = alertDate;
  for (let i = 0; i < periodsToAdvance; i++) {
    previewNextDate = getNextDateFromPlan(previewNextDate, paymentModal.payment_plan || 'monthly');
  }

  const previewNextBalance = paidNow >= currentTotal
    ? (partialCredit > 0 ? monthly - partialCredit : monthly)
    : currentTotal - paidNow;

  const isFullPay      = paidNow >= currentTotal;
  const hasCredit      = isFullPay && partialCredit > 0;
  const isPartialPay   = !isFullPay;

  // لون الرصيد القادم
  const balanceColor = hasCredit
    ? '#C9A84C'           // أصفر — كريديت متبقي
    : isPartialPay
      ? '#E63946'         // أحمر — متأخر فعلي
      : '#2A9D8F';        // أخضر — كامل طبيعي

  // عنوان الحالة
  const statusLabel = isPartialPay
    ? t('⚠️ دفعة جزئية', '⚠️ Partial payment')
    : hasCredit
      ? t('✅ تسوية + جزئي للدورة القادمة', '✅ Settlement + Partial next cycle')
      : additionalPeriods > 0
        ? t(`✅ تسوية + ${periodsToAdvance} دورات`, `✅ Settlement + ${periodsToAdvance} periods`)
        : t('✅ تسوية كاملة', '✅ Full settlement');

  const statusColor = isPartialPay ? '#E63946' : '#2A9D8F';

  // مبلغ الدورة حسب الخطة
  const planObj2 = PAYMENT_PLANS.find(p => p.value === (paymentModal.payment_plan || 'monthly'));
  const planLabel2 = planObj2?.label[lang] || planObj2?.label.ar || '';
  const periodAmount = monthly;

  return (
    <div className="rounded-xl p-3 space-y-1.5" style={{
      backgroundColor: isFullPay ? 'rgba(42,157,143,0.06)' : 'rgba(230,57,70,0.05)',
      border: `1px solid ${isFullPay ? '#2A9D8F' : '#E63946'}33`
    }}>
      {/* العنوان */}
      <p className="text-xs font-bold" style={{ color: statusColor }}>
        {statusLabel}
      </p>

      {/* المدفوع */}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t('المدفوع', 'Paid')}</span>
        <span className="font-bold" style={{ color: '#2A9D8F' }}>
          {paidNow.toLocaleString()} {t('د.إ', 'AED')}
        </span>
      </div>

      {/* مبلغ الدورة */}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">
          {t(`الدورة (${planLabel2})`, `Cycle (${planLabel2})`)}
        </span>
        <span className="font-bold" style={{ color: '#1B2B4B' }}>
          {periodAmount.toLocaleString()} {t('د.إ', 'AED')}
        </span>
      </div>

      {/* الدورات المغطاة */}
      {isFullPay && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('الدورات المغطاة', 'Periods covered')}</span>
          <span className="font-bold" style={{ color: '#1B2B4B' }}>{periodsToAdvance}</span>
        </div>
      )}

      {/* تاريخ الاستحقاق القادم */}
      <div className="flex justify-between text-xs border-t pt-1">
        <span className="text-muted-foreground">{t('تاريخ الاستحقاق القادم', 'Next due date')}</span>
        <span className="font-bold" style={{ color: '#1B2B4B' }}>{previewNextDate}</span>
      </div>

      {/* الرصيد القادم */}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t('الرصيد القادم', 'Next balance')}</span>
        <span className="font-bold" style={{ color: balanceColor }}>
          {previewNextBalance.toLocaleString()} {t('د.إ', 'AED')}
          {hasCredit && t(' (كريديت)', ' (credit)')}
          {isPartialPay && t(' (متأخر)', ' (overdue)')}
        </span>
      </div>
    </div>
  );
})()}

                {/* رفع الإيصال - إجباري */}
<div className="space-y-1.5">
  <Label className="text-sm font-semibold">{t('رفع الإيصال *', 'Upload Receipt *')}</Label>
  {receiptUploading ? (
    <div className="flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl" style={{ borderColor: '#C9A84C' }}>
      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
      <span className="text-xs text-muted-foreground">{t('جاري الرفع...', 'Uploading...')}</span>
    </div>
  ) : paymentInput.receipt_url ? (
    <div className="relative">
      <img src={paymentInput.receipt_url} alt="إيصال" className="w-full max-h-48 object-contain rounded-xl border border-border" />
      <button type="button" onClick={() => setPaymentInput(p => ({ ...p, receipt_url: '' }))}
        className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-0.5">
        <X size={14} />
      </button>
    </div>
  ) : (
    <label className="flex items-center justify-center w-full px-4 py-2.5 border-2 border-dashed rounded-xl cursor-pointer transition-all"
      style={{ borderColor: 'rgba(201,168,76,0.3)' }}>
      <input type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} className="hidden" />
      <div className="flex items-center gap-2">
        <Upload size={14} style={{ color: '#C9A84C' }} />
        <span className="text-xs" style={{ color: '#C9A84C' }}>{t('انقر لرفع الإيصال', 'Click to upload receipt')}</span>
      </div>
    </label>
  )}
</div>

                {/* ملاحظات */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
                  <Input
                    value={paymentInput.notes}
                    onChange={e => setPaymentInput(p => ({ ...p, notes: e.target.value }))}
                    placeholder={t('أي ملاحظات...', 'Any notes...')}
                    className="text-sm"
                  />
                </div>

                {paymentError && (
                  <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946' }}>
                    ⚠️ {paymentError}
                  </p>
                )}

                <div className="flex gap-2 pt-1 pb-1">
                  <Button onClick={handleDataEntryPaid} disabled={paymentSaving || !paymentInput.amount}
                    className="flex-1 gap-2" style={{ backgroundColor: '#2A9D8F' }}>
                    <CheckCircle2 size={15} />
                    {paymentSaving ? t('جاري الحفظ...', 'Saving...') : t('تأكيد الدفعة', 'Confirm Payment')}
                  </Button>
                  <Button variant="outline" onClick={() => { setPaymentModal(null); setPaymentError(''); }} className="flex-1">{t('إلغاء', 'Cancel')}</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Form Dialog - Admin Only */}
      {isAdmin && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md w-full" dir="rtl" style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DialogHeader className="flex-shrink-0 pb-2 border-b">
              <DialogTitle className="text-base">{editing ? t('تعديل التنبيه', 'Edit Alert') : t('إضافة تنبيه دفعة', 'Add Payment Alert')}</DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 py-3 space-y-3">

              {/* الوحدة */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('اختر الوحدة *', 'Select Unit *')}</Label>
                <MobileDrawerSelect
                  value={form.unit_number}
                  onValueChange={handleUnitSelect}
                  placeholder={t('اختر وحدة...', 'Select unit...')}
                  triggerClassName="text-sm h-9 w-full"
                  dir="rtl"
                  options={allUnits.filter(u => u.tenant_name).map(u => ({
                    value: u.unit_number,
                    label: `${u.unit_number} — ${u.tenant_name} (${u._type === 'qarya' ? t('القرية', 'Qarya') : t('العقارات', 'RE')})`,
                  }))}
                />
              </div>

              {/* اسم المستأجر + نوع العقار */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('اسم المستأجر *', 'Tenant Name *')}</Label>
                  <Input value={form.tenant_name}
                    onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))}
                    placeholder={t('اسم المستأجر', 'Tenant name')} className="text-sm h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('نوع العقار', 'Property Type')}</Label>
                  <MobileDrawerSelect
                    value={form.property_type}
                    onValueChange={v => setForm(f => ({ ...f, property_type: v }))}
                    triggerClassName="text-sm h-9 w-full"
                    dir="rtl"
                    options={[
                      { value: 'qarya', label: t('بناية القرية', 'Qarya') },
                      { value: 'real_estate', label: t('العقارات', 'Real Estate') },
                    ]}
                  />
                </div>
              </div>

              {/* خطة الدفع + تاريخ أول دفعة */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('خطة الدفع *', 'Payment Plan *')}</Label>
                  <MobileDrawerSelect
                    value={form.payment_plan}
                    onValueChange={v => setForm(f => ({ ...f, payment_plan: v }))}
                    triggerClassName="text-sm h-9 w-full"
                    dir="rtl"
                    options={PAYMENT_PLANS.map(p => ({ value: p.value, label: p.label[lang] }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('تاريخ أول دفعة *', 'First Due Date *')}</Label>
                  <Input type="date" value={form.alert_date}
                    onChange={e => setForm(f => ({ ...f, alert_date: e.target.value }))} className="text-sm h-9" />
                </div>
              </div>

              {/* معاينة الدفعة التالية */}
              {previewNextDate && (
                <div className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs"
                  style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <RefreshCw size={12} style={{ color: '#C9A84C' }} />
                  <span style={{ color: '#1B2B4B' }}>
                    {t('الدفعة التالية', 'Next payment')}: <span className="font-bold" style={{ color: '#C9A84C' }}>{previewNextDate}</span>
                  </span>
                </div>
              )}

              {/* المبلغ الشهري */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('المبلغ الشهري *', 'Monthly Amount *')}</Label>
                <Input
                  type="number"
                  value={form.original_amount}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(f => ({
                      ...f,
                      original_amount: val,
                      remaining_balance: String((Number(val) || 0) + (Number(f.accumulated_amount) || 0)),
                    }));
                  }}
                  placeholder="0.00"
                  className="text-sm h-9"
                />
              </div>

              {/* المبلغ المتأخر */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold" style={{ color: '#E63946' }}>{t('المبلغ المتأخر (اختياري)', 'Overdue Amount (optional)')}</Label>
                <Input
                  type="number"
                  value={form.accumulated_amount || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(f => ({
                      ...f,
                      accumulated_amount: val,
                      remaining_balance: String((Number(f.original_amount) || 0) + (Number(val) || 0)),
                      status: Number(val) > 0 ? 'overdue' : 'active',
                    }));
                  }}
                  placeholder="0.00"
                  className="text-sm h-9"
                  style={{ borderColor: Number(form.accumulated_amount) > 0 ? '#E63946' : undefined }}
                />
              </div>

              {/* ملخص المبالغ — يظهر فقط إذا في مبلغ */}
              {(Number(form.original_amount) > 0 || Number(form.accumulated_amount) > 0) && (
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                  <p className="text-xs font-bold" style={{ color: '#1B2B4B' }}>{t('ملخص المبالغ', 'Amount Summary')}</p>
                  <div className="space-y-1.5">
                    {Number(form.original_amount) > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground text-xs">{t('المبلغ الشهري', 'Monthly Amount')}</span>
                        <span className="font-bold" style={{ color: '#2A9D8F' }}>{Number(form.original_amount).toLocaleString()} {t('د.إ', 'AED')}</span>
                      </div>
                    )}
                    {Number(form.accumulated_amount) > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground text-xs">{t('المبلغ المتأخر', 'Overdue Amount')}</span>
                        <span className="font-bold" style={{ color: '#E63946' }}>{Number(form.accumulated_amount).toLocaleString()} {t('د.إ', 'AED')}</span>
                      </div>
                    )}
                    <div className="border-t pt-1.5 flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: '#1B2B4B' }}>{t('الإجمالي المستحق', 'Total Due')}</span>
                      <span className="text-base font-bold" style={{ color: '#1B2B4B' }}>
                        {((Number(form.original_amount) || 0) + (Number(form.accumulated_amount) || 0)).toLocaleString()} {t('د.إ', 'AED')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ملاحظات */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('ملاحظات', 'Notes')}</Label>
                <Input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('تفاصيل إضافية...', 'Additional details...')} className="text-sm h-9" />
              </div>

            </div>

            <div className="flex gap-2 pt-3 flex-shrink-0 border-t mt-1">
              <Button onClick={handleSave} disabled={saving || !form.unit_number || !form.alert_date}
                className="flex-1 h-9" style={{ backgroundColor: '#1B2B4B' }}>
                {saving ? t('جاري الحفظ...', 'Saving...') : (editing ? t('تحديث التنبيه', 'Update Alert') : t('حفظ التنبيه', 'Save Alert'))}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-9">{t('إلغاء', 'Cancel')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}