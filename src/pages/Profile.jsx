import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { User, AtSign, Shield, ArrowRight, Phone, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const roleLabels = {
  admin: 'مالك',
  investor: 'مستثمر',
  data_entry: 'مدخل بيانات',
};

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isManualUser, setIsManualUser] = useState(false);

  // Username
  const [username, setUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(''); // '', 'saving', 'saved'

  // Phone
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) {
      setProfile(data);
      setUsername(data.username || '');
      setPhone(data.phone || '');
    }
    // Determine if user registered manually (email/password) vs OAuth
    setIsManualUser(session.user.app_metadata?.provider === 'email');
  };

  useEffect(() => { loadProfile(); }, []);

  // 1) Save username -> show updating message then refresh page
  const handleSaveUsername = async () => {
    if (!username.trim()) return;
    setSavingUsername(true);
    setUsernameStatus('saving');
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('users').update({ username }).eq('id', session.user.id);
    setUsernameStatus('saved');
    setTimeout(() => {
      window.location.reload();
    }, 900);
  };

  // 3) Save phone number
  const handleSavePhone = async () => {
    setSavingPhone(true);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('users').update({ phone }).eq('id', session.user.id);
    setProfile(prev => ({ ...prev, phone }));
    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2000);
  };

  // 4) Change password (manual users only)
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('يرجى تعبئة جميع الحقول');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    setPasswordSaving(true);

    // Verify old password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile?.email,
      password: oldPassword,
    });

    if (signInError) {
      setPasswordSaving(false);
      setPasswordError('كلمة المرور الحالية غير صحيحة');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setPasswordSaving(false);

    if (updateError) {
      setPasswordError('حدث خطأ أثناء تغيير كلمة المرور، حاول مرة أخرى');
      return;
    }

    setPasswordSuccess(true);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  if (!profile) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in-up" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowRight size={18} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>الملف الشخصي</h1>
      </div>

      <div className="bg-white card-bevel rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: '#1B2B4B', color: '#C9A84C' }}>
            {profile?.full_name?.[0] || 'م'}
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{profile?.full_name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
              {roleLabels[profile?.role] || profile?.role}
            </span>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <User size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">الاسم الكامل</p>
              <p className="font-medium text-sm">{profile?.full_name || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Shield size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">الصلاحية</p>
              <p className="font-medium text-sm">{roleLabels[profile?.role] || profile?.role}</p>
            </div>
          </div>

          {/* 2) Email - read only */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Mail size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
              <p className="font-medium text-sm" dir="ltr">{profile?.email || '—'}</p>
            </div>
          </div>

          {/* 1) Username - editable */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <AtSign size={14} /> اسم المستخدم
            </label>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="اسم المستخدم"
              />
              <button
                onClick={handleSaveUsername}
                disabled={savingUsername}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors min-w-[110px]"
                style={{ backgroundColor: usernameStatus === 'saved' ? '#2A9D8F' : '#1B2B4B' }}
              >
                {usernameStatus === 'saved'
                  ? '✓ تم'
                  : usernameStatus === 'saving'
                  ? 'جاري التحديث...'
                  : 'حفظ'}
              </button>
            </div>
          </div>

          {/* 3) Phone - editable */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={14} /> رقم الهاتف
            </label>
            <div className="flex gap-2">
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="رقم الهاتف"
                dir="ltr"
              />
              <button
                onClick={handleSavePhone}
                disabled={savingPhone}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors min-w-[80px]"
                style={{ backgroundColor: phoneSaved ? '#2A9D8F' : '#1B2B4B' }}
              >
                {phoneSaved ? '✓' : savingPhone ? '...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4) Change password - manual users only */}
      {isManualUser && (
        <div className="bg-white card-bevel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={16} style={{ color: '#1B2B4B' }} />
            <h2 className="font-bold text-base" style={{ color: '#1B2B4B' }}>تغيير كلمة المرور</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">كلمة المرور الحالية</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">كلمة المرور الجديدة</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">تأكيد كلمة المرور الجديدة</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords(prev => !prev)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPasswords ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}
            </button>

            {passwordError && (
              <p className="text-xs font-medium" style={{ color: '#E63946' }}>{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-xs font-medium" style={{ color: '#2A9D8F' }}>✓ تم تغيير كلمة المرور بنجاح</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1B2B4B' }}
            >
              {passwordSaving ? 'جاري التحديث...' : 'تغيير كلمة المرور'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}