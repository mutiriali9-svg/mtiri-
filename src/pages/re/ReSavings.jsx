import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useLang } from '@/lib/LanguageContext';
import { Wallet, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const INIT = { description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '', category: 'savings' };
const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('ar-AE') : n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReSavings() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(INIT);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { t, lang } = useLang();

  const fetchData = () => {
    base44.entities.ReExpense.filter({ category: 'savings' }).then(data => {
      setRecords(data.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)));
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!formData.description || !formData.amount) { toast.error(t('fillRequired')); return; }
    await base44.entities.ReExpense.create({ ...formData, amount: Number(formData.amount), category: 'savings' });
    toast.success(t('savingAdded'));
    setFormData(INIT);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = (id) => {
    setConfirmDelete({ message: t('confirmDeleteSaving'), onConfirm: async () => {
      await base44.entities.ReExpense.delete(id);
      setRecords(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
      toast.success(t('savingDeleted'));
    }});
  };

  const total = records.reduce((sum, s) => sum + (s.amount || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFF8E7' }}>
            <Wallet size={20} style={{ color: '#C9A84C' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('savingsTitle')} — العقارات</h1>
            <p className="text-xs text-muted-foreground">{t('savingsSubTitle')}</p>
          </div>
        </div>
        <Button onClick={() => { setFormData(INIT); setDialogOpen(true); }} className="gap-2" style={{ backgroundColor: '#1B2B4B' }}>
          <Plus size={18} /> {t('addSaving')}
        </Button>
      </div>

      <div className="bg-white rounded-xl card-bevel p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FBF9' }}>
          <Wallet size={28} style={{ color: '#2A9D8F' }} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('totalSavings')}</p>
          <p className="text-3xl font-bold" style={{ color: '#2A9D8F' }}>{fmt(total)} AED</p>
        </div>
      </div>

      <div className="bg-white rounded-xl card-bevel overflow-hidden hidden md:block">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold" style={{ color: '#1B2B4B' }}>{t('savingsRecord')}</h2>
        </div>
        {records.length === 0 ? <div className="p-8 text-center text-muted-foreground">{t('noSavings')}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-muted-foreground text-xs">
                <th className="text-right px-5 py-3 font-medium">{t('description_col')}</th>
                <th className="text-right px-5 py-3 font-medium">{t('amount')}</th>
                <th className="text-right px-5 py-3 font-medium">{t('date')}</th>
                <th className="text-right px-5 py-3 font-medium">{t('notes')}</th>
                <th className="text-right px-5 py-3 font-medium">{t('delete')}</th>
              </tr></thead>
              <tbody>
                {records.map((s, i) => (
                  <tr key={s.id} className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#1B2B4B' }}>{s.description}</td>
                    <td className="px-5 py-3.5 font-bold" style={{ color: '#2A9D8F' }}>{fmt(s.amount || 0)} AED</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{s.expense_date ? new Date(s.expense_date).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US') : '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{s.notes || '—'}</td>
                    <td className="px-5 py-3.5"><button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-muted rounded transition-colors"><Trash2 size={16} className="text-red-500" /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td className="px-5 py-3" style={{ color: '#1B2B4B' }}>{t('totalRow_i')}</td>
                <td className="px-5 py-3" style={{ color: '#2A9D8F' }}>{fmt(total)} AED</td>
                <td colSpan={3} />
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="md:hidden space-y-3">
        {records.length === 0 ? <div className="bg-white rounded-xl card-bevel p-8 text-center text-muted-foreground">{t('noSavings')}</div> : records.map((s) => (
          <div key={s.id} className="bg-white rounded-xl card-bevel p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{s.description}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.expense_date).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')}</p>
              </div>
              <p className="text-xl font-bold" style={{ color: '#2A9D8F' }}>{fmt(s.amount || 0)} AED</p>
            </div>
            {s.notes && <p className="text-xs text-muted-foreground mb-3">{s.notes}</p>}
            <button onClick={() => handleDelete(s.id)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive">
              <Trash2 size={14} />{t('delete')}
            </button>
          </div>
        ))}
        <div className="bg-muted/30 rounded-xl card-bevel p-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{t('totalRow_i')}</span>
            <span className="font-bold text-lg" style={{ color: '#2A9D8F' }}>{fmt(total)} AED</span>
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('addSavingTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-muted-foreground">{t('savingsDescription')}</label><Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">{t('savingsAmount')}</label><Input type="number" placeholder="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">{t('savingsDate')}</label><Input type="date" value={formData.expense_date} onChange={e => setFormData({ ...formData, expense_date: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">{t('notes')}</label><Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
              <Button onClick={handleSave} style={{ backgroundColor: '#1B2B4B' }}>{t('add')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}