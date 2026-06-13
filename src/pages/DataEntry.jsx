import { useState, useRef, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { PlusCircle, CheckCircle2, CreditCard, Camera, X, ImagePlus, Clock, AlertTriangle, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PLAN_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 };

function calcSmartArrears(alert, paidNow) {
  const monthly = Number(alert.original_amount || 0);
  const remaining = Number(alert.remaining_balance ?? monthly);
  const paid = Number(paidNow) || 0;
  const newBalance = Math.max(0, remaining - paid);
  return { monthly, remaining, newBalance };
}

const emptyPayment = {
  tenant_name: '', unit_number: '', amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  due_months: '', payment_method: '', receipt_number: '', notes: '', status: 'paid',
};

export default function DataEntry() {
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [paymentImage, setPaymentImage] = useState(null);
  const [uploadingP, setUploadingP] = useState(false);
  const [units, setUnits] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const paymentFileRef = useRef();
  const { t } = useLang();
  const { user } = useAuth();

  useEffect(() => {
    base44.entities.Unit.list().then(data => {
      const sorted = data.sort((a, b) => (parseInt(a.unit_number) || 0) - (parseInt(b.unit_number) || 0));
      setUnits(sorted);
    });
  }, []);

  const paymentMethods = {
    cash: t('cash'), bank_transfer: t('bank_transfer'), cheque: t('cheque'), other: t('other')
  };

  const setP = (k, v) => setPaymentForm(f => ({ ...f, [k]: v }));

  const handleUnitSelect = async (unitNumber) => {
    if (unitNumber === 'none') {
      setPaymentForm(f => ({ ...f, unit_number: '', amount: '' }));
      setActiveAlert(null);
      return;
    }
    const unit = units.find(u => u.unit_number === unitNumber);
    setPaymentForm(f => ({
      ...f,
      unit_number: unitNumber,
      tenant_name: unit?.tenant_name || f.tenant_name,
      amount: '',
    }));
    // fetch active alert for this unit
    setAlertLoading(true);
    setActiveAlert(null);
    try {
      const alerts = await base44.entities.PaymentAlert.filter({ unit_number: unitNumber });
      const alert = alerts?.find(a => a.status === 'active' || a.status === 'overdue') || null;
      setActiveAlert(alert);
      // لا نملأ المبلغ تلقائياً — المستخدم يختار
    } catch {}
    setAlertLoading(false);
  };

  const [errorMsg, setErrorMsg] = useState('');
  const showSuccess = (msg) => {
    setSuccess(msg);
    setErrorMsg('');
    setTimeout(() => setSuccess(''), 4000);
  };
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingP(true);
    const { file_url } = await uploadFile(file);
    setPaymentImage(file_url);
    setUploadingP(false);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const paidAmount = parseFloat(paymentForm.amount) || 0;

    // validation
    const errors = [];
if (!paymentForm.tenant_name.trim()) errors.push('اسم المستأجر');
if (!paidAmount || paidAmount <= 0) errors.push('المبلغ');
if (!paymentForm.payment_date) errors.push('تاريخ الدفعة');
if (!paymentForm.payment_method) errors.push('طريقة الدفع*.');
if (!paymentForm.due_months.trim()) errors.push('الأشهر المستحقة*.');
if (!paymentImage) errors.push('صورة الإيصال');

if (errors.length > 0) {
  return showError(`يرجى إكمال: ${errors.join(' · ')}`);
}

    setSaving(true);
    const data = { ...paymentForm, amount: paidAmount, receipt_image_url: paymentImage || '' };

    

    const created = await base44.entities.Payment.create({
      tenant_name: data.tenant_name || '',
      unit_number: data.unit_number || '',
      amount: data.amount,
      payment_date: data.payment_date || '',
      due_months: data.due_months || '',
      payment_method: data.payment_method || '',
      receipt_number: data.receipt_number || '',
      notes: data.notes || '',
      status: data.status || 'paid',
      receipt_image_url: data.receipt_image_url,
      created_by: user?.id || '',
    });

    // سجّل في سجل العمليات
    base44.functions.invoke('logActivity', {
      action: 'create',
      entity_type: 'Payment',
      entity_id: created?.id || '',
      entity_label: `دفعة ${data.tenant_name} - وحدة ${data.unit_number || ''}`,
      changes_summary: `إضافة دفعة ${paidAmount.toLocaleString()} AED`,
      performed_by_name: user?.full_name || '',
      performed_by_id: user?.id || '',
      performed_by_role: user?.role || '',
      new_data: data,
    }).catch(() => {});

    // update alert balance via backend function (handles permission)
    if (activeAlert) {
      await base44.functions.invoke('updateAlertBalance', {
        alert_id: activeAlert.id,
        paid_amount: paidAmount,
        payment_date: data.payment_date,
      });
      setActiveAlert(null);
    }

    setSaving(false);
    setPaymentForm({ ...emptyPayment, payment_date: new Date().toISOString().split('T')[0] });
    setPaymentImage(null);
    showSuccess('تم تسجيل الدفعة بنجاح ✓');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('dataEntryTitle')}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Data Entry</p>
      </div>



      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {/* Payment Form */}
      <form onSubmit={handlePaymentSubmit} className="bg-white card-bevel rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard size={18} style={{ color: '#1B2B4B' }} />
          <h2 className="font-bold text-base" style={{ color: '#1B2B4B' }}>{t('registerPaymentTab')}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>{t('unitNumber')}</Label>
            <Select value={paymentForm.unit_number || 'none'} onValueChange={handleUnitSelect}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الوحدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون وحدة —</SelectItem>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.unit_number}>
                    {u.unit_number}{u.tenant_name ? ` — ${u.tenant_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t('tenantName')} *</Label>
            <Input required value={paymentForm.tenant_name} onChange={e => setP('tenant_name', e.target.value)} />
          </div>
          {/* Smart Arrears Card */}
          {alertLoading && (
            <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Clock size={14} className="animate-spin" /> جاري حساب المتأخرات...
            </div>
          )}
          {activeAlert && !alertLoading && (() => {
            const { monthly, remaining, newBalance } = calcSmartArrears(activeAlert, paymentForm.amount);
            const overdueAmt = Math.max(0, remaining - monthly);
            return (
              <div className="col-span-2 rounded-xl p-3 space-y-2.5 border" style={{ backgroundColor: 'rgba(230,57,70,0.04)', borderColor: 'rgba(230,57,70,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={15} style={{ color: '#E63946' }} />
                  <span className="font-bold text-sm" style={{ color: '#E63946' }}>حسبة ذكية للمتأخرات</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(27,43,75,0.06)' }}>
                    <p className="text-muted-foreground">الشهري</p>
                    <p className="font-bold mt-0.5" style={{ color: '#1B2B4B' }}>{monthly.toLocaleString()}</p>
                  </div>
                  {overdueAmt > 0 && (
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(230,57,70,0.1)' }}>
                      <p className="text-muted-foreground">متأخرات</p>
                      <p className="font-bold mt-0.5" style={{ color: '#E63946' }}>{overdueAmt.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(201,168,76,0.12)' }}>
                    <p className="text-muted-foreground">الإجمالي المستحق</p>
                    <p className="font-bold mt-0.5" style={{ color: '#C9A84C' }}>{remaining.toLocaleString()}</p>
                  </div>
                </div>
                {Number(paymentForm.amount) > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t" style={{ borderColor: 'rgba(230,57,70,0.15)' }}>
                    <span className="text-muted-foreground flex items-center gap-1"><Calculator size={12} /> الرصيد بعد الدفع</span>
                    <span className="font-bold" style={{ color: newBalance <= 0 ? '#2A9D8F' : '#E63946' }}>
                      {newBalance <= 0 ? '✓ مسدد بالكامل' : `${newBalance.toLocaleString()} AED متبقي`}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap pt-0.5">
                  <button type="button" onClick={() => setP('amount', remaining)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ backgroundColor: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>
                    سداد الكل ({remaining.toLocaleString()})
                  </button>
                  <button type="button" onClick={() => setP('amount', monthly)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ backgroundColor: 'rgba(27,43,75,0.08)', color: '#1B2B4B' }}>
                    شهري فقط ({monthly.toLocaleString()})
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <Label>{t('amount')} * (AED) *</Label>
            <Input required type="number" min="0" value={paymentForm.amount} onChange={e => setP('amount', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('date')} *</Label>
            <Input required type="date" value={paymentForm.payment_date} onChange={e => setP('payment_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('dueMonths')} *</Label>
            <Input value={paymentForm.due_months} onChange={e => setP('due_months', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('paymentMethod')}</Label>
            <select value={paymentForm.payment_method} onChange={e => setP('payment_method', e.target.value)}
              className="w-full h-9 border border-input rounded-md px-3 text-sm bg-transparent">
              <option value="">— اختر —</option>
              <option value="cash">{t('cash')}</option>
              <option value="bank_transfer">{t('bank_transfer')}</option>
              <option value="cheque">{t('cheque')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('receiptNumber')}</Label>
            <Input value={paymentForm.receipt_number} onChange={e => setP('receipt_number', e.target.value)} placeholder="REC-001" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t('notes')}</Label>
            <Input value={paymentForm.notes} onChange={e => setP('notes', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t('receiptImage')} *</Label>
            {paymentImage ? (
              <div className="relative w-full rounded-lg overflow-hidden border border-border">
                <img src={paymentImage} alt="receipt" className="w-full max-h-48 object-contain bg-muted" />
                <button type="button" onClick={() => setPaymentImage(null)}
                  className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-4 text-sm text-muted-foreground hover:border-gold hover:text-foreground transition-colors cursor-pointer">
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => handleImageUpload(e.target.files[0])} disabled={uploadingP} />
                {uploadingP ? <span>{t('uploading')}</span> : <><Camera size={18} style={{ color: '#C9A84C' }} /> <ImagePlus size={16} /> {t('uploadOrCapture')}</>}
              </label>
            )}
          </div>
        </div>
        <Button type="submit" disabled={saving || uploadingP} className="w-full gap-2" style={{ backgroundColor: '#1B2B4B' }}>
          <PlusCircle size={16} />
          {saving ? t('saving_') : 'تسجيل الدفعة'}
        </Button>
      </form>
    </div>
  );
}