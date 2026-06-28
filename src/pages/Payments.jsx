import { useState, useEffect, useCallback, useRef } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Plus, Search, Edit2, Trash2, ImagePlus, X, FileText, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { addMonths, format, parseISO } from 'date-fns';
import { logActivity, getChangeSummary } from '@/utils/activityLogger';

function getNextAlertDate(dateStr, plan) {
  const months = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 }[plan] || 1;
  return format(addMonths(parseISO(dateStr), months), 'yyyy-MM-dd');
}

const emptyPayment = {
  tenant_name: '', unit_number: '', amount: '', payment_date: '',
  due_months: '', payment_method: 'bank_transfer', status: 'paid', notes: '', receipt_number: ''
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
  const [reUnits, setReUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);
  const [newRowPulse, setNewRowPulse] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [inlineError, setInlineError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [unitAlert, setUnitAlert] = useState(null);

  const [comboQuery, setComboQuery] = useState('');
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const isTester = user?.role === 'tester';
  const maskName = (name) => isTester ? '***' : name;

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'data_entry';

  const methodLabels = { cash: t('cash'), bank_transfer: t('bank_transfer'), cheque: t('cheque'), other: t('other') };
  const statusConfig = {
    paid: { label: t('paid'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    pending: { label: t('pending'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    late: { label: t('late'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };

  useEffect(() => {
    const handler = (e) => { if (comboRef.current && !comboRef.current.contains(e.target)) setComboOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      setReceiptUrl(result.file_url);
    } catch {
      toast({ description: 'فشل رفع الملف، حاول مجدداً', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [p, u, ru] = await Promise.all([
      base44.entities.Payment.list('-payment_date'),
      base44.entities.Unit.list(),
      base44.entities.ReUnit.list(),
    ]);
    setPayments(p);
    setUnits(u);
    setReUnits(ru || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, []);

  const allUnits = [
    ...units.map(u => ({ ...u, _type: 'qarya' })),
    ...reUnits.map(u => ({ ...u, _type: 're' })),
  ].sort((a, b) => (parseInt(a.unit_number) || 0) - (parseInt(b.unit_number) || 0));

  const filteredComboUnits = comboQuery.trim()
    ? allUnits.filter(u =>
        u.unit_number?.toLowerCase().includes(comboQuery.toLowerCase()) ||
        u.tenant_name?.toLowerCase().includes(comboQuery.toLowerCase())
      )
    : allUnits;

  const openAdd = () => {
    setEditItem(null); setForm(emptyPayment); setReceiptUrl('');
    setInlineError(''); setUnitAlert(null);
    setComboQuery(''); setComboOpen(false);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditItem(p); setForm({ ...emptyPayment, ...p }); setReceiptUrl(p.receipt_image_url || '');
    setInlineError(''); setUnitAlert(null);
    setComboQuery(p.unit_number ? `${p.unit_number}${p.tenant_name ? ' — ' + p.tenant_name : ''}` : '');
    setComboOpen(false);
    setDialogOpen(true);
  };

  const handleUnitSelect = async (unit) => {
    setComboQuery(`${unit.unit_number}${unit.tenant_name ? ' — ' + unit.tenant_name : ''}`);
    setComboOpen(false);
    setForm(p => ({ ...p, unit_number: unit.unit_number, tenant_name: unit.tenant_name || p.tenant_name }));
    setUnitAlert(null);
    try {
      const alerts = await base44.entities.PaymentAlert.filter({ unit_number: unit.unit_number });
      const active = alerts.find(a => a.status !== 'paid');
      setUnitAlert(active || null);
    } catch {}
  };

  const handleLogActivity = async (action, payment, oldData = null, newData = null) => {
    const summary = action === 'create' 
      ? `إضافة دفعة ${payment?.amount?.toLocaleString()} AED`
      : action === 'update'
      ? `تعديل دفعة ${payment?.tenant_name}`
      : `حذف دفعة ${payment?.tenant_name}`;
    await logActivity('Payment', action, `${payment?.tenant_name} - وحدة ${payment?.unit_number}`, oldData, newData, summary, user);
  };

  const handleSave = async () => {
    const missing = [];
    if (!form.tenant_name?.trim()) missing.push('اسم المستأجر');
    if (!form.amount || parseFloat(form.amount) <= 0) missing.push('المبلغ');
    if (!form.payment_date) missing.push('تاريخ الدفع');
    if (!form.due_months?.trim()) missing.push('مستحق لشهر');
    if (!receiptUrl) missing.push('صورة الإيصال');
    if (missing.length > 0) {
      setInlineError(`⚠️ يرجى تعبئة: ${missing.join(' — ')}`);
      setTimeout(() => setInlineError(''), 4000);
      return;
    }
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) || 0, receipt_image_url: receiptUrl };
    if (editItem) {
      setDialogOpen(false); setSaving(false);
      await base44.entities.Payment.update(editItem.id, data);
      await handleLogActivity('update', { ...editItem, ...data }, editItem, data);
      setPayments(prev => prev.map(p => p.id === editItem.id ? { ...p, ...data } : p));
      showSuccess(t('paymentUpdated'));
    } else {
      setDialogOpen(false); setSaving(false);
      const created = await base44.entities.Payment.create(data);
      const newPayment = { ...data, ...(created || {}), id: created?.id || `temp_${Date.now()}` };
      await handleLogActivity('create', newPayment, null, data);
      base44.entities.Notification.create({
        type: 'payment',
        title: `دفعة جديدة — ${data.tenant_name}`,
        amount: data.amount,
        reference_id: created?.id || '',
        reference_data: data,
        is_read: false,
      }).catch(() => {});
      setPayments(prev => [newPayment, ...prev]);
      setNewRowPulse(newPayment.id);
      setTimeout(() => setNewRowPulse(null), 1200);

      if (unitAlert) {
        const paidAmount = parseFloat(data.amount) || 0;
        const monthly = Number(unitAlert.original_amount || 0);
        const currentBalance = Number(unitAlert.remaining_balance || monthly);
        const newBalance = Math.max(0, currentBalance - paidAmount);
        const paymentDate = data.payment_date || today;
        const alertDate = unitAlert.alert_date || today;
        const isPaidEarly = paymentDate < alertDate;
        const nextDate = getNextAlertDate(alertDate, unitAlert.payment_plan || 'monthly');
        if (newBalance === 0) {
          await base44.entities.PaymentAlert.update(unitAlert.id, {
            remaining_balance: monthly, last_paid_date: paymentDate, last_paid_amount: paidAmount,
            alert_date: nextDate, next_alert_date: nextDate, status: nextDate > today ? 'active' : 'overdue',
          });
        } else {
          await base44.entities.PaymentAlert.update(unitAlert.id, {
            remaining_balance: newBalance, last_paid_date: paymentDate, last_paid_amount: paidAmount,
            status: isPaidEarly ? 'active' : 'overdue',
          });
        }
      }
      showSuccess(t('paymentAdded'));
    }
  };

  const handleDelete = (id) => {
    const payment = payments.find(p => p.id === id);
    setConfirmDelete({ message: 'هل تريد حذف هذه الدفعة؟', onConfirm: async () => {
      setPayments(prev => prev.filter(p => p.id !== id));
      setConfirmDelete(null);
      await base44.entities.Payment.delete(id);
      await handleLogActivity('delete', { ...payment, id }, payment, null);
      showSuccess(t('paymentDeleted'));
    }});
  };

  const availableYears = [...new Set(payments.map(p => p.payment_date?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.tenant_name?.toLowerCase().includes(q) || p.unit_number?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || p.status === statusFilter;
    const matchFrom = !dateFrom || (p.payment_date && p.payment_date >= dateFrom);
    const matchTo = !dateTo || (p.payment_date && p.payment_date <= dateTo);
    const matchY = yearFilter === 'all' || p.payment_date?.startsWith(yearFilter);
    return matchQ && matchS && matchFrom && matchTo && matchY;
  });

  const total = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold animate-fade-in-up"
          style={{ backgroundColor: '#1B2B4B', minWidth: 220, textAlign: 'center' }}>
          <CheckCircle2 size={16} style={{ color: '#C9A84C' }} />{successMsg}
        </div>
      )}
      <PageHeader
        titleAr="جدول الدفعات" titleEn="Payment Ledger"
        description={`${payments.length} — ${t('total')}: ${total.toLocaleString()} AED`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#1B2B4B' }}>
            <Plus size={16} /> {t('registerPayment')}
          </Button>
        )}
      />

      <div className="bg-white card-bevel rounded-xl p-3 sm:p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-44">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input
            placeholder={t('searchPayments')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 text-sm h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses_pay')}</SelectItem>
            <SelectItem value="paid">{t('paid')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="late">{t('late')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28 h-9 text-sm">
            <SelectValue placeholder="السنة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? 'كل السنوات' : 'All Years'}</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">من:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-32 text-sm h-9" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">إلى:</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-32 text-sm h-9" />
          </div>
          {(dateFrom || dateTo || yearFilter !== 'all' || search) && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5"
              onClick={() => { setDateFrom(''); setDateTo(''); setYearFilter('all'); setSearch(''); }}>
              <X size={13} /> مسح
            </Button>
          )}
        </div>
      </div>

      <div className="bg-navy rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: '#1B2B4B' }}>
        <div>
          <p className="text-white/60 text-xs">{t('totalShown')}</p>
          <p className="text-2xl font-bold text-white">{total.toLocaleString()} <span className="text-sm text-white/60">AED</span></p>
        </div>
        <div>
          <p className="text-white/60 text-xs">{t('paymentCount')}</p>
          <p className="text-2xl font-bold" style={{ color: '#C9A84C' }}>{filtered.length}</p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#1B2B4B' }}>
              <tr>
                {[t('tenant'), t('unit'), t('amount'), t('date'), t('dueMonth'), t('paymentMethod'), t('status'), ''].map(h => (
                  <th key={h} className="text-right py-3 px-4 text-white/80 font-medium text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array(8).fill(0).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noPayments')}</td></tr>
              ) : filtered.map((p, i) => {
                const sc = statusConfig[p.status] || statusConfig.paid;
                return (
                  <tr key={p.id} onClick={() => setViewItem(p)}
                    className={`border-b border-border/50 transition-colors cursor-pointer ${newRowPulse === p.id ? 'gold-pulse' : i % 2 === 1 ? 'bg-[#F8F9FA]' : ''} hover:bg-surface`}>
                    <td className="py-3 px-4 font-medium" style={{ color: '#1B2B4B' }}>{maskName(p.tenant_name)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.unit_number || '-'}</td>
                    <td className="py-3 px-4 font-bold text-lg" style={{ color: '#2A9D8F' }}>
                      {(p.amount || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AED</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.payment_date}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.due_months || '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{methodLabels[p.payment_method] || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td className="py-3 px-4" onClick={ev => ev.stopPropagation()}>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-navy"><Edit2 size={14} /></button>
                          {user?.role === 'admin' && (
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                          )}
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
      <div className="md:hidden space-y-2">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white card-bevel rounded-xl p-3">
              <div className="h-3 bg-muted rounded animate-pulse mb-1.5" />
              <div className="h-2.5 bg-muted rounded animate-pulse w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-8 text-center text-muted-foreground text-sm">{t('noPayments')}</div>
        ) : filtered.map((p) => {
          const sc = statusConfig[p.status] || statusConfig.paid;
          return (
            <div key={p.id} onClick={() => setViewItem(p)}
              className={`bg-white card-bevel rounded-xl p-2.5 hover:shadow-sm transition-shadow cursor-pointer active:bg-muted/30 ${newRowPulse === p.id ? 'gold-pulse' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm truncate" style={{ color: '#1B2B4B' }}>{maskName(p.tenant_name)}</h3>
                    <span className="text-xs text-muted-foreground shrink-0">{t('unit')}: {p.unit_number || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{p.payment_date}</span>
                    <span className="text-xs text-muted-foreground">{p.due_months || ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-left">
                    <p className="text-sm font-bold" style={{ color: '#2A9D8F' }}>{(p.amount || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground text-left">AED</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  {canEdit && (
                    <div className="flex items-center gap-0.5" onPointerDown={ev => ev.stopPropagation()} onClick={ev => ev.stopPropagation()}>
                      <button onPointerDown={ev => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); openEdit(p); }}
                        className="p-2 rounded hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"><Edit2 size={14} /></button>
                      {user?.role === 'admin' && (
                        <button onPointerDown={ev => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); handleDelete(p.id); }}
                          className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive min-w-[36px] min-h-[36px] flex items-center justify-center"><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-md font-cairo max-h-[85vh] overflow-y-auto flex flex-col">
          <DialogHeader><DialogTitle>بيانات الدفعة</DialogTitle></DialogHeader>
          {viewItem && (() => {
            const sc = statusConfig[viewItem.status] || statusConfig.paid;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">اسم المستأجر</p><p className="font-semibold" style={{ color: '#1B2B4B' }}>{viewItem.tenant_name}</p></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">رقم الشقة او المنزل</p><p className="font-semibold">{viewItem.unit_number || '-'}</p></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">المبلغ</p><p className="font-bold text-lg" style={{ color: '#2A9D8F' }}>{(viewItem.amount || 0).toLocaleString()} AED</p></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">الحالة</p><span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-block" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">تاريخ الدفع</p><p className="font-medium">{viewItem.payment_date || '-'}</p></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">مستحق لشهر</p><p className="font-medium">{viewItem.due_months || '-'}</p></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">طريقة الدفع</p><p className="font-medium">{methodLabels[viewItem.payment_method] || '-'}</p></div>
                  <div className="space-y-0.5"><p className="text-xs text-muted-foreground">رقم الإيصال</p><p className="font-medium">{viewItem.receipt_number || '-'}</p></div>
                  {viewItem.notes && <div className="col-span-2 space-y-0.5"><p className="text-xs text-muted-foreground">ملاحظات</p><p className="font-medium">{viewItem.notes}</p></div>}
                </div>
                {viewItem.receipt_image_url && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">صورة الإيصال</p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      {viewItem.receipt_image_url.toLowerCase().endsWith('.pdf') ? (
                        <div className="flex items-center gap-3 p-3 bg-muted"><FileText size={24} style={{ color: '#C9A84C' }} /><a href={viewItem.receipt_image_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline" style={{ color: '#1B2B4B' }}>عرض ملف PDF</a></div>
                      ) : (
                        <img src={viewItem.receipt_image_url} alt="receipt" className="w-full max-h-64 object-contain p-2 bg-muted" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>إغلاق</Button>
            {canEdit && <Button onClick={() => { openEdit(viewItem); setViewItem(null); }} style={{ backgroundColor: '#1B2B4B' }}><Edit2 size={14} /> تعديل</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md font-cairo max-h-[85vh] overflow-y-auto flex flex-col">
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 8px' }}>
          <DialogHeader><DialogTitle>{editItem ? t('editPayment') : t('addPayment')}</DialogTitle></DialogHeader>

          {!editItem && unitAlert && (() => {
            const monthly = Number(unitAlert.original_amount || 0);
            const currentBalance = Number(unitAlert.remaining_balance ?? monthly);
            const overdueAmt = Math.max(0, currentBalance - monthly);
            const paidNow = parseFloat(form.amount) || 0;
            const afterPay = Math.max(0, currentBalance - paidNow);
            const isFullyPaid = paidNow >= currentBalance;
            const isPartial = paidNow > 0 && paidNow < currentBalance;
            const alertDate = unitAlert.alert_date || today;
            const payDate = form.payment_date || today;
            const isPaidEarly = payDate < alertDate;
            return (
              <div className="rounded-xl p-3 space-y-2 mb-1" style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(201,168,76,0.25)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <AlertTriangle size={14} style={{ color: '#C9A84C' }} />
                  <span className="text-xs font-bold" style={{ color: '#1B2B4B' }}>التنبيه الذكي — وحدة {unitAlert.unit_number}</span>
                  <span className="text-xs text-muted-foreground">الاستحقاق: {alertDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(42,157,143,0.07)' }}><p className="text-muted-foreground">الشهري</p><p className="font-bold" style={{ color: '#2A9D8F' }}>{monthly.toLocaleString()}</p></div>
                  {overdueAmt > 0 ? (
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(230,57,70,0.07)' }}><p className="text-muted-foreground">متأخر</p><p className="font-bold" style={{ color: '#E63946' }}>{overdueAmt.toLocaleString()}</p></div>
                  ) : (
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(27,43,75,0.04)' }}><p className="text-muted-foreground">الحالة</p><p className="font-bold text-[10px]" style={{ color: '#2A9D8F' }}>نشط</p></div>
                  )}
                  <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(27,43,75,0.06)' }}><p className="text-muted-foreground">المستحق</p><p className="font-bold" style={{ color: '#1B2B4B' }}>{currentBalance.toLocaleString()}</p></div>
                </div>
                {paidNow > 0 && (
                  <div className="rounded-lg p-2.5 space-y-1.5 border-t pt-2" style={{ backgroundColor: isFullyPaid ? 'rgba(42,157,143,0.06)' : 'rgba(230,57,70,0.04)' }}>
                    <p className="text-xs font-bold" style={{ color: isFullyPaid ? '#2A9D8F' : '#E63946' }}>{isFullyPaid ? '✅ سيتم تسوية الكامل' : '⚠️ دفعة جزئية'}</p>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">المدفوع</span><span className="font-bold" style={{ color: '#2A9D8F' }}>{paidNow.toLocaleString()} د.إ</span></div>
                    {isPartial && (
                      <>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">المتبقي بعد الدفع</span><span className="font-bold" style={{ color: isPaidEarly ? '#1B2B4B' : '#E63946' }}>{afterPay.toLocaleString()} د.إ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">حالة التنبيه بعد الدفع</span><span className="font-bold px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: isPaidEarly ? 'rgba(27,43,75,0.08)' : 'rgba(230,57,70,0.1)', color: isPaidEarly ? '#1B2B4B' : '#E63946' }}>{isPaidEarly ? '🟢 نشط (دفع مبكر)' : '🔴 متأخر'}</span></div>
                      </>
                    )}
                    {isFullyPaid && (
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">الدفعة القادمة</span><span className="font-bold" style={{ color: '#1B2B4B' }}>{getNextAlertDate(alertDate, unitAlert.payment_plan || 'monthly')} — {monthly.toLocaleString()} د.إ</span></div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2" ref={comboRef}>
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={comboQuery}
                  onChange={e => {
                    const val = e.target.value;
                    setComboQuery(val);
                    setComboOpen(true);
                    setForm(p => ({ ...p, tenant_name: val, unit_number: '' }));
                    setUnitAlert(null);
                  }}
                  onClick={() => setComboOpen(true)}
                  placeholder="ابحث برقم الوحدة أو اسم المستأجر..."
                  className="w-full pr-9 pl-7 h-9 border border-input rounded-md text-sm focus:outline-none focus:ring-1"
                  autoComplete="off"
                />
                {comboQuery && (
                  <button type="button" onClick={() => { setComboQuery(''); setForm(p => ({ ...p, tenant_name: '', unit_number: '' })); setUnitAlert(null); setComboOpen(false); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                )}
                {comboOpen && filteredComboUnits.length > 0 && (
                  <div className="absolute w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto" style={{ zIndex: 9999 }}>
                    {filteredComboUnits.map(u => (
                      <button key={u.id} type="button" onClick={() => handleUnitSelect(u)}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors">
                        <span className="font-bold" style={{ color: '#1B2B4B' }}>{u.unit_number}</span>
                        {u.tenant_name && <span className="text-muted-foreground">— {u.tenant_name}</span>}
                        <span className="text-xs px-1.5 py-0.5 rounded-full mr-auto flex-shrink-0"
                          style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
                          {u._type === 're' ? 'عقارات' : 'القرية'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5"><Label>{t('amountAED')}</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('paymentDate')} *</Label><Input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('dueMonth')} *</Label><Input value={form.due_months} onChange={e => setForm(p => ({ ...p, due_months: e.target.value }))} placeholder="مثال: يوليو 2026" /></div>
            <div className="space-y-1.5">
              <Label>{t('paymentMethod')}</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}>
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
              <Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">{t('paid')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="late">{t('late')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('receiptNumber')}</Label><Input value={form.receipt_number} onChange={e => setForm(p => ({ ...p, receipt_number: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1.5"><Label>{t('notes')}</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>{t('receiptImage')} *</Label>
              {receiptUrl ? (
                <div className="w-full rounded-lg border border-border bg-muted overflow-hidden">
                  {receiptUrl.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex items-center gap-3 p-3"><FileText size={24} style={{ color: '#C9A84C' }} /><a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline" style={{ color: '#1B2B4B' }}>عرض ملف PDF</a></div>
                  ) : (
                    <img src={receiptUrl} alt="receipt" className="w-full max-h-52 object-contain p-2" />
                  )}
                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-t border-green-100">
                    <span className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 size={13} /> تم رفع الإيصال بنجاح</span>
                    <button type="button" onClick={() => setReceiptUrl('')} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><X size={12} /> حذف</button>
                  </div>
                </div>
              ) : (
                <label className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-6 text-sm text-muted-foreground hover:border-amber-400 hover:bg-amber-50/40 transition-colors cursor-pointer">
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  {uploading ? <><Loader2 size={22} className="animate-spin" style={{ color: '#C9A84C' }} /><span>جارٍ الرفع...</span></> : <><ImagePlus size={22} style={{ color: '#C9A84C' }} /><span>اضغط لرفع صورة الإيصال أو PDF</span></>}
                </label>
              )}
            </div>
          </div>

          {inlineError && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium animate-fade-in-up"
              style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946', border: '1px solid rgba(230,57,70,0.2)' }}>
              {inlineError}
            </div>
          )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || uploading} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? t('saving_') : t('savePayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}