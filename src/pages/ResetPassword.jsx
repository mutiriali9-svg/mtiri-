import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useLang } from "@/lib/LanguageContext";

export default function ResetPassword() {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || (isAr ? "تعذّرت إعادة تعيين كلمة المرور" : "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title={isAr ? "رابط إعادة التعيين غير صالح" : "Invalid reset link"}
        subtitle={isAr ? "رابط إعادة تعيين كلمة المرور ناقص أو غير صالح" : "This password reset link is missing or invalid"}
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            {isAr ? "طلب رابط جديد" : "Request a new link"}
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          {isAr ? "يبدو أن الرابط الذي استخدمته غير مكتمل. يرجى طلب رسالة جديدة لإعادة تعيين كلمة المرور." : "The link you used appears to be incomplete. Please request a new password reset email."}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title={isAr ? "كلمة مرور جديدة" : "New password"}
      subtitle={isAr ? "أدخل كلمة المرور الجديدة" : "Enter your new password below"}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{isAr ? "كلمة المرور الجديدة" : "New Password"}</Label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="ps-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{isAr ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="ps-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 me-2 animate-spin" />
              {isAr ? "جاري إعادة التعيين..." : "Resetting..."}
            </>
          ) : (
            isAr ? "إعادة تعيين كلمة المرور" : "Reset password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
