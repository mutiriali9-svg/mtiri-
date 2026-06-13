import { Globe, CheckCircle2, Loader2, User, Phone, AtSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import { t_data } from '@/lib/LanguageContext';
import { base44, uploadFile } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UserNotRegisteredError() {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ar');
  const t = (key) => t_data[lang]?.[key] ?? key;
  const isRtl = lang === 'ar';

  const [userEmail, setUserEmail] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const toggleLang = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('app_lang', newLang);
    setLang(newLang);
  };

  // Try to get logged-in user's email from base44
  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) setUserEmail(u.email);
      if (u?.full_name) {
        const parts = u.full_name.split(' ');
        setForm(f => ({
          ...f,
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' ') || '',
        }));
      }
    }).catch(() => {});
  }, []);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { first_name, last_name, username, phone } = form;
    if (!first_name.trim() || !last_name.trim() || !username.trim() || !phone.trim()) {
      setError(isRtl ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      // Check for duplicate email or username
      const existing = await base44.entities.RegistrationRequest.list();
      if (existing.find(r => r.email?.toLowerCase() === userEmail.toLowerCase())) {
        setError(isRtl ? 'طلبك مُسجَّل مسبقاً، انتظر موافقة المسؤول' : 'Request already submitted. Awaiting admin approval.');
        setLoading(false);
        return;
      }
      await base44.entities.RegistrationRequest.create({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        username: username.trim(),
        email: userEmail,
        phone: phone.trim(),
        status: 'pending',
      });
      // Notify admin via email
      try {
        await base44.functions.invoke('notifyAdminNewRequest', {
          name: `${first_name.trim()} ${last_name.trim()}`,
          email: userEmail,
        });
      } catch (_) {}
      setSuccess(true);
    } catch (err) {
      setError(err.message || (isRtl ? 'حدث خطأ، حاول مرة أخرى' : 'An error occurred, please try again'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-lg border border-slate-100 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(42,157,143,0.12)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: '#2A9D8F' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1B2B4B' }}>
            {isRtl ? 'تم إرسال طلبك!' : 'Request Submitted!'}
          </h2>
          <p className="text-muted-foreground text-sm mb-4">
            {isRtl
              ? 'سيراجع المسؤول طلبك وستصلك دعوة على بريدك الإلكتروني عند القبول.'
              : 'The admin will review your request and you will receive an email invitation upon approval.'}
          </p>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
          <button
            onClick={() => base44.auth.logout()}
            className="mt-6 text-sm text-slate-500 underline"
          >
            {isRtl ? 'تسجيل الخروج' : 'Logout'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 py-10" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-lg border border-slate-100 relative">
        {/* Language Toggle */}
        <button
          onClick={toggleLang}
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <Globe size={14} />
          {lang === 'ar' ? 'English' : 'عربي'}
        </button>

        <div className="text-center mb-6">
          <span className="text-2xl font-bold block mb-1" style={{ color: '#C9A84C' }}>
            {isRtl ? 'المطيري' : 'Al-Mutairi'}
          </span>
          <h1 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>
            {isRtl ? 'طلب الوصول للنظام' : 'Request Access'}
          </h1>
          {userEmail && (
            <p className="text-xs text-muted-foreground mt-1">
              {isRtl ? 'مسجّل بـ' : 'Logged in as'} <span className="font-medium">{userEmail}</span>
            </p>
          )}
        </div>

        {!showForm ? (
          <div className="space-y-4 text-center">
            <p className="text-slate-600 text-sm">
              {isRtl
                ? 'حسابك غير مسجّل في النظام. أرسل طلب وصول وسيتم إشعار المسؤول.'
                : 'Your account is not registered. Submit a request and the admin will be notified.'}
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="w-full h-11"
              style={{ backgroundColor: '#1B2B4B' }}
            >
              {isRtl ? 'إرسال طلب وصول' : 'Submit Access Request'}
            </Button>
            <button
              onClick={() => base44.auth.logout()}
              className="text-sm text-slate-400 underline"
            >
              {isRtl ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isRtl ? 'الاسم الأول *' : 'First Name *'}</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={form.first_name} onChange={set('first_name')} className="pr-9 h-10" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{isRtl ? 'اسم العائلة *' : 'Last Name *'}</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={form.last_name} onChange={set('last_name')} className="pr-9 h-10" required />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? 'اسم المستخدم *' : 'Username *'}</Label>
              <div className="relative">
                <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={form.username} onChange={set('username')} className="pr-9 h-10" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? 'رقم الهاتف *' : 'Phone *'}</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="tel" value={form.phone} onChange={set('phone')} placeholder="+971 50 000 0000" className="pr-9 h-10" required />
              </div>
            </div>
            <div className="pt-1 space-y-2">
              <Button type="submit" className="w-full h-11" disabled={loading} style={{ backgroundColor: '#1B2B4B' }}>
                {loading
                  ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{isRtl ? 'جاري الإرسال...' : 'Sending...'}</>
                  : (isRtl ? 'إرسال الطلب' : 'Submit Request')}
              </Button>
              <button type="button" onClick={() => setShowForm(false)} className="w-full text-sm text-slate-400 underline">
                {isRtl ? 'رجوع' : 'Back'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}