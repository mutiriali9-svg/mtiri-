import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Plus, Search, Edit2, Trash2, ImagePlus, X, CalendarRange, FileImage } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const categoryColors = {
  maintenance: '#1B2B4B', salary: '#C9A84C', utilities: '#2A9D8F', equipment: '#7C3AED',
  cleaning: '#0EA5E9', admin: '#64748B', marketing: '#F97316', insurance: '#E63946', savings: '#059669', other: '#94A3B8'
};

const emptyExpense = {
  description: '', amount: '', expense_date: '', category: 'maintenance',
  unit_number: '', vendor: '', invoice_number: '', notes: ''
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyExpense);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [image, setImage] = useState(null);
  const [imageType, setImageType] = useState('image');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const fileRef = useRef();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLang();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const categoryLabels = {
    maintenance: t('maintenance_cat'), salary: t('salary'), utilities: t('utilities'),
    equipment: t('equipment'), cleaning: t('cleaning'), admin: t('admin'),
    marketing: t('marketing'), insurance: t('insurance'), savings: t('savings_cat'), other: t('other_cat')
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    // التحقق من حجم الملف (الحد الأقصى 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ description: 'حجم الملف كبير جداً، يرجى اختيار ملف أقل من 5MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    setImageType(file.type === 'application/pdf' ? 'pdf' : 'image');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImage(file_url);
      setErrors(p => ({ ...p, image: false }));
    } catch (err) {
      toast({ description: 'فشل رفع الصورة، يرجى المحاولة مرة أخرى', variant: 'destructive' });
    }
    setUploading(false);
  };

  const fetchData = () => {
    setLoading(true);
    base44.entities.Expense.list('-expense_date').then(data => {
      setExpenses(data);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditItem(null); setForm(emptyExpense); setImage(null); setImageType('image'); setErrors({}); setDialogOpen(true); };
  const openEdit = (e) => { setEditItem(e); setForm({ ...emptyExpense, ...e }); setImage(e.invoice_image_url || null); setImageType(e.invoice_image_url?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'); setErrors({}); setDialogOpen(true); };

  const logActivity = (action, expense, oldData = null, newData = null) => {
    base44.functions.invoke('logActivity', {
      action,
      entity_type: 'Expense',
      entity_id: expense?.id || '',
      entity_label: `مصروف: ${expense?.description || ''} - ${expense?.amount?.toLocaleString()} AED`,
      changes_summary: action === 'create' ? `إضافة مصروف ${expense?.description}` : action === 'update' ? `تعديل مصروف ${expense?.description}` : `حذف مصروف ${expense?.description}`,
      old_data: oldData,
      new_data: newData,
    }).catch(() => {});
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.description?.trim()) newErrors.description = true;
    if (!form.amount || parseFloat(form.amount) <= 0) newErrors.amount = true;
    if (!form.expense_date) newErrors.expense_date = true;
    // الصورة إجبارية في كل التصنيفات ما عدا "أخرى"
    if (form.category !== 'other' && !image) newErrors.image = true;
    // الملاحظات إجبارية إذا التصنيف "أخرى"
    if (form.category === 'other' && !form.notes?.trim()) newErrors.notes = true;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) || 0 };
    if (image) data.invoice_image_url = image;
    if (editItem) {
      await base44.entities.Expense.update(editItem.id, data);
      logActivity('update', { ...editItem, ...data }, editItem, data);
      toast({ description: t('expenseUpdated') });
    } else {
      const created = await base44.entities.Expense.create(data);
      logActivity('create', { ...data, id: created?.id }, null, data);
      toast({ description: t('expenseAdded') });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = (id) => {
    const expense = expenses.find(e => e.id === id);
    setConfirmDelete({ message: 'هل تريد حذف هذا المصروف؟', onConfirm: async () => {
      await base44.entities.Expense.delete(id);
      logActivity('delete', { ...expense, id }, expense, null);
      toast({ description: t('expenseDeleted') });
      setConfirmDelete(null);
      fetchData();
    }});
  };

  const availableYears = [...new Set(expenses.map(e => e.expense_date?.slice(0,4)).filter(Boolean))].sort((a,b) => b-a);

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.description?.toLowerCase().includes(q) || e.vendor?.toLowerCase().includes(q);
    const matchC = catFilter === 'all' || e.category === catFilter;
    const matchFrom = !dateFrom || (e.expense_date && e.expense_date >= dateFrom);
    const matchTo = !dateTo || (e.expense_date && e.expense_date <= dateTo);
    const matchY = yearFilter === 'all' || e.expense_date?.startsWith(yearFilter);
    return matchQ && matchC && matchFrom && matchTo && matchY;
  });

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('ar-AE') : n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const catBreakdown = Object.keys(categoryLabels).map(k => ({
    key: k, label: categoryLabels[k],
    total: expenses.filter(e => e.category === k).reduce((s, e) => s + (e.amount || 0), 0),
    count: expenses.filter(e => e.category === k).length,
    color: categoryColors[k],
  })).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        titleAr="المصاريف والتكاليف"
        titleEn="Expenses & Costs"
        description={`${expenses.length} — ${t('total')}: ${fmt(total)} AED`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#1B2B4B' }}>
            <Plus size={16} /> {t('addExpense')}
          </Button>
        )}
      />

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {catBreakdown.slice(0, 5).map(c => (
          <div key={c.key} className="bg-white card-bevel rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setCatFilter(catFilter === c.key ? 'all' : c.key)}
            style={{ borderRight: `3px solid ${c.color}`, opacity: catFilter !== 'all' && catFilter !== c.key ? 0.5 : 1 }}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-bold text-sm mt-1" style={{ color: c.color }}>{fmt(c.total)} AED</p>
            <p className="text-xs text-muted-foreground">{c.count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white card-bevel rounded-xl p-3 sm:p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-44">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input
            placeholder={t('searchExpenses')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 text-sm h-9"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder={t('category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28 h-9 text-sm">
            <SelectValue placeholder="السنة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل السنوات</SelectItem>
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
          {(dateFrom || dateTo || catFilter !== 'all' || search || yearFilter !== 'all') && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5"
              onClick={() => { setDateFrom(''); setDateTo(''); setCatFilter('all'); setSearch(''); setYearFilter('all'); }}>
              <X size={13} /> مسح
            </Button>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="bg-navy rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: '#1B2B4B' }}>
        <div>
          <p className="text-white/60 text-xs">{t('totalExpensesShown')}</p>
          <p className="text-2xl font-bold text-white">{fmt(total)} <span className="text-sm text-white/60">AED</span></p>
        </div>
        <div>
          <p className="text-white/60 text-xs">{t('expenseCount')}</p>
          <p className="text-2xl font-bold" style={{ color: '#C9A84C' }}>{filtered.length}</p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#1B2B4B' }}>
              <tr>
                {[t('details'), t('amount'), t('date'), t('category'), t('vendor'), t('unitNumber'), ''].map(h => (
                  <th key={h} className="text-right py-3 px-4 text-white/80 font-medium text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t('noExpenses')}</td></tr>
              ) : filtered.map((e, i) => (
                <tr key={e.id} onClick={() => setViewItem(e)} className={`border-b border-border/50 hover:bg-surface transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-[#F8F9FA]' : ''}`}>
                  <td className="py-3 px-4 font-medium max-w-48" style={{ color: '#1B2B4B' }}>
                    <p className="truncate">{e.description}</p>
                    {e.invoice_number && <p className="text-xs text-muted-foreground">#{e.invoice_number}</p>}
                  </td>
                  <td className="py-3 px-4 font-bold" style={{ color: '#E63946' }}>
                    {fmt(e.amount || 0)} <span className="text-xs font-normal text-muted-foreground">AED</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{e.expense_date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${categoryColors[e.category]}18`,
                        color: categoryColors[e.category]
                      }}>
                      {categoryLabels[e.category] || e.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{e.vendor || '-'}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{e.unit_number || '-'}</td>
                  <td className="py-3 px-4" onClick={ev => ev.stopPropagation()}>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-navy">
                          <Edit2 size={14} />
                        </button>
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white card-bevel rounded-xl p-3">
              <div className="h-3 bg-muted rounded animate-pulse mb-1.5" />
              <div className="h-2.5 bg-muted rounded animate-pulse w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-8 text-center text-muted-foreground text-sm">{t('noExpenses')}</div>
        ) : filtered.map((e) => (
          <div key={e.id} onClick={() => setViewItem(e)} className="bg-white card-bevel rounded-xl p-2.5 hover:shadow-sm transition-shadow cursor-pointer active:bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm truncate" style={{ color: '#1B2B4B' }}>{e.description}</h3>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                    style={{ backgroundColor: `${categoryColors[e.category]}18`, color: categoryColors[e.category] }}>
                    {categoryLabels[e.category] || e.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground">{e.expense_date}</span>
                  {e.vendor && <span className="text-xs text-muted-foreground truncate">{e.vendor}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: '#E63946' }}>{fmt(e.amount || 0)}</p>
                  <p className="text-[10px] text-muted-foreground text-left">AED</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5" onClick={ev => ev.stopPropagation()}>
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                      <Edit2 size={13} />
                    </button>
                    {user?.role === 'admin' && (
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />

      {/* View Details Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-md font-cairo">
          <DialogHeader>
            <DialogTitle>تفاصيل المصروف</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">التفاصيل</span>
                <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{viewItem.description}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">المبلغ</span>
                <span className="font-bold text-lg" style={{ color: '#E63946' }}>{fmt(viewItem.amount || 0)} AED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">التاريخ</span>
                <span className="text-sm">{viewItem.expense_date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">التصنيف</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: `${categoryColors[viewItem.category]}18`, color: categoryColors[viewItem.category] }}>
                  {categoryLabels[viewItem.category] || viewItem.category}
                </span>
              </div>
              {viewItem.vendor && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">المورد</span>
                  <span className="text-sm">{viewItem.vendor}</span>
                </div>
              )}
              {viewItem.invoice_number && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">رقم الفاتورة</span>
                  <span className="text-sm">#{viewItem.invoice_number}</span>
                </div>
              )}
              {viewItem.unit_number && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">رقم الوحدة</span>
                  <span className="text-sm">{viewItem.unit_number}</span>
                </div>
              )}
              {viewItem.notes && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">ملاحظات</span>
                  <span className="text-sm text-left">{viewItem.notes}</span>
                </div>
              )}
              {viewItem.invoice_image_url && (
                <div className="space-y-2 pt-1">
                  <span className="text-muted-foreground text-sm">صورة الفاتورة</span>
                  {viewItem.invoice_image_url.toLowerCase().endsWith('.pdf') ? (
                    <a href={viewItem.invoice_image_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm underline" style={{ color: '#1B2B4B' }}>
                      <FileImage size={16} style={{ color: '#C9A84C' }} /> عرض ملف PDF
                    </a>
                  ) : (
                    <img src={viewItem.invoice_image_url} alt="invoice" className="w-full max-h-56 object-contain rounded-lg border border-border" />
                  )}
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => { setViewItem(null); openEdit(viewItem); }} style={{ backgroundColor: '#1B2B4B' }}>
                    <Edit2 size={14} /> تعديل
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md font-cairo max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? t('editExpense') : t('addNewExpense')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className={errors.description ? 'text-destructive' : ''}>{t('expenseDetails')} *</Label>
              <Input value={form.description} onChange={e => { setForm(p => ({ ...p, description: e.target.value })); setErrors(p => ({ ...p, description: false })); }}
                className={errors.description ? 'border-destructive focus-visible:ring-destructive' : ''} />
              {errors.description && <p className="text-xs text-destructive">هذا الحقل مطلوب</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={errors.amount ? 'text-destructive' : ''}>{t('amountAED') || `${t('amount')} (AED)`} *</Label>
              <Input type="number" value={form.amount} onChange={e => { setForm(p => ({ ...p, amount: e.target.value })); setErrors(p => ({ ...p, amount: false })); }}
                className={errors.amount ? 'border-destructive focus-visible:ring-destructive' : ''} />
              {errors.amount && <p className="text-xs text-destructive">أدخل مبلغاً صحيحاً</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={errors.expense_date ? 'text-destructive' : ''}>{t('date')} *</Label>
              <Input type="date" value={form.expense_date} onChange={e => { setForm(p => ({ ...p, expense_date: e.target.value })); setErrors(p => ({ ...p, expense_date: false })); }}
                className={errors.expense_date ? 'border-destructive focus-visible:ring-destructive' : ''} />
              {errors.expense_date && <p className="text-xs text-destructive">هذا الحقل مطلوب</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t('category')}</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('vendor')}</Label>
              <Input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('invoiceNumber')}</Label>
              <Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('optionalUnit')}</Label>
              <Input value={form.unit_number} onChange={e => setForm(p => ({ ...p, unit_number: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className={errors.notes ? 'text-destructive' : ''}>
                {t('notes')} {form.category === 'other' ? '*' : ''}
              </Label>
              <Input value={form.notes}
                onChange={e => { setForm(p => ({ ...p, notes: e.target.value })); setErrors(p => ({ ...p, notes: false })); }}
                className={errors.notes ? 'border-destructive focus-visible:ring-destructive' : ''}
                placeholder={form.category === 'other' ? 'مطلوب عند اختيار تصنيف أخرى' : ''} />
              {errors.notes && <p className="text-xs text-destructive">هذا الحقل مطلوب عند اختيار تصنيف أخرى</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className={errors.image ? 'text-destructive' : ''}>
                {t('invoiceImage')} *
              </Label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => handleImageUpload(e.target.files[0])} />
              {errors.image && <p className="text-xs text-destructive">صورة الفاتورة مطلوبة</p>}
              {image ? (
                <div className="relative w-full rounded-lg overflow-hidden border border-border bg-muted p-3">
                  {imageType === 'pdf' ? (
                    <div className="flex items-center gap-2 py-2">
                      <FileImage size={20} style={{ color: '#C9A84C' }} />
                      <a href={image} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:opacity-70" style={{ color: '#1B2B4B' }}>عرض الملف PDF</a>
                    </div>
                  ) : (
                    <img src={image} alt="invoice" className="w-full max-h-48 object-contain" />
                  )}
                  <button type="button" onClick={() => { setImage(null); setImageType('image'); }}
                    className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current.click()} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-4 text-sm text-muted-foreground hover:border-gold hover:text-foreground transition-colors">
                  <ImagePlus size={18} style={{ color: '#C9A84C' }} />
                  {uploading ? t('uploading') : t('uploadInvoice')}
                </button>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || uploading} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? t('saving_') : t('saveExpense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}