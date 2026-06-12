import { useState, useEffect } from 'react';
const { supabase } = await import('@/api/base44Client');
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Check, X, User, Phone, Mail, AtSign, Clock, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import MobileDrawerSelect from '@/components/MobileDrawerSelect';
import ConfirmDialog from '@/components/ConfirmDialog';

const statusConfig = {
  pending:  { label: 'قيد الانتظار', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  approved: { label: 'مقبول',        color: '#2A9D8F', bg: 'rgba(42,157,143,0.12)' },
  rejected: { label: 'مرفوض',        color: '#E63946', bg: 'rgba(230,57,70,0.12)'  },
};

const roleLabels = {
  data_entry: 'مدخل بيانات',
  investor:   'مستثمر',
  admin:      'مسؤول',
};

const ROLE_OPTIONS = [
  { value: 'data_entry', label: 'مدخل بيانات' },
  { value: 'investor', label: 'مستثمر' },
  { value: 'admin', label: 'مسؤول' },
];

export default function RegistrationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [confirmReject, setConfirmReject] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = () => {
  setLoading(true);
  base44.entities.RegistrationRequest.list('-created_at').then(data => {
    setRequests(data);
    setLoading(false);
  });
};

  useEffect(() => { fetchData(); }, []);

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-muted-foreground">غير مصرح</div>;
  }

  const handleApprove = async (req) => {
  const { supabase } = await import('@/api/base44Client');
  
  // جيب الـ id الصحيح
  const { data: userId } = await supabase.rpc('get_user_id_by_email', { user_email: req.email });
  
  if (userId) {
    // حدّث users مع كل البيانات
    await supabase.from('users').upsert({
      id: userId,
      email: req.email,
      full_name: `${req.first_name} ${req.last_name}`,
      username: req.username,
      phone: req.phone,
      role: req.role || 'data_entry',
    });
  }

  // حدّث registration_requests
  await base44.entities.RegistrationRequest.update(req.id, {
    status: 'approved',
    role: req.role || 'data_entry',
  });

  toast({ description: `تم قبول طلب ${req.first_name} ${req.last_name} ✓` });
  fetchData();
};
  
  // تحديث users table
  const { supabase } = await import('@/api/base44Client');
  await supabase
    .from('users')
    .update({ role: req.role || 'data_entry', full_name: `${req.first_name} ${req.last_name}` })
    .eq('email', req.email);
  
  toast({ description: `تم قبول طلب ${req.first_name} ${req.last_name} ✓` });
  fetchData();
};

  const handleReject = (req) => {
    setConfirmReject({
      message: `هل تريد رفض طلب ${req.first_name} ${req.last_name}؟`,
      onConfirm: async () => {
        await base44.entities.RegistrationRequest.update(req.id, { status: 'rejected' });
        toast({ description: `تم رفض الطلب` });
        setConfirmReject(null);
        fetchData();
      },
    });
  };

  const handleRoleChange = async (req, role) => {
    await base44.entities.RegistrationRequest.update(req.id, { role });
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, role } : r));
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        titleAr="طلبات التسجيل"
        titleEn="Registration Requests"
        description={`${pendingCount} طلب في الانتظار`}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pending',  label: 'قيد الانتظار' },
          { key: 'approved', label: 'مقبولة' },
          { key: 'rejected', label: 'مرفوضة' },
          { key: 'all',      label: 'الكل' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
            style={filter === tab.key
              ? { backgroundColor: '#1B2B4B', color: '#fff', borderColor: '#1B2B4B' }
              : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }
            }
          >
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
        <div className="bg-white card-bevel rounded-xl p-16 text-center text-muted-foreground">
          لا توجد طلبات
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const sc = statusConfig[req.status] || statusConfig.pending;
            return (
              <div key={req.id} className="bg-white card-bevel rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base" style={{ color: '#1B2B4B' }}>
                        {req.first_name} {req.last_name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                      {req.status === 'approved' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                          {roleLabels[req.role] || req.role}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <AtSign size={13} /> <span className="truncate">{req.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={13} /> <span className="truncate">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={13} /> <span>{req.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={13} /> <span className="text-xs">{new Date(req.created_date).toLocaleDateString('ar-AE')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <MobileDrawerSelect
                        value={req.role || 'data_entry'}
                        onValueChange={v => handleRoleChange(req, v)}
                        options={ROLE_OPTIONS}
                        triggerClassName="w-36 h-9 text-xs"
                        dir="rtl"
                      />

                      <Button
                        size="sm"
                        onClick={() => handleApprove(req)}
                        className="gap-1.5 h-9 text-xs"
                        style={{ backgroundColor: '#2A9D8F' }}
                      >
                        <UserCheck size={14} /> قبول
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(req)}
                        className="gap-1.5 h-9 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <UserX size={14} /> رفض
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmReject}
        message={confirmReject?.message}
        onConfirm={confirmReject?.onConfirm}
        onCancel={() => setConfirmReject(null)}
      />
    </div>
  );
}
