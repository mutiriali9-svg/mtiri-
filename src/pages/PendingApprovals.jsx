import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { CheckCircle2, XCircle, Clock, User, CreditCard, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const statusLabels = { pending: 'بانتظار الموافقة', approved: 'مقبول', rejected: 'مرفوض' };

const paymentMethodLabel = { cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى' };

export default function PendingApprovals() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.PendingEntry.list('-created_date', 100);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (entry) => {
    setProcessing(true);
    // Save to actual Payment entity
    const d = entry.data || {};
    await base44.entities.Payment.create({
      tenant_name: d.tenant_name || '',
      unit_number: d.unit_number || '',
      amount: d.amount || 0,
      payment_date: d.payment_date || '',
      due_months: d.due_months || '',
      payment_method: d.payment_method || 'bank_transfer',
      receipt_number: d.receipt_number || '',
      notes: d.notes || '',
      status: d.status || 'paid',
    });
    await base44.entities.PendingEntry.update(entry.id, { status: 'approved' });
    setSelected(null);
    setProcessing(false);
    load();
  };

  const handleReject = async (entry) => {
    setProcessing(true);
    await base44.entities.PendingEntry.update(entry.id, { status: 'rejected' });
    setSelected(null);
    setProcessing(false);
    load();
  };

  const filtered = entries.filter(e => filter === 'all' ? true : e.status === filter);
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#1B2B4B' }}>
            الموافقة على البيانات
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#E63946' }}>
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">مراجعة البيانات المُدخلة من مدخلي البيانات</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 bg-muted/40 rounded-xl p-1 w-fit">
        {[
          { key: 'pending', label: `بانتظار الموافقة${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'approved', label: 'مقبول' },
          { key: 'rejected', label: 'مرفوض' },
          { key: 'all', label: 'الكل' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === tab.key ? 'bg-white shadow-sm text-navy-deep' : 'text-muted-foreground hover:text-foreground'}`}
            style={filter === tab.key ? { color: '#1B2B4B' } : {}}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p>{filter === 'pending' ? 'لا توجد بيانات بانتظار الموافقة' : 'لا توجد سجلات'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => {
            const d = entry.data || {};
            return (
              <div key={entry.id} className="bg-white card-bevel rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(27,43,75,0.08)' }}>
                    <CreditCard size={18} style={{ color: '#1B2B4B' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{d.tenant_name || '—'} · وحدة {d.unit_number || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {(d.amount || 0).toLocaleString('ar-AE')} درهم · {d.payment_date || ''}
                      {entry.submitted_by_name && <span className="mr-2 flex items-center gap-1 inline-flex"><User size={11} /> {entry.submitted_by_name}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[entry.status]}`}>
                    {statusLabels[entry.status]}
                  </span>
                  <button onClick={() => setSelected(entry)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Eye size={15} />
                  </button>
                  {entry.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(entry)} disabled={processing}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors">
                        <CheckCircle2 size={17} />
                      </button>
                      <button onClick={() => handleReject(entry)} disabled={processing}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                        <XCircle size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تفاصيل الإدخال</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {[
                ['المستأجر', selected.data?.tenant_name],
                ['رقم الوحدة', selected.data?.unit_number],
                ['المبلغ', `${(selected.data?.amount || 0).toLocaleString('ar-AE')} درهم`],
                ['تاريخ الدفع', selected.data?.payment_date],
                ['طريقة الدفع', paymentMethodLabel[selected.data?.payment_method] || selected.data?.payment_method],
                ['مستحق لشهر/أشهر', selected.data?.due_months],
                ['رقم الإيصال', selected.data?.receipt_number],
                ['ملاحظات', selected.data?.notes],
                ['مُدخل بواسطة', selected.submitted_by_name],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {selected.data?.receipt_image && (
                <div>
                  <p className="text-muted-foreground mb-1">صورة الإيصال</p>
                  <img src={selected.data.receipt_image} alt="receipt" className="w-full rounded-lg border border-border max-h-48 object-contain bg-muted" />
                </div>
              )}
            </div>
            {selected.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button onClick={() => handleApprove(selected)} disabled={processing} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 size={16} /> قبول وإضافة للحسابات
                </Button>
                <Button onClick={() => handleReject(selected)} disabled={processing} variant="destructive" className="flex-1 gap-2">
                  <XCircle size={16} /> رفض
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}