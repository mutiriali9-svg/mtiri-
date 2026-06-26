import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useLang } from '@/lib/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2, Clock, User, Filter } from 'lucide-react';
import { format } from 'date-fns';

const actionConfig = {
  create: { label: 'إضافة', labelEn: 'Create', color: 'bg-green-100 text-green-700 border-green-200' },
  update: { label: 'تعديل', labelEn: 'Update', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  delete: { label: 'حذف', labelEn: 'Delete', color: 'bg-red-100 text-red-700 border-red-200' },
};

const entityLabels = {
  Unit: { ar: 'وحدة (القرية)', en: 'Unit (Qarya)' },
  Payment: { ar: 'دفعة (القرية)', en: 'Payment (Qarya)' },
  Expense: { ar: 'مصروف (القرية)', en: 'Expense (Qarya)' },
  ReUnit: { ar: 'وحدة (عقارية)', en: 'Unit (RE)' },
  RePayment: { ar: 'دفعة (عقارية)', en: 'Payment (RE)' },
  ReExpense: { ar: 'مصروف (عقارية)', en: 'Expense (RE)' },
};

const ActionIcon = ({ action }) => {
  if (action === 'create') return <Plus className="w-3.5 h-3.5" />;
  if (action === 'update') return <Pencil className="w-3.5 h-3.5" />;
  if (action === 'delete') return <Trash2 className="w-3.5 h-3.5" />;
  return null;
};

export default function ActivityLogPage() {
  const { lang } = useLang();
  const isAr = lang === 'ar';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await base44.supabase
  .from('activity_logs')
  .select('*')
  .order('created_date', { ascending: false })
  .limit(200)
  .then(res => res.data || [])
  .catch(err => { console.error(err); return []; });
      setLogs(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.entity_label?.includes(search) ||
      log.performed_by_name?.includes(search) ||
      log.changes_summary?.includes(search);
    const matchAction = filterAction === 'all' || log.action === filterAction;
    const matchEntity = filterEntity === 'all' || log.entity_type === filterEntity;
    return matchSearch && matchAction && matchEntity;
  });

  const stats = {
    create: logs.filter(l => l.action === 'create').length,
    update: logs.filter(l => l.action === 'update').length,
    delete: logs.filter(l => l.action === 'delete').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy">{isAr ? 'سجل العمليات' : 'Activity Log'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAr ? 'مراقبة جميع العمليات على البيانات' : 'Monitor all data operations'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'create', icon: Plus, label: isAr ? 'إضافة' : 'Created', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
          { key: 'update', icon: Pencil, label: isAr ? 'تعديل' : 'Updated', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
          { key: 'delete', icon: Trash2, label: isAr ? 'حذف' : 'Deleted', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
        ].map(s => (
          <div key={s.key} className={`${s.bg} ${s.border} border rounded-xl p-3 text-center`}>
            <div className={`text-2xl font-bold ${s.text}`}>{stats[s.key]}</div>
            <div className={`text-xs ${s.text} mt-0.5`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pr-8"
            placeholder={isAr ? 'بحث...' : 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={isAr ? 'نوع العملية' : 'Action'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? 'كل العمليات' : 'All Actions'}</SelectItem>
            <SelectItem value="create">{isAr ? 'إضافة' : 'Create'}</SelectItem>
            <SelectItem value="update">{isAr ? 'تعديل' : 'Update'}</SelectItem>
            <SelectItem value="delete">{isAr ? 'حذف' : 'Delete'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={isAr ? 'نوع السجل' : 'Entity'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? 'الكل' : 'All'}</SelectItem>
            {Object.entries(entityLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{isAr ? v.ar : v.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log List */}
      {loading ? (
        <div className="text-center text-muted-foreground py-16">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">{isAr ? 'لا توجد سجلات' : 'No logs found'}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const cfg = actionConfig[log.action] || actionConfig.update;
            const entityInfo = entityLabels[log.entity_type];
            const isExpanded = expandedId === log.id;
            return (
              <div
                key={log.id}
                className="bg-white border border-border rounded-xl p-3.5 cursor-pointer hover:border-navy/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${cfg.color} border text-xs flex items-center gap-1 py-0.5`}>
                      <ActionIcon action={log.action} />
                      {isAr ? cfg.label : cfg.labelEn}
                    </Badge>
                    {entityInfo && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {isAr ? entityInfo.ar : entityInfo.en}
                      </span>
                    )}
                    {log.entity_label && (
                      <span className="text-sm font-medium text-navy">{log.entity_label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {log.created_date ? format(new Date(log.created_date), 'dd/MM/yyyy HH:mm') : '-'}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {log.performed_by_name}
                    {log.performed_by_role && (
                      <span className="mr-1 text-slate-400">({log.performed_by_role})</span>
                    )}
                  </span>
                </div>

                {log.changes_summary && (
                  <p className="text-xs text-muted-foreground mt-1.5 border-t pt-1.5">{log.changes_summary}</p>
                )}

                {isExpanded && (log.old_data || log.new_data) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
                    {log.old_data && (
                      <div>
                        <div className="text-xs font-semibold text-red-600 mb-1">{isAr ? 'قبل التعديل' : 'Before'}</div>
                        <pre className="text-xs bg-red-50 rounded-lg p-2 overflow-auto max-h-40 text-slate-700">
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_data && (
                      <div>
                        <div className="text-xs font-semibold text-green-600 mb-1">{isAr ? 'بعد التعديل' : 'After'}</div>
                        <pre className="text-xs bg-green-50 rounded-lg p-2 overflow-auto max-h-40 text-slate-700">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}