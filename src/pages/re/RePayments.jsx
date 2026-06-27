import { useState, useEffect, useRef } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, FileText, CheckCircle2, Loader2 } from 'lucide-react';
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
  const [currentPage, setCurrentPage] = useState(1);
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
  const comboRef = useRef(null);
  const [comboQuery, setComboQuery] = useState('');
  const [comboOpen, setComboOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';    
  const canEdit = user?.role === 'admin';

  const itemsPerPage = 35;

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

  useEffect(() => {
    const handler = (e) => { if (comboRef.current && !comboRef.current.contains(e.target)) setComboOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, dateFrom, dateTo, yearFilter]);

  const sortedUnits = [...units].sort((a, b) => (parseInt(a.unit_number) || 0) - (parseInt(b.unit_number) || 0));
  const filteredComboUnits = comboQuery.trim()
    ? sortedUnits.filter(u => u.unit_number?.toLowerCase().includes(comboQuery.toLowerCase()) || u.tenant_name?.toLowerCase().includes(comboQuery.toLowerCase()))
    : sortedUnits;

  const handleUnitComboSelect = (u) => {
    setComboQuery(`${u.unit_number}${u.tenant_name ? ' — ' + u.tenant_name : ''}`);
    setComboOpen(false);
    setForm(p => ({ ...p, unit_number: u.unit_number, tenant_name: u.tenant_name || p.tenant_name }));
  };

  const openAdd = () => { setEditItem(null); setForm(emptyPayment); setReceiptUrl(''); setInlineError(''); setComboQuery(''); setComboOpen(false); setDialogOpen(true); };
  const openEdit = (p) => { setEditItem(p); setForm({ ...emptyPayment, ...p }); setReceiptUrl(p.receipt_image_url || ''); setInlineError(''); setComboQuery(p.unit_number ? `${p.unit_number}${p.tenant_name ? ' — ' + p.tenant_name : ''}` : ''); setComboOpen(false); setDialogOpen(true); };

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
      await logActivity('RePayment', 'update', `دفعة - ${form.tenant_name} (${form.unit_number})`, editItem, data, null, user);
      toast({ description: t('paymentUpdated') });
    } else {
      const created = await base44.entities.RePayment.create(data);
      await logActivity('RePayment', 'create', `دفعة - ${form.tenant_name} (${form.unit_number})`, null, data, null, user);
      setNewRowPulse(created.id);
      setTimeout(() => setNewRowPulse(null), 1200);
      base44.entities.Notification.create({
        type: 're_payment',
        title: `دفعة عقارات — ${data.tenant_name}`,
        amount: data.amount,
        reference_id: created?.id || '',
        reference_data: data,
        is_read: false,
      }).catch(() => {});
      toast({ description: t('paymentAdded') });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = (id) => {
    const payment = payments.find(p => p.id === id);
    setConfirmDelete({ message: t('deletePaymentConfirm'), onConfirm: async () => {
      await base44.entities.RePayment.delete(id);
      await logActivity('RePayment', 'delete', `دفعة - ${payment.tenant_name} (${payment.unit_number})`, payment, null, null, user);
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);
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
            <SelectItem value="all">{isAr ? 'كل السنوات' : 'All Years'}</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
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
              )) : paginatedData.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noPayments')}</td></tr>
              ) : paginatedData.map((p, i) => {
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
        )) : paginatedData.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('noPayments')}</div>
        ) : paginatedData.map((p) => {
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl card-bevel flex-wrap">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors">
            <ChevronRight size={18} />
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-navy text-white'
                    : 'border hover:bg-muted'
                }`}
                style={currentPage === page ? { backgroundColor: '#1B2B4B' } : {}}>
                {page}
              </button>
            ))}
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
            className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs text-muted-foreground ml-auto">{isAr ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}</span>
        </div>
      )}

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />

      {/* View Dialog + Add/Edit Dialog — باقي نفس الأصل بدون تغيير */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-md font-cairo"><DialogHeader><DialogTitle>بيانات الدفعة</DialogTitle></DialogHeader>{viewItem && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm"><div className="space-y-0.5"><p className="text-xs text-muted-foreground">اسم المستأجر</p><p className="font-semibold" style={{ color: '#1B2B4B' }}>{viewItem.tenant_name}</p></div><div className="space-y-0.5"><p className="text-xs text-muted-foreground">رقم الشقة او المنزل</p><p className="font-semibold">{viewItem.unit_number || '-'}</p></div><div className="space-y-0.5"><p className="text-xs text-muted-foreground">المبلغ</p><p className="font-bold text-lg" style={{ color: '#2A9D8F' }}>{(viewItem.amount || 0).toLocaleString()} AED</p></div></div></div>}<DialogFooter><Button variant="outline" onClick={() => setViewItem(null)}>إغلاق</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md font-cairo max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editItem ? t('editPayment') : t('addPayment')}</DialogTitle></DialogHeader><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2"><div className="space-y-1.5"><Label>{t('tenantName')} *</Label><Input value={form.tenant_name} onChange={e => setForm(p => ({ ...p, tenant_name: e.target.value }))} /></div></div>{inlineError && <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium animate-fade-in-up" style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946', border: '1px solid rgba(230,57,70,0.2)' }}>{inlineError}</div>}<DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving || uploading} style={{ backgroundColor: '#1B2B4B' }}>{saving ? t('saving_') : t('savePayment')}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}