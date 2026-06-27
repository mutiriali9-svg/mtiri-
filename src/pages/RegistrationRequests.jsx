import { useState, useEffect } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { logActivity } from '@/utils/activityLogger';
import { Check, X, User, Phone, Mail, AtSign, Clock, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import MobileDrawerSelect from '@/components/MobileDrawerSelect';
import ConfirmDialog from '@/components/ConfirmDialog';

const statusConfig = {
  pending:  { label: { ar: 'قيد الانتظار', en: 'Pending' },  color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  approved: { label: { ar: 'مقبول',        en: 'Approved' }, color: '#2A9D8F', bg: 'rgba(42,157,143,0.12)' },
  rejected: { label: { ar: 'مرفوض',        en: 'Rejected' }, color: '#E63946', bg: 'rgba(230,57,70,0.12)'  },
};

const roleLabels = {
  data_entry: { ar: 'مدخل بيانات', en: 'Data Entry' },
  investor:   { ar: 'مستثمر',      en: 'Investor' },
  admin:      { ar: 'مسؤول',       en: 'Admin' },
};

const ROLE_OPTIONS_BY_LANG = {
  ar: [
    { value: 'data_entry', label: 'مدخل بيانات' },
    { value: 'investor', label: 'مستثمر' },
    { value: 'admin', label: 'مسؤول' },
  ],
  en: [
    { value: 'data_entry', label: 'Data Entry' },
    { value: 'investor', label: 'Investor' },
    { value: 'admin', label: 'Admin' },
  ],
};

export default function RegistrationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [confirmReject, setConfirmReject] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { lang } = useLang();
  const isAr = lang === 'ar';

  const ROLE_OPTIONS = ROLE_OPTIONS_BY_LANG[lang] || ROLE_OPTIONS_BY_LANG.ar;

  const fetchData = () => {
    setLoading(true);
    base44.entities.RegistrationRequest.list('-created_at').then(data => {
      setRequests(data);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-muted-foreground">{isAr ? 'غير مصرح' : 'Not authorized'}</div>;
  }

  const handleApprove = async (req) => {
    const { data: userId } = await supabase.rpc('get_user_id_by_email', { user_email: req.email });
    if (userId) {
      await supabase.from('users').upsert({
        id: userId,
        email: req.email,
        full_name: `${req.first_name} ${req.last_name}`,
        username: req.username,
        phone: req.phone,
        role: req.role || 'data_entry',
      });
    }
    
    const updatePayload = {
      status: 'approved',
      role: req.role || 'data_entry',
    };

    await base44.entities.RegistrationRequest.update(req.id, updatePayload);
    
    await logActivity(
      'RegistrationRequest',
      'update',
      `قبول طلب - ${req.first_name} ${req.last_name} (${req.email})`,
      req,
      updatePayload,
      `تم قبول الطلب وتعيين الدور: ${roleLabels[req.role || 'data_entry']?.[lang] || req.role || 'data_entry'}`,
      user
    );

    toast({ description: isAr ? `تم قبول طلب ${req.first_name} ${req.last_name} ✓` : `Approved request for ${req.first_name} ${req.last_name} ✓` });
    fetchData();
  };

  const handleReject = (req) => {
    setConfirmReject({
      message: isAr ? `هل تريد رفض طلب ${req.first_name} ${req.last_name}؟` : `Reject request from ${req.first_name} ${req.last_name}?`,
      onConfirm: async () => {
        const updatePayload = { status: 'rejected' };
        
        await base44.entities.RegistrationRequest.update(req.id, updatePayload);
        
        await logActivity(
          'RegistrationRequest',
          'update',
          `رفض طلب - ${req.first_name} ${req.last_name} (${req.email})`,
          req,
          updatePayload,
          'تم رفض طلب التسجيل',
          user
        );

        toast({ description: isAr ? `تم رفض الطلب` : `Request rejected` });
        setConfirmReject(null);
        fetchData();
      },
    });
  };

  const handleRoleChange = async (req, role) => {
    const oldData = { ...req };
    const newData = { ...req, role };

    await base44.entities.RegistrationRequest.update(req.id, { role });
    
    await logActivity(
      'RegistrationRequest',
      'update',
      `تغيير الدور - ${req.first_name} ${req.last_name}`,
      oldData,
      newData,
      `تم تغيير الدور من ${roleLabels[req.role]?.[lang] || req.role} إلى ${roleLabels[role]?.[lang] || role}`,
      user
    );

    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, role } : r));
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const tabs = [
    { key: 'pending',  label: isAr ? 'قيد الانتظار' : 'Pending' },
    { key: 'approved', label: isAr ? 'مقبولة' : 'Approved' },
    { key: 'rejected', label: isAr ? 'مرفوضة' : 'Rejected' },
    { key: 'all',      label: isAr ? 'الكل' : 'All' },
  ];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        titleAr="طلبات التسجيل"
        titleEn="Registration Requests"
        description={isAr ? `${pendingCount} طلب في الانتظار` : `${pendingCount} pending request${pendingCount === 1 ? '' : 's'}`}
      />
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
            style={filter === tab.key
              ? { backgroundColor: '#1B2B4B', color: '#fff', borderColor: '#1B2B4B' }
              : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }
            }>
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 && (
              <span className="mr-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white card-bevel rounded-xl p-5">
              <div className="h-4 bg-muted rounded animate-pulse mb-2 w-1/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white card-bevel rounded-xl p-16 text-center text-muted-foreground">{isAr ? 'لا توجد طلبات' : 'No requests'}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const sc = statusConfig[req.status] || statusConfig.pending;
            return (
              <div key={req.id} className="bg-white card-bevel rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base" style={{ color: '#1B2B4B' }}>{req.first_name} {req.last_name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label[lang] || sc.label.ar}</span>
                      {req.status === 'approved' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{(roleLabels[req.role] && (roleLabels[req.role][lang] || roleLabels[req.role].ar)) || req.role}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><AtSign size={13} /> <span className="truncate">{req.username}</span></div>
                      <div className="flex items-center gap-2"><Mail size={13} /> <span className="truncate">{req.email}</span></div>
                      <div className="flex items-center gap-2"><Phone size={13} /> <span>{req.phone}</span></div>
                      <div className="flex items-center gap-2"><Clock size={13} /> <span className="text-xs">{req.created_at ? new Date(req.created_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-GB') : '—'}</span></div>
                    </div>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <MobileDrawerSelect value={req.role || 'data_entry'} onValueChange={v => handleRoleChange(req, v)} options={ROLE_OPTIONS} triggerClassName="w-36 h-9 text-xs" dir={isAr ? 'rtl' : 'ltr'} />
                      <Button size="sm" onClick={() => handleApprove(req)} className="gap-1.5 h-9 text-xs" style={{ backgroundColor: '#2A9D8F' }}>
                        <UserCheck size={14} /> {isAr ? 'قبول' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(req)} className="gap-1.5 h-9 text-xs border-destructive/40 text-destructive hover:bg-destructive/10">
                        <UserX size={14} /> {isAr ? 'رفض' : 'Reject'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!confirmReject} message={confirmReject?.message} onConfirm={confirmReject?.onConfirm} onCancel={() => setConfirmReject(null)} />
    </div>
  );
}