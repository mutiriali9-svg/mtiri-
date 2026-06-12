import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { User, AtSign, Shield, ArrowRight } from 'lucide-react';

const roleLabels = {
  admin: 'مالك',
  investor: 'مستثمر',
  data_entry: 'مدخل بيانات',
};

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setUsername(user.username || '');
  }, [user]);

  const handleSave = async () => {
    if (!username.trim()) return;
    setSaving(true);
    await supabase.from('users').update({ username }).eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fade-in-up" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowRight size={18} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>الملف الشخصي</h1>
      </div>

      <div className="bg-white card-bevel rounded-2xl p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: '#1B2B4B', color: '#C9A84C' }}>
            {user?.full_name?.[0] || 'م'}
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{user?.full_name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
              {roleLabels[user?.role] || user?.role}
            </span>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <User size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">الاسم الكامل</p>
              <p className="font-medium text-sm">{user?.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Shield size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">الصلاحية</p>
              <p className="font-medium text-sm">{roleLabels[user?.role] || user?.role}</p>
            </div>
          </div>

          {/* Username - Editable */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <AtSign size={14} /> اسم المستخدم
            </label>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2"
                style={{ focusRingColor: '#C9A84C' }}
                placeholder="اسم المستخدم"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: saved ? '#2A9D8F' : '#1B2B4B' }}
              >
                {saved ? '✓' : saving ? '...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}