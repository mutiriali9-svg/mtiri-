import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { LogIn, Mail, Lock, Loader2, Globe } from "lucide-react";
import { useLang } from "@/lib/LanguageContext";

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://www.mteiri-bm.com';

const inputStyle = {
  color: '#EEF2F8',
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderColor: 'rgba(255,255,255,0.1)',
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { lang, setLang } = useLang();
  const isAr = lang === 'ar';

  const toggleLang = () => {
    setLang(isAr ? 'en' : 'ar');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { persistSession: rememberMe },
      });
      if (error) throw error;
      window.location.href = "/";
    } catch (err) {
      setError(err.message || (isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: APP_URL + "/auth/callback" },
    });
    if (error) setError(error.message);
  };

  return (
    <AuthLayout
      icon={LogIn}
      title={isAr ? 'مرحباً بك' : 'Welcome back'}
      subtitle={isAr ? 'سجّل دخولك' : 'Log in to your account'}
      footer={
        <>
          {isAr ? 'ليس لديك حساب؟' : "Don't have an account?"}{" "}
          <Link
            to="/register"
            className="inline-block px-4 py-1.5 rounded-full border border-blue-400 text-blue-400 text-sm font-medium hover:bg-blue-400/10 transition-colors"
          >
            {isAr ? 'تسجيل حساب جديد' : 'Register new account'}
          </Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 me-2" />
        {isAr ? 'المتابعة مع Google' : 'Continue with Google'}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{isAr ? 'أو' : 'or'}</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" style={{ color: '#AEB8C9' }}>{isAr ? 'البريد الإلكتروني' : 'Email'}</Label>
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="ps-10 h-12" style={inputStyle} required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" style={{ color: '#AEB8C9' }}>{isAr ? 'كلمة المرور' : 'Password'}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="ps-10 h-12" style={inputStyle} required />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-border cursor-pointer accent-[#C9A84C]"
          />
          <Label htmlFor="remember" className="text-sm cursor-pointer" style={{ color: '#AEB8C9' }}>
            {isAr ? 'تذكرني' : 'Remember me'}
          </Label>
        </div>

        <Button type="submit" className="w-full h-12 font-medium" disabled={loading} style={{ backgroundColor: '#C9A84C', color: '#1B2B4B' }}>
          {loading
            ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{isAr ? 'جاري الدخول...' : 'Logging in...'}</>
            : (isAr ? 'تسجيل الدخول' : 'Log in')}
        </Button>
      </form>

      <div className="flex justify-center mt-4">
        <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Globe className="w-4 h-4" />
          {isAr ? 'English' : 'عربي'}
        </button>
      </div>
    </AuthLayout>
  );
}