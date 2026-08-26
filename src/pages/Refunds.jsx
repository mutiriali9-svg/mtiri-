import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44, supabase, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import {
  RotateCcw, Plus, Trash2, Search, X, Upload, FileImage,
  Building2, Home, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileDrawerSelect from '@/components/MobileDrawerSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  REFUND_KINDS, VISIBLE_REFUND_KINDS, SETTLEMENT_MODES, autoReasonKind, reasonFieldLabel,
  PAY_METHODS, kindLabel, kindColor, needsSettlement, methodLabel, propLabel,
  settle, settlementColumns, emptySettlement, depositBalance, unconsumed, cleanItems, itemsTotal,
  dueMonthsLabel, defaultAppliesTo, crossesYear, fmtNum,
} from '@/utils/settlementCalc';

const emptyForm = {
  property_type: 'qarya', kind: 'tenant_refund', unit_number: '', tenant_name: '',
  payment_id: '', amount: '', refund_date: '', applies_to_date: '',
  method: 'cash', reason: '', notes: '',
};

export default function Refunds() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = (ar, en) => (lang === 'en' ? en : ar);
  const navigate = useNavigate();
  const isAr = lang !== 'en';
  const isAdmin = user?.role === 'admin' || user?.role === 'tester';
  const currency = t('د.إ', 'AED');
  const today = new Date().toISOString().split('T')[0];

  const [refunds, setRefunds] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [handoff, setHandoff] = useState(null);
  const [units, setUnits] = useState([]);
  const [reUnits, setReUnits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rePayments, setRePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [search, setSearch] = useState('');
  const [prop, setProp] = useState('qarya');
  const [filterKind, setFilterKind] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [input, setInput] = useState(emptySettlement);
  const [smode, setSmode] = useState('full');
  const [vacate, setVacate] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, dp, dd, u, ru, p, rp] = await Promise.all([
        base44.entities.Refund.list('-refund_date'),
        base44.entities.Deposit.list(),
        base44.entities.DepositDeduction.list(),
        base44.entities.Unit.list(),
        base44.entities.ReUnit.list(),
        base44.entities.Payment.list('-payment_date'),
        base44.entities.RePayment.list('-payment_date'),
      ]);
      setRefunds(r); setDeposits(dp); setDeductions(dd);
      setUnits(u); setReUnits(ru); setPayments(p); setRePayments(rp);
      setPageError('');
    } catch (e) {
      setPageError(t('فشل تحميل البيانات: ', 'Failed to load data: ') + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || loading) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('open') !== '1') { deepLinked.current = true; return; }
    if (units.length === 0 && reUnits.length === 0) return;
    deepLinked.current = true;

    const unitKey = q.get('unit');
    const type = q.get('prop') || 'qarya';
    window.history.replaceState({}, '', window.location.pathname);

    setProp(type);
    setSmode('full'); setVacate(false); setReceiptUrl(''); setInlineError('');

    const u = [
      ...units.map(x => ({ ...x, _type: 'qarya' })),
      ...reUnits.map(x => ({ ...x, _type: 'real_estate' })),
    ].find(x => x._type === type && x.unit_number === unitKey) || null;

    setForm({
      ...emptyForm,
      property_type: type,
      unit_number: unitKey || '',
      tenant_name: u?.tenant_name || '',
      refund_date: today,
    });

    if (u) {
      const list = (type === 'real_estate' ? rePayments : payments)
        .filter(p => p.unit_number === unitKey && (!p.status || p.status === 'paid'))
        .filter(p => {
          const d = p.payment_date || '';
          return (!u.contract_start || d >= u.contract_start) && (!u.contract_end || d <= u.contract_end);
        });
      const paidTotal = list.reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(u.annual_rent) || 0;
      setInput({
        ...emptySettlement,
        paidTotal: paidTotal || '',
        periodStart: u.contract_start || '',
        periodEnd: u.contract_end || '',
        exitDate: today,
      });
    } else {
      setInput(emptySettlement);
    }
    setDialogOpen(true);
  }, [loading, units.length, reUnits.length]);

  const allUnits = [
    ...units.map(u => ({ ...u, _type: 'qarya' })),
    ...reUnits.map(u => ({ ...u, _type: 'real_estate' })),
  ];

  const paymentsFor = (type) => (type === 'real_estate' ? rePayments : payments);

  const visible = refunds.filter(r => {
    if (r.property_type !== prop) return false;
    if (filterKind !== 'all' && r.kind !== filterKind) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.unit_number?.toLowerCase().includes(q)
      || r.tenant_name?.toLowerCase().includes(q)
      || r.reason?.toLowerCase().includes(q)
      || r.receipt_number?.toLowerCase().includes(q);
  });

  const byKind = REFUND_KINDS
    .map(k => {
      const rows = visible.filter(r => r.kind === k.value);
      return {
        ...k,
        total: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
        kept: rows.reduce((s, r) => s + (Number(r.penalty_amount) || 0) + (Number(r.other_deductions) || 0), 0),
        count: rows.length,
      };
    })
    .filter(k => k.count > 0);

  const selectedUnit = allUnits.find(u => u._type === form.property_type && u.unit_number === form.unit_number) || null;
  const usesSettlement = needsSettlement(form.kind);
  const plain = smode === 'simple';
  const waived = smode === 'waiver';
  const baseSettlement = settle({ ...input, penalty: 0, penaltyReason: '', items: [] }, isAr);
  const waiverAmount = baseSettlement.ok ? baseSettlement.remainingAmount : 0;
  const effInput = plain
    ? { ...input, penalty: 0, penaltyReason: '', items: [] }
    : waived
      ? { ...input, penalty: waiverAmount, penaltyReason: (input.penaltyReason || '').trim(), items: [] }
      : input;
  const settlement = settle(effInput, isAr);
  const amount = usesSettlement ? settlement.netRefund : itemsTotal(input.items);
  const toCompany = Math.max(0, (Number(input.paidTotal) || 0) - amount);
  const deductedNow = settlement.penalty + settlement.itemsTotal;


  const asOf = usesSettlement && effInput.exitDate ? effInput.exitDate : (form.refund_date || today);
  const unconsumedInfo = unconsumed(
    selectedUnit, paymentsFor(form.property_type), form.unit_number, asOf, isAr,
  );
  const unitPayments = unconsumedInfo.payments;
  const linkedPayment = unitPayments.find(p => p.id === form.payment_id) || null;
  const appliesTo = form.applies_to_date
    || defaultAppliesTo(linkedPayment?.payment_date, input.periodStart, form.refund_date || today);
  const yearShift = crossesYear(appliesTo, form.refund_date || today);

  const addItem = () => setInput(p => ({ ...p, items: [...p.items, { reason: '', amount: '' }] }));
  const setItem = (i, patch) => setInput(p => ({ ...p, items: p.items.map((it, ix) => (ix === i ? { ...it, ...patch } : it)) }));
  const removeItem = (i) => setInput(p => ({ ...p, items: p.items.filter((_, ix) => ix !== i) }));

  const openAdd = () => {
    setForm({ ...emptyForm, property_type: prop, refund_date: today });
    setInput(emptySettlement);
    setSmode('full'); setVacate(false); setReceiptUrl(''); setInlineError('');
    setDialogOpen(true);
  };

  const setKind = (kind) => {
    setForm(f => ({ ...f, kind, amount: '', reason: '', payment_id: '', applies_to_date: '' }));
    setInput(emptySettlement);
    setSmode('full'); setVacate(false); setInlineError('');
  };

  const pickUnit = (key) => {
    const [type, ...rest] = key.split('::');
    const unitNumber = rest.join('::');
    const u = allUnits.find(x => x._type === type && x.unit_number === unitNumber) || null;
    setForm(f => ({
      ...f,
      property_type: type,
      unit_number: unitNumber,
      tenant_name: u?.tenant_name || '',
      payment_id: '',
      applies_to_date: '',
      amount: '',
    }));
    if (needsSettlement(form.kind)) {
      const list = (type === 'real_estate' ? rePayments : payments)
        .filter(p => p.unit_number === unitNumber && (!p.status || p.status === 'paid'))
        .filter(p => {
          const d = p.payment_date || '';
          return (!u?.contract_start || d >= u.contract_start) && (!u?.contract_end || d <= u.contract_end);
        });
      const paidTotal = list.reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(u?.annual_rent) || 0;
      setInput({
        ...emptySettlement,
        paidTotal: paidTotal || '',
        periodStart: u?.contract_start || '',
        periodEnd: u?.contract_end || '',
        exitDate: today,
      });
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      setReceiptUrl(file_url);
    } catch {
      setInlineError(t('تعذّر رفع الملف', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.refund_date) { setInlineError(t('يُرجى تحديد تاريخ العملية', 'Set the date')); return; }
    if (usesSettlement && !settlement.ok) { setInlineError(settlement.error); return; }
    const items = cleanItems(effInput.items);
    if (!autoReasonKind(form.kind) && !form.reason?.trim()) {
      setInlineError(t('يُرجى كتابة السبب أو اسم الحركة', 'Enter the reason or record name')); return;
    }
    if (amount <= 0 && settlement.itemsTotal <= 0 && settlement.penalty <= 0) {
      setInlineError(t('لا توجد مبالغ في هذه العملية', 'This record has no amounts')); return;
    }
    const finalReason = autoReasonKind(form.kind)
      ? `خروج مبكر بتاريخ ${input.exitDate || form.refund_date}`
      : form.reason.trim();

    setInlineError(''); setSaving(true);
    try {
      const payload = {
        property_type: form.property_type,
        kind: form.kind,
        unit_number: form.unit_number || null,
        tenant_name: form.tenant_name || null,
        payment_id: form.payment_id || null,
        amount,
        refund_date: form.refund_date,
        applies_to_date: appliesTo,
        method: form.method || 'cash',
        reason: finalReason,
        notes: form.notes || null,
        is_manual: false,
        receipt_image_url: receiptUrl || null,
        ...(usesSettlement
          ? settlementColumns(effInput, settlement)
          : { other_deductions: amount, deduction_items: items }),
      };
      const { data: created, error: rpcError } = await supabase.rpc('create_refund', {
        p_refund: payload,
        p_vacate: usesSettlement && vacate,
      });
      if (rpcError) throw rpcError;

      await logActivity(
        'Refund', 'create',
        `${kindLabel(form.kind, isAr)} — ${form.unit_number || ''} (${propLabel(form.property_type, isAr)})`,
        null, payload,
        `استرجاع/خصم ${amount.toLocaleString()} AED — ${form.unit_number || ''}`,
        user,
      );
      base44.entities.Notification.create({
        type: 'refund',
        title: `${kindLabel(form.kind, true)} — ${form.unit_number || ''} · ${propLabel(form.property_type, true)}`,
        amount,
        reference_id: created?.id || '',
        reference_data: { ...payload, receipt_number: created?.receipt_number || null },
        is_read: false,
      }).catch(() => {});
      window.dispatchEvent(new Event('notifications-updated'));

      const savedUnit = form.unit_number;
      const savedProp = form.property_type;
      const held = deposits
        .filter(d => d.property_type === savedProp && d.unit_number === savedUnit && d.method !== 'cheque')
        .reduce((a, d) => a + (Number(d.amount) || 0), 0);
      const usedUp = deductions
        .filter(d => d.property_type === savedProp && d.unit_number === savedUnit)
        .reduce((a, d) => a + (Number(d.amount) || 0), 0);
      const depLeft = Math.max(0, Math.round((held - usedUp) * 100) / 100);

      setDialogOpen(false); setForm(emptyForm); setInput(emptySettlement);
      setSmode('full'); setVacate(false); setReceiptUrl('');
      if (depLeft > 0) setHandoff({ unit: savedUnit, prop: savedProp, amount: depLeft });
      await load();
      return created;
    } catch (e) {
      setInlineError(e?.message || t('تعذّر الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (r) => setConfirm({
    message: t(
      `حذف الحركة ${r.receipt_number || ''}؟ سيعود الإيراد إلى قيمته قبل الخصم.`,
      `Delete record ${r.receipt_number || ''}? Revenue returns to its pre-deduction value.`,
    ),
    onConfirm: async () => {
      try {
        await base44.entities.Refund.delete(r.id);
        await logActivity('Refund', 'delete', `${r.unit_number || ''} — ${r.receipt_number || ''}`, r, null,
          `حذف استرجاع ${(r.amount || 0).toLocaleString()} AED`, user);
        setViewItem(null);
        await load();
      } catch (e) {
        setPageError(e?.message || t('تعذّر الحذف', 'Delete failed'));
      } finally {
        setConfirm(null);
      }
    },
  });

  const PropIcon = ({ type, size = 16, color }) =>
    type === 'real_estate' ? <Home size={size} style={{ color }} /> : <Building2 size={size} style={{ color }} />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7C3AED' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#1B2B4B' }}>
            {t('الاسترجاعات والخصومات', 'Refunds & Deductions')}
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#64748B' }}>
            {t('مبالغ تُطرح من الإيراد أو تُحتسب ضمنه — وليست مصاريف تشغيل', 'Deducted from or booked into revenue — not operating expenses')}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="text-white shrink-0" style={{ backgroundColor: '#7C3AED', minHeight: 44 }}>
            <Plus size={15} className="ml-1" />
            {t('إضافة', 'Add')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-white border shadow-sm w-full max-w-xs"
        style={{ borderColor: '#E2E8F0' }}>
        {[
          { v: 'qarya', label: t('القرية', 'Qarya'), Icon: Building2 },
          { v: 'real_estate', label: t('العقار', 'Real Estate'), Icon: Home },
        ].map(x => {
          const on = prop === x.v;
          return (
            <button key={x.v} onClick={() => setProp(x.v)}
              className="flex-1 flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-lg text-sm font-bold transition-all duration-200"
              style={on
                ? { backgroundColor: '#1B2B4B', color: '#C9A84C' }
                : { backgroundColor: 'transparent', color: '#64748B' }}>
              <x.Icon size={16} style={{ flexShrink: 0 }} />
              <span>{x.label}</span>
            </button>
          );
        })}
      </div>

      {pageError && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)' }}>
          <AlertTriangle size={14} style={{ color: '#E63946', marginTop: 2 }} />
          <p className="text-xs font-medium" style={{ color: '#E63946' }}>{pageError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {byKind.slice(0, 4).map(k => (
          <div key={k.value} className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E2E8F0' }}>
            <p className="text-xs mb-1 truncate" style={{ color: '#64748B' }}>{k.label[isAr ? 'ar' : 'en']}</p>
            <p className="text-lg font-bold" style={{ color: k.color }}>
              − {fmtNum(k.total)} <span className="text-xs font-normal">{currency}</span>
            </p>
            {k.kept > 0 && (
              <p className="text-[10px] mt-0.5 font-bold" style={{ color: '#2A9D8F' }}>
                + {fmtNum(k.kept)} {t('محتسب إيراداً', 'kept as revenue')}
              </p>
            )}
            <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
              {k.count} {t('حركة', 'records')} · {t('مطروح من الإيراد', 'deducted from revenue')}
            </p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: '#94A3B8', right: isAr ? 12 : 'auto', left: isAr ? 'auto' : 12 }} />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('ابحث بالوحدة أو المستأجر أو السبب أو رقم السند', 'Search unit, tenant, reason or voucher')}
          className="w-full" style={{ minHeight: 44, paddingRight: isAr ? 36 : 12, paddingLeft: isAr ? 12 : 36 }} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ value: 'all', label: t('كل الأنواع', 'All kinds'), color: '#1B2B4B' },
          ...REFUND_KINDS.filter(k => !k.hidden || refunds.some(r => r.kind === k.value))
            .map(k => ({ value: k.value, label: k.label[isAr ? 'ar' : 'en'], color: k.color }))].map(k => {
          const on = filterKind === k.value;
          return (
            <button key={k.value} onClick={() => setFilterKind(k.value)}
              className="px-2.5 rounded-lg text-[11px] font-bold border transition-colors"
              style={{
                minHeight: 32,
                backgroundColor: on ? k.color : `${k.color}0D`,
                borderColor: on ? k.color : 'transparent',
                color: on ? '#fff' : k.color,
              }}>
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC' }}>
                {[t('النوع', 'Kind'), t('العقار', 'Property'), t('المبلغ', 'Amount'),
                  t('التاريخ', 'Date'), t('الوحدة', 'Unit'), t('السند', 'Voucher'), ''].map((h, i) => (
                  <th key={i} className="py-2.5 px-3 text-xs font-semibold" style={{ color: '#64748B', textAlign: 'start' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const kc = kindColor(r.kind);
                return (
                  <tr key={r.id} className="border-t cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ borderColor: '#F1F5F9' }} onClick={() => setViewItem(r)}>
                    <td className="py-2.5 px-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: `${kc}18`, color: kc }}>
                        {kindLabel(r.kind, isAr)}
                      </span>
                      {r.reason && <p className="text-[11px] mt-1 truncate max-w-[150px]" style={{ color: '#94A3B8' }}>{r.reason}</p>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: 'rgba(27,43,75,0.07)', color: '#1B2B4B' }}>
                        <PropIcon type={r.property_type} size={11} color="#C9A84C" />
                        {propLabel(r.property_type, isAr)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-xs" style={{ color: '#7C3AED' }}>− {fmtNum(r.amount || 0)}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: '#64748B', textAlign: 'start' }}><span dir="ltr">{r.refund_date}</span></td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: '#1B2B4B' }}>
                      {r.unit_number || '-'}
                      {r.tenant_name && <p className="text-[11px] truncate max-w-[110px]" style={{ color: '#94A3B8' }}>{r.tenant_name}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono" style={{ color: '#94A3B8', textAlign: 'start' }}><span dir="ltr">{r.receipt_number || '-'}</span></td>
                    <td className="py-2.5 px-3">
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); askDelete(r); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition" style={{ color: '#94A3B8' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
                <RotateCcw size={22} style={{ color: '#7C3AED' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#1B2B4B' }}>
                {t('لا توجد استرجاعات أو خصومات', 'No refunds or deductions')}
              </p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                {t('تُسجَّل هنا المبالغ المُعادة للمستأجرين والمبالغ المخصومة من الإيراد',
                  'Record amounts refunded to tenants or deducted from revenue')}
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!viewItem} onOpenChange={o => !o && setViewItem(null)}>
        <DialogContent className="max-w-md w-full" dir={isAr ? 'rtl' : 'ltr'}
          style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader className="flex-shrink-0 pb-2 border-b">
            <DialogTitle className="text-base">{t('تفاصيل الحركة', 'Record Details')}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="overflow-y-auto flex-1 py-3 space-y-3">
              <div className="rounded-xl p-4 text-center"
                style={{ backgroundColor: `${kindColor(viewItem.kind)}0D`, border: `1px solid ${kindColor(viewItem.kind)}33` }}>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{t('المبلغ المخصوم من الإيراد', 'Deducted from revenue')}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: kindColor(viewItem.kind) }}>
                  − {fmtNum(viewItem.amount || 0)} {currency}
                </p>
                <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${kindColor(viewItem.kind)}18`, color: kindColor(viewItem.kind) }}>
                  {kindLabel(viewItem.kind, isAr)}
                </span>
                {viewItem.receipt_number && (
                  <p className="text-[11px] mt-2 font-mono" style={{ color: '#94A3B8' }} dir="ltr">{viewItem.receipt_number}</p>
                )}
              </div>

              {viewItem.computed_amount != null && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ backgroundColor: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <p className="text-xs font-bold" style={{ color: '#7C3AED' }}>{t('حسبة الخروج المبكر', 'Early exit calculation')}</p>
                  {[
                    { label: t('المدفوع', 'Paid'), value: viewItem.paid_total },
                    { label: t('الفترة', 'Period'), value: viewItem.period_start && viewItem.period_end ? `${viewItem.period_start} → ${viewItem.period_end}` : null, raw: true },
                    { label: t('تاريخ الخروج', 'Exit date'), value: viewItem.exit_date, raw: true },
                    { label: t('المعدل اليومي', 'Daily rate'), value: viewItem.daily_rate },
                    { label: t('المستهلَك', 'Consumed'), value: viewItem.consumed_amount },
                  ].filter(r => r.value != null && r.value !== '' && r.value !== 0).map(r => (
                    <div key={r.label} className="flex justify-between gap-2 text-xs">
                      <span style={{ color: '#94A3B8' }}>{r.label}</span>
                      <span className="font-medium text-left" style={{ color: '#1B2B4B' }} dir={r.raw ? 'ltr' : undefined}>
                        {r.raw ? String(r.value) : fmtNum(Number(r.value))}
                      </span>
                    </div>
                  ))}

                  {(Number(viewItem.penalty_amount) > 0 || (viewItem.deduction_items || []).length > 0) && (
                    <div className="rounded-lg px-2.5 py-2 space-y-1" style={{ backgroundColor: 'rgba(230,57,70,0.05)', border: '1px solid rgba(230,57,70,0.2)' }}>
                      <p className="text-[11px] font-bold" style={{ color: '#E63946' }}>{t('أسباب الخصم', 'Deduction reasons')}</p>
                      {Number(viewItem.penalty_amount) > 0 && (
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate" style={{ color: '#64748B' }}>{viewItem.penalty_reason || t('بدون سبب مكتوب', 'No reason given')}</span>
                          <span className="font-bold shrink-0" style={{ color: '#E63946' }}>− {fmtNum(Number(viewItem.penalty_amount))}</span>
                        </div>
                      )}
                      {(viewItem.deduction_items || []).map((it, i) => (
                        <div key={`di-${i}`} className="flex justify-between gap-2 text-xs">
                          <span className="truncate" style={{ color: '#64748B' }}>{it.reason}</span>
                          <span className="font-bold shrink-0" style={{ color: '#E63946' }}>− {fmtNum(Number(it.amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
                    <span className="font-bold" style={{ color: '#1B2B4B' }}>{t('الصافي المحسوب', 'Computed net')}</span>
                    <span className="font-bold" style={{ color: '#7C3AED' }}>{fmtNum(Number(viewItem.computed_amount) || 0)}</span>
                  </div>
                  {viewItem.is_manual && (
                    <p className="text-[10px] font-medium" style={{ color: '#C9A84C' }}>
                      {t('المبلغ عُدِّل يدوياً ويختلف عن الحساب التلقائي', 'Manually overridden')}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                {[
                  { label: t('العقار', 'Property'), value: propLabel(viewItem.property_type, isAr) },
                  { label: t('السبب', 'Reason'), value: viewItem.reason },
                  { label: t('تاريخ الصرف', 'Paid out on'), value: viewItem.refund_date },
                  { label: t('يُخصم على سنة', 'Attributed to'), value: viewItem.applies_to_date ? String(viewItem.applies_to_date).slice(0, 4) : null },
                  { label: t('الوحدة', 'Unit'), value: viewItem.unit_number },
                  { label: t('المستأجر', 'Tenant'), value: viewItem.tenant_name },
                  { label: t('طريقة الصرف', 'Method'), value: methodLabel(viewItem.method, isAr) },
                  { label: t('ملاحظات', 'Notes'), value: viewItem.notes },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex justify-between gap-2 text-xs">
                    <span style={{ color: '#94A3B8' }}>{r.label}</span>
                    <span className="font-medium text-left" style={{ color: '#1B2B4B' }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {viewItem.receipt_image_url && (
                <a href={viewItem.receipt_image_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: '#E2E8F0', color: '#1B2B4B' }}>
                  <FileImage size={18} style={{ color: '#C9A84C' }} />
                  {t('عرض السند المرفق', 'View attached voucher')}
                </a>
              )}

              <p className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
                {t('الحركات لا تُعدَّل بعد الحفظ — يُحذف الخطأ ويُعاد إدخاله', 'Records cannot be edited after saving')}
              </p>

              <div className="flex gap-2">
                {isAdmin && (
                  <Button variant="outline" onClick={() => askDelete(viewItem)}
                    className="flex-1" style={{ borderColor: 'rgba(230,57,70,0.35)', color: '#E63946', minHeight: 44 }}>
                    <Trash2 size={14} className="ml-1" /> {t('حذف', 'Delete')}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewItem(null)} className="flex-1" style={{ minHeight: 44 }}>
                  {t('إغلاق', 'Close')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md w-full" dir={isAr ? 'rtl' : 'ltr'}
            style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DialogHeader className="flex-shrink-0 pb-2 border-b">
              <DialogTitle className="text-base">{t('إضافة استرجاع أو خصم', 'Add Refund / Deduction')}</DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 py-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('نوع الحركة *', 'Kind *')}</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {VISIBLE_REFUND_KINDS.map(k => {
                    const on = form.kind === k.value;
                    return (
                      <button key={k.value} onClick={() => setKind(k.value)}
                        className="rounded-xl border px-2 text-xs font-semibold transition"
                        style={{
                          minHeight: 44,
                          backgroundColor: on ? k.color : `${k.color}0D`,
                          borderColor: on ? k.color : 'transparent',
                          color: on ? '#fff' : k.color,
                        }}>
                        {k.label[isAr ? 'ar' : 'en']}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!autoReasonKind(form.kind) && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {reasonFieldLabel(form.kind, isAr)}
                  </Label>
                  <Input value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                  <p className="text-[11px] pt-0.5" style={{ color: '#94A3B8' }}>
                    {form.kind === 'eviction'
                      ? t('يظهر هذا النص عنواناً للحركة في السجل والتقارير.', 'Shown as the record title in the ledger and reports.')
                      : t('اكتب مسمّى الحركة كما تريده أن يظهر في السجل والتقارير.', 'Name this record as you want it listed.')}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('الوحدة *', 'Unit *')}</Label>
                <MobileDrawerSelect
                  value={form.unit_number ? `${form.property_type}::${form.unit_number}` : ''}
                  onValueChange={pickUnit}
                  placeholder={t('اختر وحدة...', 'Select unit...')}
                  triggerClassName="text-sm w-full"
                  dir={isAr ? 'rtl' : 'ltr'}
                  options={allUnits.filter(u => u._type === prop && u.tenant_name).map(u => ({
                    value: `${u._type}::${u.unit_number}`,
                    label: `${u.unit_number}${u.tenant_name ? ' — ' + u.tenant_name : ''}`,
                  }))}
                />
                {form.unit_number && (
                  <p className="flex items-center gap-1.5 text-[11px] pt-1" style={{ color: '#64748B' }}>
                    <PropIcon type={form.property_type} size={12} color="#C9A84C" />
                    {propLabel(form.property_type, isAr)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('المستأجر', 'Tenant')}</Label>
                  <Input value={form.tenant_name}
                    onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('تاريخ العملية *', 'Date *')}</Label>
                  <Input type="date" value={form.refund_date}
                    onChange={e => setForm(f => ({ ...f, refund_date: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>
              </div>

              {usesSettlement && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ backgroundColor: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <div className="flex gap-1.5 p-1 rounded-xl" style={{ backgroundColor: '#fff' }}>
                    {SETTLEMENT_MODES.map(m => {
                      const on = smode === m.value;
                      return (
                        <button key={m.value} onClick={() => setSmode(m.value)}
                          className="flex-1 rounded-lg text-[11px] font-bold transition px-1"
                          style={{ minHeight: 38, backgroundColor: on ? m.color : 'transparent', color: on ? '#fff' : '#64748B' }}>
                          {m.label[isAr ? 'ar' : 'en']}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
                    {(SETTLEMENT_MODES.find(m => m.value === smode) || SETTLEMENT_MODES[0]).hint[isAr ? 'ar' : 'en']}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">{t('المدفوع عن الفترة', 'Paid for the period')}</Label>
                      <div className="rounded-lg flex items-center px-2.5 font-bold text-sm"
                        style={{ minHeight: 40, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1B2B4B' }}>
                        {fmtNum(Number(input.paidTotal) || 0)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">{t('تاريخ الخروج الفعلي *', 'Actual exit *')}</Label>
                      <Input type="date" value={input.exitDate}
                        onChange={e => setInput(p => ({ ...p, exitDate: e.target.value }))}
                        className="text-sm bg-white" style={{ minHeight: 40 }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">{t('بداية الفترة *', 'Start *')}</Label>
                      <Input type="date" value={input.periodStart}
                        onChange={e => setInput(p => ({ ...p, periodStart: e.target.value }))}
                        className="text-sm bg-white" style={{ minHeight: 40 }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">{t('نهاية الفترة *', 'End *')}</Label>
                      <Input type="date" value={input.periodEnd}
                        onChange={e => setInput(p => ({ ...p, periodEnd: e.target.value }))}
                        className="text-sm bg-white" style={{ minHeight: 40 }} />
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: '#94A3B8' }}>
                    {t('«المدفوع عن الفترة» يُقرأ من دفعات الوحدة المسجَّلة داخل العقد ولا يُعدَّل هنا — يُقسَّم على أيام الفترة لاحتساب المستهلَك.',
                      'Paid for the period is read from the recorded payments and cannot be edited here — it is divided over the period days.')}
                  </p>

                  {waived && (
                    <div className="rounded-xl p-3 space-y-2"
                      style={{ backgroundColor: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.3)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold" style={{ color: '#E63946' }}>
                          {t('المتبقي المخصوم كاملاً', 'Full balance deducted')}
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#E63946' }}>{fmtNum(waiverAmount)} {currency}</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">{t('سبب الخصم الكامل *', 'Reason for the full deduction *')}</Label>
                        <Input value={input.penaltyReason}
                          onChange={e => setInput(p => ({ ...p, penaltyReason: e.target.value }))}
                          placeholder={t('تخلّف المستأجر عن السداد · إخلال بشروط العقد · تلفيات', 'Non-payment · breach of contract · damages')}
                          className="text-sm bg-white" style={{ minHeight: 40 }} />
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
                        {t('لا يُصرف للمستأجر شيء — يبقى المبلغ ضمن الإيراد، ويُنشأ سند يوثّق السبب ومن سجّله ومتى.',
                          'Nothing is paid out — the amount stays as revenue and a voucher records the reason, the user and the date.')}
                      </p>
                    </div>
                  )}

                  {!plain && !waived && (
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">{t('أسباب الخصم', 'Deduction reasons')}</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input value={input.penaltyReason}
                        onChange={e => setInput(p => ({ ...p, penaltyReason: e.target.value }))}
                        placeholder={form.kind === 'tenant_refund'
                          ? t('مثال: خصم شهر · بند قانوني · تلفيات', 'e.g. one month · legal clause · damages')
                          : t('السبب', 'Reason')}
                        className="flex-1 min-w-0 text-sm bg-white" style={{ minHeight: 40 }} />
                      <Input type="number" value={input.penalty}
                        onChange={e => setInput(p => ({ ...p, penalty: e.target.value }))}
                        placeholder="0" className="text-sm bg-white" style={{ minHeight: 40, width: 86 }} />
                      <span className="shrink-0" style={{ width: 34 }} />
                    </div>
                  </div>
                  )}

                  {!plain && !waived && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{ color: '#374151' }}>{t('خصومات أخرى', 'Other deductions')}</span>
                      <button onClick={addItem}
                        className="flex items-center gap-1 px-2 rounded-lg text-[11px] font-bold"
                        style={{ minHeight: 30, backgroundColor: 'rgba(124,58,237,0.12)', color: '#7C3AED' }}>
                        <Plus size={12} /> {t('إضافة خصم وسبب آخر', 'Add another reason')}
                      </button>
                    </div>

                    {input.items.length === 0 && (
                      <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                        {t('لا توجد خصومات إضافية — اضغط «إضافة خصم وسبب آخر» عند الحاجة', 'None — tap Add if needed')}
                      </p>
                    )}

                    {input.items.map((it, i) => (
                      <div key={i} className="flex gap-1.5 items-center">
                        <Input value={it.reason} onChange={e => setItem(i, { reason: e.target.value })}
                          placeholder={t('السبب', 'Reason')}
                          className="flex-1 min-w-0 text-sm bg-white" style={{ minHeight: 40 }} />
                        <Input type="number" value={it.amount} onChange={e => setItem(i, { amount: e.target.value })}
                          placeholder="0" className="text-sm bg-white" style={{ minHeight: 40, width: 86 }} />
                        <button onClick={() => removeItem(i)}
                          className="rounded-lg grid place-items-center shrink-0"
                          style={{ width: 34, height: 40, color: '#E63946', backgroundColor: 'rgba(230,57,70,0.08)' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer rounded-xl px-3 py-2"
                    style={{ minHeight: 44, backgroundColor: vacate ? 'rgba(201,168,76,0.1)' : '#fff', border: `1px solid ${vacate ? 'rgba(201,168,76,0.45)' : '#E2E8F0'}` }}>
                    <input type="checkbox" checked={vacate} onChange={e => setVacate(e.target.checked)}
                      className="w-4 h-4 mt-0.5" style={{ accentColor: '#C9A84C' }} />
                    <span className="text-[11px] leading-relaxed" style={{ color: '#374151' }}>
                      <span className="font-bold block">{t('اجعل الوحدة شاغرة', 'Mark the unit vacant')}</span>
                      <span style={{ color: '#94A3B8' }}>
                        {t('يُفرَّغ اسم المستأجر والجنسية وتواريخ العقد، وتصير حالة الوحدة «شاغرة». السجل المالي والتأمين يبقيان مربوطين برقم الوحدة.',
                          'Clears tenant name, nationality and contract dates; financial history stays linked to the unit number.')}
                      </span>
                    </span>
                  </label>

                  {settlement.ok ? (
                    <div className="rounded-lg bg-white px-2.5 py-2 space-y-1" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>
                      {[
                        { l: t('أيام الفترة / أيام السكن', 'Period / occupied'), v: `${settlement.totalDays} / ${settlement.consumedDays}`, raw: true },
                        { l: t('المعدل اليومي', 'Daily rate'), v: fmtNum(settlement.dailyRate) },
                        { l: t('المستهلَك', 'Consumed'), v: fmtNum(settlement.consumedAmount) },
                        { l: t('المتبقي', 'Remaining'), v: fmtNum(settlement.remainingAmount) },
                        ...(settlement.penalty > 0
                          ? [{ l: input.penaltyReason.trim() || t('خصم', 'Deduction'), v: '− ' + fmtNum(settlement.penalty) }] : []),
                        ...settlement.items.map(it => ({ l: it.reason, v: '− ' + fmtNum(it.amount) })),
                      ].map((r, i) => (
                        <div key={`${r.l}-${i}`} className="flex justify-between gap-2 text-[11px]">
                          <span className="truncate" style={{ color: '#94A3B8' }}>{r.l}</span>
                          <span className="font-medium shrink-0" style={{ color: '#1B2B4B' }} dir={r.raw ? 'ltr' : undefined}>{r.v}</span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: '#F1F5F9' }}>
                        <span className="font-bold" style={{ color: '#1B2B4B' }}>{t('صافي المسترجَع للمستأجر', 'Net refund to tenant')}</span>
                        <span className="font-bold" style={{ color: '#7C3AED' }}>{fmtNum(settlement.netRefund)} {currency}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] font-medium" style={{ color: '#C9A84C' }}>{settlement.error}</p>
                  )}

                </div>
              )}

              {(
                <div className="rounded-xl p-3 space-y-2"
                  style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.12)' }}>
                  <p className="text-[11px] font-bold" style={{ color: '#1B2B4B' }}>{t('السنة المحاسبية للخصم', 'Accounting year')}</p>

                  {!unconsumedInfo.ok ? (
                    <p className="text-[11px] font-medium" style={{ color: '#C9A84C' }}>{unconsumedInfo.reason}</p>
                  ) : unitPayments.length === 0 ? (
                    <p className="text-[11px] font-bold" style={{ color: '#E63946' }}>
                      {t('المبالغ المدفوعة استُهلكت بالكامل — لا يوجد رصيد غير مستهلك يمكن الخصم منه',
                        'Everything paid is already consumed')}
                    </p>
                  ) : (
                    <>
                      <div className="rounded-lg bg-white px-2.5 py-2 space-y-1" style={{ border: '1px solid #E2E8F0' }}>
                        {[
                          { l: t('أيام العقد / المنقضية', 'Contract / elapsed'), v: `${unconsumedInfo.totalDays} / ${unconsumedInfo.elapsedDays}`, raw: true },
                          { l: t('المدفوع داخل العقد', 'Paid within contract'), v: fmtNum(unconsumedInfo.paid) },
                          { l: usesSettlement ? t('المستهلَك حتى تاريخ الخروج', 'Consumed to the exit date') : t('المستهلَك حتى اليوم', 'Consumed to date'),
                            v: '− ' + fmtNum(unconsumedInfo.consumed) },
                        ].map(r => (
                          <div key={r.l} className="flex justify-between gap-2 text-[11px]">
                            <span style={{ color: '#94A3B8' }}>{r.l}</span>
                            <span className="font-medium" style={{ color: '#1B2B4B' }} dir={r.raw ? 'ltr' : undefined}>{r.v}</span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: '#F1F5F9' }}>
                          <span className="font-bold" style={{ color: '#1B2B4B' }}>{t('الرصيد غير المستهلك', 'Unconsumed balance')}</span>
                          <span className="font-bold" style={{ color: '#2A9D8F' }}>{fmtNum(unconsumedInfo.balance)} {currency}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">{t('الدفعة المخصوم منها', 'Payment to deduct from')}</Label>
                        <MobileDrawerSelect
                          value={form.payment_id || ''}
                          onValueChange={v => {
                            const pay = unitPayments.find(x => x.id === v) || null;
                            setForm(f => ({ ...f, payment_id: v, applies_to_date: pay?.payment_date || '' }));
                          }}
                          placeholder={t('بدون ربط', 'Not linked')}
                          triggerClassName="text-sm w-full"
                          dir={isAr ? 'rtl' : 'ltr'}
                          options={unitPayments.map(pay => ({
                            value: pay.id,
                            label: `${pay.payment_date} · ${dueMonthsLabel(pay.due_months, isAr)} · ${t('متبقي', 'left')} ${fmtNum(pay.remaining)}`,
                          }))}
                        />
                      </div>

                      {amount > unconsumedInfo.balance && (
                        <p className="text-[11px] font-bold" style={{ color: '#E63946' }}>
                          {t('المبلغ يتجاوز الرصيد غير المستهلك', 'Amount exceeds the unconsumed balance')}
                        </p>
                      )}
                    </>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">{t('تاريخ احتساب الإيراد', 'Revenue attribution date')}</Label>
                    <Input type="date" value={appliesTo}
                      onChange={e => setForm(f => ({ ...f, applies_to_date: e.target.value }))}
                      className="text-sm bg-white" style={{ minHeight: 40 }} />
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: yearShift ? '#C9A84C' : '#94A3B8' }}>
                    {t(
                      `يُحتسب الخصم على إيراد سنة ${appliesTo.slice(0, 4)}، والصرف الفعلي ضمن سنة ${(form.refund_date || today).slice(0, 4)}.`,
                      `Charged against ${appliesTo.slice(0, 4)} revenue; disbursed in ${(form.refund_date || today).slice(0, 4)}.`,
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('طريقة الصرف', 'Method')}</Label>
                <MobileDrawerSelect
                  value={form.method}
                  onValueChange={v => setForm(f => ({ ...f, method: v }))}
                  triggerClassName="text-sm w-full"
                  dir={isAr ? 'rtl' : 'ltr'}
                  options={PAY_METHODS.map(m => ({ value: m.value, label: m.label[isAr ? 'ar' : 'en'] }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('ملاحظات', 'Notes')}</Label>
                <Input value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="text-sm" style={{ minHeight: 44 }} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('سند الصرف', 'Payout Voucher')}</Label>
                {receiptUrl ? (
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: '#E2E8F0' }}>
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm" style={{ color: '#1B2B4B' }}>
                      <FileImage size={16} style={{ color: '#C9A84C' }} />
                      {t('تم الرفع', 'Uploaded')}
                    </a>
                    <button onClick={() => setReceiptUrl('')} style={{ color: '#E63946' }}><X size={14} /></button>
                  </div>
                ) : (
                  <label className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl cursor-pointer"
                    style={{ borderColor: 'rgba(201,168,76,0.4)', minHeight: 44 }}>
                    <Upload size={15} style={{ color: '#C9A84C' }} />
                    <span className="text-xs" style={{ color: '#C9A84C' }}>
                      {uploading ? t('جاري الرفع...', 'Uploading...') : t('إرفاق سند (اختياري)', 'Attach (optional)')}
                    </span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
                  </label>
                )}
              </div>

              <div className="rounded-xl px-3 py-2.5 space-y-1.5" style={{ backgroundColor: 'rgba(27,43,75,0.04)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium" style={{ color: '#64748B' }}>
                    {waived
                      ? t('المخصوم كاملاً في هذه العملية', 'Fully deducted in this record')
                      : t('المبلغ المخصوم في هذه العملية', 'Deducted in this record')}
                  </span>
                  <span className="text-base font-bold shrink-0" style={{ color: '#7C3AED' }}>
                    − {fmtNum(deductedNow)} {currency}
                  </span>
                </div>

                {settlement.ok && (
                  <div className="space-y-1.5 pt-1.5 border-t" style={{ borderColor: 'rgba(27,43,75,0.12)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                        {plain
                          ? t('يدخل للشركة — المستهلَك', 'To the company — consumed')
                          : waived
                            ? t('يدخل للشركة — المستهلَك والمخصوم كاملاً', 'To the company — consumed and fully deducted')
                            : t('يدخل للشركة — المستهلَك والخصومات', 'To the company — consumed and deductions')}
                      </span>
                      <span className="text-sm font-bold shrink-0" style={{ color: '#2A9D8F' }}>
                        {fmtNum(toCompany)} {currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px]" style={{ color: '#94A3B8' }}>{t('يعود للمستأجر', 'Returned to tenant')}</span>
                      <span className="text-sm font-bold shrink-0" style={{ color: '#0EA5E9' }}>
                        {fmtNum(amount)} {currency}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {inlineError && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)' }}>
                  <AlertTriangle size={14} style={{ color: '#E63946', marginTop: 2 }} />
                  <p className="text-xs font-medium" style={{ color: '#E63946' }}>{inlineError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || uploading}
                  className="flex-1 text-white" style={{ backgroundColor: '#7C3AED', minHeight: 44 }}>
                  <CheckCircle2 size={15} className="ml-1" />
                  {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ minHeight: 44 }}>
                  {t('إلغاء', 'Cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!handoff} onOpenChange={(v) => { if (!v) setHandoff(null); }}>
        <DialogContent className="max-w-sm font-cairo" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-base">{t('بقي تأمين على الوحدة', 'A deposit is still held')}</DialogTitle>
          </DialogHeader>
          {handoff && (
            <div className="space-y-3">
              <div className="rounded-xl p-3 flex items-center justify-between gap-2"
                style={{ backgroundColor: 'rgba(42,157,143,0.08)', border: '1px solid rgba(42,157,143,0.35)' }}>
                <span className="text-xs" style={{ color: '#64748B' }}>
                  {t(`تأمين الوحدة ${handoff.unit}`, `Unit ${handoff.unit} deposit`)}
                </span>
                <span className="text-base font-bold" style={{ color: '#2A9D8F' }}>
                  {fmtNum(handoff.amount)} {currency}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>
                {t('تمّت تسوية الإيجار، لكن تأمين المستأجر ما زال محفوظاً لديك. أكمل إرجاعه من صفحة التأمينات ليخرج من الأمانة ويُقفل ملف المستأجر.',
                  'The rent is settled, but the tenant deposit is still held. Refund it from the Deposits page to close the file.')}
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => { const h = handoff; setHandoff(null); navigate(`/deposits?open=1&prop=${h.prop}&unit=${encodeURIComponent(h.unit)}`); }}
                  className="w-full text-white" style={{ backgroundColor: '#0EA5E9', minHeight: 44 }}>
                  {t('اذهب لإرجاع التأمين', 'Go refund the deposit')}
                </Button>
                <Button variant="outline" onClick={() => setHandoff(null)} className="w-full" style={{ minHeight: 44 }}>
                  {t('لاحقاً', 'Later')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirm && (
        <ConfirmDialog
          open={!!confirm}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
