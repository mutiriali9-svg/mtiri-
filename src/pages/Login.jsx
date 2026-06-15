import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { LogIn, Mail, Lock, Loader2, Globe } from "lucide-react";


const APP_URL = 'https://www.mteiri-bm.com';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [currentLang, setCurrentLang] = useState(localStorage.getItem('app_lang') || 'ar');

  const toggleLang = () => {
    const newLang = currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('app_lang', newLang);
    setCurrentLang(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    window.location.reload();
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
      setError(err.message || "Invalid email or password");
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
      title={currentLang === 'ar' ? 'مرحباً بك' : 'Welcome back'}
      subtitle={currentLang === 'ar' ? 'سجّل دخولك' : 'Log in to your account'}
      footer={
        <>
          {currentLang === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}{" "}
          <Link
            to="/register"
            className="inline-block px-4 py-1.5 rounded-full border border-blue-400 text-blue-400 text-sm font-medium hover:bg-blue-400/10 transition-colors"
          >
            {currentLang === 'ar' ? 'تسجيل حساب جديد' : 'Register new account'}
          </Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        {currentLang === 'ar' ? 'المتابعة مع Google' : 'Continue with Google'}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{currentLang === 'ar' ? 'أو' : 'or'}</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{currentLang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{currentLang === 'ar' ? 'كلمة المرور' : 'Password'}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {currentLang === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-border cursor-pointer accent-[#C9A84C]"
          />
          <Label htmlFor="remember" className="text-sm cursor-pointer">
            {currentLang === 'ar' ? 'تذكرني' : 'Remember me'}
          </Label>
        </div>

        <Button type="submit" className="w-full h-12 font-medium" disabled={loading} style={{ backgroundColor: '#C9A84C', color: '#1B2B4B' }}>
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{currentLang === 'ar' ? 'جاري الدخول...' : 'Logging in...'}</>
            : (currentLang === 'ar' ? 'تسجيل الدخول' : 'Log in')}
        </Button>
      </form>

      <div className="flex justify-center mt-4">
        <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Globe className="w-4 h-4" />
          {currentLang === 'en' ? 'عربي' : 'English'}
        </button>
      </div>
    </AuthLayout>
  );
}