import { useState, useEffect, useRef } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Plus, Search, Edit2, Trash2, ImagePlus, X, FileText, CheckCircle2, Loader2 } from 'lucide-react';

import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const emptyPayment = {
  tenant_name: '', unit_number: '', amount: '', payment_date: '',
  due_months: '', payment_method: 'bank_transfer', status: 'paid', notes: '', receipt_number: '', receipt_image_url: ''
};

export default function RePayments() {
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
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
  const fileRef = useRef();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLang();
  const canEdit = user?.role === 'admin';

  const methodLabels = { cash: t('cash'), bank_transfer: t('bank_transfer'), cheque: t('cheque'), other: t('other') };
  const statusConfig = {
    paid: { label: t('paid'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    pending: { label: t('pending'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    late: { label: t('late'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      setReceiptUrl(result.file_url);
      toast({ description: 'تم رفع الإيصال بنجاح ✓' });
    } catch {
      toast({ description: 'فشل رفع الملف، حاول مجدداً', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      base44.entities.RePayment.list('-payment_date'),
      base44.entities.ReUnit.list(),
    ]).then(([p, u]) => { setPayments(p); setUnits(u); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditItem(null); setForm(emptyPayment); setReceiptUrl(''); setInlineError(''); setDialogOpen(true); };
  const openEdit = (p) => { setEditItem(p); setForm({ ...emptyPayment, ...p }); setReceiptUrl(p.receipt_image_url || ''); setInlineError(''); setDialogOpen(true); };

  const handleSave = async () => {
    const missing = [];
    if (!form.tenant_name?.trim()) missing.push('اسم المستأجر');
    if (!form.amount || parseFloat(form.amount) <= 0) missing.push('المبلغ');
    if (!form.payment_date) missing.push('تاريخ الدفع');
    if (missing.length > 0) {
      setInlineError(`⚠️ يرجى تعبئة: ${missing.join(' — ')}`);
      setTimeout(() => setInlineError(''), 4000);
      return;
    }
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) || 0, receipt_image_url: receiptUrl };
    if (editItem) {
      await base44.entities.RePayment.update(editItem.id, data);
      toast({ description: t('paymentUpdated') });
    } else {
      const created = await base44.entities.RePayment.create(data);
      setNewRowPulse(created.id);
      setTimeout(() => setNewRowPulse(null), 1200);
      toast({ description: t('paymentAdded') });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = (id) => {
    setConfirmDelete({ message: t('deletePaymentConfirm'), onConfirm: async () => {
      await base44.entities.RePayment.delete(id);
      toast({ description: t('paymentDeleted') });
      setConfirmDelete(null);
      fetchData();
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
      <PageHeader
        titleAr="الدفعات - العقارات"
        titleEn="RE Payment Ledger"
        description={`${payments.length} — ${t('total')}: ${total.toLocaleString()} AED`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#1B2B4B' }}>
            <Plus size={16} /> {t('registerPayment')}
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input placeholder={t('searchPayments')} value={search} onChange={e => setSearch(e.target.value)} className="pr-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t('status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses_pay')}</SelectItem>
            <SelectItem value="paid">{t('paid')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="late">{t('late')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28"><SelectValue placeholder="السنة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل السنوات</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 text-sm" />
          <span className="text-muted-foreground text-xs">—</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 text-sm" />
          {(dateFrom || dateTo || yearFilter !== 'all') && <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setYearFilter('all'); }} className="text-xs">{t('clear')}</Button>}
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
              {loading ? Array(6).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-border">{Array(8).fill(0).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noPayments')}</td></tr>
              ) : filtered.map((p, i) => {
                const sc = statusConfig[p.status] || statusConfig.paid;
                return (
                  <tr key={p.id} onClick={() => setViewItem(p)} className={`border-b border-border/50 transition-colors cursor-pointer ${newRowPulse === p.id ? 'gold-pulse' : i % 2 === 1 ? 'bg-[#F8F9FA]' : ''} hover:bg-surface`}>
                    <td className="py-3 px-4 font-medium" style={{ color: '#1B2B4B' }}>{p.tenant_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.unit_number || '-'}</td>
                    <td className="py-3 px-4 font-bold text-lg" style={{ color: '#2A9D8F' }}>{(p.amount || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AED</span></td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.payment_date}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.due_months || '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{methodLabels[p.payment_method] || '-'}</td>
                    <td className="py-3 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span></td>
                    <td className="py-3 px-4" onClick={ev => ev.stopPropagation()}>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-navy"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
          <div key={i} className="bg-white card-bevel rounded-xl p-4"><div className="h-4 bg-muted rounded animate-pulse mb-2" /><div className="h-3 bg-muted rounded animate-pulse w-2/3" /></div>
        )) : filtered.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('noPayments')}</div>
        ) : filtered.map((p) => {
          const sc = statusConfig[p.status] || statusConfig.paid;
          return (
            <div key={p.id} onClick={() => setViewItem(p)} className={`bg-white card-bevel rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer active:bg-muted/30 ${newRowPulse === p.id ? 'gold-pulse' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-base" style={{ color: '#1B2B4B' }}>{p.tenant_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('unit')}: {p.unit_number || '-'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xl font-bold" style={{ color: '#2A9D8F' }}>{(p.amount || 0).toLocaleString()} <span className="text-xs font-normal">AED</span></p>
                <p className="text-sm text-muted-foreground">{p.payment_date}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-3 border-t border-border" onClick={ev => ev.stopPropagation()}>
                  <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm"><Edit2 size={14} />{t('edit')}</button>
                  <button onClick={() => handleDelete(p.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive"><Trash2 size={14} />{t('delete')}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />

      {/* View Payment Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-md font-cairo">
          <DialogHeader>
            <DialogTitle>بيانات الدفعة</DialogTitle>
          </DialogHeader>
          {viewItem && (() => {
            const sc = statusConfig[viewItem.status] || statusConfig.paid;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">اسم المستأجر</p>
                    <p className="font-semibold" style={{ color: '#1B2B4B' }}>{viewItem.tenant_name}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">رقم الشقة</p>
                    <p className="font-semibold">{viewItem.unit_number || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">المبلغ</p>
                    <p className="font-bold text-lg" style={{ color: '#2A9D8F' }}>{(viewItem.amount || 0).toLocaleString()} AED</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">الحالة</p>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-block"
                      style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">تاريخ الدفع</p>
                    <p className="font-medium">{viewItem.payment_date || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">مستحق لشهر</p>
                    <p className="font-medium">{viewItem.due_months || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                    <p className="font-medium">{methodLabels[viewItem.payment_method] || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">رقم الإيصال</p>
                    <p className="font-medium">{viewItem.receipt_number || '-'}</p>
                  </div>
                  {viewItem.notes && (
                    <div className="col-span-2 space-y-0.5">
                      <p className="text-xs text-muted-foreground">ملاحظات</p>
                      <p className="font-medium">{viewItem.notes}</p>
                    </div>
                  )}
                </div>
                {viewItem.receipt_image_url && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">صورة الإيصال</p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      {viewItem.receipt_image_url.toLowerCase().endsWith('.pdf') ? (
                        <div className="flex items-center gap-3 p-3 bg-muted">
                          <FileText size={24} style={{ color: '#C9A84C' }} />
                          <a href={viewItem.receipt_image_url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-medium underline" style={{ color: '#1B2B4B' }}>عرض ملف PDF</a>
                        </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md font-cairo max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? t('editPayment') : t('addPayment')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label>{t('tenantName')} *</Label><Input value={form.tenant_name} onChange={e => setForm(p => ({ ...p, tenant_name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('unitNumber')}</Label>
              <Select value={form.unit_number || 'none'} onValueChange={v => setForm(p => ({ ...p, unit_number: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder={t('unitNumber')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noneUnit')}</SelectItem>
                  {[...units].sort((a, b) => (parseInt(a.unit_number) || 0) - (parseInt(b.unit_number) || 0)).map(u => <SelectItem key={u.id} value={u.unit_number}>{u.unit_number} — {u.tenant_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('amountAED')}</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('paymentDate')} *</Label><Input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('dueMonth')}</Label><Input value={form.due_months} onChange={e => setForm(p => ({ ...p, due_months: e.target.value }))} /></div>
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
              <Label>صورة الإيصال</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleImageUpload}
              />
              {receiptUrl ? (
                <div className="relative w-full rounded-lg border border-border bg-muted overflow-hidden">
                  {receiptUrl.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex items-center gap-3 p-3">
                      <FileText size={24} style={{ color: '#C9A84C' }} />
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium underline" style={{ color: '#1B2B4B' }}>
                        عرض ملف PDF
                      </a>
                    </div>
                  ) : (
                    <img src={receiptUrl} alt="receipt" className="w-full max-h-52 object-contain p-2" />
                  )}
                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-t border-green-100">
                    <span className="flex items-center gap-1.5 text-xs text-green-700">
                      <CheckCircle2 size={13} /> تم رفع الإيصال بنجاح
                    </span>
                    <button type="button" onClick={() => { setReceiptUrl(''); if (fileRef.current) fileRef.current.value = ''; }}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X size={12} /> حذف
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-6 text-sm text-muted-foreground hover:border-amber-400 hover:bg-amber-50/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={22} className="animate-spin" style={{ color: '#C9A84C' }} />
                      <span>جارٍ الرفع...</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={22} style={{ color: '#C9A84C' }} />
                      <span>اضغط لرفع صورة الإيصال أو PDF</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {inlineError && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium animate-fade-in-up"
              style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946', border: '1px solid rgba(230,57,70,0.2)' }}>
              {inlineError}
            </div>
          )}
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