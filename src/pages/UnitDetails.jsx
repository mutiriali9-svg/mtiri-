import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44, uploadFile } from '@/api/base44Client';
import { useLang } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { ArrowRight, ArrowLeft, Building2, Calendar, Phone, Receipt, Filter, Edit2, Upload, X, FileImage, Loader2 } from 'lucide-react';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRef } from 'react';

const emptyUnit = {
  unit_number: '', tenant_name: '', nationality: '', annual_rent: '',
  insurance: '', contract_start: '', contract_end: '', payment_plan: '',
  owner_phone: '', status: 'occupied', floor: '', notes: '', contract_image_url: '',
};

export default function UnitDetails() {
  const { unitNumber } = useParams();
  const [unit, setUnit] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyUnit);
  const [saving, setSaving] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const contractFileRef = useRef(null);
  // Payment edit
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({});
  const [savingPayment, setSavingPayment] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'data_entry';

  const statusConfig = {
    occupied: { label: t('occupied'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    vacant: { label: t('vacant'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    maintenance: { label: t('maintenance'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };
  const paymentStatusConfig = {
    paid: { label: t('paid'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    pending: { label: t('pending'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    late: { label: t('late'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };
  const methodLabels = {
    cash: t('cash'), bank_transfer: t('bank_transfer'), cheque: t('cheque'), other: t('other')
  };

  useEffect(() => {
  const decodedUnit = decodeURIComponent(unitNumber);
  Promise.all([
    base44.entities.Unit.filter({ unit_number: decodedUnit }),
    base44.entities.Payment.list('-payment_date', 500),
  ]).then(([units, allPays]) => {
    setUnit(units[0] || null);
    setPayments(allPays.filter(p => p.unit_number === decodedUnit));
    setLoading(false);
  });
}, [unitNumber]);

  const openEdit = () => {
    setForm({ ...emptyUnit, ...unit });
    setEditOpen(true);
  };

  const handleContractUpload = async (file) => {
    if (!file) return;
    setUploadingContract(true);
    const { file_url } = await uploadFile(file);
    setForm(p => ({ ...p, contract_image_url: file_url }));
    setUploadingContract(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, annual_rent: parseFloat(form.annual_rent) || 0 };
    await base44.entities.Unit.update(unit.id, data);
    setUnit(prev => ({ ...prev, ...data }));
    setSaving(false);
    setEditOpen(false);
  };

  const openEditPayment = (p) => {
    setEditingPayment(p);
    setPaymentForm({ ...p });
    setEditPaymentOpen(true);
  };

  const handleSavePayment = async () => {
    setSavingPayment(true);
    const data = { ...paymentForm, amount: parseFloat(paymentForm.amount) || 0 };
    await base44.entities.Payment.update(editingPayment.id, data);
    setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...data } : p));
    setSavingPayment(false);
    setEditPaymentOpen(false);
  };

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);

  const availableYears = [...new Set(payments.map(p => p.payment_date?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  const filteredPayments = payments.filter(p => {
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    if (yearFilter !== 'all' && !p.payment_date?.startsWith(yearFilter)) return false;
    return true;
  });

  const filteredTotal = filteredPayments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  if (!unit) return (
    <div className="text-center py-20 text-muted-foreground">{t('unitNotFound')}</div>
  );

  const sc = statusConfig[unit.status] || statusConfig.vacant;
  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-navy transition-colors">
        <BackIcon size={16} /> {t('backToUnits')}
      </button>

      {/* Header */}
      <div className="bg-white card-bevel rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1B2B4B' }}>
              <Building2 size={24} color="#C9A84C" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('unitLabel')} {unit.unit_number}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{unit.tenant_name || t('noTenant')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
            {canEdit && (
              <button onClick={openEdit} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-navy border border-border">
                <Edit2 size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">{t('annualRentLabel')}</p>
            <p className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{unit.annual_rent ? `${unit.annual_rent.toLocaleString()} AED` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('nationality')}</p>
            <p className="font-medium text-sm mt-1">{unit.nationality || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={11} /> {t('contractStartLabel')}</p>
            <p className="font-medium text-sm mt-1">{unit.contract_start || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={11} /> {t('contractEndLabel')}</p>
            <p className="font-medium text-sm mt-1">{unit.contract_end || '-'}</p>
          </div>
          {unit.owner_phone && (
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={11} /> {t('ownerPhoneLabel')}</p>
              <p className="font-medium text-sm mt-1">{unit.owner_phone}</p>
            </div>
          )}
          {unit.payment_plan && (
            <div>
              <p className="text-xs text-muted-foreground">{t('paymentPlanLabel')}</p>
              <p className="font-medium text-sm mt-1">{unit.payment_plan}</p>
            </div>
          )}
          {unit.notes && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">{t('notesLabel')}</p>
              <p className="font-medium text-sm mt-1">{unit.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payments Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white card-bevel rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{t('totalCollectedLabel')}</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#2A9D8F' }}>{totalPaid.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AED</span></p>
        </div>
        <div className="bg-white card-bevel rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{t('paymentCountLabel')}</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#1B2B4B' }}>{payments.length}</p>
        </div>
        <div className="bg-white card-bevel rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{t('lastPayment')}</p>
          <p className="text-sm font-bold mt-1" style={{ color: '#1B2B4B' }}>{payments[0]?.payment_date || '-'}</p>
        </div>
      </div>

      {/* Payments Table - Desktop */}
      <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Receipt size={16} style={{ color: '#C9A84C' }} />
              <h2 className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
                {t('paymentRecord')} ({filteredPayments.length})
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
                className="text-xs bg-muted/50 rounded-lg px-2 py-1.5 border border-border outline-none cursor-pointer"
              >
                <option value="all">كل السنوات</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5 border border-border">
                <Filter size={13} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t('fromLabel')}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="text-xs bg-transparent outline-none text-foreground cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5 border border-border">
                <span className="text-xs text-muted-foreground">{t('toLabel')}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="text-xs bg-transparent outline-none text-foreground cursor-pointer"
                />
              </div>
              {(dateFrom || dateTo || yearFilter !== 'all') && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setYearFilter('all'); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded border border-border hover:border-destructive/30"
                >
                  {t('clear')}
                </button>
              )}
            </div>
          </div>
          {(dateFrom || dateTo || yearFilter !== 'all') && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <span>{t('periodTotal')}:</span>
              <span className="font-bold text-sm" style={{ color: '#2A9D8F' }}>{filteredTotal.toLocaleString()} AED</span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#F8F9FA' }}>
              <tr>
                {[t('tenantName'), t('date'), t('amount'), t('dueMonth'), t('paymentMethod'), t('status'), t('notes'), ''].map(h => (
                  <th key={h} className="text-right py-3 px-4 text-muted-foreground font-medium text-xs whitespace-nowrap border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">
                  {payments.length === 0 ? t('noPaymentsUnit') : t('noMatchingResults')}
                </td></tr>
              ) : filteredPayments.map((p, i) => {
                const ps = paymentStatusConfig[p.status] || paymentStatusConfig.paid;
                return (
                  <tr key={p.id} className={`border-b border-border/50 hover:bg-surface transition-colors ${i % 2 === 1 ? 'bg-[#F8F9FA]' : ''}`}>
                    <td className="py-3 px-4 text-xs font-medium" style={{ color: '#1B2B4B' }}>{p.tenant_name || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.payment_date}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: '#2A9D8F' }}>
                      {(p.amount || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AED</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.due_months || '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{methodLabels[p.payment_method] || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: ps.bg, color: ps.color }}>{ps.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-40">
                      <span className="truncate block">{p.notes || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin && (
                        <button onClick={() => openEditPayment(p)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments Cards - Mobile */}
      <div className="md:hidden space-y-3">
        <div className="bg-white card-bevel rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt size={16} style={{ color: '#C9A84C' }} />
            <h2 className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
              {t('paymentRecord')} ({filteredPayments.length})
            </h2>
          </div>
          {/* Mobile Filters */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">السنة</label>
              <select
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
                className="text-xs bg-muted/50 rounded-lg px-2 py-2 border border-border outline-none cursor-pointer w-full"
              >
                <option value="all">كل السنوات</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('fromLabel')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="text-xs bg-muted/50 rounded-lg px-2 py-2 border border-border outline-none w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('toLabel')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="text-xs bg-muted/50 rounded-lg px-2 py-2 border border-border outline-none w-full"
              />
            </div>
            {(dateFrom || dateTo || yearFilter !== 'all') && (
              <div className="flex flex-col gap-1 justify-end">
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setYearFilter('all'); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-2 rounded-lg border border-border hover:border-destructive/30 w-full"
                >
                  {t('clear')}
                </button>
              </div>
            )}
          </div>
          {(dateFrom || dateTo || yearFilter !== 'all') && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <span>{t('periodTotal')}:</span>
              <span className="font-bold text-sm" style={{ color: '#2A9D8F' }}>{filteredTotal.toLocaleString()} AED</span>
            </div>
          )}
        </div>
        
        {filteredPayments.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-10 text-center text-muted-foreground">
            {payments.length === 0 ? t('noPaymentsUnit') : t('noMatchingResults')}
          </div>
        ) : (
          filteredPayments.map((p, i) => {
            const ps = paymentStatusConfig[p.status] || paymentStatusConfig.paid;
            return (
              <div key={p.id} className="bg-white card-bevel rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {p.tenant_name && (
                      <p className="text-xs font-bold mb-0.5" style={{ color: '#1B2B4B' }}>{p.tenant_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{t('date')}</p>
                    <p className="text-sm font-medium">{p.payment_date}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold" style={{ color: '#2A9D8F' }}>
                      {(p.amount || 0).toLocaleString()} <span className="text-xs font-normal">AED</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: ps.bg, color: ps.color }}>{ps.label}</span>
                    <span className="text-xs text-muted-foreground">{methodLabels[p.payment_method] || '-'}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => openEditPayment(p)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy">
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span>{t('dueMonth')}:</span> {p.due_months || '-'}
                </div>
                {p.notes && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">{p.notes}</p>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Edit Payment Dialog */}
      <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
        <DialogContent className="max-w-md font-cairo max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الدفعة</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">اسم المستأجر</Label>
              <Input value={paymentForm.tenant_name || ''} onChange={e => setPaymentForm(p => ({ ...p, tenant_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">المبلغ (AED)</Label>
              <Input type="number" value={paymentForm.amount || ''} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ الدفع</Label>
              <Input type="date" value={paymentForm.payment_date || ''} onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">مستحق لشهر</Label>
              <Input value={paymentForm.due_months || ''} onChange={e => setPaymentForm(p => ({ ...p, due_months: e.target.value }))} placeholder="مثال: يوليو 2026" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">طريقة الدفع</Label>
              <Select value={paymentForm.payment_method || 'bank_transfer'} onValueChange={v => setPaymentForm(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('cash')}</SelectItem>
                  <SelectItem value="bank_transfer">{t('bank_transfer')}</SelectItem>
                  <SelectItem value="cheque">{t('cheque')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">الحالة</Label>
              <Select value={paymentForm.status || 'paid'} onValueChange={v => setPaymentForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">{t('paid')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="late">{t('late')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">رقم الإيصال</Label>
              <Input value={paymentForm.receipt_number || ''} onChange={e => setPaymentForm(p => ({ ...p, receipt_number: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">ملاحظات</Label>
              <Input value={paymentForm.notes || ''} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>إلغاء</Button>
            <Button onClick={handleSavePayment} disabled={savingPayment} style={{ backgroundColor: '#1B2B4B' }}>
              {savingPayment ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-cairo" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الوحدة — {unit?.unit_number}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {[
              { label: 'اسم المستأجر', key: 'tenant_name', type: 'text' },
              { label: 'الجنسية', key: 'nationality', type: 'text' },
              { label: 'الإيجار السنوي (AED)', key: 'annual_rent', type: 'number' },
              { label: 'التأمين', key: 'insurance', type: 'text' },
              { label: 'رقم المالك', key: 'owner_phone', type: 'text' },
              { label: 'بداية العقد', key: 'contract_start', type: 'date' },
              { label: 'نهاية العقد', key: 'contract_end', type: 'date' },
              { label: 'خطة الدفع', key: 'payment_plan', type: 'text' },
              { label: 'الطابق', key: 'floor', type: 'text' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                <Input type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="text-sm" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm">الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupied">مأجرة</SelectItem>
                  <SelectItem value="vacant">شاغرة</SelectItem>
                  <SelectItem value="maintenance">صيانة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">ملاحظات</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">صورة العقد</Label>
              <div className="flex items-center gap-3">
                <input ref={contractFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleContractUpload(e.target.files[0])} />
                <Button type="button" variant="outline" size="sm" onClick={() => contractFileRef.current?.click()} disabled={uploadingContract} className="gap-2">
                  {uploadingContract ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingContract ? 'جاري الرفع...' : 'رفع صورة العقد'}
                </Button>
                {form.contract_image_url && (
                  <div className="flex items-center gap-2">
                    <a href={form.contract_image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#1B2B4B' }}>
                      <FileImage size={14} /> عرض العقد
                    </a>
                    <button type="button" onClick={() => setForm(p => ({ ...p, contract_image_url: '' }))} className="text-destructive hover:opacity-70">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}