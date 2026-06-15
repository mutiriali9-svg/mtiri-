import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { Shield, User, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const ROLES = [
  { value: 'admin',      label: 'Admin — مدير',           color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  { value: 'data_entry', label: 'Data Entry — مدخل بيانات', color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
  { value: 'investor',   label: 'Investor — مستثمر',       color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  { value: 'tester',     label: 'Tester — تجريبي',         color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
];

const roleConfig = Object.fromEntries(ROLES.map(r => [r.value, r]));

export default function Users() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState({});
  const { user: currentUser } = useAuth();
  const { toast }             = useToast();

  const isAdmin = currentUser?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const data = await base44.entities.User.list();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    setSaving(prev => ({ ...prev, [userId]: true }));
    try {
      await base44.entities.User.update(userId, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ description: 'تم تحديث الصلاحية ✓' });
    } catch {
      toast({ description: 'حدث خطأ، حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        titleAr="إدارة المستخدمين"
        titleEn="User Management"
        description={`${users.length} مستخدم`}
      />

      {/* Desktop Table */}
      <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#1B2B4B' }}>
              <tr>
                {['المستخدم', 'البريد الإلكتروني', 'الصلاحية'].map(h => (
                  <th key={h} className="text-right py-3 px-4 text-white/80 font-medium text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array(3).fill(0).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={3} className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون</td></tr>
              ) : users.map((u, i) => {
                const rc = roleConfig[u.role];
                return (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-surface transition-colors"
                    style={{ backgroundColor: i % 2 === 1 ? '#F8F9FA' : undefined }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'rgba(27,43,75,0.08)' }}>
                          <User size={14} style={{ color: '#1B2B4B' }} />
                        </div>
                        <span className="font-semibold" style={{ color: '#1B2B4B' }}>{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1">
                        <Mail size={12} />{u.email || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin && u.id !== currentUser?.id ? (
                        <div className="flex items-center gap-2">
                          <Select value={u.role || ''} onValueChange={v => handleRoleChange(u.id, v)} disabled={!!saving[u.id]}>
                            <SelectTrigger className="w-52 h-8 text-xs" style={{ borderColor: rc?.color, color: rc?.color }}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(r => (
                                <SelectItem key={r.value} value={r.value}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                                    {r.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {saving[u.id] && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                          {!saving[u.id] && u.role && <CheckCircle2 size={14} style={{ color: '#2A9D8F' }} />}
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: rc?.bg, color: rc?.color }}>
                          {rc?.label || u.role}
                        </span>
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
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-white card-bevel rounded-xl p-4">
              <div className="h-4 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            </div>
          ))
        ) : users.map(u => {
          const rc = roleConfig[u.role];
          return (
            <div key={u.id} className="bg-white card-bevel rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(27,43,75,0.08)' }}>
                    <User size={16} style={{ color: '#1B2B4B' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#1B2B4B' }}>{u.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{u.email || '—'}</p>
                  </div>
                </div>
                {(!isAdmin || u.id === currentUser?.id) && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: rc?.bg, color: rc?.color }}>
                    {rc?.label || u.role}
                  </span>
                )}
              </div>

              {isAdmin && u.id !== currentUser?.id && (
                <div className="flex items-center gap-2">
                  <Select value={u.role || ''} onValueChange={v => handleRoleChange(u.id, v)} disabled={!!saving[u.id]}>
                    <SelectTrigger className="flex-1 h-9 text-xs" style={{ borderColor: rc?.color, color: rc?.color }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                            {r.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {saving[u.id]
                    ? <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    : <CheckCircle2 size={16} style={{ color: '#2A9D8F' }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
