import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, Building2, FileImage, Upload, Wallet, X } from 'lucide-react';
import { base44, supabase, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import useGoBack from '@/hooks/useGoBack';
import { formatPhone } from '@/utils/phone';
import { arrearsLeft, getContractArchive, listContractArchive } from '@/utils/contractArchive';
import { ARREARS_NOTE, contractPeriods, exitPaymentName, isArrearsPayment, localDay, splitWithCarryOver } from '@/utils/contractPeriods';
import { PAY_METHODS, destColor, destLabel, fmtNum, kindColor, kindLabel, methodLabel } from '@/utils/settlementCalc';
import { logActivity } from '@/utils/activityLogger';
import { ArchiveReason } from '@/components/ContractArchive';
import MobileDrawerSelect from '@/components/MobileDrawerSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PLANS = {
  monthly: { ar: 'شهري', en: 'Monthly' },
  quarterly: { ar: 'كل 3 أشهر', en: 'Quarterly' },
  five_annual: { ar: '5 دفعات سنوياً', en: '5x Annually' },
  biannual: { ar: 'كل 6 أشهر', en: 'Biannual' },
  annual: { ar: 'سنوي', en: 'Annual' },
};

const sumOf = (rows) => rows.reduce((t, x) => t + (Number(x.amount) || 0), 0);

const ARREARS_DUE = 'متأخرات عند الخروج';

async function loadArchive(archiveId) {
  try {
    const row = await getContractArchive(archiveId);
    if (!row) return { row: null };
    const prop = row.property_type;
    const unit = String(row.unit_number);
    const payTable = prop === 'real_estate' ? 're_payments' : 'payments';
    const unitTable = prop === 'real_estate' ? 're_units' : 'units_masked';
    const [siblings, pays, deps, deds, refs, unitRow] = await Promise.all([
      listContractArchive(prop, unit),
      supabase.from(payTable).select('*').eq('unit_number', unit).order('payment_date', { ascending: false }),
      supabase.from('deposits').select('*').eq('property_type', prop).eq('unit_number', unit).order('received_date', { ascending: false }),
      supabase.from('deposit_deductions').select('*').eq('property_type', prop).eq('unit_number', unit).order('deduction_date', { ascending: false }),
      supabase.from('refunds').select('*').eq('property_type', prop).eq('unit_number', unit).order('refund_date', { ascending: false }),
      supabase.from(unitTable).select('id, tenant_name').eq('unit_number', unit).limit(1),
    ]);
    return {
      row,
      siblings,
      payments: pays.data || [],
      deposits: deps.data || [],
      deductions: deds.data || [],
      refunds: refs.data || [],
      unitExists: !!unitRow.data?.length,
      unitTenant: unitRow.data?.[0]?.tenant_name || '',
      error: pays.error?.message || '',
    };
  } catch (e) {
    return { row: null, error: e?.message || '' };
  }
}

export default function ContractArchiveDetails() {
  const { archiveId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const base = pathname.startsWith('/re-units') ? '/re-units' : '/units';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: '', date: '', method: 'cash', receipt: '' });
  const [paySaving, setPaySaving] = useState(false);
  const [payUploading, setPayUploading] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadArchive(archiveId).then(d => { if (live) { setData(d); setLoading(false); } });
    return () => { live = false; };
  }, [archiveId]);

  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const back = () => goBack(base === '/re-units' ? '/re-archive' : '/archive');

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  const c = data?.row;
  if (!c) return (
    <div className="text-center py-20 text-muted-foreground space-y-4">
      <Archive size={40} className="mx-auto" style={{ color: '#E2E8F0' }} />
      <p className="text-sm">{data?.error || (isAr ? 'العقد المؤرشف غير موجود' : 'Archived contract not found')}</p>
      <button onClick={back} className="text-sm font-semibold" style={{ color: '#1B2B4B', minHeight: 44 }}>
        {isAr ? '← رجوع' : '← Back'}
      </button>
    </div>
  );

  const split = (items, dayOf, nameOf) =>
    splitWithCarryOver(data.siblings, items, dayOf, x => x.created_at, nameOf, data.unitTenant);
  const mine = (items, dayOf, nameOf) => split(items, dayOf, nameOf).byArchive[c.id] || [];
  const paySplit = split(data.payments, p => p.payment_date, exitPaymentName);
  const payments = paySplit.byArchive[c.id] || [];
  const paidLater = (paySplit.carried[c.id] || []).filter(p => !p.status || p.status === 'paid');
  const arrearsPaid = paidLater.filter(isArrearsPayment);
  const deposits = mine(data.deposits, d => d.received_date, d => d.tenant_name);
  const deductions = mine(data.deductions, d => d.deduction_date, d => d.tenant_name);
  const refunds = mine(data.refunds, r => r.refund_date);
  const period = contractPeriods(data.siblings)[c.id];
  const totalPaid = sumOf(payments);
  const depositMoves = deposits.length + deductions.length + refunds.length;
  const { owed, left } = arrearsLeft(c, sumOf(paidLater));
  const depositLeft = sumOf(deposits.filter(d => d.method !== 'cheque')) - sumOf(deductions);
  const contractDeposit = Number(String(c.insurance || '').replace(/[^0-9.]/g, '')) || 0;
  const aed = (n) => `${Number(n || 0).toLocaleString()} ${isAr ? 'د.إ' : 'AED'}`;
  const canPay = user?.role === 'admin' || user?.role === 'data_entry';

  const openPay = () => {
    setPay({ amount: String(left), date: new Date().toISOString().split('T')[0], method: 'cash', receipt: '' });
    setPayError('');
    setPayOpen(true);
  };

  const uploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPayUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      setPay(p => ({ ...p, receipt: file_url }));
    } catch {
      setPayError(isAr ? 'تعذّر رفع الإيصال، حاول مجدداً.' : 'Could not upload the receipt. Try again.');
    } finally {
      setPayUploading(false);
    }
  };

  const savePay = async () => {
    const amount = Math.round((parseFloat(pay.amount) || 0) * 100) / 100;
    if (amount <= 0) { setPayError(isAr ? 'يُرجى إدخال المبلغ.' : 'Enter the amount.'); return; }
    if (amount > left + 0.001) {
      setPayError(isAr ? `المبلغ أكبر من المتبقي على المستأجر (${aed(left)}).` : `The amount is more than what is owed (${aed(left)}).`);
      return;
    }
    if (!pay.date) { setPayError(isAr ? 'يُرجى تحديد تاريخ الدفع.' : 'Set the payment date.'); return; }
    setPaySaving(true); setPayError('');
    try {
      const realEstate = c.property_type === 'real_estate';
      const record = {
        tenant_name: c.tenant_name,
        unit_number: c.unit_number,
        amount,
        payment_date: pay.date,
        due_months: ARREARS_DUE,
        payment_method: pay.method,
        status: 'paid',
        notes: ARREARS_NOTE,
        receipt_image_url: pay.receipt || null,
      };
      const created = await (realEstate ? base44.entities.RePayment : base44.entities.Payment).create(record);
      await logActivity(realEstate ? 'RePayment' : 'Payment', 'create',
        `${c.tenant_name || ''} - وحدة ${c.unit_number}`, null, record,
        `سداد متأخرات ${amount.toLocaleString()} AED بعد الخروج`, user);
      base44.entities.Notification.create({
        type: realEstate ? 're_payment' : 'payment',
        title: `سداد متأخرات — ${c.tenant_name || ''}`,
        amount,
        reference_id: created?.id || '',
        reference_data: record,
        is_read: false,
      }).catch(() => {});
      window.dispatchEvent(new Event('notifications-updated'));
      setPayOpen(false);
      setData(await loadArchive(archiveId));
    } catch (e) {
      setPayError(e?.message || (isAr ? 'تعذّر تسجيل الدفعة.' : 'Could not record the payment.'));
    } finally {
      setPaySaving(false);
    }
  };
  const plan = PLANS[c.payment_plan]?.[isAr ? 'ar' : 'en'] || c.payment_plan;
  const depositType = c.insurance ? methodLabel(c.insurance_type || 'cash', isAr) : '';
  const statusOf = {
    paid: { label: t('paid'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    pending: { label: t('pending'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    late: { label: t('late'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };
  const facts = [
    [isAr ? 'الهاتف' : 'Phone', c.owner_phone ? formatPhone(c.owner_phone) : '', true],
    [isAr ? 'الجنسية' : 'Nationality', c.nationality],
    [isAr ? 'الإيجار السنوي' : 'Annual Rent', c.annual_rent ? aed(c.annual_rent) : ''],
    [isAr ? 'التأمين' : 'Deposit', c.insurance ? `${c.insurance}${depositType ? ` · ${depositType}` : ''}` : ''],
    [isAr ? 'خطة الدفع' : 'Payment plan', plan],
    [isAr ? 'بداية العقد' : 'Contract start', c.contract_start],
    [isAr ? 'نهاية العقد' : 'Contract end', c.contract_end],
    [isAr ? 'تاريخ الأرشفة' : 'Archived on', localDay(c.created_at)],
    [isAr ? 'أرشفه' : 'Archived by', c.archived_by_name],
  ];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="bg-white card-bevel rounded-xl p-5">
        <div className="flex items-center gap-3">
          <button onClick={back} aria-label={isAr ? 'رجوع' : 'Back'}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground shrink-0">
            <BackIcon size={18} />
          </button>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1B2B4B' }}>
            <Archive size={22} color="#C9A84C" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate" style={{ color: '#1B2B4B' }}>{c.tenant_name || (isAr ? 'بدون مستأجر' : 'No tenant')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAr ? `الوحدة ${c.unit_number} · عقد مؤرشف` : `Unit ${c.unit_number} · archived contract`}
            </p>
          </div>
          <ArchiveReason c={c} isAr={isAr} pill />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
          {facts.map(([label, value, ltr]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium text-sm mt-1" style={{ color: value ? '#1B2B4B' : '#CBD5E1' }} dir={ltr ? 'ltr' : undefined}>{value || '—'}</p>
            </div>
          ))}
        </div>

        {c.note && (
          <p className="text-sm mt-4 pt-4 border-t border-border" style={{ color: '#374151' }}>
            <span className="text-muted-foreground">{isAr ? 'السبب: ' : 'Reason: '}</span>{c.note}
          </p>
        )}

        {(owed > 0 || depositMoves > 0 || c.settlement_note) && (
          <div className="rounded-lg border border-border mt-4">
            <p className="px-3 pt-2.5 pb-1 text-xs font-bold" style={{ color: '#1B2B4B' }}>
              {isAr ? 'المتأخرات والتأمين' : 'Arrears and deposit'}
            </p>
            {owed > 0 && <Line label={isAr ? 'متأخرات عند الخروج' : 'Arrears at exit'} amount={aed(owed)} color="#E63946" />}
            {arrearsPaid.map(p => (
              <Line key={`paid-${p.id}`} label={isAr ? 'سداد متأخرات بعد الخروج' : 'Arrears paid after exit'}
                sub={[p.payment_date, methodLabel(p.payment_method, isAr)].filter(Boolean).join(' · ')}
                amount={`− ${aed(p.amount)}`} color="#2A9D8F" />
            ))}
            {deposits.map(d => (
              <Line key={`dep-${d.id}`} label={isAr ? 'استلام تأمين' : 'Deposit received'}
                sub={[d.received_date, methodLabel(d.method, isAr), d.receipt_number ? `#${d.receipt_number}` : ''].filter(Boolean).join(' · ')}
                amount={aed(d.amount)} color="#2A9D8F" />
            ))}
            {deductions.map(d => (
              <Line key={`ded-${d.id}`} label={destLabel(d.destination, isAr)}
                sub={[d.deduction_date, d.reason, d.due_months].filter(Boolean).join(' · ')}
                amount={`− ${aed(d.amount)}`} color={d.destination === 'tenant_return' ? destColor(d.destination) : '#E63946'} />
            ))}
            {refunds.map(r => (
              <div key={`ref-${r.id}`}>
                <Line label={kindLabel(r.kind, isAr)}
                  sub={[r.refund_date, r.reason, methodLabel(r.method, isAr), r.receipt_number].filter(Boolean).join(' · ')}
                  amount={aed(r.amount)} color={kindColor(r.kind)} />
                <SettlementBreakdown r={r} isAr={isAr} deposit={contractDeposit} />
              </div>
            ))}
            {c.settlement_note && (
              <p className="px-3 py-1.5 text-xs leading-relaxed" style={{ color: '#374151' }}>
                <span className="font-bold">{isAr ? 'ملاحظة التسوية: ' : 'Settlement note: '}</span>{c.settlement_note}
              </p>
            )}
            {(owed > 0 || deposits.length > 0) && (
            <div className="border-t border-border mt-1 py-1">
              {owed > 0 && (
                <Line label={isAr ? 'المتبقي على المستأجر' : 'Still owed by the tenant'} amount={aed(left)}
                  color={left > 0 ? '#E63946' : '#2A9D8F'} bold />
              )}
              {deposits.length > 0 && (
                <Line label={isAr ? 'رصيد التأمين بعد الخروج' : 'Deposit left after exit'} amount={aed(depositLeft)} color="#1B2B4B" bold />
              )}
              {left > 0 && canPay && (
                <div className="px-3 pt-1.5 pb-1">
                  <Button onClick={openPay} className="w-full gap-1.5 text-white" style={{ backgroundColor: '#2A9D8F', minHeight: 44 }}>
                    <Wallet size={15} /> {isAr ? 'تسديد المتأخرات' : 'Pay the arrears'}
                  </Button>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {c.contract_image_url && (
          <a href={c.contract_image_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline mt-4 pt-4 border-t border-border" style={{ color: '#1B2B4B' }}>
            <FileImage size={15} style={{ color: '#C9A84C' }} /> {isAr ? 'عرض العقد' : 'View Contract'}
          </a>
        )}
      </div>

      {data.error && <p className="text-xs font-medium" style={{ color: '#E63946' }}>{data.error}</p>}

      <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ backgroundColor: '#1B2B4B' }}>
        <div className="min-w-0">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{isAr ? 'إجمالي دفعات هذا العقد' : 'Total paid on this contract'}</p>
          <p className="text-2xl font-bold" style={{ color: '#2A9D8F' }}>{totalPaid.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.5)' }}>{isAr ? 'د.إ' : 'AED'}</span></p>
          {period && (
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {isAr
                ? `من ${period.from || 'أول سجل للوحدة'} حتى ${period.to}`
                : `From ${period.from || 'the first unit record'} to ${period.to}`}
            </p>
          )}
        </div>
        <div className="text-center shrink-0">
          <p className="text-2xl font-bold" style={{ color: '#C9A84C' }}>{payments.length}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{isAr ? 'دفعة' : 'payments'}</p>
        </div>
      </div>

      <div className="bg-white card-bevel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#F8F9FA' }}>
              <tr>
                {[isAr ? 'التاريخ' : 'Date', isAr ? 'الدافع' : 'Paid by', isAr ? 'الشهر' : 'Month', isAr ? 'المبلغ' : 'Amount', isAr ? 'الحالة' : 'Status', ''].map((h, i) => (
                  <th key={i} className="text-start py-3 px-3 text-muted-foreground font-medium text-xs whitespace-nowrap border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const s = statusOf[p.status] || statusOf.paid;
                return (
                  <tr key={p.id} className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-[#F8F9FA]' : ''}`}>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{p.payment_date || '-'}</td>
                    <td className="py-2.5 px-3 text-xs font-medium max-w-[140px]"><span className="truncate block" style={{ color: '#1B2B4B' }}>{p.tenant_name || '-'}</span></td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{p.due_months || '-'}</td>
                    <td className="py-2.5 px-3 text-xs font-bold whitespace-nowrap" style={{ color: '#2A9D8F' }}>{Number(p.amount || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {p.receipt_image_url && (
                        <a href={p.receipt_image_url} target="_blank" rel="noopener noreferrer" title={isAr ? 'الإيصال' : 'Receipt'}
                          className="inline-flex p-1.5 rounded hover:bg-muted" style={{ color: '#C9A84C' }}>
                          <FileImage size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {payments.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {isAr ? 'لا توجد دفعات على هذا العقد' : 'No payments on this contract'}
            </div>
          )}
        </div>
      </div>

      {data.unitExists && (
        <button onClick={() => navigate(`${base}/${encodeURIComponent(c.unit_number)}`)}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted/30 transition-colors"
          style={{ minHeight: 44, color: '#1B2B4B' }}>
          <Building2 size={15} /> {isAr ? `صفحة الوحدة ${c.unit_number} والعقد الحالي` : `Unit ${c.unit_number} and its current contract`}
        </button>
      )}

      {user?.role === 'data_entry' && (
        <p className="text-[11px] text-muted-foreground">
          {isAr ? 'لا تظهر لك حركات التأمين لأنها للمالك وحده.' : 'Deposit records are visible to the owner only.'}
        </p>
      )}

      <Dialog open={payOpen} onOpenChange={o => { if (!paySaving) setPayOpen(o); }}>
        <DialogContent className="max-w-sm font-cairo" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-base">{isAr ? 'تسديد المتأخرات' : 'Pay the arrears'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl p-3 flex items-center justify-between gap-2"
              style={{ backgroundColor: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.25)' }}>
              <span className="text-xs min-w-0 truncate" style={{ color: '#64748B' }}>
                {isAr ? `المتبقي على ${c.tenant_name || 'المستأجر'}` : `Owed by ${c.tenant_name || 'the tenant'}`}
              </span>
              <span className="text-base font-bold shrink-0" style={{ color: '#E63946' }}>{aed(left)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? 'المبلغ *' : 'Amount *'}</Label>
                <Input type="number" inputMode="decimal" value={pay.amount}
                  onChange={e => setPay(p => ({ ...p, amount: e.target.value }))}
                  className="text-sm" style={{ minHeight: 44 }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? 'تاريخ الدفع *' : 'Payment date *'}</Label>
                <Input type="date" value={pay.date}
                  onChange={e => setPay(p => ({ ...p, date: e.target.value }))}
                  className="text-sm" style={{ minHeight: 44 }} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">{isAr ? 'طريقة الدفع' : 'Method'}</Label>
              <MobileDrawerSelect
                value={pay.method}
                onValueChange={v => setPay(p => ({ ...p, method: v }))}
                triggerClassName="text-sm w-full"
                dir={isAr ? 'rtl' : 'ltr'}
                options={PAY_METHODS.map(m => ({ value: m.value, label: m.label[isAr ? 'ar' : 'en'] }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">{isAr ? 'صورة الإيصال (اختيارية)' : 'Receipt image (optional)'}</Label>
              {pay.receipt ? (
                <div className="flex items-center justify-between rounded-xl border p-2 ps-3" style={{ borderColor: '#E2E8F0' }}>
                  <a href={pay.receipt} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm" style={{ color: '#1B2B4B' }}>
                    <FileImage size={16} style={{ color: '#C9A84C' }} />
                    {isAr ? 'تم الرفع' : 'Uploaded'}
                  </a>
                  <button type="button" onClick={() => setPay(p => ({ ...p, receipt: '' }))}
                    aria-label={isAr ? 'حذف الإيصال' : 'Remove the receipt'}
                    className="flex items-center justify-center rounded-lg" style={{ color: '#E63946', minHeight: 44, minWidth: 44 }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl cursor-pointer"
                  style={{ borderColor: 'rgba(201,168,76,0.4)', minHeight: 44 }}>
                  <Upload size={15} style={{ color: '#C9A84C' }} />
                  <span className="text-xs" style={{ color: '#C9A84C' }}>
                    {payUploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : (isAr ? 'إرفاق الإيصال' : 'Attach the receipt')}
                  </span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={uploadReceipt} />
                </label>
              )}
            </div>

            <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
              {isAr
                ? 'تُسجَّل دفعة في سجل الدفعات باسم المستأجر الخارج، وتدخل الإيراد بتاريخها، ولا تمسّ تنبيهات المستأجر الحالي. وتظهر في هذا العقد، وينقص بها المتبقي عليه.'
                : 'A payment is added to the payment ledger under the departed tenant’s name and counts as revenue on its date, without touching the current tenant’s alerts. It shows on this contract and reduces what is owed.'}
            </p>

            {payError && <p className="text-xs font-medium" style={{ color: '#E63946' }}>{payError}</p>}

            <div className="flex gap-2">
              <Button onClick={savePay} disabled={paySaving || payUploading}
                className="flex-1 text-white" style={{ backgroundColor: '#2A9D8F', minHeight: 44 }}>
                {paySaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تسجيل الدفعة' : 'Record the payment')}
              </Button>
              <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paySaving}
                className="flex-1" style={{ minHeight: 44 }}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettlementBreakdown({ r, isAr, deposit = 0 }) {
  const note = r.notes;
  const extra = r.computed_amount != null ? Math.round((Number(r.amount) - Number(r.computed_amount)) * 100) / 100 : 0;
  const extraIsDeposit = extra > 0 && deposit > 0 && Math.abs(extra - deposit) < 0.01;
  const hasCalc = r.computed_amount != null || Number(r.paid_total) > 0;
  const items = Array.isArray(r.deduction_items) ? r.deduction_items : [];
  if (!hasCalc && !items.length && !(Number(r.penalty_amount) > 0)) {
    return note ? <p className="px-3 pb-1.5 text-[11px] leading-relaxed text-muted-foreground">{note}</p> : null;
  }
  const facts = [
    [isAr ? 'المدفوع' : 'Paid', r.paid_total != null ? fmtNum(Number(r.paid_total)) : null],
    [isAr ? 'الفترة' : 'Period', r.period_start && r.period_end ? `${r.period_start} → ${r.period_end}` : null, true],
    [isAr ? 'تاريخ الخروج' : 'Exit date', r.exit_date, true],
    [isAr ? 'المعدل اليومي' : 'Daily rate', r.daily_rate != null ? fmtNum(Number(r.daily_rate)) : null],
    [isAr ? 'المستهلَك' : 'Consumed', r.consumed_amount != null ? fmtNum(Number(r.consumed_amount)) : null],
  ].filter(([, v]) => v != null && v !== '' && v !== '0');
  return (
    <div className="mx-3 mb-2 rounded-lg px-3 py-2 space-y-1.5" style={{ backgroundColor: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
      {hasCalc && <p className="text-[11px] font-bold" style={{ color: '#7C3AED' }}>{r.kind === 'expiry' ? (isAr ? 'حسبة انتهاء العقد' : 'Contract end calculation') : (isAr ? 'حسبة الخروج المبكر' : 'Early exit calculation')}</p>}
      {facts.map(([label, value, ltr]) => (
        <div key={label} className="flex justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-end" style={{ color: '#1B2B4B' }} dir={ltr ? 'ltr' : undefined}>{value}</span>
        </div>
      ))}
      {(Number(r.penalty_amount) > 0 || items.length > 0) && (
        <div className="rounded-md px-2.5 py-2 space-y-1" style={{ backgroundColor: 'rgba(230,57,70,0.05)', border: '1px solid rgba(230,57,70,0.2)' }}>
          <p className="text-[11px] font-bold" style={{ color: '#E63946' }}>{isAr ? 'أسباب الخصم' : 'Deduction reasons'}</p>
          {Number(r.penalty_amount) > 0 && (
            <div className="flex justify-between gap-3 text-xs">
              <span className="leading-relaxed" style={{ color: '#64748B' }}>{r.penalty_reason || (isAr ? 'بدون سبب مكتوب' : 'No reason given')}</span>
              <span className="font-bold whitespace-nowrap" style={{ color: '#E63946' }}>− {fmtNum(Number(r.penalty_amount))}</span>
            </div>
          )}
          {items.map((it, i) => (
            <div key={`di-${i}`} className="flex justify-between gap-3 text-xs">
              <span className="leading-relaxed" style={{ color: '#64748B' }}>{it.reason}</span>
              <span className="font-bold whitespace-nowrap" style={{ color: '#E63946' }}>− {fmtNum(Number(it.amount))}</span>
            </div>
          ))}
        </div>
      )}
      {r.computed_amount != null && (
        <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
          <span className="font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الصافي المحسوب' : 'Computed net'}</span>
          <span className="font-bold" style={{ color: '#7C3AED' }}>{fmtNum(Number(r.computed_amount))}</span>
        </div>
      )}
      {extra > 0 && (
        <>
          <div className="flex justify-between gap-2 text-xs">
            <span style={{ color: '#64748B' }}>
              {extraIsDeposit
                ? (isAr ? 'ردّ التأمين إلى المستأجر' : 'Deposit returned to the tenant')
                : (isAr ? 'مبلغ مضاف إلى الصافي' : 'Amount added to the net')}
            </span>
            <span className="font-bold" style={{ color: '#2A9D8F' }}>+ {fmtNum(extra)}</span>
          </div>
          <div className="flex justify-between gap-2 text-xs pt-1 border-t" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
            <span className="font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'المبلغ المُعاد للمستأجر' : 'Paid back to the tenant'}</span>
            <span className="font-bold" style={{ color: '#7C3AED' }}>{fmtNum(Number(r.amount))}</span>
          </div>
        </>
      )}
      {note && <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{note}</p>}
    </div>
  );
}

function Line({ label, sub, amount, color, bold }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs">
      <span className="min-w-0 leading-relaxed">
        <span className={bold ? 'font-bold' : 'font-medium'} style={{ color: '#374151' }}>{label}</span>
        {sub && <span className="text-muted-foreground"> · {sub}</span>}
      </span>
      <span className="font-bold whitespace-nowrap" style={{ color }}>{amount}</span>
    </div>
  );
}
