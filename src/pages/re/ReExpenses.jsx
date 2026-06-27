import { useState, useEffect, useRef } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const categoryColors = {
  maintenance: '#1B2B4B', salary: '#C9A84C', utilities: '#2A9D8F', equipment: '#7C3AED',
  cleaning: '#0EA5E9', admin: '#64748B', marketing: '#F97316', insurance: '#E63946', savings: '#059669', other: '#94A3B8'
};

const emptyExpense = { description: '', amount: '', expense_date: '', category: 'maintenance', unit_number: '', vendor: '', invoice_number: '', notes: '' };

export default function ReExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyExpense);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null);
  const [imageType, setImageType] = useState('image');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileRef = useRef();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const canEdit = user?.role === 'admin';

  const itemsPerPage = 35;

  const categoryLabels = {
    maintenance: t('maintenance_cat'), salary: t('salary'), utilities: t('utilities'),
    equipment: t('equipment'), cleaning: t('cleaning'), admin: t('admin'),
    marketing: t('marketing'), insurance: t('insurance'), savings: t('savings_cat'), other: t('other_cat')
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setImageType(file.type === 'application/pdf' ? 'pdf' : 'image');
    const { file_url } = await uploadFile(file);
    setImage(file_url);
    setUploading(false);
  };

  const fetchData = () => {
    setLoading(true);
    base44.entities.ReExpense.list('-expense_date').then(data => { setExpenses(data); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => { setCurrentPage(1); }, [search, catFilter, yearFilter]);

  const openAdd = () => { setEditItem(null); setForm(emptyExpense); setImage(null); setImageType('image'); setDialogOpen(true); };
  const openEdit = (e) => { setEditItem(e); setForm({ ...emptyExpense, ...e }); setImage(null); setImageType('image'); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) || 0 };
    if (image) data.notes = (data.notes ? data.notes + '\n' : '') + '[Invoice]: ' + image;
    if (editItem) {
      await base44.entities.ReExpense.update(editItem.id, data);
      await logActivity('ReExpense', 'update', `مصروف - ${form.description}`, editItem, data, null, user);
      toast({ description: t('expenseUpdated') });
    } else {
      const created = await base44.entities.ReExpense.create(data);
      await logActivity('ReExpense', 'create', `مصروف - ${form.description}`, null, data, null, user);
      base44.entities.Notification.create({
        type: 're_expense',
        title: `مصروف عقارات — ${data.description}`,
        amount: data.amount,
        reference_id: created?.id || '',
        reference_data: data,
        is_read: false,
      }).catch(() => {});
      toast({ description: t('expenseAdded') });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = (id) => {
    const expense = expenses.find(e => e.id === id);
    setConfirmDelete({ message: t('deleteExpenseConfirm'), onConfirm: async () => {
      await base44.entities.ReExpense.delete(id);
      await logActivity('ReExpense', 'delete', `مصروف - ${expense.description}`, expense, null, null, user);
      toast({ description: t('expenseDeleted') });
      setConfirmDelete(null);
      fetchData();
    }});
  };

  const availableYears = [...new Set(expenses.map(e => e.expense_date?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.description?.toLowerCase().includes(q) || e.vendor?.toLowerCase().includes(q);
    const matchC = catFilter === 'all' || e.category === catFilter;
    const matchY = yearFilter === 'all' || e.expense_date?.startsWith(yearFilter);
    return matchQ && matchC && matchY;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);
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
        titleAr="المصاريف - العقارات"
        titleEn="RE Expenses"
        description={`${expenses.length} — ${t('total')}: ${fmt(total)} AED`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#1B2B4B' }}>
            <Plus size={16} /> {t('addExpense')}
          </Button>
        )}
      />

      {/* Category Breakdown */}
      {catBreakdown.length > 0 && (
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
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input placeholder={t('searchExpenses')} value={search} onChange={e => setSearch(e.target.value)} className="pr-9 text-sm" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('category')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              {loading ? Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-border">{Array(7).fill(0).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
              )) : paginatedData.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t('noExpenses')}</td></tr>
              ) : paginatedData.map((e, i) => (
                <tr key={e.id} className={`border-b border-border/50 hover:bg-surface transition-colors ${i % 2 === 1 ? 'bg-[#F8F9FA]' : ''}`}>
                  <td className="py-3 px-4 font-medium max-w-48" style={{ color: '#1B2B4B' }}>
                    <p className="truncate">{e.description}</p>
                    {e.invoice_number && <p className="text-xs text-muted-foreground">#{e.invoice_number}</p>}
                  </td>
                  <td className="py-3 px-4 font-bold" style={{ color: '#E63946' }}>{fmt(e.amount || 0)} <span className="text-xs font-normal text-muted-foreground">AED</span></td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{e.expense_date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${categoryColors[e.category]}18`, color: categoryColors[e.category] }}>
                      {categoryLabels[e.category] || e.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{e.vendor || '-'}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{e.unit_number || '-'}</td>
                  <td className="py-3 px-4">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-navy"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
      <div className="md:hidden space-y-3">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white card-bevel rounded-xl p-4"><div className="h-4 bg-muted rounded animate-pulse mb-2" /><div className="h-3 bg-muted rounded animate-pulse w-2/3" /></div>
        )) : paginatedData.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('noExpenses')}</div>
        ) : paginatedData.map((e) => (
          <div key={e.id} className="bg-white card-bevel rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{e.description}</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ backgroundColor: `${categoryColors[e.category]}18`, color: categoryColors[e.category] }}>
                {categoryLabels[e.category] || e.category}
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-lg font-bold" style={{ color: '#E63946' }}>{fmt(e.amount || 0)} <span className="text-xs font-normal">AED</span></p>
              <p className="text-sm text-muted-foreground">{e.expense_date}</p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button onClick={() => openEdit(e)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm"><Edit2 size={14} />{t('edit')}</button>
                <button onClick={() => handleDelete(e.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive"><Trash2 size={14} />{t('delete')}</button>
              </div>
            )}
          </div>
        ))}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md font-cairo max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? t('editExpense') : t('addNewExpense')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1.5"><Label>{t('expenseDetails')}</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('amountAED')}</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('date')} *</Label><Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('category')}</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('vendor')}</Label><Input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('invoiceNumber')}</Label><Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('optionalUnit')}</Label><Input value={form.unit_number} onChange={e => setForm(p => ({ ...p, unit_number: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1.5"><Label>{t('notes')}</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || uploading} style={{ backgroundColor: '#1B2B4B' }}>{saving ? t('saving_') : t('saveExpense')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}