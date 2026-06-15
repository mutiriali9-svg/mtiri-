import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, User, Phone, Globe, AtSign } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { LogIn, Mail, Lock, Loader2, Globe } from "lucide-react";

const APP_URL = 'https://www.mteiri-bm.com';

const t = {
  ar: {
    title: 'إنشاء حساب جديد',
    subtitle: 'أدخل بياناتك لإرسال طلب التسجيل',
    firstName: 'الاسم الأول', firstNamePh: 'مثال: علي',
    lastName: 'اسم العائلة', lastNamePh: 'مثال: المطيري',
    username: 'اسم المستخدم', usernamePh: 'مثال: A.mteiri',
    email: 'البريد الإلكتروني', phone: 'رقم الهاتف', phonePh: '+971 50 000 0000',
    password: 'كلمة المرور', confirmPassword: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمتا المرور غير متطابقتين',
    createAccount: 'إرسال طلب التسجيل', creating: 'جاري الإرسال...',
    hasAccount: 'لديك حساب بالفعل؟', login: 'تسجيل الدخول',
    or: 'أو', continueGoogle: 'المتابعة مع Google', language: 'English',
    fillAll: 'يرجى ملء جميع الحقول المطلوبة',
  },
  en: {
    title: 'Create your account', subtitle: 'Enter your details to send a registration request',
    firstName: 'First Name', firstNamePh: 'e.g. Mohammed',
    lastName: 'Last Name', lastNamePh: 'e.g. Al Kaabi',
    username: 'Username', usernamePh: 'e.g. m.alkaabi',
    email: 'Email', phone: 'Phone Number', phonePh: '+971 50 000 0000',
    password: 'Password', confirmPassword: 'Confirm Password',
    passwordMismatch: 'Passwords do not match',
    createAccount: 'Send Registration Request', creating: 'Sending...',
    hasAccount: 'Already have an account?', login: 'Log in',
    or: 'or', continueGoogle: 'Continue with Google', language: 'عربي',
    fillAll: 'Please fill all required fields',
  }
};

export default function Register() {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ar');
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const tx = t[lang];
  const isRtl = lang === 'ar';

  const toggleLang = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !phone.trim() || !password) {
      setError(tx.fillAll); return;
    }
    if (password !== confirmPassword) {
      setError(tx.passwordMismatch); return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: `${firstName.trim()} ${lastName.trim()}` } }
      });
      if (signUpError) throw signUpError;

      await supabase.from('registration_requests').insert({
        first_name: firstName.trim(), last_name: lastName.trim(),
        username: username.trim(), email: email.trim(),
        phone: phone.trim(), status: 'pending', role: 'data_entry',
      });

      if (data.user) {
        await supabase.from('users').upsert({
          id: data.user.id, email: email.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          username: username.trim(), phone: phone.trim(), role: 'pending',
        });
      }
      window.location.href = '/pending-approval';
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: APP_URL + "/auth/callback" }
    });
    if (error) setError(error.message);
  };

  return (
    <AuthLayout icon={UserPlus} title={tx.title} subtitle={tx.subtitle}
      footer={<>{tx.hasAccount}{" "}<Link to="/login" className="text-primary font-medium hover:underline">{tx.login}</Link></>}>
      <div className="flex justify-end mb-4">
        <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Globe className="w-4 h-4" />{tx.language}
        </button>
      </div>
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />{tx.continueGoogle}
      </Button>
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{tx.or}</span>
        </div>
      </div>
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{tx.firstName} *</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder={tx.firstNamePh} value={firstName} onChange={e => setFirstName(e.target.value)} className="pr-10 h-12" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tx.lastName} *</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder={tx.lastNamePh} value={lastName} onChange={e => setLastName(e.target.value)} className="pr-10 h-12" required />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tx.username} *</Label>
          <div className="relative">
            <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="text" placeholder={tx.usernamePh} value={username} onChange={e => setUsername(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tx.email} *</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tx.phone} *</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="tel" autoComplete="tel" placeholder={tx.phonePh} value={phone} onChange={e => setPhone(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tx.password} *</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tx.confirmPassword} *</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium text-base text-white" disabled={loading} style={{ backgroundColor: '#1B2B4B' }}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{tx.creating}</> : tx.createAccount}
        </Button>
      </form>
    </AuthLayout>
  );
}