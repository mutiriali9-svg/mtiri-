import { useState, useEffect, useRef } from 'react';
import { base44, supabase, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import {
  ShieldCheck, Plus, Trash2, Search, X, Upload, FileImage,
  Building2, Home, AlertTriangle, CheckCircle2, FileCheck2, Banknote, Layers, MinusCircle, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileDrawerSelect from '@/components/MobileDrawerSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  PAY_METHODS, methodLabel, propLabel, depositBalance, isCheque, fmtNum,
  DEDUCTION_DESTINATIONS, destLabel, destColor,
} from '@/utils/settlementCalc';

const emptyForm = {
  property_type: 'qarya', unit_number: '', tenant_name: '', amount: '',
  received_date: '', expected_start: '', method: 'cash', notes: '',
};

export default function Deposits() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = (ar, en) => (lang === 'en' ? en : ar);
  const isAr = lang !== 'en';
  const isAdmin = user?.role === 'admin' || user?.role === 'tester';
  const currency = t('د.إ', 'AED');
  const today = new Date().toISOString().split('T')[0];

  const [deposits, setDeposits] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [units, setUnits] = useState([]);
  const [reUnits, setReUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [tab, setTab] = useState('ledger');
  const [dedOpen, setDedOpen] = useState(false);
  const [ded, setDed] = useState(null);
  const [search, setSearch] = useState('');
  const [prop, setProp] = useState('qarya');
  const [filterKind, setFilterKind] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [dedView, setDedView] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [future, setFuture] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, r, u, ru] = await Promise.all([
        base44.entities.Deposit.list('-received_date'),
        base44.entities.DepositDeduction.list('-deduction_date'),
        base44.entities.Unit.list(),
        base44.entities.ReUnit.list(),
      ]);
      setDeposits(d); setDeductions(r); setUnits(u); setReUnits(ru);
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
    const unitNumber = q.get('unit');
    const type = q.get('prop') || 'qarya';
    window.history.replaceState({}, '', window.location.pathname);
    setProp(type);
    setDed({
      ...emptyDed,
      property_type: type,
      unit_number: unitNumber || '',
      mode: 'return',
      destination: 'tenant_return',
    });
    setReceiptUrl(''); setInlineError(''); setDedOpen(true);
  }, [loading, units.length, reUnits.length]);

  const allUnits = [
    ...units.map(u => ({ ...u, _type: 'qarya' })),
    ...reUnits.map(u => ({ ...u, _type: 'real_estate' })),
  ];

  const rows = allUnits.map(u => ({
    ...u,
    ...depositBalance(deposits, deductions, u._type, u.unit_number),
  }));

  const visibleRows = rows.filter(r => r._type === prop);
  const withDeposit = visibleRows.filter(r => r.hasDeposit);
  const withoutDeposit = visibleRows.filter(r => !r.hasDeposit);

  const unitDeposit = (type, unitNumber) => {
    const received = deposits
      .filter(d => d.property_type === type && d.unit_number === unitNumber && !isCheque(d))
      .reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const mine = deductions.filter(d => d.property_type === type && d.unit_number === unitNumber);
    const cut = mine.filter(d => d.destination !== 'tenant_return').reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const back = mine.filter(d => d.destination === 'tenant_return').reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    return { received: r2(received), cut: r2(cut), back: r2(back), balance: r2(Math.max(0, received - cut - back)) };
  };

  const settledUnits = new Set(
    rows.filter(r => r.hasDeposit && r.balance <= 0).map(r => r.unit_number),
  );

  const visibleDeposits = deposits.filter(d => {
    if (d.property_type !== prop) return false;
    if (settledUnits.has(d.unit_number)) return false;
    if (filterKind === 'cheque' && !isCheque(d)) return false;
    if (filterKind === 'cash' && isCheque(d)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return d.unit_number?.toLowerCase().includes(q)
      || d.tenant_name?.toLowerCase().includes(q)
      || d.receipt_number?.toLowerCase().includes(q);
  });

  const totalHeld = visibleRows.reduce((s, r) => s + r.balance, 0);
  const visibleDeductions = deductions.filter(x => x.property_type === prop);
  const totalCheque = visibleRows.reduce((s, r) => s + r.cheque, 0);
  const chequeCount = visibleRows.reduce((s, r) => s + r.chequeCount, 0);

  const openAdd = () => {
    setForm({ ...emptyForm, property_type: prop, received_date: today });
    setFuture(false); setReceiptUrl(''); setInlineError('');
    setDialogOpen(true);
  };

  const pickUnit = (key) => {
    const [type, ...rest] = key.split('::');
    const unitNumber = rest.join('::');
    setForm(f => ({ ...f, property_type: type, unit_number: unitNumber }));
  };

  const emptyDed = {
    property_type: prop, unit_number: '', tenant_name: '', amount: '',
    deduction_date: today, reason: '', mode: 'return', destination: 'tenant_return',
    due_months: '', method: 'cash', notes: '',
  };

  const openDed = (row) => {
    setDed({
      ...emptyDed,
      property_type: row?._type || prop,
      unit_number: row?.unit_number || '',
      tenant_name: row?.tenant_name || '',
    });
    setReceiptUrl(''); setInlineError('');
    setDedOpen(true);
  };

  const dedBalance = ded
    ? depositBalance(deposits, deductions, ded.property_type, ded.unit_number)
    : { balance: 0, hasDeposit: false, received: 0, used: 0 };

  const dedAmount = parseFloat(ded?.amount) || 0;

  const pickDedUnit = (key) => {
    const [type, ...rest] = key.split('::');
    setDed(d => ({ ...d, property_type: type, unit_number: rest.join('::'), amount: '' }));
  };

  const handleDedSave = async () => {
    if (!ded?.unit_number) { setInlineError(t('يُرجى اختيار الوحدة', 'Select a unit')); return; }
    if (!dedBalance.hasDeposit) {
      setInlineError(t('لا يوجد تأمين مسجَّل لهذه الوحدة', 'No deposit recorded for this unit')); return;
    }
    if (dedAmount <= 0) { setInlineError(t('يُرجى إدخال المبلغ', 'Enter the amount')); return; }
    if (dedAmount > dedBalance.balance) {
      setInlineError(t(`المبلغ يتجاوز الرصيد المتاح (${fmtNum(dedBalance.balance)})`,
        `Amount exceeds the available balance (${fmtNum(dedBalance.balance)})`)); return;
    }
    if (!ded.reason?.trim()) { setInlineError(t('يُرجى كتابة السبب', 'Enter the reason')); return; }
    if (!DEDUCTION_DESTINATIONS.some(o => o.value === ded.destination)) {
      setInlineError(t('يُرجى تحديد وجهة المبلغ', 'Choose where the amount goes')); return;
    }
    if (ded.destination === 'payment' && !ded.due_months?.trim()) {
      setInlineError(t('يُرجى تحديد الشهر المستحق للدفعة', 'Enter the due month')); return;
    }

    setInlineError(''); setSaving(true);
    try {
      const { mode: _mode, ...dedRest } = ded;
      const payload = {
        ...dedRest,
        amount: dedAmount,
        receipt_image_url: receiptUrl || null,
      };
      const { data: created, error: rpcError } = await supabase.rpc('create_deposit_deduction', { p_ded: payload });
      if (rpcError) throw rpcError;
      await logActivity(
        'DepositDeduction', 'create',
        `${ded.unit_number} — ${propLabel(ded.property_type, isAr)}`,
        null, payload,
        `${destLabel(ded.destination, true)} ${dedAmount.toLocaleString()} AED — ${ded.reason}`,
        user,
      );
      base44.entities.Notification.create({
        type: ded.mode === 'return' ? 'deposit_return' : 'deposit_deduction',
        title: `${destLabel(ded.destination, true)} — ${ded.unit_number} · ${propLabel(ded.property_type, true)}`,
        amount: dedAmount,
        reference_id: created?.id || '',
        reference_data: { ...payload, receipt_number: created?.receipt_number || null },
        is_read: false,
      }).catch(() => {});
      window.dispatchEvent(new Event('notifications-updated'));

      setDedOpen(false); setDed(null); setReceiptUrl('');
      await load();
      return created;
    } catch (e) {
      const msg = e?.message || '';
      setInlineError(
        msg.includes('exceeds_balance') ? t('المبلغ يتجاوز الرصيد المتاح', 'Exceeds available balance')
        : msg.includes('reason_required') ? t('يُرجى كتابة السبب', 'Reason required')
        : msg.includes('destination_required') ? t('يُرجى تحديد وجهة المبلغ', 'Destination required')
        : msg || t('تعذّر الحفظ', 'Save failed'),
      );
    } finally {
      setSaving(false);
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
    if (!form.unit_number) { setInlineError(t('يُرجى اختيار الوحدة', 'Select a unit')); return; }
    if (!(parseFloat(form.amount) > 0)) { setInlineError(t('يُرجى إدخال مبلغ التأمين', 'Enter the amount')); return; }
    if (!form.received_date) { setInlineError(t('يُرجى تحديد تاريخ الاستلام', 'Set the received date')); return; }
    if (future && !form.expected_start) { setInlineError(t('يُرجى تحديد تاريخ السكن المتوقع', 'Set the expected move-in date')); return; }

    setInlineError(''); setSaving(true);
    try {
      const payload = {
        property_type: form.property_type,
        unit_number: form.unit_number,
        tenant_name: form.tenant_name || null,
        amount: parseFloat(form.amount) || 0,
        received_date: form.received_date,
        expected_start: future ? form.expected_start : null,
        method: form.method || 'cash',
        notes: form.notes || null,
        receipt_image_url: receiptUrl || null,
      };
      const { data: created, error: rpcError } = await supabase.rpc('create_deposit', { p_deposit: payload });
      if (rpcError) throw rpcError;
      await logActivity(
        'Deposit', 'create',
        `${form.unit_number} — ${propLabel(form.property_type, isAr)}`,
        null, payload,
        `تسجيل تأمين ${(parseFloat(form.amount) || 0).toLocaleString()} AED — ${form.unit_number}`,
        user,
      );
      base44.entities.Notification.create({
        type: 'deposit',
        title: `تسجيل تأمين — ${form.unit_number} · ${propLabel(form.property_type, true)}`,
        amount: parseFloat(form.amount) || 0,
        reference_id: created?.id || '',
        reference_data: { ...payload, receipt_number: created?.receipt_number || null },
        is_read: false,
      }).catch(() => {});
      window.dispatchEvent(new Event('notifications-updated'));

      setDialogOpen(false); setForm(emptyForm); setReceiptUrl(''); setFuture(false);
      await load();
      return created;
    } catch (e) {
      setInlineError(e?.message || t('تعذّر الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (d) => setConfirm({
    autoSourced: d.source === 'unit',
    message: d.source === 'unit'
      ? t(
        'هذا السند مسجَّل تلقائياً من بيانات الوحدة. لحذفه أو تعديله، غيّر حقل التأمين في صفحة الوحدات وسيتحدّث هنا تلقائياً.',
        'This voucher is auto-synced from the unit. Change the unit deposit field instead.',
      )
      : t(
      `حذف سند ${d.receipt_number || ''}؟ سينقص رصيد الوحدة بمقدار المبلغ نفسه.`,
      `Delete voucher ${d.receipt_number || ''}? The unit balance will drop accordingly.`,
    ),
    onConfirm: async () => {
      if (d.source === 'unit') { setConfirm(null); return; }
      try {
        await base44.entities.Deposit.delete(d.id);
        await logActivity('Deposit', 'delete', `${d.unit_number} — ${d.receipt_number || ''}`, d, null,
          `حذف تأمين ${(d.amount || 0).toLocaleString()} AED`, user);
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
          style={{ borderColor: 'rgba(42,157,143,0.3)', borderTopColor: '#2A9D8F' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('التأمينات', 'Deposits')}</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#64748B' }}>
            {t('مبالغ أمانة لدى المالك — لا تُحتسب ضمن الإيراد', 'Held in trust — not counted as revenue')}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => openDed(null)} variant="outline"
              style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#7C3AED', minHeight: 44 }}>
              <MinusCircle size={15} className="ml-1" />
              {t('استرجاع التأمين أو خصم', 'Refund / Deduct')}
            </Button>
            <Button onClick={openAdd} className="text-white" style={{ backgroundColor: '#2A9D8F', minHeight: 44 }}>
              <Plus size={15} className="ml-1" />
              {t('تسجيل تأمين', 'Receive Deposit')}
            </Button>
          </div>
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
        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: 'rgba(42,157,143,0.35)' }}>
          <p className="text-xs mb-1" style={{ color: '#64748B' }}>{t('التأمينات النقدية المحفوظة', 'Cash Deposits Held')}</p>
          <p className="text-xl font-bold" style={{ color: '#2A9D8F' }}>
            {fmtNum(totalHeld)} <span className="text-xs font-normal">{currency}</span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
            {t('مبالغ فعلية مستحقة الردّ', 'Actual cash refundable')}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: 'rgba(201,168,76,0.45)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <FileCheck2 size={13} style={{ color: '#C9A84C' }} />
            <p className="text-xs" style={{ color: '#64748B' }}>{t('شيكات التأمين', 'Deposit Cheques')}</p>
          </div>
          <p className="text-xl font-bold" style={{ color: '#C9A84C' }}>
            {fmtNum(totalCheque)} <span className="text-xs font-normal">{currency}</span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
            {t(`${chequeCount} شيك · غير محتسبة مع النقدي`, `${chequeCount} cheques · not counted with cash`)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-xs mb-1" style={{ color: '#64748B' }}>{t('وحدات مؤمَّنة', 'Covered Units')}</p>
          <p className="text-xl font-bold" style={{ color: '#1B2B4B' }}>
            {withDeposit.length} <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>
              {t(`من ${visibleRows.length}`, `of ${visibleRows.length}`)}
            </span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{t('لها تأمين مسجّل', 'have a deposit')}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border"
          style={{ borderColor: withoutDeposit.length ? 'rgba(230,57,70,0.35)' : '#E2E8F0' }}>
          <p className="text-xs mb-1" style={{ color: '#64748B' }}>{t('وحدات غير مؤمَّنة', 'Uncovered Units')}</p>
          <p className="text-xl font-bold" style={{ color: withoutDeposit.length ? '#E63946' : '#2A9D8F' }}>
            {withoutDeposit.length}
          </p>
          <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{t('تحتاج تسجيل تأمين', 'need a deposit')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {[
          { v: 'all', label: t('الكل', 'All'), Icon: Layers, color: '#1B2B4B' },
          { v: 'cash', label: t('نقداً', 'Cash'), Icon: Banknote, color: '#2A9D8F' },
          { v: 'cheque', label: t('شيك', 'Cheque'), Icon: FileCheck2, color: '#C9A84C' },
        ].map(f => {
          const on = filterKind === f.v;
          const n = f.v === 'all'
            ? deposits.filter(d => d.property_type === prop).length
            : deposits.filter(d => d.property_type === prop
                && (f.v === 'cheque' ? isCheque(d) : !isCheque(d))).length;
          return (
            <button key={f.v} onClick={() => setFilterKind(f.v)}
              className="flex items-center gap-1 px-2.5 rounded-lg text-[11px] font-bold border transition-colors"
              style={{
                minHeight: 32,
                backgroundColor: on ? f.color : `${f.color}0D`,
                borderColor: on ? f.color : 'transparent',
                color: on ? '#fff' : f.color,
              }}>
              <f.Icon size={12} />
              {f.label}
              <span className="text-[10px] font-normal opacity-80">({n})</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {[
          { k: 'ledger', label: t('التأمينات', 'Deposits'), n: visibleDeposits.length },
          { k: 'units', label: t('حالة الوحدات', 'Units'), n: visibleRows.length },
          { k: 'deductions', label: t('الخصومات', 'Deductions'), n: visibleDeductions.length },
        ].map(x => (
          <button key={x.k} onClick={() => setTab(x.k)}
            className="px-4 rounded-xl text-sm font-bold border transition-colors"
            style={{
              minHeight: 44,
              backgroundColor: tab === x.k ? '#C9A84C' : '#fff',
              borderColor: tab === x.k ? '#C9A84C' : '#E2E8F0',
              color: tab === x.k ? '#fff' : '#64748B',
            }}>
            {x.label} <span className="text-xs font-normal">({x.n})</span>
          </button>
        ))}
      </div>

      {tab === 'ledger' && (
        <>
          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#94A3B8', right: isAr ? 12 : 'auto', left: isAr ? 'auto' : 12 }} />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('ابحث برقم الوحدة أو اسم المستأجر أو رقم السند', 'Search unit, tenant or voucher')}
              className="w-full" style={{ minHeight: 44, paddingRight: isAr ? 36 : 12, paddingLeft: isAr ? 12 : 36 }} />
          </div>

          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    {[t('الوحدة', 'Unit'), t('العقار', 'Property'), t('المبلغ', 'Amount'),
                      t('تاريخ الاستلام', 'Received'), t('الحالة', 'Status'), t('السند', 'Voucher'), ''].map((h, i) => (
                      <th key={i} className="py-2.5 px-3 text-xs font-semibold" style={{ color: '#64748B', textAlign: 'start' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDeposits.map(d => (
                    <tr key={d.id} className="border-t cursor-pointer hover:bg-slate-50 transition-colors"
                      style={{ borderColor: '#F1F5F9' }} onClick={() => setViewItem(d)}>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-xs" style={{ color: '#1B2B4B' }}>{d.unit_number}</p>
                        {d.tenant_name && <p className="text-[11px] truncate max-w-[120px]" style={{ color: '#94A3B8' }}>{d.tenant_name}</p>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: 'rgba(27,43,75,0.07)', color: '#1B2B4B' }}>
                          <PropIcon type={d.property_type} size={11} color="#C9A84C" />
                          {propLabel(d.property_type, isAr)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-xs" style={{ color: isCheque(d) ? '#C9A84C' : '#2A9D8F' }}>
                        {fmtNum(d.amount || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-xs" style={{ color: '#64748B', textAlign: 'start' }}><span dir="ltr">{d.received_date}</span></td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {d.source === 'unit' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ backgroundColor: 'rgba(27,43,75,0.07)', color: '#64748B' }}>
                              {t('تلقائي', 'Auto')}
                            </span>
                          )}
                          {isCheque(d) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ backgroundColor: 'rgba(201,168,76,0.16)', color: '#C9A84C' }}>
                              <FileCheck2 size={10} /> {t('شيك', 'Cheque')}
                            </span>
                          )}
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={d.expected_start
                              ? { backgroundColor: 'rgba(201,168,76,0.14)', color: '#C9A84C' }
                              : { backgroundColor: 'rgba(42,157,143,0.12)', color: '#2A9D8F' }}>
                            {d.expected_start ? t('سكن لاحق', 'Future') : t('محفوظ', 'Held')}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono" style={{ color: '#94A3B8', textAlign: 'start' }}><span dir="ltr">{d.receipt_number || '-'}</span></td>
                      <td className="py-2.5 px-3">
                        {isAdmin && d.source !== 'unit' && (
                          <button onClick={e => { e.stopPropagation(); askDelete(d); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition" style={{ color: '#94A3B8' }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {visibleDeposits.length === 0 && (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(42,157,143,0.08)' }}>
                    <ShieldCheck size={22} style={{ color: '#2A9D8F' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#1B2B4B' }}>
                    {t('لا توجد تأمينات مسجّلة', 'No deposits recorded')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'units' && (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  {[t('الوحدة', 'Unit'), t('العقار', 'Property'), t('المستأجر', 'Tenant'),
                    t('مبلغ التأمين', 'Deposit'), t('الرصيد الحالي', 'Balance'), t('الحالة', 'Status')].map((h, i) => (
                    <th key={i} className="py-2.5 px-3 text-xs font-semibold" style={{ color: '#64748B', textAlign: 'start' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...withoutDeposit, ...withDeposit].map(r => (
                  <tr key={`${r._type}-${r.unit_number}`} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                    <td className="py-2.5 px-3 font-bold text-xs" style={{ color: '#1B2B4B' }}>{r.unit_number}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: 'rgba(27,43,75,0.07)', color: '#1B2B4B' }}>
                        <PropIcon type={r._type} size={11} color="#C9A84C" />
                        {propLabel(r._type, isAr)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs truncate max-w-[130px]" style={{ color: '#64748B' }}>{r.tenant_name || '-'}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: '#1B2B4B' }}>
                      {r.received ? fmtNum(r.received) : '-'}
                      {r.hasCheque && (
                        <span className="block text-[11px] mt-0.5" style={{ color: '#C9A84C' }}>
                          {t('شيك', 'Cheque')} {fmtNum(r.cheque)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-xs" style={{ color: r.balance ? '#2A9D8F' : '#94A3B8' }}>
                      {r.balance ? fmtNum(r.balance) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={r.hasDeposit
                            ? { backgroundColor: 'rgba(42,157,143,0.12)', color: '#2A9D8F' }
                            : { backgroundColor: 'rgba(230,57,70,0.1)', color: '#E63946' }}>
                          {r.hasDeposit ? t('مؤمَّنة', 'Covered') : t('غير مؤمَّنة', 'Uncovered')}
                        </span>
                        {isAdmin && r.balance > 0 && (
                          <button onClick={() => openDed(r)} title={t('استرجاع التأمين أو خصم', 'Refund / Deduct')}
                            className="p-1 rounded-lg" style={{ color: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.08)' }}>
                            <MinusCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length === 0 && (
              <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
                {t('لا توجد وحدات مسجّلة', 'No units recorded')}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'deductions' && (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  {[t('الوحدة', 'Unit'), t('المبلغ', 'Amount'), t('التاريخ', 'Date'),
                    t('السبب', 'Reason'), t('الوجهة', 'Destination'), t('السند', 'Voucher')].map((h, i) => (
                    <th key={i} className="py-2.5 px-3 text-xs font-semibold" style={{ color: '#64748B', textAlign: 'start' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDeductions.map(x => {
                  const box = unitDeposit(x.property_type, x.unit_number);
                  return (
                  <tr key={x.id} onClick={() => setDedView(x)}
                    className="border-t cursor-pointer hover:bg-slate-50" style={{ borderColor: '#F1F5F9' }}>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-xs" style={{ color: '#1B2B4B' }}>{x.unit_number}</p>
                      {box.cut > 0 ? (
                        <p className="text-[11px] font-bold" style={{ color: '#7C3AED' }}>
                          {t(`خُصم منها ${fmtNum(box.cut)}`, `deducted ${fmtNum(box.cut)}`)}
                        </p>
                      ) : (
                        <p className="text-[11px]" style={{ color: '#94A3B8' }}>{propLabel(x.property_type, isAr)}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-xs" style={{ color: '#7C3AED' }}>− {fmtNum(x.amount || 0)}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: '#64748B', textAlign: 'start' }}><span dir="ltr">{x.deduction_date}</span></td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: '#1B2B4B' }}>{x.reason}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: `${destColor(x.destination)}18`, color: destColor(x.destination) }}>
                        {destLabel(x.destination, isAr)}
                      </span>
                      {x.due_months && (
                        <span className="block text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
                          {t('شهر', 'month')} {x.due_months}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono" style={{ color: '#94A3B8', textAlign: 'start' }} dir="ltr">
                      {x.receipt_number || '-'}
                      {x.receipt_image_url && (
                        <a href={x.receipt_image_url} target="_blank" rel="noopener noreferrer"
                          className="block mt-0.5" style={{ color: '#C9A84C' }}>
                          <FileImage size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleDeductions.length === 0 && (
              <div className="py-16 text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
                  <MinusCircle size={22} style={{ color: '#7C3AED' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#1B2B4B' }}>
                  {t('لا توجد خصومات على التأمينات', 'No deductions recorded')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!viewItem} onOpenChange={o => !o && setViewItem(null)}>
        <DialogContent className="max-w-md w-full" dir={isAr ? 'rtl' : 'ltr'}
          style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader className="flex-shrink-0 pb-2 border-b">
            <DialogTitle className="text-base">{t('تفاصيل التأمين', 'Deposit Details')}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="overflow-y-auto flex-1 py-3 space-y-3">
              <div className="rounded-xl p-4 text-center"
                style={{ backgroundColor: 'rgba(42,157,143,0.06)', border: '1px solid rgba(42,157,143,0.25)' }}>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{t('مبلغ التأمين', 'Deposit amount')}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#2A9D8F' }}>
                  {fmtNum(viewItem.amount || 0)} {currency}
                </p>
                {viewItem.receipt_number && (
                  <p className="text-[11px] mt-2 font-mono" style={{ color: '#94A3B8' }} dir="ltr">{viewItem.receipt_number}</p>
                )}
              </div>

              <div className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                {[
                  { label: t('العقار', 'Property'), value: propLabel(viewItem.property_type, isAr) },
                  { label: t('الوحدة', 'Unit'), value: viewItem.unit_number },
                  { label: t('دفعه', 'Paid by'), value: viewItem.tenant_name },
                  { label: t('تاريخ الاستلام', 'Received on'), value: viewItem.received_date },
                  { label: t('السكن المتوقع', 'Expected move-in'), value: viewItem.expected_start },
                  { label: t('طريقة الاستلام', 'Method'), value: methodLabel(viewItem.method, isAr) },
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

              {viewItem.source === 'unit' && (
                <p className="text-[11px] font-medium rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: 'rgba(27,43,75,0.05)', color: '#1B2B4B' }}>
                  {t(
                    'سند مسجَّل تلقائياً من حقل التأمين في الوحدة — يتحدّث معها ولا يُحذف من هنا.',
                    'Auto-synced from the unit deposit field.',
                  )}
                </p>
              )}

              <p className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
                {t(
                  'الإرجاع والخصم من التأمين يتمّان من صفحة الاسترجاعات والخصومات، وهناك يُسجَّل السبب واسم المستأجر وبيانات العقد.',
                  'Refunds and deductions are done from the Refunds page.',
                )}
              </p>

              <div className="flex gap-2">
                {isAdmin && viewItem.source !== 'unit' && (
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
              <DialogTitle className="text-base">{t('تسجيل تأمين جديد', 'Receive Deposit')}</DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 py-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl px-3"
                style={{
                  minHeight: 44,
                  backgroundColor: future ? 'rgba(201,168,76,0.1)' : '#F8FAFC',
                  border: `1px solid ${future ? 'rgba(201,168,76,0.4)' : '#E2E8F0'}`,
                }}>
                <input type="checkbox" checked={future}
                  onChange={e => { setFuture(e.target.checked); setForm(f => ({ ...f, expected_start: '' })); }}
                  className="w-4 h-4" style={{ accentColor: '#C9A84C' }} />
                <span className="text-xs font-medium" style={{ color: '#374151' }}>
                  {t('المستأجر سيسكن لاحقاً — الوحدة لم تُسلَّم بعد', 'Tenant will move in later')}
                </span>
              </label>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('اختر الوحدة *', 'Select Unit *')}</Label>
                <MobileDrawerSelect
                  value={form.unit_number ? `${form.property_type}::${form.unit_number}` : ''}
                  onValueChange={pickUnit}
                  placeholder={t('اختر وحدة...', 'Select unit...')}
                  triggerClassName="text-sm w-full"
                  dir={isAr ? 'rtl' : 'ltr'}
                  options={allUnits.filter(u => u._type === prop).map(u => ({
                    value: `${u._type}::${u.unit_number}`,
                    label: `${u.unit_number}${u.floor ? ' · ' + u.floor : ''}`,
                  }))}
                />
                <p className="text-[11px] pt-1" style={{ color: '#94A3B8' }}>
                  {t(
                    'القائمة تعرض أرقام الوحدات فقط — التأمين يُسجَّل باسم من دفعه لا باسم ساكن الوحدة الحالي.',
                    'Units are listed by number only — the deposit is booked under whoever paid it.',
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {t('اسم من دفع التأمين', 'Paid by')}
                </Label>
                <Input value={form.tenant_name}
                  onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))}
                  placeholder={t('اكتب اسم المستأجر صاحب هذا التأمين', 'Name of the tenant who paid')}
                  className="text-sm" style={{ minHeight: 44 }} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('المبلغ *', 'Amount *')}</Label>
                  <Input type="number" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('تاريخ الاستلام *', 'Received *')}</Label>
                  <Input type="date" value={form.received_date}
                    onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>
              </div>

              {future && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('تاريخ السكن المتوقع *', 'Expected move-in *')}</Label>
                  <Input type="date" value={form.expected_start}
                    onChange={e => setForm(f => ({ ...f, expected_start: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t('طريقة الاستلام', 'Method')}</Label>
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
                <Label className="text-xs font-semibold text-muted-foreground">{t('سند الاستلام', 'Receipt')}</Label>
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

              {form.method === 'cheque' && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)' }}>
                  <FileCheck2 size={14} style={{ color: '#C9A84C', marginTop: 2 }} />
                  <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#8A6D1F' }}>
                    {t(
                      'شيك تأمين — يُسجَّل في بطاقة «شيكات التأمين» منفصلاً، ولا يُجمع مع التأمينات النقدية.',
                      'Deposit cheque — tracked separately and not summed with cash deposits.',
                    )}
                  </p>
                </div>
              )}

              <div className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
                style={{ backgroundColor: 'rgba(42,157,143,0.07)', color: '#1B2B4B' }}>
                {t(
                  'هذا المبلغ أمانة لدى المالك — لا يُضاف إلى الإيراد ولا يرفع هامش الربح، ولا يتحوّل إلى إيراد إلا عند خصم جزء منه فعلياً من صفحة الاسترجاعات والخصومات.',
                  'Held in trust — not revenue until actually deducted from the Refunds page.',
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
                  className="flex-1 text-white" style={{ backgroundColor: '#2A9D8F', minHeight: 44 }}>
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

      <Dialog open={!!dedView} onOpenChange={(v) => { if (!v) setDedView(null); }}>
        <DialogContent className="max-w-md w-full" dir={isAr ? 'rtl' : 'ltr'}
          style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader className="flex-shrink-0 pb-2 border-b">
            <DialogTitle className="text-base">{t('تفاصيل الحركة', 'Record details')}</DialogTitle>
          </DialogHeader>
          {dedView && (() => {
            const box = unitDeposit(dedView.property_type, dedView.unit_number);
            return (
              <div className="overflow-y-auto flex-1 py-3 space-y-3">
                <div className="rounded-xl p-4 text-center"
                  style={{ backgroundColor: `${destColor(dedView.destination)}0F`, border: `1px solid ${destColor(dedView.destination)}44` }}>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{destLabel(dedView.destination, isAr)}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: destColor(dedView.destination) }}>
                    − {fmtNum(dedView.amount || 0)} {currency}
                  </p>
                  {dedView.receipt_number && (
                    <p className="text-[11px] mt-2 font-mono" style={{ color: '#94A3B8' }} dir="ltr">{dedView.receipt_number}</p>
                  )}
                </div>

                <div className="rounded-xl p-3 space-y-2"
                  style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                  {[
                    { label: t('العقار', 'Property'), value: propLabel(dedView.property_type, isAr) },
                    { label: t('الوحدة', 'Unit'), value: dedView.unit_number },
                    { label: t('المستأجر', 'Tenant'), value: dedView.tenant_name },
                    { label: t('التاريخ', 'Date'), value: dedView.deduction_date, raw: true },
                    { label: t('السبب', 'Reason'), value: dedView.reason },
                    { label: t('الشهر المستحق', 'Due month'), value: dedView.due_months },
                    { label: t('الطريقة', 'Method'), value: methodLabel(dedView.method, isAr) },
                    { label: t('ملاحظات', 'Notes'), value: dedView.notes },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="flex justify-between gap-2 text-xs">
                      <span style={{ color: '#94A3B8' }}>{r.label}</span>
                      <span className="font-medium text-left" style={{ color: '#1B2B4B' }} dir={r.raw ? 'ltr' : undefined}>{r.value}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-3 space-y-1.5"
                  style={{ backgroundColor: 'rgba(42,157,143,0.06)', border: '1px solid rgba(42,157,143,0.3)' }}>
                  <p className="text-[11px] font-bold" style={{ color: '#2A9D8F' }}>
                    {t(`ملخص تأمين الوحدة ${dedView.unit_number}`, `Unit ${dedView.unit_number} deposit summary`)}
                  </p>
                  {[
                    { l: t('المستلَم نقداً', 'Received'), v: fmtNum(box.received), c: '#1B2B4B' },
                    { l: t('المخصوم', 'Deducted'), v: '− ' + fmtNum(box.cut), c: box.cut > 0 ? '#7C3AED' : '#94A3B8' },
                    { l: t('المُرجَع للمستأجر', 'Returned'), v: '− ' + fmtNum(box.back), c: box.back > 0 ? '#0EA5E9' : '#94A3B8' },
                  ].map(r => (
                    <div key={r.l} className="flex justify-between gap-2 text-[11px]">
                      <span style={{ color: '#94A3B8' }}>{r.l}</span>
                      <span className="font-bold" style={{ color: r.c }}>{r.v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: 'rgba(42,157,143,0.2)' }}>
                    <span className="font-bold" style={{ color: '#1B2B4B' }}>{t('الرصيد المتبقي', 'Remaining balance')}</span>
                    <span className="font-bold" style={{ color: box.balance > 0 ? '#2A9D8F' : '#94A3B8' }}>{fmtNum(box.balance)} {currency}</span>
                  </div>
                </div>

                {dedView.receipt_image_url && (
                  <a href={dedView.receipt_image_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl border py-3 text-xs font-bold"
                    style={{ borderColor: 'rgba(201,168,76,0.45)', color: '#C9A84C', minHeight: 44 }}>
                    <FileImage size={15} />
                    {t('فتح المرفق', 'Open attachment')}
                  </a>
                )}

                <Button variant="outline" onClick={() => setDedView(null)} className="w-full" style={{ minHeight: 44 }}>
                  {t('إغلاق', 'Close')}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <Dialog open={dedOpen} onOpenChange={o => { setDedOpen(o); if (!o) setInlineError(''); }}>
          <DialogContent className="max-w-md w-full" dir={isAr ? 'rtl' : 'ltr'}
            style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DialogHeader className="flex-shrink-0 pb-2 border-b">
              <DialogTitle className="text-base">{t('استرجاع التأمين أو خصم', 'Deposit Refund / Deduction')}</DialogTitle>
            </DialogHeader>

            {ded && (
              <div className="overflow-y-auto flex-1 py-3 space-y-3">
                <div className="flex gap-1.5 p-1 rounded-xl" style={{ backgroundColor: '#F1F5F9' }}>
                  {[
                    { k: 'return', label: t('استرجاع', 'Refund'), color: '#0EA5E9', Icon: RotateCcw },
                    { k: 'deduction', label: t('خصم', 'Deduction'), color: '#7C3AED', Icon: MinusCircle },
                  ].map(m => {
                    const on = ded.mode === m.k;
                    return (
                      <button key={m.k}
                        onClick={() => setDed(d => ({
                          ...d, mode: m.k,
                          destination: m.k === 'return' ? 'tenant_return' : '',
                          due_months: '',
                        }))}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition"
                        style={{ minHeight: 40, backgroundColor: on ? m.color : 'transparent', color: on ? '#fff' : '#64748B' }}>
                        <m.Icon size={15} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('الوحدة *', 'Unit *')}</Label>
                  <MobileDrawerSelect
                    value={ded.unit_number ? `${ded.property_type}::${ded.unit_number}` : ''}
                    onValueChange={pickDedUnit}
                    placeholder={t('اختر وحدة...', 'Select unit...')}
                    triggerClassName="text-sm w-full"
                    dir={isAr ? 'rtl' : 'ltr'}
                    options={rows.filter(u => u._type === prop && u.balance > 0).map(u => ({
                      value: `${u._type}::${u.unit_number}`,
                      label: `${u.unit_number} — ${fmtNum(u.balance)} ${currency}`,
                    }))}
                  />
                </div>

                <div className="rounded-xl p-3 space-y-1.5"
                  style={{
                    backgroundColor: dedBalance.hasDeposit ? 'rgba(42,157,143,0.07)' : 'rgba(230,57,70,0.07)',
                    border: `1px solid ${dedBalance.hasDeposit ? 'rgba(42,157,143,0.3)' : 'rgba(230,57,70,0.3)'}`,
                  }}>
                  {!ded.unit_number ? (
                    <p className="text-[11px] font-medium" style={{ color: '#64748B' }}>
                      {t('اختر الوحدة لعرض رصيد تأمينها', 'Select a unit to see its balance')}
                    </p>
                  ) : !dedBalance.hasDeposit ? (
                    <p className="text-xs font-bold" style={{ color: '#E63946' }}>
                      {t('لا يوجد تأمين مسجَّل لهذه الوحدة', 'No deposit recorded for this unit')}
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between gap-2 text-[11px]">
                        <span style={{ color: '#94A3B8' }}>{t('الرصيد المتاح', 'Available')}</span>
                        <span className="font-medium" style={{ color: '#1B2B4B' }}>{fmtNum(dedBalance.balance)}</span>
                      </div>
                      {dedAmount > 0 && (
                        <div className="flex justify-between gap-2 text-[11px]">
                          <span style={{ color: '#7C3AED' }}>{ded.mode === 'return' ? t('المبلغ المسترجَع', 'Refunded now') : t('المبلغ المخصوم', 'Deducted now')}</span>
                          <span className="font-bold" style={{ color: '#7C3AED' }}>− {fmtNum(dedAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: 'rgba(42,157,143,0.2)' }}>
                        <span className="font-bold" style={{ color: '#1B2B4B' }}>{t('الرصيد بعد العملية', 'Balance after')}</span>
                        <span className="font-bold" style={{ color: '#2A9D8F' }}>
                          {fmtNum(Math.max(0, dedBalance.balance - dedAmount))} {currency}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {ded.mode === 'return' ? t('المبلغ المسترجَع *', 'Refund amount *') : t('المبلغ المخصوم *', 'Deducted amount *')}
                    </Label>
                    <Input type="number" value={ded.amount}
                      onChange={e => setDed(d => ({ ...d, amount: e.target.value }))}
                      className="text-sm" style={{ minHeight: 44 }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">{t('التاريخ *', 'Date *')}</Label>
                    <Input type="date" value={ded.deduction_date}
                      onChange={e => setDed(d => ({ ...d, deduction_date: e.target.value }))}
                      className="text-sm" style={{ minHeight: 44 }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {ded.mode === 'return' ? t('سبب الاسترجاع *', 'Refund reason *') : t('سبب الخصم *', 'Deduction reason *')}
                  </Label>
                  <Input value={ded.reason}
                    onChange={e => setDed(d => ({ ...d, reason: e.target.value }))}
                    placeholder={ded.mode === 'return'
                      ? t('مثال: إخلاء الوحدة وانتهاء العقد', 'e.g. unit vacated, contract ended')
                      : t('مثال: تصليح باب المطبخ · فاتورة كهرباء متأخرة', 'e.g. kitchen door repair')}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>

                {ded.mode === 'return' ? (
                  <p className="text-[11px] leading-relaxed rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.25)', color: '#0369A1' }}>
                    {t('ردّ التأمين أو جزء منه إلى المستأجر عند إخلاء الوحدة — ينقص الرصيد المحفوظ ولا يمسّ الإيراد ولا المصاريف.',
                      'Deposit handed back to the tenant — reduces the held balance with no P&L effect.')}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">{t('وجهة المبلغ المخصوم *', 'Where does it go? *')}</Label>
                    {DEDUCTION_DESTINATIONS.filter(o => o.group === 'deduction').map(o => {
                      const on = ded.destination === o.value;
                      return (
                        <button key={o.value}
                          onClick={() => setDed(d => ({ ...d, destination: o.value, due_months: '' }))}
                          className="w-full text-right rounded-xl border px-3 py-2.5 transition"
                          style={{
                            backgroundColor: on ? `${o.color}12` : '#fff',
                            borderColor: on ? o.color : '#E2E8F0',
                          }}>
                          <span className="block text-sm font-bold" style={{ color: on ? o.color : '#1B2B4B' }}>
                            {o.label[isAr ? 'ar' : 'en']}
                          </span>
                          <span className="block text-[11px] leading-relaxed mt-0.5" style={{ color: '#94A3B8' }}>
                            {o.hint[isAr ? 'ar' : 'en']}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {ded.destination === 'payment' && (
                  <div className="rounded-xl p-3 space-y-2"
                    style={{ backgroundColor: 'rgba(42,157,143,0.06)', border: '1px solid rgba(42,157,143,0.25)' }}>
                    <p className="text-[11px] font-bold" style={{ color: '#2A9D8F' }}>
                      {t('تفاصيل الدفعة', 'Payment details')}
                      <span className="font-normal" style={{ color: '#94A3B8' }}>
                        {' — '}{fmtNum(dedAmount)} {currency}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">{t('الشهر المستحق *', 'Due month *')}</Label>
                        <Input value={ded.due_months}
                          onChange={e => setDed(d => ({ ...d, due_months: e.target.value }))}
                          placeholder={t('مثال: 8 أو 8/9', 'e.g. 8')}
                          className="text-sm bg-white" style={{ minHeight: 40 }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">{t('طريقة الدفعة', 'Method')}</Label>
                        <MobileDrawerSelect
                          value={ded.method}
                          onValueChange={v => setDed(d => ({ ...d, method: v }))}
                          triggerClassName="text-sm w-full bg-white"
                          dir={isAr ? 'rtl' : 'ltr'}
                          options={PAY_METHODS.map(m => ({ value: m.value, label: m.label[isAr ? 'ar' : 'en'] }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">{t('اسم المستأجر في الدفعة', 'Tenant on the payment')}</Label>
                      <Input value={ded.tenant_name}
                        onChange={e => setDed(d => ({ ...d, tenant_name: e.target.value }))}
                        className="text-sm bg-white" style={{ minHeight: 40 }} />
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
                      {t('يُنشأ سند دفعة في سجل الدفعات بملاحظة «محسوم من التأمين» ويدخل الإيراد.',
                         'A payment voucher is created and counted as revenue.')}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{t('ملاحظات', 'Notes')}</Label>
                  <Input value={ded.notes}
                    onChange={e => setDed(d => ({ ...d, notes: e.target.value }))}
                    className="text-sm" style={{ minHeight: 44 }} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {ded.mode === 'return' ? t('سند الاستلام', 'Handover receipt') : t('الإيصال / الفاتورة', 'Receipt / Invoice')}
                  </Label>
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
                        {uploading
                          ? t('جاري الرفع...', 'Uploading...')
                          : ded.mode === 'return'
                            ? t('إرفاق سند استلام موقَّع من المستأجر', 'Attach a receipt signed by the tenant')
                            : t('إرفاق فاتورة التصليح أو الإيصال', 'Attach the repair invoice or receipt')}
                      </span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
                    </label>
                  )}
                </div>

                <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                  style={{ backgroundColor: 'rgba(27,43,75,0.04)' }}>
                  <span className="text-xs font-medium" style={{ color: '#64748B' }}>
                    {ded.mode === 'return' ? t('الرصيد بعد الاسترجاع', 'Balance after refund') : t('الرصيد بعد الخصم', 'Balance after deduction')}
                  </span>
                  <span className="text-base font-bold" style={{ color: '#2A9D8F' }}>
                    {fmtNum(Math.max(0, dedBalance.balance - dedAmount))} {currency}
                  </span>
                </div>

                {inlineError && (
                  <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)' }}>
                    <AlertTriangle size={14} style={{ color: '#E63946', marginTop: 2 }} />
                    <p className="text-xs font-medium" style={{ color: '#E63946' }}>{inlineError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleDedSave} disabled={saving || uploading}
                    className="flex-1 text-white"
                    style={{ backgroundColor: ded.mode === 'return' ? '#0EA5E9' : '#7C3AED', minHeight: 44 }}>
                    <CheckCircle2 size={15} className="ml-1" />
                    {saving
                      ? t('جاري الحفظ...', 'Saving...')
                      : ded.mode === 'return' ? t('حفظ الاسترجاع', 'Save refund') : t('حفظ الخصم', 'Save deduction')}
                  </Button>
                  <Button variant="outline" onClick={() => setDedOpen(false)} className="flex-1" style={{ minHeight: 44 }}>
                    {t('إلغاء', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

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
