import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import {
  Bell, Plus, Trash2, CheckCircle2, AlertTriangle,
  Building2, Home, Search, X, Edit2, Calendar, RefreshCw, Clock, Upload, MessageCircle, FileImage
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

// Fields to strip before sending to DB (not part of PaymentAlert entity)
const FORM_ONLY_FIELDS = ['accumulated_amount'];

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

function getFutureDates(alertDate, plan, count = 4) {
  const dates = [];
  let current = alertDate;
  for (let i = 0; i < count; i++) {
    current = getNextDateFromPlan(current, plan);
    dates.push(current);
  }
  return dates;
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
  const [expandedAlert, setExpandedAlert] = useState(null);
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
  }, [searchTenant, filterProperty, filterStatus, filterUnit]);

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

  const handleMarkPaid = async (alert) => {
    const nextDate = getNextDateFromPlan(alert.alert_date, alert.payment_plan || 'monthly');
    const planObj = PAYMENT_PLANS.find(p => p.value === (alert.payment_plan || 'monthly'));
    const planLabel = planObj?.label[lang] || planObj?.label.ar || 'شهري';
    
    const updatePayload = {
      status: 'active',
      last_paid_date: alert.alert_date,
      alert_date: nextDate,
      next_alert_date: nextDate,
    };
    
    await base44.entities.PaymentAlert.update(alert.id, updatePayload);
    await logActivity('PaymentAlert', 'update', `تحديث حالة - ${alert.unit_number} - ${alert.tenant_name}`, alert, updatePayload, 'تم تحديد كمدفوع وتقدم التاريخ', user);
    
    setJustPaid({ unit_number: alert.unit_number, tenant_name: alert.tenant_name, next_date: nextDate, plan: planLabel });
    setTimeout(() => setJustPaid(null), 5000);
    load();
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
      // fallback
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
    <div className="space-y-6 animate-fade-in-up" dir="rtl">
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

      {/* باقي الملف كما هو — بدون تغيير في الـ JSX */}
      {/* ... (الكود الباقي يبقى كما هو تماماً) ... */}
    </div>
  );
}