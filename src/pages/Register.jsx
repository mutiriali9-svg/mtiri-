import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, User, Phone, Globe, AtSign } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";

const t = {
  ar: {
    title: 'إنشاء حساب جديد',
    subtitle: 'أدخل بياناتك لإرسال طلب التسجيل',
    firstName: 'الاسم الأول',
    firstNamePh: 'مثال: محمد',
    lastName: 'اسم العائلة',
    lastNamePh: 'مثال: الكعبي',
    username: 'اسم المستخدم',
    usernamePh: 'مثال: m.alkaabi',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    phonePh: '+971 50 000 0000',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمتا المرور غير متطابقتين',
    createAccount: 'إرسال طلب التسجيل',
    creating: 'جاري الإرسال...',
    hasAccount: 'لديك حساب بالفعل؟',
    login: 'تسجيل الدخول',
    verifyTitle: 'تحقق من بريدك الإلكتروني',
    verifySubtitle: 'أرسلنا رمزاً إلى',
    verify: 'تحقق',
    verifying: 'جاري التحقق...',
    resend: 'إعادة الإرسال',
    noCode: 'لم تستلم الرمز؟',
    or: 'أو',
    continueGoogle: 'المتابعة مع Google',
    language: 'English',
    nameExists: 'هذا الاسم مسجّل بالفعل، يرجى استخدام اسم مختلف',
    usernameExists: 'اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر',
    emailExists: 'هذا البريد الإلكتروني مسجّل بالفعل',
    requestSent: 'تم إرسال طلبك بنجاح! سيتم مراجعته من قِبل المسؤول.',
    fillAll: 'يرجى ملء جميع الحقول المطلوبة',
  },
  en: {
    title: 'Create your account',
    subtitle: 'Enter your details to send a registration request',
    firstName: 'First Name',
    firstNamePh: 'e.g. Mohammed',
    lastName: 'Last Name',
    lastNamePh: 'e.g. Al Kaabi',
    username: 'Username',
    usernamePh: 'e.g. m.alkaabi',
    email: 'Email',
    phone: 'Phone Number',
    phonePh: '+971 50 000 0000',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    passwordMismatch: 'Passwords do not match',
    createAccount: 'Send Registration Request',
    creating: 'Sending...',
    hasAccount: 'Already have an account?',
    login: 'Log in',
    verifyTitle: 'Verify your email',
    verifySubtitle: 'We sent a code to',
    verify: 'Verify',
    verifying: 'Verifying...',
    resend: 'Resend',
    noCode: "Didn't receive the code?",
    or: 'or',
    continueGoogle: 'Continue with Google',
    language: 'عربي',
    nameExists: 'This name is already registered, please use a different name',
    usernameExists: 'This username is already taken, please choose another',
    emailExists: 'This email is already registered',
    requestSent: 'Your request was sent successfully! It will be reviewed by the admin.',
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
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [success, setSuccess] = useState(false);

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
      setError(tx.fillAll);
      return;
    }
    if (password !== confirmPassword) {
      setError(tx.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      // Check for duplicates in existing requests
      const existing = await base44.entities.RegistrationRequest.list();

      const fullName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
      const nameDup = existing.find(r =>
        `${r.first_name} ${r.last_name}`.toLowerCase() === fullName
      );
      if (nameDup) { setError(tx.nameExists); setLoading(false); return; }

      const userDup = existing.find(r =>
        r.username?.toLowerCase() === username.trim().toLowerCase()
      );
      if (userDup) { setError(tx.usernameExists); setLoading(false); return; }

      const emailDup = existing.find(r =>
        r.email?.toLowerCase() === email.trim().toLowerCase()
      );
      if (emailDup) { setError(tx.emailExists); setLoading(false); return; }

      // Save registration request
      await base44.entities.RegistrationRequest.create({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status: 'pending',
      });

      // Also register in auth system
      await base44.auth.register({
        email: email.trim(),
        password,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim(),
      });

      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: isRtl ? "تم الإرسال" : "Code sent", description: isRtl ? "تحقق من بريدك الإلكتروني" : "Check your email." });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth/callback" } }); if (error) setError(error.message);
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title={tx.verifyTitle} subtitle={`${tx.verifySubtitle} ${email}`}>
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{tx.verifying}</> : tx.verify}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {tx.noCode}{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">{tx.resend}</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title={tx.title}
      subtitle={tx.subtitle}
      footer={<>{tx.hasAccount}{" "}<Link to="/login" className="text-primary font-medium hover:underline">{tx.login}</Link></>}
    >
      {/* Language Toggle */}
      <div className="flex justify-end mb-4">
        <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Globe className="w-4 h-4" />
          {tx.language}
        </button>
      </div>

      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        {tx.continueGoogle}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{tx.or}</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">{tx.firstName} *</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="firstName" type="text" placeholder={tx.firstNamePh}
                value={firstName} onChange={e => setFirstName(e.target.value)}
                className="pr-10 h-12" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{tx.lastName} *</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="lastName" type="text" placeholder={tx.lastNamePh}
                value={lastName} onChange={e => setLastName(e.target.value)}
                className="pr-10 h-12" required />
            </div>
          </div>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">{tx.username} *</Label>
          <div className="relative">
            <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="username" type="text" placeholder={tx.usernamePh}
              value={username} onChange={e => setUsername(e.target.value)}
              className="pr-10 h-12" required />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{tx.email} *</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="pr-10 h-12" required />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">{tx.phone} *</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="phone" type="tel" placeholder={tx.phonePh}
              value={phone} onChange={e => setPhone(e.target.value)}
              className="pr-10 h-12" required />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">{tx.password} *</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              className="pr-10 h-12" required />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirm">{tx.confirmPassword} *</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="pr-10 h-12" required />
          </div>
        </div>

        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}
          style={{ backgroundColor: '#1B2B4B' }}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{tx.creating}</> : tx.createAccount}
        </Button>
      </form>
    </AuthLayout>
  );
}
