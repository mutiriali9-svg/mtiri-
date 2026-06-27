import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import { Bell, Plus, Trash2, CheckCircle2, AlertTriangle, Building2, Home, Search, X, Edit2, Calendar, RefreshCw, Clock, Upload, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { differenceInDays, parseISO, isValid, addMonths, format } from 'date-fns';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const isDataEntry = user?.role === 'data_entry';

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
  const [paymentInput, setPaymentInput] = useState({ amount: '', notes: '', due_months: '', receipt_url: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [searchTenant, setSearchTenant] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();

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
    try {
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
    } catch (e) {
      toast({ description: 'خطأ في تحميل البيانات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const allUnits = [
    ...units.map(u => ({ ...u, _type: 'qarya' })),
    ...reUnits.map(u => ({ ...u, _type: 'real_estate' })),
  ];

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
    if (!form.unit_number || !form.alert_date || !form.tenant_name) {
      toast({ description: t('يرجى ملء الحقول المطلوبة', 'Please fill required fields'), variant: 'destructive' });
      return;
    }
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
        toast({ description: t('تم التحديث بنجاح', 'Updated successfully') });
      } else {
        await base44.entities.PaymentAlert.create(payload);
        await logActivity('PaymentAlert', 'create', `تنبيه - ${form.unit_number} - ${form.tenant_name}`, null, payload, null, user);
        toast({ description: t('تم الإضافة بنجاح', 'Created successfully') });
      }
      setShowForm(false);
      load();
    } catch (e) {
      toast({ description: t('حدث خطأ', 'Error occurred'), variant: 'destructive' });
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
    setPaymentInput({ amount: '', notes: '', due_months: '', receipt_url: '' });
    setReceiptUploaded(false);
    setPaymentError('');
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      setPaymentInput(p => ({ ...p, receipt_url: file_url }));
      setReceiptUploaded(true);
      setTimeout(() => setReceiptUploaded(false), 2000);
      toast({ description: t('تم رفع الإيصال', 'Receipt uploaded') });
    } catch (e) {
      toast({ description: t('فشل الرفع', 'Upload failed'), variant: 'destructive' });
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleDataEntryPaid = async () => {
    const alert = paymentModal;
    if (!alert || !paymentInput.amount) return;
    if (!paymentInput.due_months?.trim()) {
      setPaymentError(t('يرجى تحديد الشهر المستحق *', 'Please enter due month *'));
      return;
    }
    if (!paymentInput.receipt_url) {
      setPaymentError(t('يرجى رفع الإيصال *', 'Please upload receipt *'));
      return;
    }
    setPaymentError('');
    setPaymentSaving(true);

    const paidAmount = Number(paymentInput.amount);
    const monthly = Number(alert.original_amount || 0);
    const currentBalance = Number(alert.remaining_balance || monthly);
    const alertDate = alert.alert_date || today;
    const plan = alert.payment_plan || 'monthly';
    const planObj = PAYMENT_PLANS.find(p => p.value === plan);
    const planLabel = planObj?.label[lang] || planObj?.label.ar || 'شهري';

    const paymentRecord = {
      tenant_name: alert.tenant_name,
      unit_number: alert.unit_number,
      amount: paidAmount,
      payment_date: today,
      due_months: paymentInput.due_months || '',
      status: 'paid',
      notes: paymentInput.notes || '',
      receipt_image_url: paymentInput.receipt_url || '',
      created_by: user?.id || '',
    };

    try {
      await base44.entities.Payment.create(paymentRecord);
      await logActivity('Payment', 'create', `دفعة - ${alert.unit_number} - ${alert.tenant_name}`, null, paymentRecord, `دفعة جديدة: ${paidAmount} د.إ`, user);

      let newDate, newBalance, nextStatus, periodsAdvanced;

      if (paidAmount >= currentBalance) {
        const creditAfterCurrent = paidAmount - currentBalance;
        const additionalPeriods = monthly > 0 ? Math.floor(creditAfterCurrent / monthly) : 0;
        const partialCredit = monthly > 0 ? creditAfterCurrent % monthly : 0;
        periodsAdvanced = 1 + additionalPeriods;

        newDate = alertDate;
        for (let i = 0; i < periodsAdvanced; i++) {
          newDate = getNextDateFromPlan(newDate, plan);
        }

        newBalance = partialCredit > 0 ? monthly - partialCredit : monthly;
        nextStatus = newDate > today ? 'active' : 'overdue';

        const alertUpdatePayload = {
          remaining_balance: newBalance,
          last_paid_date: today,
          last_paid_amount: paidAmount,
          alert_date: newDate,
          next_alert_date: newDate,
          status: nextStatus,
        };

        await base44.entities.PaymentAlert.update(alert.id, alertUpdatePayload);
        await logActivity('PaymentAlert', 'update', `تحديث بعد دفع - ${alert.unit_number} - ${alert.tenant_name}`, alert, alertUpdatePayload, `دفعة كاملة + ${periodsAdvanced} دورات`, user);

        setJustPaid({
          unit_number: alert.unit_number,
          tenant_name: alert.tenant_name,
          next_date: newDate,
          plan: planLabel,
          paid: paidAmount,
          remaining: partialCredit > 0 ? newBalance : 0,
        });
      } else {
        newBalance = currentBalance - paidAmount;
        newDate = alertDate;
        nextStatus = today < alertDate ? 'active' : 'overdue';

        const alertUpdatePayload = {
          remaining_balance: newBalance,
          last_paid_date: today,
          last_paid_amount: paidAmount,
          status: nextStatus,
        };

        await base44.entities.PaymentAlert.update(alert.id, alertUpdatePayload);
        await logActivity('PaymentAlert', 'update', `تحديث بعد دفع جزئي - ${alert.unit_number} - ${alert.tenant_name}`, alert, alertUpdatePayload, `دفعة جزئية: ${paidAmount} د.إ`, user);

        setJustPaid({
          unit_number: alert.unit_number,
          tenant_name: alert.tenant_name,
          next_date: newDate,
          plan: planLabel,
          paid: paidAmount,
          remaining: newBalance,
        });
      }

      setTimeout(() => setJustPaid(null), 5000);
      toast({ description: t('تم تسجيل الدفعة', 'Payment recorded') });
      setPaymentModal(null);
      load();
    } catch (e) {
      setPaymentError(t('خطأ في تسجيل الدفعة', 'Error recording payment'));
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDelete = (alert) => {
    setConfirmDelete({
      message: t(`حذف تنبيه ${alert.unit_number}؟`, `Delete alert for unit ${alert.unit_number}?`),
      onConfirm: async () => {
        await base44.entities.PaymentAlert.delete(alert.id);
        await logActivity('PaymentAlert', 'delete', `تنبيه - ${alert.unit_number} - ${alert.tenant_name}`, alert, null, null, user);
        toast({ description: t('تم الحذف', 'Deleted') });
        setConfirmDelete(null);
        load();
      },
    });
  };

  const uniqueUnits = [...new Set(alerts.map(a => a.unit_number).filter(Boolean))];
  const totalActive = alerts.filter(a => a.status === 'active').length;
  const totalOverdue = alerts.filter(a => a.status === 'overdue').length;

  return (
    <div className="space-y-6 animate-fade-in-up" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Bell size={22} style={{ color: '#C9A84C' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('نظام التنبيه الذكي', 'Smart Alerts')}</h1>
            <p className="text-xs mt-0.5 text-muted-foreground">{t(`${alerts.length} تنبيهات — ${totalActive} نشط — ${totalOverdue} متأخر`, `${alerts.length} alerts — ${totalActive} active — ${totalOverdue} overdue`)}</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => openForm()} style={{ backgroundColor: '#1B2B4B' }} className="gap-2">
            <Plus size={16} /> {t('إضافة تنبيه', 'Add Alert')}
          </Button>
        )}
      </div>

      {/* Success Banner */}
      {justPaid && (
        <div className="rounded-xl p-4 flex items-start gap-3 border-2" style={{ backgroundColor: 'rgba(42,157,143,0.07)', borderColor: '#2A9D8F' }}>
          <CheckCircle2 size={22} style={{ color: '#2A9D8F', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#2A9D8F' }}>✅ {t(`دفعة - ${justPaid.unit_number} - ${justPaid.tenant_name}`, `Payment - ${justPaid.unit_number} - ${justPaid.tenant_name}`)}</p>
            <p className="text-xs mt-1" style={{ color: '#1B2B4B' }}>
              {t('المدفوع', 'Paid')}: <span className="font-bold">{justPaid.paid?.toLocaleString()}</span> د.إ · 
              {t('المتبقي', 'Remaining')}: <span className="font-bold">{justPaid.remaining?.toLocaleString()}</span> د.إ · 
              {t('القادم', 'Next')}: <span className="font-bold">{justPaid.next_date}</span>
            </p>
          </div>
          <button onClick={() => setJustPaid(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input placeholder={t('ابحث عن مستأجر أو وحدة', 'Search tenant or unit')} value={searchTenant} onChange={e => setSearchTenant(e.target.value)} className="pr-9 text-sm" />
        </div>
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('النوع', 'Type')}</SelectItem>
            <SelectItem value="qarya">{t('القرية', 'Qarya')}</SelectItem>
            <SelectItem value="real_estate">{t('العقارات', 'Real Estate')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('الحالة', 'Status')}</SelectItem>
            <SelectItem value="active">{t('نشط', 'Active')}</SelectItem>
            <SelectItem value="overdue">{t('متأخر', 'Overdue')}</SelectItem>
            <SelectItem value="paid">{t('مدفوع', 'Paid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts Grid */}
      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white card-bevel rounded-xl p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('لا توجد تنبيهات', 'No alerts')}</div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => {
            const sc = statusConfig[alert.status] || statusConfig.active;
            const dayLabel = getDaysLabel(alert.alert_date, lang);
            return (
              <div key={alert.id} className="bg-white card-bevel rounded-xl p-4 border-r-4" style={{ borderColor: sc.color }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{alert.tenant_name}</h3>
                    <p className="text-sm text-muted-foreground">{t('وحدة', 'Unit')}: {alert.unit_number} {alert.property_type === 'real_estate' ? t('- عقار', '- RE') : ''}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label[lang]}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('المبلغ الأصلي', 'Original')}</p>
                    <p className="font-bold text-lg" style={{ color: '#2A9D8F' }}>{(alert.original_amount || 0).toLocaleString()} {t('د.إ', 'AED')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('المتبقي', 'Remaining')}</p>
                    <p className="font-bold text-lg" style={{ color: '#E63946' }}>{(alert.remaining_balance || 0).toLocaleString()} {t('د.إ', 'AED')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('موعد الدفع', 'Due')}</p>
                    <p className="font-semibold text-sm">{alert.alert_date}</p>
                  </div>
                  <div>
                    {dayLabel && <p className="text-xs text-muted-foreground">{t('الحالة', 'Status')}</p>}
                    {dayLabel && <p className="font-semibold text-sm" style={{ color: dayLabel.color }}>{dayLabel.text}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                  {(isAdmin || isDataEntry) && (
                    <>
                      <Button onClick={() => openPaymentModal(alert)} variant="outline" size="sm" className="gap-1 text-xs">
                        <Upload size={14} /> {t('تسجيل دفعة', 'Record')}
                      </Button>
                      {isAdmin && alert.status !== 'paid' && (
                        <Button onClick={() => handleMarkPaid(alert)} variant="outline" size="sm" className="gap-1 text-xs">
                          <CheckCircle2 size={14} /> {t('تم الدفع', 'Mark Paid')}
                        </Button>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <Button onClick={() => openForm(alert)} variant="outline" size="sm" className="gap-1 text-xs">
                        <Edit2 size={14} /> {t('تعديل', 'Edit')}
                      </Button>
                      <Button onClick={() => handleDelete(alert)} variant="outline" size="sm" className="gap-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 size={14} /> {t('حذف', 'Delete')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto font-cairo">
          <DialogHeader><DialogTitle>{editing ? t('تعديل التنبيه', 'Edit Alert') : t('إضافة تنبيه جديد', 'New Alert')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t('رقم الوحدة', 'Unit Number')} *</Label>
              <Select value={form.unit_number} onValueChange={handleUnitSelect}>
                <SelectTrigger><SelectValue placeholder={t('اختر وحدة', 'Select unit')} /></SelectTrigger>
                <SelectContent>
                  {allUnits.map(u => <SelectItem key={u.unit_number} value={u.unit_number}>{u.unit_number} — {u.tenant_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('اسم المستأجر', 'Tenant Name')} *</Label>
              <Input value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('المبلغ الشهري', 'Monthly Amount')} *</Label>
              <Input type="number" value={form.original_amount} onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('المتأخر', 'Overdue')} </Label>
              <Input type="number" value={form.accumulated_amount} onChange={e => setForm(f => ({ ...f, accumulated_amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('تاريخ الدفع', 'Payment Date')} *</Label>
              <Input type="date" value={form.alert_date} onChange={e => setForm(f => ({ ...f, alert_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('خطة الدفع', 'Payment Plan')}</Label>
              <Select value={form.payment_plan} onValueChange={v => setForm(f => ({ ...f, payment_plan: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label[lang]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('ملاحظات', 'Notes')}</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#1B2B4B' }}>{saving ? t('جاري...', 'Saving...') : t('حفظ', 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto font-cairo">
          <DialogHeader><DialogTitle>{t('تسجيل دفعة', 'Record Payment')}</DialogTitle></DialogHeader>
          {paymentModal && (
            <div className="space-y-4 py-2">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('الوحدة', 'Unit')}</p>
                <p className="font-bold" style={{ color: '#1B2B4B' }}>{paymentModal.unit_number} — {paymentModal.tenant_name}</p>
                <p className="text-sm mt-2"><span className="text-xs text-muted-foreground">{t('المتبقي', 'Remaining')}:</span> <span className="font-bold text-lg" style={{ color: '#E63946' }}>{(paymentModal.remaining_balance || 0).toLocaleString()}</span> د.إ</p>
              </div>
              <div className="space-y-1">
                <Label>{t('المبلغ المدفوع', 'Amount')} *</Label>
                <Input type="number" value={paymentInput.amount} onChange={e => setPaymentInput(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>{t('الشهر المستحق', 'Due Month')} *</Label>
                <Input value={paymentInput.due_months} onChange={e => setPaymentInput(p => ({ ...p, due_months: e.target.value }))} placeholder={t('مثلاً: يناير 2026', 'e.g., January 2026')} />
              </div>
              <div className="space-y-1">
                <Label>{t('الإيصال', 'Receipt')} *</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={handleReceiptUpload} disabled={receiptUploading} className="flex-1" />
                  {receiptUploaded && <CheckCircle2 size={16} style={{ color: '#2A9D8F' }} />}
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t('ملاحظات', 'Notes')}</Label>
                <Input value={paymentInput.notes} onChange={e => setPaymentInput(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {paymentError && <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{paymentError}</div>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPaymentModal(null)}>{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleDataEntryPaid} disabled={paymentSaving || receiptUploading} style={{ backgroundColor: '#1B2B4B' }}>{paymentSaving ? t('جاري...', 'Saving...') : t('حفظ', 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}