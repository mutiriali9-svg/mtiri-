import { useState, useEffect, useRef, useCallback } from 'react';
import { base44, uploadFile, supabase } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import PhoneInput from '@/components/PhoneInput';
import { formatPhone } from '@/utils/phone';
import { Plus, Search, Edit2, Trash2, Building2, Phone, Upload, X, FileImage, Loader2, BellRing, DoorOpen, CalendarX, ArrowLeft, ArrowRight } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useContractArchive } from '@/components/ContractArchive';
import { contractEnded, hasContract, isAlertDue, owedAsOf, renewalDraft, settleArrears } from '@/utils/contractArchive';
import { getAlertState } from '@/utils/alertAccrual';
import { isOtherTenantsExitPayment } from '@/utils/contractPeriods';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO, isValid, addMonths, format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import PullRefreshIndicator from '@/components/PullRefreshIndicator';
import { logActivity } from '@/utils/activityLogger';
import { owedDueText, positionNote, positionPeriod, rentPosition } from '@/utils/rentPosition';
import RentPositionBox from '@/components/RentPositionBox';

const emptyUnit = {
  unit_number: '', tenant_name: '', nationality: '', annual_rent: '',
  insurance: '', insurance_type: 'cash', contract_start: '', contract_end: '', payment_plan: '',
  owner_phone: '', status: 'occupied', floor: '', notes: '', contract_image_url: '',
  _type: 'qarya',
};

const TYPE_MAP = {
  qarya: {
    write: () => base44.entities.UnitWrite,
    labelAr: 'القرية', labelEn: 'Qarya',
    color: '#1B2B4B', bg: 'rgba(27,43,75,0.08)',
  },
  re: {
    write: () => base44.entities.ReUnit,
    labelAr: 'العقارات', labelEn: 'Real Estate',
    color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',
  },
};

const PAYMENT_PLANS = [
  { value: 'monthly', label: { ar: 'شهري', en: 'Monthly' }, months: 1 },
  { value: 'quarterly', label: { ar: 'كل 3 أشهر', en: 'Quarterly' }, months: 3 },
  { value: 'five_annual', label: { ar: '5 دفعات سنوياً', en: '5x Annually' }, days: 73 },
  { value: 'biannual', label: { ar: 'كل 6 أشهر', en: 'Biannual' }, months: 6 },
  { value: 'annual', label: { ar: 'سنوي', en: 'Annual' }, months: 12 },
];

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

export default function Units() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [form, setForm] = useState(emptyUnit);
  const [saving, setSaving] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [vacateUnit, setVacateUnit] = useState(null);
  const [vacating, setVacating] = useState(false);
  const [vacateReason, setVacateReason] = useState('');
  const [keepDeposit, setKeepDeposit] = useState(true);
  const [exitDate, setExitDate] = useState('');
  const [gapsConfirmed, setGapsConfirmed] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [viewUnit, setViewUnit] = useState(null);

  // ── Alert dialog state ──
  const [alertDialog, setAlertDialog] = useState(null);
  const [alertForm, setAlertForm] = useState({
    alert_date: '', original_amount: '', accumulated_amount: '',
    payment_plan: 'monthly', description: '',
  });
  const [alertSaving, setAlertSaving] = useState(false);

  const contractFileRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const GoIcon = isAr ? ArrowLeft : ArrowRight;
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'data_entry';
  const canAlert = isAdmin || user?.role === 'data_entry';
  const { chooseAction, archiveForVacate, archiveForRenewal, chooserDialog } = useContractArchive('qarya');
  const [editMode, setEditMode] = useState('correct');
  const [replacing, setReplacing] = useState(false);
  const [exitKind, setExitKind] = useState('vacate');
  const ending = exitKind === 'expiry';
  const openExit = (u, kind) => {
    if (kind === 'expiry' && !contractEnded(u, new Date().toISOString().split('T')[0])) {
      toast({
        description: u?.contract_end
          ? (isAr ? `ينتهي العقد في ${u.contract_end}. وللخروج قبل ذلك استخدم «إخلاء المستأجر».` : `The contract ends on ${u.contract_end}. To leave before then, use «Vacate the tenant».`)
          : (isAr ? 'لا يوجد تاريخ نهاية لهذا العقد. وللخروج استخدم «إخلاء المستأجر».' : 'This contract has no end date. To leave, use «Vacate the tenant».'),
        variant: 'destructive',
      });
      return;
    }
    setReplacing(kind === 'replace');
    setExitKind(kind === 'expiry' ? 'expiry' : 'vacate');
    setVacateReason('');
    setExitDate(new Date().toISOString().split('T')[0]);
    setGapsConfirmed(false);
    setVacateUnit(u);
  };
  const closeExit = () => { setVacateUnit(null); setReplacing(false); setExitKind('vacate'); setVacateReason(''); setGapsConfirmed(false); };
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('tab') === 'archive') navigate('/archive', { replace: true });
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const statusConfig = {
    occupied: { label: t('occupied'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    vacant: { label: t('vacant'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    maintenance: { label: t('maintenance'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };

  const handleContractUpload = async (file) => {
    if (!file) return;
    setUploadingContract(true);
    const { file_url } = await uploadFile(file);
    setForm(p => ({ ...p, contract_image_url: file_url }));
    setUploadingContract(false);
  };

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const qarya = await base44.entities.Unit.list();
      try {
        const dep = await base44.entities.Deposit.list();
        setDeposits((dep || []).filter(d => d.property_type === 'qarya'));
      } catch { setDeposits([]); }
      try {
        const dd = await base44.entities.DepositDeduction.list();
        setDeductions((dd || []).filter(d => d.property_type === 'qarya'));
      } catch { setDeductions([]); }
      try {
        const pay = await base44.entities.Payment.list();
        setPayments(pay || []);
      } catch { setPayments([]); }
      try {
        const al = await base44.entities.PaymentAlert.list();
        setAlerts((al || []).filter(a => a.property_type === 'qarya'));
      } catch { setAlerts([]); }
      setUnits((qarya || []).map(u => ({ ...u, _type: 'qarya' })));
    } catch (err) {
      console.error('fetchUnits ERROR:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUnits(); }, []);
  const refreshing = usePullToRefresh(fetchUnits);

  useEffect(() => {
    const fresh = searchParams.get('newTenant');
    const target = searchParams.get('replace') || searchParams.get('vacate') || searchParams.get('expire');
    const kind = searchParams.get('replace') ? 'replace' : searchParams.get('vacate') ? 'vacate' : 'expiry';
    if ((!target && !fresh) || loading) return;
    setSearchParams({}, { replace: true });
    if (fresh) {
      const vacant = units.find(x => String(x.unit_number) === fresh);
      if (vacant && !hasContract(vacant)) openForm(vacant, 'new_tenant', vacant);
      return;
    }
    const u = units.find(x => String(x.unit_number) === target);
    if (u && hasContract(u)) openExit(u, kind);
  }, [loading, units]);

  const vacantUnits = units
    .filter(u => u.status === 'vacant' && !u.tenant_name)
    .sort((a, b) => (parseInt(a.unit_number) || 9999) - (parseInt(b.unit_number) || 9999));

  const dupTarget = !editUnit && form.unit_number?.trim()
    ? units.find(u => String(u.unit_number).trim() === String(form.unit_number).trim()) || null
    : null;
  const dupUnit = !!dupTarget;

  const openAdd = () => { setEditUnit(null); setEditMode('correct'); setForm(emptyUnit); setDialogOpen(true); };

  const openForm = (u, mode, values) => {
    const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v != null));
    setEditUnit(u);
    setEditMode(mode);
    setForm({ ...emptyUnit, ...filled });
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    if (!hasContract(u)) return openForm(u, 'correct', u);
    setDialogOpen(false);
    chooseAction(u, {
      renew: () => openForm(u, 'renew', renewalDraft(u)),
      replace: () => openExit(u, 'replace'),
      vacate: () => openExit(u, 'vacate'),
      expire: () => openExit(u, 'expiry'),
      correct: () => openForm(u, 'correct', u),
    });
  };

  const handleSave = async () => {
    if (dupTarget) return openEdit(dupTarget);
    if (editUnit && editMode === 'renew') {
      if (!form.contract_start || !form.contract_end) {
        toast({ description: isAr ? 'أدخل تاريخ بداية العقد الجديد ونهايته.' : 'Enter the new contract start and end dates.', variant: 'destructive' });
        return;
      }
      setSaving(true);
      try {
        await archiveForRenewal(editUnit);
      } catch (e) {
        setSaving(false);
        toast({ description: (isAr ? 'تعذّر حفظ العقد الحالي في الأرشيف، ولم يُحفظ التجديد. ' : 'Could not archive the current contract, so the renewal was not saved. ') + (e?.message || ''), variant: 'destructive' });
        return;
      }
    }
    return saveUnit();
  };

  const saveUnit = async (target = editUnit, values = form) => {
    setSaving(true);
    const type = values._type || 'qarya';
    const entity = TYPE_MAP[type].write();
    const { _type, id, created_at, ...clean } = values;
    const data = {
      ...clean,
      annual_rent: parseFloat(values.annual_rent) || 0,
      contract_start: values.contract_start || null,
      contract_end: values.contract_end || null,
    };

    try {
      if (target) {
        setUnits(prev => prev.map(u => u.id === target.id ? { ...u, ...data, _type: type } : u));
        setDialogOpen(false);
        await entity.update(target.id, data);
        await logActivity('Unit', 'update', `${values.unit_number} - ${values.tenant_name}`, target, data, null, user);
        toast({ description: t('unitUpdated') });
      } else {
        setDialogOpen(false);
        const created = await entity.create(data);
        await logActivity('Unit', 'create', `${values.unit_number} - ${values.tenant_name}`, null, data, null, user);
        toast({ description: t('unitAdded') });
      }

      try {
        await supabase.rpc('sync_unit_deposit', {
          p_sync: {
            property_type: type === 'qarya' ? 'qarya' : 'real_estate',
            unit_number: data.unit_number,
            tenant_name: data.tenant_name || null,
            amount: parseFloat(String(data.insurance || '').replace(/[^0-9.]/g, '')) || 0,
            method: data.insurance_type || 'cash',
            received_date: data.contract_start || null,
          },
        });
      } catch (e) {
        console.error('deposit sync ERROR:', e);
      }

      fetchUnits();
    } catch (err) {
      console.error('save ERROR:', err);
      toast({ description: isAr ? 'فشل الحفظ، حاول مرة أخرى' : 'Save failed', variant: 'destructive' });
      fetchUnits();
    }
    setSaving(false);
  };

  const depositBalanceOf = (unitNumber) => {
    const held = deposits
      .filter(d => d.unit_number === unitNumber && d.method !== 'cheque')
      .reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const used = deductions
      .filter(d => d.unit_number === unitNumber)
      .reduce((a, d) => a + (Number(d.amount) || 0), 0);
    return Math.max(0, Math.round((held - used) * 100) / 100);
  };

  const positionOf = (unit) => rentPosition({
    unit,
    payments: payments.filter(p => p.unit_number === unit?.unit_number && !isOtherTenantsExitPayment(p, unit?.tenant_name)),
    exitDate: exitDate || new Date().toISOString().split('T')[0],
    confirmGaps: gapsConfirmed,
  });

  const openAlertsOf = (unitNumber) =>
    alerts.filter(a => a.unit_number === unitNumber && a.status !== 'paid');

  const exitDayOf = () => {
    const now = new Date().toISOString().split('T')[0];
    return exitDate && exitDate < now ? exitDate : now;
  };

  const owedOf = (unit) => owedAsOf(openAlertsOf(unit.unit_number), exitDayOf());

  const handleVacate = async (unit, returnDeposit = false, recordReason = false, settleFromDeposit = false) => {
    setVacating(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const exitStr = exitDate || todayStr;
    const pos = positionOf(unit);
    const owedText = pos.ok ? owedDueText(pos) : '';

    const settled = settleArrears(pos.ok ? pos.owed : owedOf(unit), depositBalanceOf(unit.unit_number), settleFromDeposit || (recordReason && keepDeposit));
    const depositSteps = [];
    let recorded = false;

    if (recordReason) {
      const rentLeft = pos.ok ? pos.credit : 0;
      const reason = vacateReason.trim();

      if (rentLeft > 0) {
        const { error: rErr } = await supabase.rpc('create_refund', {
          p_refund: {
            property_type: 'qarya',
            kind: 'eviction',
            unit_number: unit.unit_number,
            tenant_name: unit.tenant_name || null,
            amount: 0,
            refund_date: todayStr,
            applies_to_date: unit.contract_start || todayStr,
            method: 'cash',
            reason,
            paid_total: pos.paidTotal,
            period_start: positionPeriod(pos).periodStart,
            period_end: positionPeriod(pos).periodEnd,
            exit_date: exitStr,
            daily_rate: pos.dayRate,
            consumed_amount: pos.consumed,
            penalty_amount: rentLeft,
            penalty_reason: reason,
            other_deductions: 0,
            computed_amount: 0,
            is_manual: false,
          },
          p_vacate: false,
        });
        if (rErr) {
          setVacating(false);
          toast({ description: rErr.message || (isAr ? 'تعذّر تسجيل سند الإخلاء' : 'Could not record the voucher'), variant: 'destructive' });
          return;
        }
        recorded = true;
      }

      depositSteps.push(
        { amount: settled.applied, destination: 'payment', due_months: owedText || 'متأخرات حتى الإخلاء', reason },
        { amount: settled.recovery, destination: 'owner_recovery', due_months: null, reason },
      );
    }

    if (settleFromDeposit) {
      depositSteps.push(
        { amount: settled.applied, destination: 'payment', due_months: owedText || (ending ? 'متأخرات حتى انتهاء العقد' : 'متأخرات حتى الإخلاء'), reason: ending ? 'سداد المستحق من التأمين عند انتهاء العقد' : 'سداد المستحق من التأمين عند الإخلاء' },
        { amount: settled.recovery, destination: 'tenant_return', due_months: null, reason: `إرجاع باقي التأمين عند ${ending ? 'انتهاء عقد' : 'تفريغ'} الوحدة ${unit.unit_number}` },
      );
    }

    for (const step of depositSteps.filter(s => s.amount > 0)) {
      const { error: dErr } = await supabase.rpc('create_deposit_deduction', {
        p_ded: {
          property_type: 'qarya',
          unit_number: unit.unit_number,
          tenant_name: unit.tenant_name || null,
          amount: step.amount,
          deduction_date: todayStr,
          reason: step.reason,
          destination: step.destination,
          due_months: step.due_months,
          method: 'cash',
        },
      });
      if (dErr) {
        setVacating(false);
        toast({ description: dErr.message || (isAr ? 'تعذّر احتساب التأمين' : 'Could not book the deposit'), variant: 'destructive' });
        return;
      }
      recorded = true;
    }

    if (returnDeposit) {
      const bal = depositBalanceOf(unit.unit_number);
      if (bal > 0) {
        const { error: rpcErr } = await supabase.rpc('create_deposit_deduction', {
          p_ded: {
            property_type: unit._type === 're' ? 'real_estate' : 'qarya',
            unit_number: unit.unit_number,
            tenant_name: unit.tenant_name || null,
            amount: bal,
            deduction_date: new Date().toISOString().split('T')[0],
            reason: `إرجاع التأمين عند تفريغ الوحدة ${unit.unit_number}`,
            destination: 'tenant_return',
            method: 'cash',
          },
        });
        if (rpcErr) {
          setVacating(false);
          toast({ description: rpcErr.message || (isAr ? 'تعذّر تسجيل إرجاع التأمين' : 'Could not record the deposit refund'), variant: 'destructive' });
          return;
        }
        recorded = true;
      }
    }

    try {
      await archiveForVacate(unit, recordReason ? vacateReason : '', replacing ? 'tenant_change' : ending ? 'expiry' : 'vacate', settled.owed, settled.applied, positionNote(pos));
    } catch (e) {
      setVacating(false);
      toast({
        description: (recorded
          ? (isAr ? 'سُجّلت الحركات المالية، لكن تعذّر حفظ العقد في الأرشيف، فلم تُفرَّغ الوحدة. أكمل الإنهاء دون تكرار الحركات. ' : 'The money movements were recorded, but the contract could not be archived, so the unit was not vacated. Finish without repeating them. ')
          : (isAr ? 'تعذّر حفظ العقد في الأرشيف، ولم تُفرَّغ الوحدة. ' : 'Could not archive the contract, so the unit was not vacated. ')) + (e?.message || ''),
        variant: 'destructive',
      });
      if (recorded) fetchUnits();
      return;
    }
    const entity = TYPE_MAP[unit._type || 'qarya'].write();
    const patch = {
      status: 'vacant', tenant_name: null, nationality: null, owner_phone: null,
      insurance: null, insurance_type: 'cash', annual_rent: null, payment_plan: null,
      contract_start: null, contract_end: null, contract_image_url: null,
    };
    try {
      const killed = openAlertsOf(unit.unit_number);
      try {
        await Promise.all(killed.map(a => base44.entities.PaymentAlert.delete(a.id)));
      } catch (e) { console.error('vacate alerts ERROR:', e); }
      await entity.update(unit.id, patch);
      const steps = [
        `مسح بيانات المستأجر ${unit.tenant_name ? `«${unit.tenant_name}»` : ''}`,
        'مسح الجنسية والهاتف',
        unit.insurance ? `مسح مبلغ التأمين ${unit.insurance}` : null,
        unit.annual_rent ? `مسح الإيجار السنوي ${Number(unit.annual_rent).toLocaleString()}` : null,
        unit.contract_start || unit.contract_end ? `مسح تواريخ العقد ${unit.contract_start || ''} → ${unit.contract_end || ''}` : null,
        killed.length ? `حذف ${killed.length} تنبيه غير مسدَّد` : null,
        `تاريخ الخروج ${exitStr}`,
        pos.gapsConfirmed ? 'اعتبار الأشهر التي لا يُعرف شهر دفعاتها مسدَّدة بتأكيد المستخدم' : null,
        returnDeposit ? 'تسجيل إرجاع التأمين للمستأجر' : null,
        settleFromDeposit ? 'سداد المتأخرات من التأمين وردّ الباقي للمستأجر' : null,
        recordReason ? `تسجيل سند إخلاء بسبب «${vacateReason.trim()}»` : null,
        'تغيير الحالة إلى شاغرة',
      ].filter(Boolean);
      await logActivity('Unit', 'update', `${unit.unit_number} — ${ending ? 'انتهاء العقد' : 'تفريغ الوحدة'}`, unit, { ...unit, ...patch }, steps.join(' · '), user);
      toast({ description: ending ? (isAr ? 'تم إنهاء العقد' : 'Contract ended') : (isAr ? 'تم تفريغ الوحدة' : 'Unit vacated') });
      setVacateUnit(null); setVacateReason(''); setKeepDeposit(true); setDialogOpen(false); setExitKind('vacate'); setGapsConfirmed(false);
      if (replacing) {
        setReplacing(false);
        openForm({ ...unit, ...patch }, 'new_tenant', { ...unit, ...patch });
      }
      fetchUnits();
    } catch (err) {
      console.error('vacate ERROR:', err);
      toast({ description: isAr ? 'تعذّر تفريغ الوحدة' : 'Could not vacate the unit', variant: 'destructive' });
    }
    setVacating(false);
  };

  const handleDelete = (unit) => {
    const type = unit._type || 'qarya';
    const entity = TYPE_MAP[type].write();
    setConfirmDelete({
      message: (() => {
        const dep = deposits.filter(d => d.unit_number === unit.unit_number);
        const depTotal = dep.reduce((a, d) => a + (Number(d.amount) || 0), 0);
        const hasCheque = dep.some(d => d.method === 'cheque');
        return (
          <>
            <span className="block text-base font-bold mb-3" style={{ color: '#1B2B4B' }}>
              {isAr ? `حذف الوحدة ${unit.unit_number}` : `Delete unit ${unit.unit_number}`}
            </span>
            <span className="block mb-3 pb-3" style={{ borderBottom: '1px solid #E2E8F0', color: depTotal ? '#E63946' : '#64748B' }}>
              {depTotal
                ? (isAr
                  ? `سيُحذف معها التأمين المسجَّل البالغ ${depTotal.toLocaleString()} د.إ${hasCheque ? ' (شيك)' : ''}.`
                  : `The recorded deposit of ${depTotal.toLocaleString()} AED${hasCheque ? ' (cheque)' : ''} will also be deleted.`)
                : (isAr ? 'لا يوجد تأمين مسجَّل لهذه الوحدة.' : 'No deposit is recorded for this unit.')}
            </span>
            <span className="block mb-2 text-start leading-relaxed">
              {isAr ? (
                <>عند دخول مستأجر جديد، يُفضَّل <b style={{ color: '#1B2B4B' }}>تعديل بيانات الوحدة</b> بدلاً من حذفها، للحفاظ على سجلّها المالي وتأمينها مرتبطَين بها.</>
              ) : (
                <>When a new tenant moves in, it is better to <b style={{ color: '#1B2B4B' }}>edit the unit details</b> than to delete the unit, so its financial history and deposit stay linked to it.</>
              )}
            </span>
            <span className="block text-start leading-relaxed" style={{ color: '#C9A84C' }}>
              {isAr
                ? 'حذف الوحدة وإعادة إدخالها يُنشئ سجلاً جديداً، وتبقى السجلات السابقة دون وحدة مرتبطة.'
                : 'Deleting and re-adding the unit creates a new record, and earlier records are left without a linked unit.'}
            </span>
          </>
        );
      })(),
      onConfirm: async () => {
        setUnits(prev => prev.filter(u => u.id !== unit.id));
        setConfirmDelete(null);
        setDialogOpen(false);
        try {
          await entity.delete(unit.id);
          await logActivity('Unit', 'delete', `${unit.unit_number} - ${unit.tenant_name}`, unit, null, null, user);
          toast({ description: t('unitDeleted') });
        } catch (err) {
          console.error('delete ERROR:', err);
          fetchUnits();
        }
      },
    });
  };

  const goToUnit = (unit) => {
    const base = unit._type === 're' ? '/re-units' : '/units';
    navigate(`${base}/${encodeURIComponent(unit.unit_number)}`);
  };

  // ── Alert handlers ──
  const openAlert = (unit) => {
    setAlertForm({
      alert_date: '',
      original_amount: unit.annual_rent ? String(Math.round(Number(unit.annual_rent) / 12)) : '',
      accumulated_amount: '', payment_plan: 'monthly', description: '',
    });
    setAlertDialog(unit);
  };

  const handleSaveAlert = async () => {
    const unit = alertDialog;
    if (!unit || !alertForm.alert_date) return;
    setAlertSaving(true);
    try {
      const monthly = Number(alertForm.original_amount) || 0;
      const overdue = Number(alertForm.accumulated_amount) || 0;
      const total = monthly + overdue;
      const propertyType = unit._type === 're' ? 'real_estate' : 'qarya';

      await base44.entities.PaymentAlert.create({
        unit_number: unit.unit_number,
        tenant_name: unit.tenant_name || '',
        property_type: propertyType,
        alert_date: alertForm.alert_date,
        original_amount: monthly,
        remaining_balance: total || monthly,
        payment_plan: alertForm.payment_plan || 'monthly',
        description: alertForm.description || '',
        status: overdue > 0 ? 'overdue' : (alertForm.alert_date <= today ? 'overdue' : 'active'),
      });

      await logActivity('Unit', 'create', `تنبيه - ${unit.unit_number}`, null, { alert: true }, null, user);
      toast({ description: isAr ? 'تم إنشاء التنبيه ✓' : 'Alert created ✓' });
      setAlertDialog(null);
    } catch (err) {
      console.error('alert save ERROR:', err);
      toast({ description: isAr ? 'فشل إنشاء التنبيه' : 'Failed to create alert', variant: 'destructive' });
    }
    setAlertSaving(false);
  };

  const alertPreviewDate = alertForm.alert_date && alertForm.payment_plan
    ? getNextDateFromPlan(alertForm.alert_date, alertForm.payment_plan)
    : null;

  const getExpiryTag = (contract_end) => {
    if (!contract_end) return null;
    const d = parseISO(contract_end);
    if (!isValid(d)) return null;
    const days = differenceInDays(d, new Date());
    if (days < 0) return { label: t('expired'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' };
    if (days <= 30) return { label: `${days}d`, color: '#E63946', bg: 'rgba(230,57,70,0.1)' };
    if (days <= 90) return { label: `${days}d`, color: '#F97316', bg: 'rgba(249,115,22,0.1)' };
    return null;
  };

  const availableYears = [...new Set(units.map(u => u.contract_start?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  const filtered = units.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.unit_number?.toLowerCase().includes(q) || u.tenant_name?.toLowerCase().includes(q) || u.nationality?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || u.status === statusFilter;
    const matchY = yearFilter === 'all' || u.contract_start?.startsWith(yearFilter) || u.contract_end?.startsWith(yearFilter);
    return matchQ && matchS && matchY;
  }).sort((a, b) => {
    const aNum = parseInt(a.unit_number) || Infinity;
    const bNum = parseInt(b.unit_number) || Infinity;
    if (aNum !== Infinity && bNum !== Infinity) return aNum - bNum;
    return (a.unit_number || '').localeCompare(b.unit_number || '');
  });

  const TypeBadge = ({ type }) => {
    const cfg = TYPE_MAP[type] || TYPE_MAP.qarya;
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
        {isAr ? cfg.labelAr : cfg.labelEn}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PullRefreshIndicator refreshing={refreshing} />
      <PageHeader
        titleAr="الوحدات السكنية"
        titleEn="All Units"
        description={`${units.length} ${isAr ? t('unitNumber') : 'units'} · ${isAr ? 'القرية' : 'Qarya'}`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#1B2B4B' }}>
            <Plus size={16} /> {t('addUnit')}
          </Button>
        )}
      />

        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input placeholder={t('searchUnits')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9 text-sm" />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder={t('status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="occupied">{t('occupied')}</SelectItem>
                <SelectItem value="vacant">{t('vacant')}</SelectItem>
                <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            {Object.entries(statusConfig).map(([k, v]) => {
              const count = units.filter(u => u.status === k).length;
              return (
                <span key={k} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: v.bg, color: v.color }}>
                  {v.label}: {count}
                </span>
              );
            })}
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-28 h-7 text-xs"><SelectValue placeholder={isAr ? 'السنة' : 'Year'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? 'كل السنوات' : 'All Years'}</SelectItem>
                {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Table */}
          <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] lg:text-sm">
                <thead style={{ backgroundColor: '#1B2B4B' }}>
                  <tr>
                    {[t('unitNumber'), t('tenantName'), t('nationality'), t('annualRent'), t('paymentPlan'), t('contractEndLabel'), t('status'), ''].map((h, i) => (
                      <th key={i} className="text-start py-2.5 lg:py-3 px-2 lg:px-4 text-white/80 font-medium text-[10px] lg:text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array(8).fill(0).map((_, j) => <td key={j} className="py-2.5 lg:py-3 px-2 lg:px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                    </tr>
                  )) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noUnitsFound')}</td></tr>
                  ) : filtered.map((u, i) => {
                    const sc = statusConfig[u.status] || statusConfig.vacant;
                    const expTag = getExpiryTag(u.contract_end);
                    const isExpired = u.contract_end && differenceInDays(parseISO(u.contract_end), new Date()) < 0;
                    const TypeIcon = Building2;
                    return (
                      <tr key={`${u._type}-${u.id}`} onClick={() => setViewUnit(u)}
                        className="border-b border-border/50 hover:bg-surface transition-colors cursor-pointer"
                        style={{ backgroundColor: isExpired ? 'rgba(230,57,70,0.07)' : i % 2 === 1 ? '#F8F9FA' : undefined }}>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4 font-bold">
                          <div className="flex items-center gap-1.5 lg:gap-2" style={{ color: '#1B2B4B' }}>
                            <TypeIcon size={14} className="text-muted-foreground" />
                            {u.unit_number}
                          </div>
                        </td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4 font-medium max-w-[120px] lg:max-w-44">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold" style={{ color: '#1B2B4B' }}>{u.tenant_name || '-'}</span>
                          </div>
                          {u.owner_phone && <p className="text-[9px] lg:text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone size={10} />{formatPhone(u.owner_phone)}</p>}
                        </td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4 text-muted-foreground text-[10px] lg:text-xs">{u.nationality || '-'}</td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4 font-semibold whitespace-nowrap" style={{ color: '#1B2B4B' }}>{u.annual_rent ? `${Number(u.annual_rent).toLocaleString()} AED` : '-'}</td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4 text-muted-foreground text-[10px] lg:text-xs max-w-[84px] lg:max-w-32"><span className="truncate block">{u.payment_plan || '-'}</span></td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-0.5 lg:gap-2">
                            <span className="text-[10px] lg:text-xs text-muted-foreground whitespace-nowrap">{u.contract_end || '-'}</span>
                            {expTag && <span className="text-[9px] lg:text-xs font-bold px-1 lg:px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: expTag.bg, color: expTag.color }}>{expTag.label}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4">
                          <span className="px-1.5 lg:px-2.5 py-0.5 lg:py-1 rounded-full text-[10px] lg:text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                        </td>
                        <td className="py-2.5 lg:py-3 px-2 lg:px-4" onClick={ev => ev.stopPropagation()}>
                          {canEdit && (
                            <div className="flex items-center gap-0.5 lg:gap-1">
                              {canAlert && (
                                <button onClick={() => openAlert(u)} title={isAr ? 'إضافة تنبيه' : 'Add alert'}
                                  className="p-1 lg:p-1.5 rounded hover:bg-muted transition-colors" style={{ color: '#C9A84C' }}><BellRing size={14} /></button>
                              )}
                              <button onClick={() => goToUnit(u)} title={isAr ? 'صفحة الوحدة' : 'Unit page'}
                                className="p-1 lg:p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy"><Building2 size={14} /></button>
                              <button onClick={() => openEdit(u)}
                                className="p-1 lg:p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy"><Edit2 size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {loading ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white card-bevel rounded-xl p-4">
                <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
              </div>
            )) : filtered.length === 0 ? (
              <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('noUnitsFound')}</div>
            ) : filtered.map((u) => {
              const sc = statusConfig[u.status] || statusConfig.vacant;
              const expTag = getExpiryTag(u.contract_end);
              const isExpired = u.contract_end && differenceInDays(parseISO(u.contract_end), new Date()) < 0;
              const TypeIcon = Building2;
              return (
                <div key={`${u._type}-${u.id}`} onClick={() => setViewUnit(u)}
                  className="card-bevel rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer active:bg-muted/30"
                  style={{ backgroundColor: isExpired ? 'rgba(230,57,70,0.07)' : '#ffffff', border: isExpired ? '1px solid rgba(230,57,70,0.25)' : undefined }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TypeIcon size={18} className="text-muted-foreground" />
                      <span className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{u.unit_number}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('tenantName')}</span>
                      <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>{u.tenant_name || '-'}</span>
                    </div>
                    {u.owner_phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone size={12} />{formatPhone(u.owner_phone)}</div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('annualRent')}</span>
                      <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>{u.annual_rent ? `${Number(u.annual_rent).toLocaleString()} AED` : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('contractEndLabel')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{u.contract_end || '-'}</span>
                        {expTag && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: expTag.bg, color: expTag.color }}>{expTag.label}</span>}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap" onClick={ev => ev.stopPropagation()}>
                      {canAlert && (
                        <button onClick={() => openAlert(u)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm" style={{ color: '#C9A84C' }}><BellRing size={14} /> {isAr ? 'تنبيه' : 'Alert'}</button>
                      )}
                      <button onClick={() => goToUnit(u)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm"><Building2 size={14} /> {isAr ? 'التفاصيل' : 'Details'}</button>
                      <button onClick={() => openEdit(u)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm"><Edit2 size={14} />{t('edit')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />
      {chooserDialog}

      <Dialog open={!!vacateUnit} onOpenChange={(v) => { if (!v) closeExit(); }}>
        <DialogContent className="max-w-sm font-cairo" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-base">
              {ending
                ? (isAr ? `انتهاء عقد الوحدة ${vacateUnit?.unit_number || ''}` : `End the contract of unit ${vacateUnit?.unit_number || ''}`)
                : (isAr ? `تفريغ الوحدة ${vacateUnit?.unit_number || ''}` : `Vacate unit ${vacateUnit?.unit_number || ''}`)}
            </DialogTitle>
          </DialogHeader>

          {vacateUnit && (() => {
            const bal = depositBalanceOf(vacateUnit.unit_number);
            const pos = positionOf(vacateUnit);
            const rentLeft = pos.ok ? pos.credit : 0;
            const exitDay = exitDayOf();
            const openAlerts = openAlertsOf(vacateUnit.unit_number);
            const dueList = pos.ok ? [] : openAlerts.filter(a => isAlertDue(a, exitDay));
            const laterCount = openAlerts.length - dueList.length;
            const pending = rentLeft > 0 || bal > 0;
            const owed = pos.ok ? pos.owed : owedOf(vacateUnit);
            const settled = settleArrears(owed, bal, keepDeposit);
            const fromDeposit = settleArrears(owed, bal, true);
            const onExit = ending ? (isAr ? 'عند إنهاء العقد' : 'When the contract ends') : (isAr ? 'عند التفريغ' : 'On vacating');
            const finish = ending ? (isAr ? 'يُنهى العقد' : 'ends the contract') : (isAr ? 'تُفرَّغ الوحدة' : 'vacates the unit');
            return (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{isAr ? 'تاريخ الخروج' : 'Exit date'}</Label>
                  <Input type="date" value={exitDate} max={today}
                    onChange={e => { setExitDate(e.target.value || today); setGapsConfirmed(false); }}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>

                {pos.ok ? (
                  <RentPositionBox pos={pos} isAr={isAr} deposit={bal} confirmed={gapsConfirmed} onConfirm={setGapsConfirmed} />
                ) : (
                  <div className="rounded-xl p-3 space-y-1.5"
                    style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.4)' }}>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#8A6D1F' }}>
                      {isAr
                        ? 'لا توجد أشهر مسجّلة في دفعات هذا العقد، فلا يُحسب المستحق من الأشهر، ويُعتمد على التنبيهات.'
                        : 'No months are recorded in this contract’s payments, so what is owed comes from the alerts.'}
                    </p>
                    {bal > 0 && (
                      <div className="flex justify-between gap-2 text-[11px]">
                        <span style={{ color: '#64748B' }}>{isAr ? 'تأمين محفوظ' : 'Deposit held'}</span>
                        <span className="font-bold" style={{ color: '#2A9D8F' }}>{bal.toLocaleString()} {isAr ? 'د.إ' : 'AED'}</span>
                      </div>
                    )}
                    {settled.owed > 0 && (
                      <div className="flex justify-between gap-2 text-[11px]">
                        <span style={{ color: '#64748B' }}>{isAr ? 'متأخرات التنبيهات' : 'Alert arrears'}</span>
                        <span className="font-bold" style={{ color: '#E63946' }}>{settled.owed.toLocaleString()} {isAr ? 'د.إ' : 'AED'}</span>
                      </div>
                    )}
                  </div>
                )}

                {openAlerts.length > 0 && pos.ok && (
                  <p className="text-[11px] leading-relaxed px-1" style={{ color: '#94A3B8' }}>
                    {isAr
                      ? `${onExit} تُحذف تنبيهات هذه الوحدة (${openAlerts.length})، والمستحق محسوب من الأشهر أعلاه.`
                      : `${onExit}, this unit’s alerts (${openAlerts.length}) are removed; what is owed comes from the months above.`}
                  </p>
                )}

                {openAlerts.length > 0 && !pos.ok && (
                  <div className="rounded-xl p-3 space-y-1"
                    style={dueList.length > 0
                      ? { backgroundColor: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.3)' }
                      : { backgroundColor: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.25)' }}>
                    {dueList.length > 0 && (
                      <>
                        <p className="text-xs font-bold" style={{ color: '#E63946' }}>
                          {isAr ? `تنبيهات حلّ موعدها ولم تُسدَّد (${dueList.length})` : `Due unpaid alerts (${dueList.length})`}
                        </p>
                        {dueList.slice(0, 4).map(a => (
                          <div key={a.id} className="flex justify-between gap-2 text-[11px]">
                            <span style={{ color: '#64748B' }} dir="ltr">{a.alert_date || '—'}</span>
                            <span className="font-medium" style={{ color: '#1B2B4B' }}>
                              {getAlertState(a, exitDay).remaining.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {dueList.length > 4 && (
                          <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                            {isAr ? `و${dueList.length - 4} تنبيهاً آخر` : `and ${dueList.length - 4} more`}
                          </p>
                        )}
                      </>
                    )}
                    <p className="text-[11px] leading-relaxed pt-1" style={{ color: '#64748B' }}>
                      {[
                        dueList.length > 0 && (settled.owed > 0
                          ? (isAr
                            ? `${onExit} تُرفع هذه التنبيهات من قائمة التنبيهات، ويُحفظ مجموعها ${settled.owed.toLocaleString()} د.إ في أرشيف العقد متأخراتٍ على المستأجر.`
                            : `${onExit}, these alerts leave the alerts list, and their total of ${settled.owed.toLocaleString()} AED is kept in the contract archive as arrears owed by the tenant.`)
                          : (isAr ? `${onExit} تُرفع هذه التنبيهات من قائمة التنبيهات.` : `${onExit}, these alerts leave the alerts list.`)),
                        laterCount > 0 && (dueList.length > 0
                          ? (isAr ? `وتُحذف كذلك تنبيهات لم يحلّ موعدها بعد (${laterCount})، ولا تُحتسب على المستأجر.` : `Alerts not yet due (${laterCount}) are also removed and are not charged to the tenant.`)
                          : (isAr ? `${onExit} تُحذف تنبيهات لم يحلّ موعدها بعد (${laterCount})، ولا تُحتسب على المستأجر.` : `${onExit}, alerts not yet due (${laterCount}) are removed and are not charged to the tenant.`)),
                      ].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  {rentLeft > 0 && (
                    <div>
                      <Button onClick={() => { setVacateUnit(null); setDialogOpen(false); navigate(`/refunds?open=1&prop=qarya&unit=${encodeURIComponent(vacateUnit.unit_number)}${ending ? '&kind=expiry' : ''}&exit=${exitDate}&vacate=1${replacing ? '&after=newTenant' : ''}`); }}
                        className="w-full gap-1.5 text-white" style={{ backgroundColor: '#7C3AED', minHeight: 44 }}>
                        <GoIcon size={15} />
                        {isAr ? 'تسوية رصيد الإيجار' : 'Settle the rent balance'}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                          {isAr ? 'موصى به' : 'Recommended'}
                        </span>
                      </Button>
                      <p className="text-[11px] mt-1 px-1 leading-relaxed" style={{ color: '#7C3AED' }}>
                        {isAr
                          ? `الانتقال إلى صفحة تسويات العقود لتسوية ${rentLeft.toLocaleString()} د.إ ردّاً أو خصماً.`
                          : `Opens Contract Settlements to settle ${rentLeft.toLocaleString()} AED as a refund or a deduction.`}
                      </p>
                    </div>
                  )}

                  {!ending && pending && (
                    <div className="rounded-xl p-3 space-y-2"
                      style={{ backgroundColor: 'rgba(230,57,70,0.05)', border: '1px solid rgba(230,57,70,0.3)' }}>
                      <p className="text-[11px] font-bold" style={{ color: '#E63946' }}>
                        {isAr ? 'تفريغ الوحدة مع احتساب المبالغ إيراداً' : 'Vacate and book the amounts as revenue'}
                      </p>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">{isAr ? 'سبب الإخلاء *' : 'Eviction reason *'}</Label>
                        <Input value={vacateReason} onChange={e => setVacateReason(e.target.value)}
                          placeholder={isAr ? 'تخلّف المستأجر عن السداد · إخلال بشروط العقد · تلفيات' : 'Non-payment · breach of contract · damages'}
                          className="text-sm bg-white" style={{ minHeight: 40 }} />
                      </div>

                      {bal > 0 && (
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={keepDeposit}
                            onChange={e => setKeepDeposit(e.target.checked)}
                            className="w-4 h-4 mt-0.5" style={{ accentColor: '#E63946' }} />
                          <span className="text-[11px] leading-relaxed" style={{ color: '#374151' }}>
                            {isAr
                              ? (settled.owed > 0 ? `سداد المتأخرات من التأمين البالغ ${bal.toLocaleString()} د.إ` : `احتساب مبلغ التأمين ${bal.toLocaleString()} د.إ ضمن الإيراد كذلك`)
                              : (settled.owed > 0 ? `Settle the arrears from the ${bal.toLocaleString()} AED deposit` : `Also book the ${bal.toLocaleString()} AED deposit as revenue`)}
                          </span>
                        </label>
                      )}

                      <Button disabled={vacating || !vacateReason.trim()}
                        onClick={() => handleVacate(vacateUnit, false, true)}
                        className="w-full gap-1.5 text-white" style={{ backgroundColor: '#E63946', minHeight: 44 }}>
                        <DoorOpen size={15} />
                        {vacating ? (isAr ? 'جارٍ التنفيذ…' : 'Working…') : (isAr ? 'تفريغ الوحدة وتسجيل السبب' : 'Vacate and record the reason')}
                      </Button>
                      <p className="text-[11px] leading-relaxed px-1" style={{ color: '#B91C1C' }}>
                        {(() => {
                          const parts = [
                            rentLeft > 0 && (isAr ? `سند إخلاء يحتسب ${rentLeft.toLocaleString()} د.إ من الإيجار غير المستهلك إيراداً` : `an eviction voucher booking ${rentLeft.toLocaleString()} AED of unconsumed rent as revenue`),
                            settled.applied > 0 && (isAr ? `دفعة إيجار ${settled.applied.toLocaleString()} د.إ من التأمين عن المتأخرات` : `a ${settled.applied.toLocaleString()} AED rent payment from the deposit for the arrears`),
                            settled.recovery > 0 && (isAr ? `استرداد ${settled.recovery.toLocaleString()} د.إ من التأمين للمالك` : `a ${settled.recovery.toLocaleString()} AED owner recovery from the deposit`),
                          ].filter(Boolean);
                          const recorded = parts.length ? (isAr ? `يُسجَّل ${parts.join('، و')}. ` : `Records ${parts.join(', and ')}. `) : '';
                          const owes = settled.remaining > 0
                            ? (isAr ? `ويُحفظ في أرشيف العقد أن المتبقي على المستأجر ${settled.remaining.toLocaleString()} د.إ. ` : `The contract archive keeps ${settled.remaining.toLocaleString()} AED as still owed by the tenant. `)
                            : '';
                          return recorded + owes + (isAr ? 'ثم تُفرَّغ الوحدة، ولا يُصرف للمستأجر أي مبلغ.' : 'Then the unit is vacated and nothing is paid to the tenant.');
                        })()}
                      </p>
                    </div>
                  )}

                  {bal > 0 && owed > 0 && (
                    <div>
                      <Button disabled={vacating}
                        onClick={() => handleVacate(vacateUnit, false, false, true)}
                        className="w-full gap-1.5 text-white" style={{ backgroundColor: '#2A9D8F', minHeight: 44 }}>
                        {ending ? <CalendarX size={15} /> : <DoorOpen size={15} />}
                        {vacating
                          ? (isAr ? 'جارٍ التنفيذ…' : 'Working…')
                          : ending
                            ? (isAr ? 'خصم المستحق من التأمين وإنهاء العقد' : 'Take what is owed from the deposit and end the contract')
                            : (isAr ? 'خصم المستحق من التأمين وتفريغ الوحدة' : 'Take what is owed from the deposit and vacate')}
                      </Button>
                      <p className="text-[11px] mt-1 px-1 leading-relaxed" style={{ color: '#1F7A6F' }}>
                        {isAr
                          ? `يُسجَّل ${fromDeposit.applied.toLocaleString()} د.إ من التأمين دفعةَ إيجار عن المستحق${fromDeposit.recovery > 0 ? `، ويُردّ الباقي ${fromDeposit.recovery.toLocaleString()} د.إ إلى المستأجر` : ''}${fromDeposit.remaining > 0 ? `، ويُحفظ في أرشيف العقد أن المتبقي عليه ${fromDeposit.remaining.toLocaleString()} د.إ` : ''}، ثم ${finish}.`
                          : `Records ${fromDeposit.applied.toLocaleString()} AED from the deposit as a rent payment for what is owed${fromDeposit.recovery > 0 ? `, returns the remaining ${fromDeposit.recovery.toLocaleString()} AED to the tenant` : ''}${fromDeposit.remaining > 0 ? `, and keeps ${fromDeposit.remaining.toLocaleString()} AED in the contract archive as still owed` : ''}, then ${finish}.`}
                      </p>
                    </div>
                  )}

                  {bal > 0 && owed <= 0 && (
                    <div>
                      <Button variant="outline" disabled={vacating}
                        onClick={() => handleVacate(vacateUnit, true)}
                        className="w-full gap-1.5"
                        style={{ borderColor: 'rgba(14,165,233,0.5)', color: '#0EA5E9', minHeight: 44 }}>
                        <DoorOpen size={15} />
                        {vacating ? (isAr ? 'جارٍ التنفيذ…' : 'Working…') : (ending ? (isAr ? 'إرجاع التأمين وإنهاء العقد' : 'Refund the deposit and end the contract') : (isAr ? 'إرجاع التأمين وتفريغ الوحدة' : 'Refund the deposit and vacate'))}
                      </Button>
                      <p className="text-[11px] mt-1 px-1 leading-relaxed" style={{ color: '#0369A1' }}>
                        {isAr
                          ? `يُسجَّل ردّ مبلغ ${bal.toLocaleString()} د.إ إلى المستأجر، ثم ${finish}.${rentLeft > 0 ? ' ولا يشمل هذا الإجراء رصيد الإيجار.' : ''}`
                          : `Records a ${bal.toLocaleString()} AED refund to the tenant, then ${finish}.${rentLeft > 0 ? ' The rent balance is not included.' : ''}`}
                      </p>
                    </div>
                  )}

                  {(ending || !pending) && (
                    <div>
                      <Button variant="outline" disabled={vacating}
                        onClick={() => handleVacate(vacateUnit)}
                        className="w-full gap-1.5"
                        style={ending
                          ? { borderColor: 'rgba(14,165,233,0.5)', color: '#0369A1', minHeight: 44 }
                          : { borderColor: 'rgba(201,168,76,0.5)', color: '#C9A84C', minHeight: 44 }}>
                        {ending ? <CalendarX size={15} /> : <DoorOpen size={15} />}
                        {vacating
                          ? (isAr ? 'جارٍ التنفيذ…' : 'Working…')
                          : ending
                            ? (bal > 0 ? (isAr ? 'إنهاء العقد دون تسوية التأمين' : 'End the contract without settling the deposit') : (isAr ? 'إنهاء العقد' : 'End the contract'))
                            : (isAr ? 'تفريغ الوحدة' : 'Vacate the unit')}
                      </Button>
                      <p className="text-[11px] mt-1 px-1 leading-relaxed" style={{ color: '#94A3B8' }}>
                        {isAr
                          ? `${ending ? 'يُحفظ العقد في الأرشيف بسبب «انتهاء العقد»' : 'يُحفظ العقد في الأرشيف'}، وتُمسح بيانات المستأجر والعقد والتنبيهات، وتبقى الدفعات والسندات مرتبطة برقم الوحدة.${bal > 0 ? ` ويبقى التأمين ${bal.toLocaleString()} د.إ محفوظاً في صفحة التأمينات حتى تسويته.` : ''}${owed > 0 ? ` ويُحفظ في أرشيف العقد أن على المستأجر ${owed.toLocaleString()} د.إ لم يسدّدها.` : ''}${rentLeft > 0 ? ` ويُحفظ فيه كذلك أن للمستأجر ${rentLeft.toLocaleString()} د.إ غير مستهلكة لم تُسوَّ.` : ''}`
                          : `${ending ? 'The contract is archived as «Contract ended»' : 'The contract is archived'}; tenant, contract and alerts are cleared, and payments and vouchers stay linked to the unit number.${bal > 0 ? ` The ${bal.toLocaleString()} AED deposit stays held on the Deposits page until it is settled.` : ''}${owed > 0 ? ` The archive keeps ${owed.toLocaleString()} AED as unpaid by the tenant.` : ''}${rentLeft > 0 ? ` It also notes the tenant’s ${rentLeft.toLocaleString()} AED unconsumed balance as unsettled.` : ''}`}
                      </p>
                    </div>
                  )}

                  <Button variant="outline" onClick={closeExit} className="w-full" style={{ minHeight: 44 }}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Unit Dialog */}
      <Dialog open={!!viewUnit} onOpenChange={() => setViewUnit(null)}>
        <DialogContent className="max-w-md font-cairo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isAr ? 'تفاصيل الوحدة' : 'Unit Details'} — {viewUnit?.unit_number}
            </DialogTitle>
          </DialogHeader>
          {viewUnit && (() => {
            const sc = statusConfig[viewUnit.status] || statusConfig.vacant;
            const expTag = getExpiryTag(viewUnit.contract_end);
            const endLabel = isAr ? 'نهاية العقد' : 'Contract End';
            return (
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{t('status')}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
                {[
                  { label: isAr ? 'اسم المستأجر' : 'Tenant Name', value: viewUnit.tenant_name },
                  { label: isAr ? 'الجنسية' : 'Nationality', value: viewUnit.nationality },
                  { label: isAr ? 'الإيجار السنوي' : 'Annual Rent', value: viewUnit.annual_rent ? `${Number(viewUnit.annual_rent).toLocaleString()} AED` : null },
                  { label: isAr ? 'خطة الدفع' : 'Payment Plan', value: viewUnit.payment_plan },
                  { label: isAr ? 'الطابق' : 'Floor', value: viewUnit.floor },
                  { label: isAr ? 'رقم المالك' : 'Owner Phone', value: formatPhone(viewUnit.owner_phone) },
                  { label: isAr ? 'بداية العقد' : 'Contract Start', value: viewUnit.contract_start },
                  { label: endLabel, value: viewUnit.contract_end },
                  { label: isAr ? 'التأمين' : 'Deposit', value: viewUnit.insurance ? `${viewUnit.insurance} (${viewUnit.insurance_type === 'cheque' ? (isAr ? 'شيك' : 'Cheque') : (isAr ? 'نقداً' : 'Cash')})` : null },
                  { label: isAr ? 'ملاحظات' : 'Notes', value: viewUnit.notes },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm">{row.label}</span>
                    <span className="font-medium text-sm" style={{ color: '#1B2B4B' }}>
                      {row.value}
                      {row.label === endLabel && expTag && (
                        <span className="ms-2 text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: expTag.bg, color: expTag.color }}>{expTag.label}</span>
                      )}
                    </span>
                  </div>
                ))}
                {viewUnit.contract_image_url && (
                  <a href={viewUnit.contract_image_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors" style={{ color: '#1B2B4B' }}>
                    <FileImage size={14} /> {isAr ? 'عرض صورة العقد' : 'View contract image'}
                  </a>
                )}
                <div className="flex gap-2 pt-1 flex-wrap">
                  {canAlert && (
                    <Button className="flex-1 gap-1" onClick={() => { setViewUnit(null); openAlert(viewUnit); }} style={{ backgroundColor: '#C9A84C' }}>
                      <BellRing size={14} /> {isAr ? 'تنبيه' : 'Alert'}
                    </Button>
                  )}
                  <Button className="flex-1" variant="outline" onClick={() => { setViewUnit(null); goToUnit(viewUnit); }}>
                    <Building2 size={14} /> {isAr ? 'صفحة الوحدة' : 'Unit page'}
                  </Button>
                  {canEdit && (
                    <Button className="flex-1" onClick={() => { setViewUnit(null); openEdit(viewUnit); }} style={{ backgroundColor: '#1B2B4B' }}>
                      <Edit2 size={14} /> {t('edit')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className=" max-h-[90vh] overflow-y-auto font-cairo">
          <DialogHeader>
            <DialogTitle>
              {!editUnit ? t('addNewUnit')
                : editMode === 'renew' ? (isAr ? `تجديد عقد الوحدة ${editUnit.unit_number}` : `Renew unit ${editUnit.unit_number}`)
                : editMode === 'new_tenant' ? (isAr ? `مستأجر جديد للوحدة ${editUnit.unit_number}` : `New tenant for unit ${editUnit.unit_number}`)
                : t('editUnit')}
            </DialogTitle>
          </DialogHeader>
          {editUnit && editMode !== 'correct' && (
            <p className="text-xs leading-relaxed rounded-xl px-3 py-2.5"
              style={{ backgroundColor: 'rgba(42,157,143,0.07)', border: '1px solid rgba(42,157,143,0.25)', color: '#1F7A70' }}>
              {editMode === 'renew'
                ? (isAr ? 'أدخل تاريخي العقد الجديد وقيمته وصورته. يُحفظ العقد الحالي في أرشيف الوحدة تلقائياً عند الحفظ.' : 'Enter the new contract dates, rent and image. The current contract is archived automatically on save.')
                : (isAr ? 'فُرّغت الوحدة وحُفظ عقدها السابق في الأرشيف. أدخل بيانات المستأجر الجديد.' : 'The unit was vacated and its previous contract archived. Enter the new tenant.')}
            </p>
          )}

          {!editUnit && vacantUnits.length > 0 && (
            <div className="rounded-xl p-3 space-y-2 mt-1"
              style={{ backgroundColor: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.35)' }}>
              <p className="text-[11px] font-bold" style={{ color: '#8A6D1F' }}>
                {isAr ? 'وحدات شاغرة جاهزة لمستأجر جديد' : 'Vacant units ready for a new tenant'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vacantUnits.map(u => (
                  <button key={u.id} type="button" onClick={() => openEdit(u)}
                    className="px-3 rounded-lg text-xs font-bold border transition-colors"
                    style={{ minHeight: 34, backgroundColor: '#fff', borderColor: 'rgba(201,168,76,0.5)', color: '#8A6D1F' }}>
                    {u.unit_number}{u.floor ? ` · ${u.floor}` : ''}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#94A3B8' }}>
                {isAr
                  ? 'اضغط رقم وحدة شاغرة لتعبئة بياناتها بدل إنشاء وحدة جديدة — يحافظ على سجلّها المالي. أو اكتب رقماً جديداً بالأسفل.'
                  : 'Tap a vacant unit to fill it instead of creating a new one — keeps its financial history. Or type a new number below.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {[
              { label: `${t('unitNumber')} *`, key: 'unit_number', type: 'text' },
              { label: t('tenantName'), key: 'tenant_name', type: 'text' },
              { label: t('nationality'), key: 'nationality', type: 'text' },
              { label: `${t('annualRent')} (AED)`, key: 'annual_rent', type: 'number' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                {f.type === 'tel' ? (
                  <PhoneInput value={form[f.key] || ''} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                ) : (
                  <Input type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="text-sm" />
                )}
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-sm" style={{ color: '#1B2B4B', fontWeight: 600 }}>
                {lang === 'en' ? 'Deposit (AED)' : 'التأمين (AED)'}
              </Label>
              <Input type="text" value={form.insurance || ''}
                onChange={e => setForm(p => ({ ...p, insurance: e.target.value }))}
                placeholder={lang === 'en' ? 'e.g. 5000' : 'مثال: 5000'}
                className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm" style={{ color: '#1B2B4B', fontWeight: 600 }}>
                {lang === 'en' ? 'Deposit Type' : 'نوع التأمين'}
              </Label>
              <Select value={form.insurance_type || 'cash'}
                onValueChange={v => setForm(p => ({ ...p, insurance_type: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{lang === 'en' ? 'Cash' : 'نقداً'}</SelectItem>
                  <SelectItem value="cheque">{lang === 'en' ? 'Cheque' : 'شيك'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                {form.insurance_type === 'cheque'
                  ? (lang === 'en' ? 'Tracked separately from cash' : 'يُحتسب منفصلاً عن النقدي')
                  : (lang === 'en' ? 'Counted with cash deposits' : 'يُحتسب ضمن التأمينات النقدية')}
              </p>
            </div>

            {[
              { label: t('ownerPhone'), key: 'owner_phone', type: 'tel' },
              { label: t('contractStart'), key: 'contract_start', type: 'date' },
              { label: t('contractEndDate'), key: 'contract_end', type: 'date' },
              { label: t('paymentPlan'), key: 'payment_plan', type: 'text' },
              { label: t('floor'), key: 'floor', type: 'text' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                {f.type === 'tel' ? (
                  <PhoneInput value={form[f.key] || ''} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                ) : (
                  <Input type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="text-sm" />
                )}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupied">{t('occupied')}</SelectItem>
                  <SelectItem value="vacant">{t('vacant')}</SelectItem>
                  <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">{t('notes')}</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">{t('contractImage')}</Label>
              <div className="flex items-center gap-3">
                <input ref={contractFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleContractUpload(e.target.files[0])} />
                <Button type="button" variant="outline" size="sm" onClick={() => contractFileRef.current?.click()} disabled={uploadingContract} className="gap-2">
                  {uploadingContract ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingContract ? t('uploading') : t('uploadContract')}
                </Button>
                {form.contract_image_url && (
                  <div className="flex items-center gap-2">
                    <a href={form.contract_image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#1B2B4B' }}>
                      <FileImage size={14} />{t('viewContract')}
                    </a>
                    <button type="button" onClick={() => setForm(p => ({ ...p, contract_image_url: '' }))} className="text-destructive hover:opacity-70"><X size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {dupUnit && (
            <p className="text-xs font-bold leading-relaxed" style={{ color: '#B8860B' }}>
              {isAr
                ? `الوحدة ${form.unit_number} مسجَّلة مسبقاً. اضغط الزر لتختار تجديد عقدها أو تبديل مستأجرها.`
                : `Unit ${form.unit_number} already exists. Use the button to renew its contract or replace its tenant.`}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {editUnit && isAdmin && editMode === 'correct' ? (
              <div className="flex gap-2">
                {(editUnit.status !== 'vacant' || editUnit.tenant_name || editUnit.contract_end || editUnit.insurance) && (
                  <Button variant="outline" onClick={() => setVacateUnit(editUnit)}
                    className="gap-1.5" style={{ borderColor: 'rgba(201,168,76,0.5)', color: '#C9A84C' }}>
                    <DoorOpen size={14} />{isAr ? 'اجعل الوحدة فارغة' : 'Mark vacant'}
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleDelete(editUnit)}
                  className="gap-1.5" style={{ borderColor: 'rgba(230,57,70,0.35)', color: '#E63946' }}>
                  <Trash2 size={14} />{t('delete')}
                </Button>
              </div>
            ) : <span />}
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.unit_number} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? t('saving_') : dupUnit ? (isAr ? 'تجديد أو تبديل' : 'Renew or replace') : t('save')}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Alert Dialog */}
      <Dialog open={!!alertDialog} onOpenChange={(v) => { if (!v) setAlertDialog(null); }}>
        <DialogContent className="max-w-md font-cairo" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing size={18} style={{ color: '#C9A84C' }} />
              {isAr ? 'إضافة تنبيه' : 'Add Alert'} — {alertDialog?.unit_number}
            </DialogTitle>
          </DialogHeader>
          {alertDialog && (
            <div className="space-y-3 py-1">
              <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                <p className="font-bold" style={{ color: '#1B2B4B' }}>{alertDialog.tenant_name || (isAr ? 'بدون مستأجر' : 'No tenant')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr ? 'النوع' : 'Type'}: {alertDialog._type === 're' ? (isAr ? 'العقارات' : 'Real Estate') : (isAr ? 'القرية' : 'Qarya')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{isAr ? 'خطة الدفع *' : 'Payment Plan *'}</Label>
                  <Select value={alertForm.payment_plan} onValueChange={v => setAlertForm(p => ({ ...p, payment_plan: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_PLANS.map(p => <SelectItem key={p.value} value={p.value}>{isAr ? p.label.ar : p.label.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{isAr ? 'تاريخ أول دفعة *' : 'First Due *'}</Label>
                  <Input type="date" value={alertForm.alert_date} onChange={e => setAlertForm(p => ({ ...p, alert_date: e.target.value }))} className="text-sm" />
                </div>
              </div>

              {alertPreviewDate && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <span style={{ color: '#1B2B4B' }}>{isAr ? 'الدفعة التالية' : 'Next payment'}: </span>
                  <span className="font-bold" style={{ color: '#C9A84C' }}>{alertPreviewDate}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'المبلغ الشهري *' : 'Monthly Amount *'}</Label>
                <Input type="number" value={alertForm.original_amount}
                  onChange={e => setAlertForm(p => ({ ...p, original_amount: e.target.value }))}
                  placeholder="0.00" className="text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: '#E63946' }}>{isAr ? 'مبلغ متأخر (اختياري)' : 'Overdue (optional)'}</Label>
                <Input type="number" value={alertForm.accumulated_amount}
                  onChange={e => setAlertForm(p => ({ ...p, accumulated_amount: e.target.value }))}
                  placeholder="0.00" className="text-sm"
                  style={{ borderColor: Number(alertForm.accumulated_amount) > 0 ? '#E63946' : undefined }} />
              </div>

              {(Number(alertForm.original_amount) > 0 || Number(alertForm.accumulated_amount) > 0) && (
                <div className="rounded-xl p-3 flex justify-between items-center text-sm" style={{ backgroundColor: 'rgba(27,43,75,0.04)' }}>
                  <span className="font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الإجمالي المستحق' : 'Total Due'}</span>
                  <span className="font-bold" style={{ color: '#1B2B4B' }}>
                    {((Number(alertForm.original_amount) || 0) + (Number(alertForm.accumulated_amount) || 0)).toLocaleString()} AED
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'ملاحظات' : 'Notes'}</Label>
                <Input value={alertForm.description} onChange={e => setAlertForm(p => ({ ...p, description: e.target.value }))} className="text-sm" />
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handleSaveAlert} disabled={alertSaving || !alertForm.alert_date}
                  className="flex-1" style={{ backgroundColor: '#1B2B4B' }}>
                  {alertSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التنبيه' : 'Save Alert')}
                </Button>
                <Button variant="outline" onClick={() => setAlertDialog(null)} className="flex-1">{isAr ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}