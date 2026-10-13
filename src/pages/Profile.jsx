import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { User, AtSign, Shield, ArrowRight, ArrowLeft, Phone, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { normalizeE164, isValidE164, phoneExampleFor, phoneInvalidText } from '@/utils/phone';
import { useLang } from '@/lib/LanguageContext';

const roleLabels = {
  admin: { ar: 'مالك', en: 'Owner' },
  investor: { ar: 'مستثمر', en: 'Investor' },
  data_entry: { ar: 'مدخل بيانات', en: 'Data Entry' },
};

export default function Profile() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isManualUser, setIsManualUser] = useState(false);

  // Username
  const [username, setUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('');

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
    setIsManualUser(session.user.app_metadata?.provider === 'email');
  };

  useEffect(() => { loadProfile(); }, []);

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

  const handleSavePhone = async () => {
    setSavingPhone(true);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('users').update({ phone }).eq('id', session.user.id);
    setProfile(prev => ({ ...prev, phone }));
    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2000);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(isAr ? 'يرجى تعبئة جميع الحقول' : 'Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(isAr ? 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' : 'The new password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(isAr ? 'كلمة المرور الجديدة غير متطابقة' : 'The new passwords do not match');
      return;
    }

    setPasswordSaving(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile?.email,
      password: oldPassword,
    });

    if (signInError) {
      setPasswordSaving(false);
      setPasswordError(isAr ? 'كلمة المرور الحالية غير صحيحة' : 'The current password is incorrect');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setPasswordSaving(false);

    if (updateError) {
      setPasswordError(isAr ? 'حدث خطأ أثناء تغيير كلمة المرور، حاول مرة أخرى' : 'An error occurred while changing the password. Please try again.');
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
    <div className="space-y-5 animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <BackIcon size={18} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الملف الشخصي' : 'Profile'}</h1>
      </div>

      <div className="bg-white card-bevel rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: '#1B2B4B', color: '#C9A84C' }}>
            {profile?.full_name?.[0] || (isAr ? 'م' : 'U')}
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{profile?.full_name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
              {roleLabels[profile?.role]?.[lang] || profile?.role}
            </span>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <User size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fullName')}</p>
              <p className="font-medium text-sm">{profile?.full_name || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Shield size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'الصلاحية' : 'Role'}</p>
              <p className="font-medium text-sm">{roleLabels[profile?.role]?.[lang] || profile?.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Mail size={16} className="text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'البريد الإلكتروني' : 'Email'}</p>
              <p className="font-medium text-sm" dir="ltr">{profile?.email || '—'}</p>
            </div>
          </div>

          {/* Username - editable */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <AtSign size={14} /> {isAr ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder={isAr ? 'اسم المستخدم' : 'Username'}
                autoComplete="username"
              />
              <button
                onClick={handleSaveUsername}
                disabled={savingUsername}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors min-w-[110px]"
                style={{ backgroundColor: usernameStatus === 'saved' ? '#2A9D8F' : '#1B2B4B' }}
              >
                {usernameStatus === 'saved'
                  ? (isAr ? '✓ تم' : '✓ Saved')
                  : usernameStatus === 'saving'
                  ? (isAr ? 'جاري التحديث...' : 'Updating...')
                  : t('save')}
              </button>
            </div>
          </div>

          {/* Phone - editable */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={14} /> {isAr ? 'رقم الهاتف' : 'Phone Number'}
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onBlur={() => { const e164 = normalizeE164(phone); if (e164 && e164 !== phone) setPhone(e164); }}
                className={`flex-1 px-3 py-2 rounded-xl border text-base sm:text-sm focus:outline-none ${phone.trim() && !isValidE164(phone) ? 'border-destructive' : 'border-border'}`}
                placeholder={phoneExampleFor()}
                dir="ltr"
                autoComplete="tel"
              />
              <button
                onClick={handleSavePhone}
                disabled={savingPhone}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors min-w-[80px]"
                style={{ backgroundColor: phoneSaved ? '#2A9D8F' : '#1B2B4B' }}
              >
                {phoneSaved ? '✓' : savingPhone ? '...' : t('save')}
              </button>
            </div>
            {phone.trim() && !isValidE164(phone) && (
              <p className="text-[11px] text-destructive">{phoneInvalidText(isAr)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Change password - manual users only */}
{isManualUser && user?.role === 'tester' && (
  <div className="bg-white card-bevel rounded-2xl p-6">
    <div className="flex items-center gap-3 p-4 rounded-xl"
      style={{ backgroundColor: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.2)' }}>
      <Lock size={16} style={{ color: '#E63946' }} />
      <p className="text-sm font-medium" style={{ color: '#E63946' }}>
        {isAr ? 'ليس لديك الصلاحية لتغيير كلمة المرور' : 'You do not have permission to change the password'}
      </p>
    </div>
  </div>
)}

{isManualUser && user?.role !== 'tester' && (
  <div className="bg-white card-bevel rounded-2xl p-6 space-y-4">
    <div className="flex items-center gap-2">
      <Lock size={16} style={{ color: '#1B2B4B' }} />
      <h2 className="font-bold text-base" style={{ color: '#1B2B4B' }}>{isAr ? 'تغيير كلمة المرور' : 'Change Password'}</h2>
    </div>

    <div className="space-y-3">
            {/* Hidden username field — tells browser/Google PM to use email not phone */}
            <input
              type="text"
              autoComplete="username"
              value={profile?.email || ''}
              readOnly
              aria-hidden="true"
              style={{ display: 'none' }}
            />

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{isAr ? 'كلمة المرور الحالية' : 'Current Password'}</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="••••••••"
                dir="ltr"
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="••••••••"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none"
                placeholder="••••••••"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords(prev => !prev)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPasswords ? (isAr ? 'إخفاء كلمات المرور' : 'Hide passwords') : (isAr ? 'إظهار كلمات المرور' : 'Show passwords')}
            </button>

            {passwordError && (
              <p className="text-xs font-medium" style={{ color: '#E63946' }}>{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-xs font-medium" style={{ color: '#2A9D8F' }}>{isAr ? '✓ تم تغيير كلمة المرور بنجاح' : '✓ Password changed successfully'}</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1B2B4B' }}
            >
              {passwordSaving ? (isAr ? 'جاري التحديث...' : 'Updating...') : (isAr ? 'تغيير كلمة المرور' : 'Change Password')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}